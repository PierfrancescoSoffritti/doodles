import {replyOutline,writeReplyEcho} from './ReplyOutline.js?v=outline-2';
import { PebbleMeshes } from './PebbleMeshes.js?v=pebble-voice-4b';
import { lumenAppearance } from './LumenAppearance.js';
import * as THREE from 'three';
import { SPECIES } from './FaunaModel.js?v=pebble-voice-4b';
import { fogGlsl } from '../FogGlsl.js';
import { faunaGeometry } from './FaunaGeometry.js';
import { faunaDeformation } from './FaunaDeformation.js';

const KIND = { lumen: 0, ray: 5 };

const vertexShader = /* glsl */`
	attribute vec4 aLife;
	attribute vec4 aMotion;
	attribute vec2 aState;
	#if KIND == 0
		attribute vec4 aPlacement, aRadiance;
		varying vec4 vRadiance;
		attribute vec3 aVelocity, aElastic;
	#endif
	uniform float uTime;
	varying vec3 vWorld, vNormal, vLocal;
	varying vec2 vUv;
	varying vec4 vLife;
	varying float vFade; varying float vNotePhase; varying float vReply;
	${faunaDeformation}
	void main() {
		vec3 p = deformFauna(position);
		vLocal = position; vUv = uv; vLife = aLife; vFade = aState.y; vNotePhase = aState.x;vReply=aLife.z;
		// Reconstruct the deformed normal so illumination follows the bending body.
		vec3 n = normalize(normal);
		vec3 t = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
		vec3 b = cross(n, t);
		vec3 displacedNormal = normalize(cross(deformFauna(position + t * 0.008) - p, deformFauna(position + b * 0.008) - p));
		#if KIND == 0
			vRadiance = aRadiance;
			vec4 world = modelMatrix * vec4(aPlacement.xyz + p * aPlacement.w, 1.0);
		#else
			vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
		#endif
		vWorld = world.xyz;
		vNormal = normalize(mat3(modelMatrix * instanceMatrix) * displacedNormal);
		gl_Position = projectionMatrix * viewMatrix * world;
	}
`;

