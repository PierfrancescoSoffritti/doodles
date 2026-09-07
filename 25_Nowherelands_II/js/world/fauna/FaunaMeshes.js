import { PebbleMeshes } from './PebbleMeshes.js?v=pebble-perf-2';
import { lumenAppearance } from './LumenAppearance.js';
import * as THREE from 'three';
import { SPECIES } from './FaunaModel.js?v=pebble-perf-2';
import { fogGlsl } from '../FogGlsl.js';
import { faunaGeometry } from './FaunaGeometry.js';
import { faunaDeformation } from './FaunaDeformation.js';

const KIND = { lumen: 0 };

const vertexShader = /* glsl */`
	attribute vec4 aLife;
	attribute vec4 aMotion;
	attribute vec2 aState;
		attribute vec4 aPlacement, aRadiance;
		varying vec4 vRadiance;
		attribute vec3 aVelocity, aElastic;
	uniform float uTime;
	varying vec3 vWorld, vNormal, vLocal;
	varying vec2 vUv;
	varying vec4 vLife;
	varying float vFade;
	${faunaDeformation}
	void main() {
		vec3 p = deformFauna(position);
		vLocal = position; vUv = uv; vLife = aLife; vFade = aState.y;
		// Reconstruct the deformed normal so illumination follows the bending body.
		vec3 n = normalize(normal);
		vec3 t = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
		vec3 b = cross(n, t);
		vec3 displacedNormal = normalize(cross(deformFauna(position + t * 0.008) - p, deformFauna(position + b * 0.008) - p));
			vRadiance = aRadiance;
			vec4 world = modelMatrix * vec4(aPlacement.xyz + p * aPlacement.w, 1.0);
		vWorld = world.xyz;
		vNormal = normalize(mat3(modelMatrix * instanceMatrix) * displacedNormal);
		gl_Position = projectionMatrix * viewMatrix * world;
	}
`;

const fragmentShader = /* glsl */`
	uniform float uTime, uMoon, uSun;
	uniform vec3 uMoonDir;
		varying vec4 vRadiance;
	varying vec3 vWorld, vNormal, vLocal;
	varying vec2 vUv;
	varying vec4 vLife;
	varying float vFade;
	${fogGlsl}
	void main() {
		vec3 viewDir = normalize(cameraPosition - vWorld);
		float facing = abs(dot(normalize(vNormal), viewDir));
		vec3 col; float alpha = vFade;
			float core = pow(facing, 0.8);
			// Motion colour remains visible inside the volume; bounded radiance
			// keeps a reunited population from blooming into one white patch.
			col = mix(vRadiance.rgb, vec3(0.84, 0.94, 1.0), core * 0.28) * (1.0 + core * 0.65) * vRadiance.w;
			alpha *= smoothstep(0.0, 0.28, facing) * (0.6 + core * 0.35);

			float dist = distance(vWorld, cameraPosition);
			float extinction = (1.0 - heightFog(vWorld, cameraPosition)) * exp(-pow(dist * uFogDistance, 2.0) * 1.4);
			alpha *= extinction;
		if (alpha < 0.005) discard;
		gl_FragColor = vec4(col, alpha);
	}
`;

