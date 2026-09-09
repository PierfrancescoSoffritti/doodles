import * as THREE from 'three';
import { terrainMeshData } from '../../js/world/TerrainMeshData.js';
import { shoreTileData } from '../../js/world/ShoreTileData.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a,b) => a.length === b.length && a.every((value,i) => value === b[i]);

// Run on the loaded island after streaming settles. Checks actual rendered pixels
// and installed worker output, not just the parameters passed to Three.js.
export function checkSurfaceData(debug = window.__debug) {
	const { terrain, heightmap, shoreMap } = debug;
	let nodes = 0;
	for (const [key, node] of [...terrain.nodes].filter((_,i)=>i%17===0)) {
		const depth=Math.floor(key/1e6), ix=Math.floor((key-depth*1e6)/1000), iz=key-depth*1e6-ix*1000;
		const expected=terrainMeshData(heightmap,depth,ix,iz), g=node.mesh.geometry;
		assert(equal(g.attributes.position.array,expected.pos), `Terrain height differs at ${key}`);
		assert(equal(g.attributes.aApron.array,expected.apron), `Entrance mask differs at ${key}`);
		assert(equal(g.attributes.aCave.array,expected.caveMask), `Cave mask differs at ${key}`); nodes++;
	}
	for(const tier of shoreMap.tiers){
		const expected=shoreTileData(heightmap,{...tier.spec,ox:tier.origin.x,oz:tier.origin.y});
		assert(equal(tier.data,expected.data),'Shore map differs from continuous terrain/water sampling');
	}
	let groups=0;
	for(const chunk of terrain.vegetation.chunks.values())for(const g of chunk.groups){
		let pending=0;
		for(let i=0;i<g.count;i++){
			const [s,e]=g.ranges?g.ranges[i]:[i,i+1];
			if(e>s&&g.attr.array[s]===1e9)pending++;
		}
		assert(g.pending===pending,`Growth counter differs: ${g.pending} / ${pending}`);groups++;
	}
	return { nodes, shoreTiles: shoreMap.tiers.length, growthGroups: groups };
}

export function checkVegetationCulling(debug = window.__debug) {
	const { renderer, camera, terrain, water, post, shared } = debug;
	const savedRotation=camera.quaternion.clone(), savedPosition=camera.position.clone();
	const meshes=[...terrain.vegetation.chunks.values(),...terrain.vegetation.farChunks.values()].flatMap(c=>c.meshes);
	const flags=meshes.map(m=>m.frustumCulled), reflect=water.far.onBeforeRender;
	const originalUniforms=terrain.vegetation.uniformSets.map(u=>[u.uWind.value,u.uPulse.value]);
	const line=terrain.vegetation.lineUniforms, oldLine=[line.uWind.value,line.uPulse.value];
	const gl=renderer.getContext(), width=renderer.domElement.width, height=renderer.domElement.height;
	const a=new Uint8Array(width*height*4), b=new Uint8Array(a.length), control=new Uint8Array(a.length);
	let samples=0, savedDraws=0, roundedChannels=0, maxChannelError=0, controlChannels=0;
	const oldAuto=renderer.info.autoReset;
	try {
		water.far.onBeforeRender=()=>{}; renderer.info.autoReset=false;
		for(const u of terrain.vegetation.uniformSets){u.uWind.value=8;u.uPulse.value=1;}
		line.uWind.value=8;line.uPulse.value=1;
		for(const elevation of [0,120])for(let turn=0;turn<12;turn++){
			camera.position.copy(savedPosition);camera.position.y+=elevation;
			camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),turn*Math.PI/6).multiply(savedRotation);
			camera.updateMatrixWorld(true);
			meshes.forEach(m=>m.frustumCulled=false);renderer.info.reset();post.render(shared.time,shared);
			const full=renderer.info.render.calls;gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,control);
			post.render(shared.time,shared);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);
			for(let i=0;i<a.length;i++)if(a[i]!==control[i])controlChannels++;
			meshes.forEach((m,i)=>m.frustumCulled=flags[i]);renderer.info.reset();post.render(shared.time,shared);
			savedDraws+=full-renderer.info.render.calls;gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,b);
			let changed=0, error=0;
			for(let i=0;i<a.length;i++)if(a[i]!==b[i]){changed++;error=Math.max(error,Math.abs(a[i]-b[i]));}
			// Allow isolated 8-bit rounding at the HDR/postprocessing boundary, not missing foliage.
			assert(error<=1 && Math.sqrt(changed/a.length)<.01,`Culling changed ${changed} channels (max ${error}) at turn ${turn}, elevation ${elevation}`);
			roundedChannels+=changed;maxChannelError=Math.max(maxChannelError,error);samples++;
		}
		assert(savedDraws>0,'Culling did not reduce draw calls');
		return { samples, savedDraws, roundedChannels, maxChannelError, controlChannels };
	} finally {
		meshes.forEach((m,i)=>m.frustumCulled=flags[i]);water.far.onBeforeRender=reflect;
		camera.position.copy(savedPosition);camera.quaternion.copy(savedRotation);camera.updateMatrixWorld(true);
		terrain.vegetation.uniformSets.forEach((u,i)=>{u.uWind.value=originalUniforms[i][0];u.uPulse.value=originalUniforms[i][1];});
		[line.uWind.value,line.uPulse.value]=oldLine;renderer.info.autoReset=oldAuto;
	}
}

export function checkVegetationCancellation(debug = window.__debug) {
	const v=debug.terrain.vegetation, key=v.key(v.centerX,v.centerZ), chunk=v.chunks.get(key);
	// Rebuild an existing location away from the published chunk, then abandon it.
	if(!chunk)return { skipped:true };
	v.chunks.delete(key);
	const colliders=debug.shared.colliders.length, children=debug.scene.children.length;
	const job=v.buildChunk(key,v.centerX,v.centerZ);
	try { job.next();job.next();job.next(); }
	finally { job.return();v.chunks.set(key,chunk); }
	assert(debug.shared.colliders.length===colliders,'Cancelled vegetation left invisible colliders');
	assert(debug.scene.children.length===children,'Cancelled vegetation left partial scene objects');
	return { colliders, sceneObjects:children };
}
