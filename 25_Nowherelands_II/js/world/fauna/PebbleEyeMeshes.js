import { pebbleLighting, setPebbleLight } from './PebbleLighting.js';
import * as THREE from 'three';
import { terrainLightGlsl } from '../TerrainMaterial.js';
import { fogGlsl } from '../FogGlsl.js';

const SEGMENTS = 7;
function material(shared, color, neutralWhite = false) {
	const world = !!shared.terrainUniforms && !neutralWhite;
	const uniforms = { uColor: { value: new THREE.Color(color) }, uMoonDir: { value: shared.moon.dir }, uMoon: { value: shared.moon.intensity }, ...shared.fogUniforms };
	if (world) {
		for (const key of ['uMoonDir', 'uMoonColor', 'uMoonIntensity', 'uSunDir', 'uSunColor', 'uSunIntensity', 'uSkyColor', 'uGroundColor']) uniforms[key] = shared.terrainUniforms[key];
		uniforms.uLightning = shared.weather.uniforms.uLightning;
	}
	return new THREE.ShaderMaterial({ uniforms,
		vertexShader: `varying vec3 vWorldPos; varying vec3 vNormal;
		void main(){mat4 m=modelMatrix*instanceMatrix;vec4 p=m*vec4(position,1.0);vWorldPos=p.xyz;
		mat3 basis=mat3(m);vNormal=normalize(basis*(normal/vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]))));
		gl_Position=projectionMatrix*viewMatrix*p;}`,
		fragmentShader: `varying vec3 vWorldPos; varying vec3 vNormal; uniform vec3 uColor; uniform vec3 uMoonDir; uniform float uMoon; ${fogGlsl}
		${world ? `uniform float uMoonIntensity, uSunIntensity, uLightning; uniform vec3 uMoonColor, uSunDir, uSunColor, uSkyColor, uGroundColor; ${terrainLightGlsl}` : ''}
		void main(){vec3 n=normalize(vNormal);float light=max(0.0,dot(n,uMoonDir));
		vec3 col=${neutralWhite ? 'vec3(.58+.10*max(0.0,dot(n,normalize(vec3(.3,1.0,.5)))))' : world ? 'terrainLight(uColor,n)' : 'uColor*(.55+light*uMoon*.45)'};
		vec3 fogged=applyFog(col,vWorldPos,cameraPosition);
		${neutralWhite ? 'fogged=vec3(min(.68,dot(fogged,vec3(.2126,.7152,.0722))));' : ''}
		gl_FragColor=vec4(fogged,1.0);}` });
}

