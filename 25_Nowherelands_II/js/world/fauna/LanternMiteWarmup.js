import { warmStreamedMaterials } from '../../fx/StreamedMaterialWarmup.js?v=streaming-60-30-19';
import * as THREE from 'three';
import { lanternHomeMaterial, lanternBrambleMaterial } from './LanternMiteHomeMaterials.js';
import { LanternMiteMeshes } from './LanternMiteMeshes.js?v=streaming-60-30-19';

// Keep one instance of every streamed material alive so retiring the last home
// cannot evict its GPU program and force a fresh driver link during travel.
export async function warmLanternMaterials(world, shared, sources) {
	const scene=new THREE.Scene();
	const uniforms={uHomeOrigin:{value:new THREE.Vector3()},uHomeNormal:{value:new THREE.Vector2(0,1)},uHomeTangent:{value:new THREE.Vector2(1,0)},uHomeScale:{value:1},uHomeGlow:{value:1}};
	const geometry=new THREE.BoxGeometry(), count=geometry.attributes.position.count;
	geometry.setAttribute('aCave',new THREE.Float32BufferAttribute(new Float32Array(count).fill(-100),1));
	geometry.setAttribute('aApron',new THREE.Float32BufferAttribute(new Float32Array(count),1));
	const materials=[];
	for(let kind=0;kind<5;kind++){
		const material=lanternHomeMaterial(kind,sources,uniforms),mesh=new THREE.Mesh(geometry,material);
		materials.push(material);mesh.frustumCulled=false;scene.add(mesh);
	}
	const lineGeometry=new THREE.BufferGeometry();
	lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,1,0],3));
	lineGeometry.setAttribute('aBase',new THREE.Float32BufferAttribute(new Float32Array(6),3));
	lineGeometry.setAttribute('aInfo',new THREE.Float32BufferAttribute([0,0,0,1,1,0,0,1],4));
	lineGeometry.setAttribute('aBorn',new THREE.Float32BufferAttribute([-1e6,-1e6],1));
	const lineMaterial=lanternBrambleMaterial(sources.bramble),lines=new THREE.LineSegments(lineGeometry,lineMaterial);
	lines.frustumCulled=false;scene.add(lines);materials.push(lineMaterial);
	const mites=new LanternMiteMeshes(scene);mites.create('warm');
	await warmStreamedMaterials(shared,[scene],{includeHidden:true});
	return {dispose(){mites.dispose();geometry.dispose();lineGeometry.dispose();materials.forEach(m=>m.dispose());scene.clear();}};
}
