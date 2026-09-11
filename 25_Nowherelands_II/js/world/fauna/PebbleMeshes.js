import {replyOutline} from './ReplyOutline.js?v=player-notes-13';
import { pebbleLighting, setPebbleLight } from './PebbleLighting.js';
import * as THREE from 'three';
import { createRockMaterial, noiseGlsl } from '../TerrainMaterial.js?v=player-notes-13';
import { fogGlsl } from '../FogGlsl.js';
import { faunaGeometry } from './FaunaGeometry.js';
import { faunaDeformation } from './FaunaDeformation.js';
import { solveLeg, SPECIES, PEBBLE_DRAW_DISTANCE } from './FaunaModel.js?v=player-notes-13';
import { PebbleEyeMeshes } from './PebbleEyeMeshes.js?v=player-notes-13';
import { clamp, smooth } from './Locomotion.js';

// Bodies share the scenery's rock lighting; legs retain their darker palette.
function stoneMaterial(shared, neutral = false, leg = false) {
 if (!neutral && shared.terrainUniforms && shared.shoreMap && shared.weather) return createRockMaterial(shared, shared.terrainUniforms);
 return new THREE.ShaderMaterial({ uniforms: { ...shared.fogUniforms, uMoonDir: { value: shared.moon.dir }, uMoon: { value: shared.moon.intensity } },
  vertexShader: `varying vec3 vWorldPos; void main(){vec4 p=modelMatrix*instanceMatrix*vec4(position,1.0);vWorldPos=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
  fragmentShader: `varying vec3 vWorldPos; uniform vec3 uMoonDir; uniform float uMoon; ${fogGlsl} ${noiseGlsl}
  void main(){vec3 n=normalize(cross(dFdx(vWorldPos),dFdy(vWorldPos)));
  float grain=vnoise(vWorldPos.xz*.7+vWorldPos.y*.3);
  vec3 albedo=${leg ? 'mix(vec3(.011,.009,.008),vec3(.023,.020,.017),grain)' : 'mix(vec3(.042,.036,.032),vec3(.085,.074,.064),grain)'};
  vec3 mineral=albedo*${neutral ? '(.60+.40*max(0.0,dot(n,normalize(vec3(.3,1.0,.5)))))' : '(.55+.45*uMoon*max(0.0,dot(n,uMoonDir)))'};
  vec3 col=applyFog(mineral,vWorldPos,cameraPosition);
  float luminance=min(${leg ? '.03' : '.10'},dot(col,vec3(.2126,.7152,.0722)));
  gl_FragColor=vec4(${neutral ? 'albedo/dot(albedo,vec3(.2126,.7152,.0722))*luminance' : 'col'},1.0);}` });
}

export class PebbleMeshes {
	constructor(root, shared) {
		this.eyes = new PebbleEyeMeshes(root, shared, SPECIES.hopper.cap);
		this.pose = new THREE.Object3D(); this.bone = new THREE.Object3D(); this.up = new THREE.Vector3(0, 1, 0);
		this.direction = new THREE.Vector3(); this.a = new THREE.Vector3(); this.b = new THREE.Vector3();
		const legMaterial = stoneMaterial(shared, true, true), bodyMaterial = stoneMaterial(shared);
		bodyMaterial.vertexShader = `#define KIND 3
		attribute vec4 aLife; varying vec3 vWorldPos;
		${faunaDeformation.replace('float stroke = aMotion.x, effort = aMotion.y;', '')}
		void main(){vec4 p=modelMatrix*instanceMatrix*vec4(deformFauna(position),1.0);vWorldPos=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
		this.bodies = this.instances(root, faunaGeometry('hopper'), bodyMaterial, SPECIES.hopper.cap, 'pebble-bodies');
		replyOutline(this.bodies,{expression:'aLife.y'});
		const sceneryMaterial = stoneMaterial(shared); sceneryMaterial.vertexShader = bodyMaterial.vertexShader;
		this.stones = this.instances(root, faunaGeometry('hopper'), sceneryMaterial, SPECIES.hopper.cap * 6, 'pebble-habitat-stones');
		this.legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.115, 1, 5), legMaterial, SPECIES.hopper.cap * 4);
		const shadowMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: shared.fogUniforms,
			vertexShader: `attribute float aOpacity; varying vec2 vUv; varying float vAlpha; varying vec3 vWorld; void main(){vUv=uv;vAlpha=aOpacity;vec4 p=modelMatrix*instanceMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
			fragmentShader: `varying vec2 vUv; varying float vAlpha; varying vec3 vWorld; ${fogGlsl} void main(){float r=length((vUv-.5)*2.0);float a=exp(-r*r*4.0)*(1.0-smoothstep(.65,1.0,r))*vAlpha; a*=1.0-heightFog(vWorld,cameraPosition);gl_FragColor=vec4(0.0,0.0,0.0,a);}` });
		const shadowGeometry = new THREE.PlaneGeometry(2, 2); shadowGeometry.rotateX(-Math.PI / 2);
		shadowGeometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(new Float32Array(SPECIES.hopper.cap * 7), 1));
		this.shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, SPECIES.hopper.cap * 7);
		this.shadows.count = 0; this.shadows.frustumCulled = false; this.shadows.renderOrder = 1; this.shadows.name = 'pebble-contact-shadows'; root.add(this.shadows);
		for (const mesh of [this.bodies, this.stones, this.legs]) pebbleLighting(mesh, shared, 'albedo', 'n');
		this.legs.name = 'pebble-legs'; this.legs.frustumCulled = false; this.legs.count = 0; this.legs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(this.legs);
	}
	instances(root, geometry, material, count, name) {
		geometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
		const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name; mesh.count = 0; mesh.frustumCulled = false;
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh); return mesh;
	}
	place(mesh, index, p, yaw, pitch, bank, size, phase) {
		this.pose.position.set(p.x, p.y, p.z); this.pose.rotation.set(bank, yaw, pitch, 'YZX'); this.pose.scale.setScalar(size); this.pose.updateMatrix();
		mesh.setMatrixAt(index, this.pose.matrix); mesh.geometry.attributes.aLife.setXYZW(index, phase, 0, 0, 0);
	}
	shadow(index, p, ground, pitch, bank, yaw, size, lift) {
		this.bone.position.set(p.x, ground + 0.035, p.z); this.bone.rotation.set(bank, yaw, pitch, 'YZX');
		this.bone.scale.set(size * (1.65 + lift * 0.12), 1, size * (1.28 + lift * 0.12)); this.bone.updateMatrix();
		this.shadows.setMatrixAt(index, this.bone.matrix); this.shadows.geometry.attributes.aOpacity.setX(index, 0.48 / (1 + lift * 1.8));
	}
	segment(a, b, width, index) {
		this.a.copy(a); this.b.copy(b); this.direction.subVectors(this.b, this.a);
		const length = this.direction.length(); this.bone.position.copy(this.a).add(this.b).multiplyScalar(0.5);
		this.bone.quaternion.setFromUnitVectors(this.up, this.direction.multiplyScalar(1 / Math.max(length, 0.0001)));
		this.bone.scale.set(width, length, width); this.bone.updateMatrix(); this.legs.setMatrixAt(index, this.bone.matrix);
	}
	update(model, alpha) {
		this.eyes.begin();
		let bodies = 0, stones = 0, legs = 0, shadows = 0;
		const lerp = (a, b) => a + (b - a) * alpha;
		for (const c of model.creatures) {
			if (c.kind !== 'hopper') continue;
			const b = c.pebble, born = clamp((model.time - (c.born || 0)) / 2, 0.001, 1);
			const far = clamp((PEBBLE_DRAW_DISTANCE - Math.hypot(c.pos.x - model.listener.x, c.pos.z - model.listener.z)) / 130, 0, 1);
			if (!far) continue;
			const size = c.size * born * far, p = { x: lerp(c.prev.x, c.pos.x), y: lerp(c.prev.y, c.pos.y), z: lerp(c.prev.z, c.pos.z) };
			c.renderPosition = p;
			const yaw = lerp(c.prevYaw ?? c.yaw, c.yaw), pitch = lerp(c.prevPitch ?? c.pitch, c.pitch), bank = lerp(c.prevBank ?? c.bank, c.bank);
			const sample = c.group.sample || model.environment.sample;
			const floor = sample(p.x, p.z);
			// Interpolation between two safe ticks can cut through a triangle ridge.
			if (Number.isFinite(floor.ground)) {
    if (floor.cave && floor.water > floor.ground) p.y = Math.min(p.y, Math.max(floor.ground + 1.5 * size, floor.water - .55 * size));
    p.y = Math.max(p.y, floor.ground + 0.55 * size, (floor.cave ? (floor.water ?? -Infinity) : -Infinity) - .8 * size);
   }
			setPebbleLight(this.bodies, bodies, floor);
			this.place(this.bodies, bodies, p, yaw, pitch, bank, size, c.phase);this.bodies.geometry.attributes.aLife.setY(bodies++,c.replyGlow||0);
			this.eyes.update(c, this.pose.matrix, alpha, size, model.time - (1 - alpha) / 30, model.eyeTarget || model.listener, floor);
			const stand = lerp(b.prevStand, b.stand);
			this.shadow(shadows++, p, c.ground, b.restPitch, b.restBank, yaw, size, stand);
			if (stand < 0.025 || !c.feet) continue;
			const world = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(this.pose.matrix);
			for (let j = 0; j < 2; j++) {
				const side = j ? 1 : -1, hip = world(-0.3, -0.22, side * 0.52);
				const f = c.feet[j], tucked = world(-0.42, -0.31, side * 0.24);
				const deploy = smooth(clamp(stand / 0.68, 0, 1));
				const foot = new THREE.Vector3(lerp(f.prev.x, f.pos.x), lerp(f.prev.y, f.pos.y), lerp(f.prev.z, f.pos.z));
				// At full speed the physical contacts can cycle between display frames.
    // A bounded, interpolated sprint cadence keeps every stride readable.
    const sprint = smooth(clamp((c.speed-14)/14,0,1));
    if(sprint>0) {
     const phase=lerp(b.prevRunCycle || 0,b.runCycle || 0)*Math.PI*2+j*Math.PI;
     const running=world(-.25+Math.cos(phase)*.8,0,side*.88);
     const at=sample(running.x,running.z);
     if(Number.isFinite(at.ground)) {
      running.y=Math.max(at.ground,at.cave?at.water-2*size:-Infinity)+(.055+Math.max(0,Math.sin(phase))*.7)*size;
      foot.lerp(running,sprint);
     }
    }
				const target = tucked.lerp(foot, deploy);
				const bend = { x: -Math.cos(yaw) + Math.sin(yaw) * side * 0.28, y: 0.05, z: Math.sin(yaw) + Math.cos(yaw) * side * 0.28 };
				const solved = solveLeg(hip, target, 0.94 * size, bend);
				setPebbleLight(this.legs, legs, floor); setPebbleLight(this.legs, legs + 1, floor);
				this.segment(hip, solved.knee, size * 1.35, legs++);
				this.segment(solved.knee, solved.foot, size * 0.88, legs++);
			}
		}
		for (const group of model.groups.values()) {
			if (group.kind !== 'hopper') continue;
			const bornAt = group.members[0]?.born || 0, born = clamp((model.time - bornAt) / 2, 0.001, 1);
			for (const c of group.stones) {
				const far = clamp((PEBBLE_DRAW_DISTANCE - Math.hypot(c.pos.x - model.listener.x, c.pos.z - model.listener.z)) / 130, 0, 1);
				if (!far || stones >= this.stones.instanceMatrix.count) continue;
				this.place(this.stones, stones++, c.pos, c.yaw, c.pitch, c.bank, c.size * born * far, c.phase);
				this.shadow(shadows++, c.pos, c.pos.y - 0.55 * c.size, c.pitch, c.bank, c.yaw, c.size * born * far, 0);
			}
		}
		this.eyes.finish();
		this.shadows.count = shadows; this.shadows.instanceMatrix.needsUpdate = true; this.shadows.geometry.attributes.aOpacity.needsUpdate = true;
		this.bodies.count = bodies; this.stones.count = stones; this.legs.count = legs;
		for (const mesh of [this.bodies, this.stones, this.legs]) { mesh.instanceMatrix.needsUpdate = true; mesh.geometry.attributes.aCaveLight.needsUpdate = true; if (mesh.geometry.attributes.aLife) mesh.geometry.attributes.aLife.needsUpdate = true; }
		return bodies;
	}
}