// Curved stalks and directional pupils share the shell's interpolated transform.
// Ordinary habitat stones never enter this renderer.
export class PebbleEyeMeshes {
	constructor(root, shared, capacity) {
		const add = (name, geometry, color, count) => {
			const mesh = new THREE.InstancedMesh(geometry, material(shared, color, name === 'pebble-eyes'), count);
			mesh.name = name; mesh.count = 0; mesh.frustumCulled = false;
			mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh); return mesh;
		};
		this.stalks = add('pebble-eye-stalks', new THREE.CylinderGeometry(0.96, 1.04, 1, 8), '#777077', capacity * 2 * SEGMENTS);
		pebbleLighting(this.stalks, shared, 'uColor', 'n');
		this.bulbs = add('pebble-eyes', new THREE.SphereGeometry(1, 12, 8), '#ffffff', capacity * 2);
		this.pupils = add('pebble-pupils', new THREE.SphereGeometry(1, 12, 8), '#191720', capacity * 2);
		this.pose = new THREE.Object3D(); this.up = new THREE.Vector3(0, 1, 0);
		this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.direction = new THREE.Vector3();
		this.curve = new THREE.CubicBezierCurve3(); this.gaze = new THREE.Vector3();
		this.motion = new Map(); this.stemUp = new THREE.Vector3(); this.goal = new THREE.Vector3();
	}
	begin() { this.count = 0; this.segments = 0; this.active = new Set(); }
	update(c, matrix, alpha, size, time, viewer, floor) {
		const lerp = (a, b) => a + (b - a) * alpha;
		this.active.add(c);
		let motion = this.motion.get(c);
		if (!motion) { motion = []; this.motion.set(c, motion); }
		for (let j = 0; j < 2; j++) {
			const e = c.pebble.eyes[j], side = j ? 1 : -1;
			const extension = lerp(e.prevExtension, e.extension), yaw = lerp(e.prevYaw, e.yaw), proximity = lerp(e.prevProximity, e.proximity);
			const fleeing = 1 - Math.min(1, extension / 0.4);
			// Grass reaches 6.5 world units. Raised eyes clear it even on small animals.
			const rise = Math.min(1, extension / 0.4), unfold = rise * rise * (3 - 2 * rise);
			const escape = lerp(e.prevEscape ?? 0,e.escape ?? 0);
			const distanceHeight = (7.2 + (2.2 - 7.2) * proximity * (1-escape)) * (e.lengthScale ?? 1);
			let height = Math.max(.35, 0.35 + unfold * ((distanceHeight + lerp(e.prevLift ?? 0,e.lift ?? 0)) / size + extension * 1.1));
			const clearance = c.group.sample?.(c.pos.x, c.pos.z).clearance ?? Infinity;
			height = Math.min(height, Math.max(0.4, (clearance - (c.pos.y - c.ground)) / size - 1.1));
			// Match the rigid shell's individual X/Z proportions and upper shear.
			const baseX = 0.02 + Math.sin(c.phase * 3.7) * 0.035;
			const baseZ = side * 0.43 * (1 + Math.cos(c.phase * 1.7) * 0.12);
			const sway = Math.sin(time * 1.3 + e.phase) * (0.08 + (1 - proximity) * 0.18) * unfold;
			const reach = 0.1 + extension * 0.3;
			const x = Math.cos(yaw) * reach - fleeing * 0.21, z = Math.sin(yaw) * reach + side * (0.12 + extension * 0.22) + sway;
			// The root follows the shell, but the head stays upright in world space.
			// A damped spring absorbs gait jolts rather than magnifying shell banking.
			this.curve.v0.set(baseX, 0.52, baseZ).applyMatrix4(matrix);
			this.goal.set(baseX + x, 0.52, baseZ + z).applyMatrix4(matrix);
			// Keep the eyes above the stream while the shell and legs paddle below it.
   const waterEye = floor?.cave && floor.water > floor.ground ? floor.water + .5 * size : -Infinity;
   height = Math.max(height, (waterEye - this.curve.v0.y) / size);
   this.goal.y = this.curve.v0.y + height * size;
			let spring = motion[j], dt = spring ? time - spring.time : 0;
			if (!spring || ![spring.head.x, spring.head.y, spring.head.z, spring.velocity.x, spring.velocity.y, spring.velocity.z].every(Number.isFinite) || dt < 0 || dt > 0.25) {
				spring = motion[j] = { head: this.goal.clone(), velocity: new THREE.Vector3(), time };
			} else if (dt > 0) {
				const frequency = 22 + fleeing * 8, decay = Math.exp(-frequency * dt);
				for (const axis of ['x', 'y', 'z']) {
					const offset = spring.head[axis] - this.goal[axis], impulse = spring.velocity[axis] + frequency * offset;
					spring.head[axis] = this.goal[axis] + (offset + impulse * dt) * decay;
					spring.velocity[axis] = (spring.velocity[axis] - frequency * impulse * dt) * decay;
				}
				// Keep fast escape inertia inside a plausible flexible-stalk envelope.
				this.direction.subVectors(spring.head, this.goal);
				const limit = Math.max(0.25 * size, height * size * 0.3);
				if (this.direction.length() > limit) spring.head.copy(this.goal).add(this.direction.setLength(limit));
				spring.head.y = Math.max(this.curve.v0.y + 0.3 * size, Math.min(spring.head.y, this.curve.v0.y + height * size + 0.12 * size));
			}
			spring.head.y = Math.max(spring.head.y, waterEye);
			spring.time = time;
			this.curve.v3.copy(spring.head);
			this.stemUp.set(0, 1, 0).transformDirection(matrix);
			this.curve.v1.copy(this.curve.v0).addScaledVector(this.stemUp, height * size * 0.36);
			this.curve.v1.x += (spring.head.x - this.curve.v0.x) * 0.18;
			this.curve.v1.z += (spring.head.z - this.curve.v0.z) * 0.18;
			this.curve.v2.copy(spring.head); this.curve.v2.y -= height * size * 0.28;
			this.curve.v2.x += (spring.head.x - this.goal.x) * 0.35;
			this.curve.v2.z += (spring.head.z - this.goal.z) * 0.35;
			// A relaxed outward bow reads as soft tissue even between footsteps.
			this.direction.set(0, 0, side).transformDirection(matrix);
			const bow = Math.min(height * size * 0.22, 1.5 * size) * unfold;
			this.curve.v1.addScaledVector(this.direction, bow);
			this.curve.v2.addScaledVector(this.direction, bow * 0.35);
			this.curve.getPoint(0, this.a);
			for (let k = 1; k <= SEGMENTS; k++) {
				this.curve.getPoint(k / SEGMENTS, this.b);
				this.direction.subVectors(this.b, this.a); const length = this.direction.length();
				this.pose.position.copy(this.a).add(this.b).multiplyScalar(0.5);
				this.pose.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
				const radius = (0.075 - k / SEGMENTS * 0.025) * size;
				this.pose.scale.set(radius, length + size * 0.009, radius); this.pose.updateMatrix();
				setPebbleLight(this.stalks, this.segments, floor);
				this.stalks.setMatrixAt(this.segments++, this.pose.matrix); this.a.copy(this.b);
			}
			// Keep the existing eyeball size while the rocky body grows.
			const radius = (0.45 + extension * 0.075) * size / 1.2 * (e.radiusScale ?? 1);
   const openness = Math.max(.025,1-lerp(e.prevBlink ?? 0,e.blink ?? 0));
			this.pose.position.copy(this.b); this.pose.quaternion.identity(); this.pose.scale.set(radius,radius*openness,radius); this.pose.updateMatrix();
			this.bulbs.setMatrixAt(this.count, this.pose.matrix);
			// Aim from each actual eye center, including stalk height, shell tilt and sway.
			this.gaze.set(viewer.x, viewer.y, viewer.z).sub(this.b).normalize();
			this.pose.position.copy(this.b).addScaledVector(this.gaze, radius * 0.86);
			const pupil = radius * (0.4 + lerp(e.prevDilation, e.dilation) * 0.38);
			this.pose.quaternion.setFromUnitVectors(this.up, this.gaze); this.pose.scale.set(pupil, radius * 0.24, pupil); this.pose.updateMatrix();
			// Compress the pupil along world-up with its eyeball, regardless of gaze.
   this.pose.matrix.elements[13]=this.b.y+(this.pose.matrix.elements[13]-this.b.y)*openness;
   for(const row of [1,5,9])this.pose.matrix.elements[row]*=openness;
			this.pupils.setMatrixAt(this.count++, this.pose.matrix);
		}
	}
	finish() {
		for (const c of this.motion.keys()) if (!this.active.has(c)) this.motion.delete(c);
		this.stalks.geometry.attributes.aCaveLight.needsUpdate = true;
		this.stalks.count = this.segments; this.bulbs.count = this.pupils.count = this.count;
		for (const mesh of [this.stalks, this.bulbs, this.pupils]) mesh.instanceMatrix.needsUpdate = true;
	}
}
