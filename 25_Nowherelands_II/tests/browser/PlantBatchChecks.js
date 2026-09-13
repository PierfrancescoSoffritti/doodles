import * as THREE from 'three';
import {PlantBatches} from '../../js/world/PlantBatches.js?v=stable-30-3';
import {sharedPlantGeometry} from '../../js/world/SharedPlantGeometry.js?v=stable-30-3';
import {FoliageDepthPrepass} from '../../js/fx/FoliageDepthPrepass.js?v=stable-30-3';
export function checkPlantBatches(){
 const r=new THREE.WebGLRenderer({antialias:false});r.setSize(320,240);r.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#151020');scene.fog=new THREE.FogExp2('#302545',.005);
 scene.add(new THREE.HemisphereLight('#f4ddff','#335655',2));const light=new THREE.DirectionalLight('#aabcff',2);light.position.set(5,10,3);scene.add(light);
 const material=new THREE.MeshLambertMaterial({side:THREE.DoubleSide,color:'#81a948'});
 material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aBorn;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y *= .7 + .3 * sin(aBorn);');};
 const bases=[new THREE.ConeGeometry(1,3,7),new THREE.BoxGeometry(1,2,1)],sources=[],matrix=new THREE.Matrix4();
 for(let j=0;j<60;j++){const base=bases[j%2],g=sharedPlantGeometry(base),mesh=new THREE.InstancedMesh(g,material,4);mesh.plantGeometry=base;g.setAttribute('aBorn',new THREE.InstancedBufferAttribute(new Float32Array([j,j+1,j+2,j+3]),1));for(let i=0;i<4;i++){matrix.makeTranslation((j%10-5)*5+i*.7,0,(Math.floor(j/10)-3)*6+i*.9);mesh.setMatrixAt(i,matrix);}mesh.computeBoundingSphere();scene.add(mesh);sources.push(mesh);}
 const camera=new THREE.PerspectiveCamera(66,4/3,.1,180),target=new THREE.WebGLRenderTarget(320,240),depth=new FoliageDepthPrepass(r,scene,material),batches=new PlantBatches(r,scene),rows=[];
 try{for(const useDepth of [false,true])for(let i=0;i<6;i++){
  depth.enabled=useDepth;camera.position.set(Math.cos(i)*29,5+i*2,Math.sin(i)*29);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  // Both source visibility and per-instance birth attributes can change.
  sources[3].visible=i%2===0;sources[4].geometry.attributes.aBorn.setX(1,i);sources[4].geometry.attributes.aBorn.needsUpdate=true;
  const images=[],calls=[];
  for(const enabled of [false,true]){batches.enabled=enabled;r.setRenderTarget(target);r.render(scene,camera);calls.push(r.info.render.calls);const bytes=new Uint8Array(320*240*4);r.readRenderTargetPixels(target,0,0,320,240,bytes);images.push(bytes);}
  let max=0,changed=0;for(let k=0;k<images[0].length;k++){const d=Math.abs(images[0][k]-images[1][k]);max=Math.max(max,d);changed+=d>0;}
  rows.push({useDepth,i,max,changed,calls,stats:{...batches.stats}});if(max>0)throw Error('Plant batching changed pixels: '+JSON.stringify(rows.at(-1)));
 }return rows;}finally{batches.dispose();depth.dispose();for(const s of sources){s.geometry.dispose();s.dispose();}for(const g of bases)g.dispose();material.dispose();target.dispose();r.dispose();}
}