const fragmentShader = /* glsl */`
	uniform float uTime, uMoon, uSun;
	uniform vec3 uMoonDir;
	#if KIND == 0
		varying vec4 vRadiance;
	#endif
	varying vec3 vWorld, vNormal, vLocal;
	varying vec2 vUv;
	varying vec4 vLife;
	varying float vFade; varying float vNotePhase; varying float vReply;
	${fogGlsl}
	void main() {
		vec3 viewDir = normalize(cameraPosition - vWorld);
		float facing = abs(dot(normalize(vNormal), viewDir));
		vec3 col; float alpha = vFade;
		#if KIND == 0
			float core = pow(facing, 0.8);
			// Motion colour remains visible inside the volume; bounded radiance
			// keeps a reunited population from blooming into one white patch.
			col = mix(vRadiance.rgb, vec3(0.84, 0.94, 1.0), core * 0.28) * (1.0 + core * 0.65) * vRadiance.w;
			alpha *= smoothstep(0.0, 0.28, facing) * (0.6 + core * 0.35);

		#elif KIND == 5
			float edge = min(vUv.y, 1.0 - vUv.y);
			float rim = 1.0 - smoothstep(0.0, max(fwidth(edge) * 1.5, 0.025), edge);
			float wave = 0.72 + 0.28 * sin(vUv.x * 14.0 - uTime * 1.8 + vLife.x);
			col = mix(vec3(0.2, 0.14, 0.29) + facing * vec3(0.17, 0.11, 0.21), vec3(0.63, 0.51, 0.83) * (0.9 + vLife.y * 0.3), rim);
			float pulse=vLife.y;float sweep=exp(-pow((vUv.y-fract(abs(vNotePhase)*1.6))/.22,2.0));
			col+=(vNotePhase<0.?vec3(1.,.25,.1):vec3(.7,.4,1.))*pulse*(rim*.4+sweep*.3);
			alpha *= (0.28 + facing * 0.15 + rim * 0.42) * wave;
		#endif
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
				side: kind === 'ray' ? THREE.DoubleSide : THREE.FrontSide });
			const mesh = new THREE.InstancedMesh(g, material, def.cap);
			mesh.name = `fauna-${kind}`; mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
			// Above-water luminous surfaces render after inland water's scene-colour capture.
			mesh.renderOrder = light ? 3 : 0; this.root.add(mesh); this.meshes[kind] = mesh;
			replyOutline(mesh,{expression:'aLife.z*aState.y'});
		}
		// The same deformation/material at every distance; only subpixel tessellation changes.
		this.lumenLods = [this.meshes.lumen];
		for (let detail = 1; detail <= 2; detail++) {
			const g = faunaGeometry('lumen', detail), original = this.meshes.lumen;
			for (const [name, attr] of Object.entries(original.geometry.attributes)) {
				if (attr.isInstancedBufferAttribute) g.setAttribute(name, attr.clone().setUsage(THREE.DynamicDrawUsage));
			}
			const mesh = new THREE.InstancedMesh(g, original.material, SPECIES.lumen.cap);
			mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = original.renderOrder;
			mesh.name = `fauna-lumen-lod-${detail}`; this.root.add(mesh); this.lumenLods.push(mesh);
			replyOutline(mesh,{expression:'aLife.z*aState.y'});
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
		for (const mesh of [...Object.values(this.meshes), ...this.lumenLods, this.glow]) mesh.visible = aboveGround;
		const counts = Object.fromEntries(Object.keys(SPECIES).map(k => [k, 0]));
		const buckets = [[], [], []];
		const camera = this.shared.camera;
		const pixels = (this.shared.renderer?.domElement.height || 900) / (2 * Math.tan((camera?.fov || 66) * Math.PI / 360));
		for (const c of model.creatures) {
			if (c.kind !== 'lumen') continue;
			const d = Math.hypot(c.pos.x-model.listener.x, c.pos.y-model.listener.y, c.pos.z-model.listener.z);
			const diameter = c.size * 5 * pixels / Math.max(1, d);
			let lod = diameter > 24 ? 0 : diameter > 7 ? 1 : 2;
			// Hysteresis keeps a creature from flickering between meshes on a threshold.
			if (c.renderLod === 0 && diameter > 20) lod = 0;
			if (c.renderLod === 1 && diameter > 6 && diameter < 28) lod = 1;
			if (c.renderLod === 2 && diameter < 8) lod = 2;
			c.renderLod = lod;
			if (Math.hypot(c.pos.x-model.listener.x,c.pos.z-model.listener.z) <= 4500) buckets[lod].push(c);
		}
		for (const c of [...buckets.flat(), ...model.creatures.filter(c => c.kind === 'ray')]) {
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
				if(c.noteGlow>0){const k=c.noteGlow*.3;glow.r=glow.r*(1-k)+(c.noteAlarm?1:.25)*k;glow.g=glow.g*(1-k)+(c.noteAlarm?.24:1)*k;glow.b=glow.b*(1-k)+(c.noteAlarm?.1:1)*k;glow.brightness+=k*.8;}
			c.radiance=glow;this.radiance.setXYZW(i,glow.r,glow.g,glow.b,glow.brightness);
				this.placement.setXYZW(i,p.x,p.y,p.z,c.size*Math.max(0.001,born));
				this.velocity.setXYZ(i,(c.oldVX??c.vel.x)+(c.vel.x-(c.oldVX??c.vel.x))*alpha,(c.oldVY??c.vel.y)+(c.vel.y-(c.oldVY??c.vel.y))*alpha,(c.oldVZ??c.vel.z)+(c.vel.z-(c.oldVZ??c.vel.z))*alpha);
				this.elastic.setXYZ(i,c.elastic?.x||0,c.elastic?.y||0,c.elastic?.z||0);
				this.dummy.position.set(0,0,0);this.dummy.scale.setScalar(1);
			}
			this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
			writeReplyEcho(this.meshes[kind],i,c);
			this.life[kind].setXYZW(i, c.phase, c.energy, c.replyGlow||0, c.bend);
			this.motion[kind].setXYZW(i, (c.prevStroke ?? c.stroke) + (c.stroke - (c.prevStroke ?? c.stroke)) * alpha, c.effort, c.compression, c.breath);
			const far = Math.max(0, Math.min(1, ((kind === 'lumen' ? 4500 : 650) - Math.hypot(p.x - model.listener.x, p.z - model.listener.z)) / (kind === 'lumen' ? 1000 : 130)));
			this.state[kind].setXY(i, kind==='ray'?(c.noteAlarm?-(c.notePhase+.001):(c.notePhase||0)):c.hop, born * far);

		}
		for (const [kind, mesh] of Object.entries(this.meshes)) {
			mesh.count = counts[kind]; mesh.instanceMatrix.needsUpdate = true;
			this.life[kind].needsUpdate = true; this.motion[kind].needsUpdate = true; this.state[kind].needsUpdate = true;
			const u = mesh.material.uniforms; u.uTime.value = model.time; u.uMoon.value = this.shared.moon.intensity; u.uSun.value = this.shared.sun.intensity;
		}
		this.glow.count=counts.lumen;this.radiance.needsUpdate=true;this.placement.needsUpdate=true;this.velocity.needsUpdate=true;this.elastic.needsUpdate=true;
		let offset = 0;
		for (let lod = 0; lod < this.lumenLods.length; lod++) {
			const mesh = this.lumenLods[lod], count = buckets[lod].length;
			mesh.count = count;
			if (lod > 0) for (const [name, attr] of Object.entries(mesh.geometry.attributes)) {
				if (!attr.isInstancedBufferAttribute) continue;
				const source = this.meshes.lumen.geometry.attributes[name];
				attr.array.set(source.array.subarray(offset * attr.itemSize, (offset + count) * attr.itemSize));
				attr.clearUpdateRanges(); attr.addUpdateRange(0, count * attr.itemSize); attr.needsUpdate = true;
			}
			offset += count;
		}
		counts.hopper = this.pebbles.update(model, alpha);
		this.root.userData.population = counts;
	}
}
