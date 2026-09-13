import * as THREE from 'three';
import { lanternHomeMaterial, lanternBrambleMaterial } from './LanternMiteHomeMaterials.js';
import { LanternMiteMeshes } from './LanternMiteMeshes.js?v=outline-2';

// Keep one instance of every streamed material alive so retiring the last home
// cannot evict its GPU program and force a fresh driver link during travel.
export async function warmLanternMaterials(world, shared, sources) {
	const renderer=shared.renderer, camera=shared.camera.clone(), scene=new THREE.Scene();
	scene.environment=world.environment;scene.environmentIntensity=world.environmentIntensity;scene.fog=world.fog;
	world.updateMatrixWorld(true);
	world.traverseVisible(light=>{if(!light.isLight||!light.layers.test(shared.camera.layers))return;const copy=light.clone();copy.position.setFromMatrixPosition(light.matrixWorld);scene.add(copy);});
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
	scene.traverse(o=>{if(o.isMesh||o.isSprite)o.frustumCulled=false;});
	// Include the reply masks so the first note does not initialize them later.
	camera.layers.enable(30);
	const target=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType});
	const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
	try{
		let ready;try{renderer.setRenderTarget(target);ready=renderer.compileAsync(scene,camera);}finally{renderer.setRenderTarget(previous,face,mip);}
		await ready;
		renderer.setRenderTarget(target);renderer.render(scene,camera);
	}finally{renderer.setRenderTarget(previous,face,mip);target.dispose();}
	return {dispose(){mites.dispose();geometry.dispose();lineGeometry.dispose();materials.forEach(m=>m.dispose());scene.clear();}};
}