export class FaunaMeshes {
	constructor(scene, shared) {
		this.shared = shared; this.root = new THREE.Group(); this.root.name = 'fauna'; scene.add(this.root);
		this.meshes = {}; this.life = {}; this.motion = {}; this.state = {}; this.dummy = new THREE.Object3D();
		for (const [kind, def] of Object.entries(SPECIES)) {
			if (kind === 'hopper') continue;
			const g = faunaGeometry(kind);
			this.life[kind] = new THREE.InstancedBufferAttribute(new Float32Array(def.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
			this.state[kind] = new THREE.InstancedBufferAttribute(new Float32Array(def.cap * 2), 2).setUsage(THREE.DynamicDrawUsage);
			this.motion[kind] = new THREE.InstancedBufferAttribute(new Float32Array(def.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
			if(kind==='lumen') {
				this.radiance=new THREE.InstancedBufferAttribute(new Float32Array(def.cap*4),4).setUsage(THREE.DynamicDrawUsage);
				g.setAttribute('aRadiance',this.radiance);
				this.placement=new THREE.InstancedBufferAttribute(new Float32Array(def.cap*4),4).setUsage(THREE.DynamicDrawUsage);
				this.velocity=new THREE.InstancedBufferAttribute(new Float32Array(def.cap*3),3).setUsage(THREE.DynamicDrawUsage);
				this.elastic=new THREE.InstancedBufferAttribute(new Float32Array(def.cap*3),3).setUsage(THREE.DynamicDrawUsage);
				g.setAttribute('aPlacement',this.placement);g.setAttribute('aVelocity',this.velocity);g.setAttribute('aElastic',this.elastic);
			}
			g.setAttribute('aLife', this.life[kind]); g.setAttribute('aMotion', this.motion[kind]); g.setAttribute('aState', this.state[kind]);
			const light = true;
			const material = new THREE.ShaderMaterial({ defines: { KIND: KIND[kind] }, uniforms: {
				uTime: { value: 0 }, uMoon: { value: 1 }, uSun: { value: 0 }, uMoonDir: { value: shared.moon.dir }, ...shared.fogUniforms,
			}, vertexShader, fragmentShader, transparent: light, depthWrite: !light,
				blending: THREE.NormalBlending,
				side: THREE.FrontSide });
			const mesh = new THREE.InstancedMesh(g, material, def.cap);
			mesh.name = `fauna-${kind}`; mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
			// Above-water luminous surfaces render after inland water's scene-colour capture.
			mesh.renderOrder = light ? 3 : 0; this.root.add(mesh); this.meshes[kind] = mesh;
		}
		const glowGeometry=new THREE.PlaneGeometry(2,2);
		glowGeometry.setAttribute('aRadiance',this.radiance);glowGeometry.setAttribute('aPlacement',this.placement);glowGeometry.setAttribute('aLife',this.life.lumen);glowGeometry.setAttribute('aState',this.state.lumen);
		const glowMaterial=new THREE.ShaderMaterial({
			uniforms:shared.fogUniforms, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
			vertexShader:`attribute vec4 aPlacement, aLife, aRadiance; attribute vec2 aState; varying vec4 vRadiance; varying vec2 vGlow; varying vec3 vCenter; varying float vFade;
			void main(){vRadiance=aRadiance;vGlow=position.xy;vCenter=aPlacement.xyz;vFade=aState.y;vec4 p=viewMatrix*vec4(vCenter,1.0);p.xy+=position.xy*aPlacement.w*3.2;gl_Position=projectionMatrix*p;}`,
			fragmentShader:`varying vec4 vRadiance;varying vec2 vGlow;varying vec3 vCenter;varying float vFade;${fogGlsl}
			void main(){float r=dot(vGlow,vGlow);float glow=max(0.0,exp(-r*5.5)-exp(-5.5));float extinction=(1.0-heightFog(vCenter,cameraPosition))*exp(-pow(distance(vCenter,cameraPosition)*uFogDistance,2.0)*1.4);gl_FragColor=vec4(vRadiance.rgb,glow*0.11*vRadiance.w*vFade*extinction);}`,
		});
		this.glow=new THREE.InstancedMesh(glowGeometry,glowMaterial,SPECIES.lumen.cap);this.glow.count=0;this.glow.frustumCulled=false;this.glow.renderOrder=4;this.root.add(this.glow);

		this.pebbles = new PebbleMeshes(this.root, shared);
	}

	update(model, alpha, dt, sample) {
		this.root.visible = true;
		const aboveGround = (this.shared.caveAmount || 0) < 0.4;
		for (const mesh of [...Object.values(this.meshes), this.glow]) mesh.visible = aboveGround;
		const counts = Object.fromEntries(Object.keys(SPECIES).map(k => [k, 0]));
		for (const c of model.creatures) {
			const kind = c.kind;
			if (kind === 'hopper') continue;
			if (kind === 'lumen' && Math.hypot(c.pos.x-model.listener.x,c.pos.z-model.listener.z)>4500) continue;
			const i = counts[kind]++, mesh = this.meshes[kind];
			const p = { x: c.prev.x + (c.pos.x - c.prev.x) * alpha, y: c.prev.y + (c.pos.y - c.prev.y) * alpha, z: c.prev.z + (c.pos.z - c.prev.z) * alpha };
			c.renderPosition = p;
			this.dummy.position.set(p.x, p.y, p.z);
			const yaw = (c.prevYaw ?? c.yaw) + (c.yaw - (c.prevYaw ?? c.yaw)) * alpha;
			const bank = (c.prevBank ?? c.bank) + (c.bank - (c.prevBank ?? c.bank)) * alpha;
			const pitch = (c.prevPitch ?? c.pitch) + (c.pitch - (c.prevPitch ?? c.pitch)) * alpha;
			// With +X forwards, X is roll and Z is pitch. Y remains heading.
			this.dummy.rotation.set(kind === 'lumen' ? 0 : bank, kind === 'lumen' ? 0 : yaw, kind === 'lumen' ? 0 : pitch, 'YZX');
			const born = Math.min(1, (model.time - (c.born || 0)) / 2);
			this.dummy.scale.setScalar(c.size * Math.max(0.001, born));
			if(kind==='lumen') {
				const glow=lumenAppearance(c.phase,c.speed,Math.hypot(c.elastic?.x||0,c.elastic?.y||0,c.elastic?.z||0),c.energy,model.time);
				c.radiance=glow;this.radiance.setXYZW(i,glow.r,glow.g,glow.b,glow.brightness);
				this.placement.setXYZW(i,p.x,p.y,p.z,c.size*Math.max(0.001,born));
				this.velocity.setXYZ(i,(c.oldVX??c.vel.x)+(c.vel.x-(c.oldVX??c.vel.x))*alpha,(c.oldVY??c.vel.y)+(c.vel.y-(c.oldVY??c.vel.y))*alpha,(c.oldVZ??c.vel.z)+(c.vel.z-(c.oldVZ??c.vel.z))*alpha);
				this.elastic.setXYZ(i,c.elastic?.x||0,c.elastic?.y||0,c.elastic?.z||0);
				this.dummy.position.set(0,0,0);this.dummy.scale.setScalar(1);
			}
			this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
			this.life[kind].setXYZW(i, c.phase, c.energy, c.speed, c.bend);
			this.motion[kind].setXYZW(i, (c.prevStroke ?? c.stroke) + (c.stroke - (c.prevStroke ?? c.stroke)) * alpha, c.effort, c.compression, c.breath);
			const far = Math.max(0, Math.min(1, ((kind === 'lumen' ? 4500 : 650) - Math.hypot(p.x - model.listener.x, p.z - model.listener.z)) / (kind === 'lumen' ? 1000 : 130)));
			this.state[kind].setXY(i, c.hop, born * far);

		}
		for (const [kind, mesh] of Object.entries(this.meshes)) {
			mesh.count = counts[kind]; mesh.instanceMatrix.needsUpdate = true;
			this.life[kind].needsUpdate = true; this.motion[kind].needsUpdate = true; this.state[kind].needsUpdate = true;
			const u = mesh.material.uniforms; u.uTime.value = model.time; u.uMoon.value = this.shared.moon.intensity; u.uSun.value = this.shared.sun.intensity;
		}
		this.glow.count=counts.lumen;this.radiance.needsUpdate=true;this.placement.needsUpdate=true;this.velocity.needsUpdate=true;this.elastic.needsUpdate=true;
		counts.hopper = this.pebbles.update(model, alpha);
		this.root.userData.population = counts;
	}
}
