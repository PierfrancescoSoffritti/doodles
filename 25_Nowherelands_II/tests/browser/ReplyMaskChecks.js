import * as THREE from 'three';
import {replyOutline} from '../../js/world/fauna/ReplyOutline.js';

export async function checkReplyMask(){
 const renderer=new THREE.WebGLRenderer({antialias:false}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,4/3,.1,100);
 renderer.setSize(160,120);renderer.setClearColor(0,0);camera.position.z=6;camera.layers.set(30);
 const geometries=[new THREE.TorusKnotGeometry(.7,.22,72,8),new THREE.SphereGeometry(.6,16,12)],material=new THREE.MeshBasicMaterial(),replies=[];
 for(let i=0;i<3;i++){const mesh=new THREE.Mesh(geometries[i%2],material);mesh.position.set(i*.65-.65,(i-1)*.3,0);mesh.rotation.set(i*.37,i*.81,i*.2);scene.add(mesh);const reply=replyOutline(mesh);reply.setSignal(.3+i*.3);reply.echo.value.set(i*.2,i%2);replies.push(reply);}
 const instances=new THREE.InstancedMesh(geometries[1],material,2),matrix=new THREE.Matrix4();instances.setMatrixAt(0,matrix.makeTranslation(-1.1,-.6,-.5));instances.setMatrixAt(1,matrix.makeTranslation(1,.5,-.5));scene.add(instances);const instancedReply=replyOutline(instances);instancedReply.setSignal(.75);replies.push(instancedReply);
 const target=new THREE.WebGLRenderTarget(160,120),a=new Uint8Array(160*120*4),b=new Uint8Array(a.length),results=[];
 try{
  renderer.setRenderTarget(target);
  for(const turn of [0,.7,1.8]){
   scene.rotation.y=turn;
   for(const reply of replies)reply.outline.material.forceSinglePass=false;
   renderer.render(scene,camera);const before=renderer.info.render.calls;renderer.readRenderTargetPixels(target,0,0,160,120,a);
   for(const reply of replies)reply.outline.material.forceSinglePass=true;
   renderer.render(scene,camera);const after=renderer.info.render.calls;renderer.readRenderTargetPixels(target,0,0,160,120,b);
   let maxDifference=0,covered=0;for(let i=0;i<a.length;i++){maxDifference=Math.max(maxDifference,Math.abs(a[i]-b[i]));if(a[i])covered++;}
   if(maxDifference||!covered||after*2!==before)throw Error(`Reply mask mismatch: ${JSON.stringify({turn,maxDifference,covered,before,after})}`);
   results.push({turn,maxDifference,covered,before,after});
  }
  return{passed:true,results};
 }finally{replies.forEach(reply=>reply.dispose());instances.dispose();geometries.forEach(g=>g.dispose());material.dispose();target.dispose();renderer.dispose();}
}

export async function checkReplySearch(){
 const {ReplyOutlinePass}=await import('../../js/fx/ReplyOutlinePass.js');
 const referenceSearch=await import('./ReplySearchReference.js');
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(240,180);renderer.setClearColor(0,1);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);camera.position.z=8;
 const target=new THREE.WebGLRenderTarget(240,180),a=new Uint8Array(240*180*4),b=new Uint8Array(a.length),material=new THREE.MeshBasicMaterial(),geometry=new THREE.SphereGeometry(1,12,8),replies=[];
 const fast=new ReplyOutlinePass(),reference=new ReplyOutlinePass();
 reference.distance.fragmentShader=reference.distance.fragmentShader.slice(0,reference.distance.fragmentShader.indexOf('void main(){'))+referenceSearch.horizontal;
 const shader=reference.contour.fragmentShader;
 reference.contour.fragmentShader=shader.slice(0,shader.indexOf('void main(){'))+referenceSearch.vertical+shader.slice(shader.indexOf('   if(echo.x<.01'));
 const results=[];
 try{
  for(const count of [1,12,80]){
   scene.clear();replies.forEach(reply=>reply.dispose());replies.length=0;
   for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(Math.sin(i*8.13)*4.2,Math.cos(i*7.71)*3.2,i*.002);mesh.scale.set(.12+i%3*.2,.12+i%4*.15,.1);scene.add(mesh);
    const reply=replyOutline(mesh);reply.setSignal(.3+i%3*.3);reply.echo.value.set(.13+i%7*.1,i%2);replies.push(reply);
   }
   renderer.setRenderTarget(target);renderer.clear();reference.render(renderer,scene,camera);renderer.readRenderTargetPixels(target,0,0,240,180,a);
   renderer.clear();fast.render(renderer,scene,camera);renderer.readRenderTargetPixels(target,0,0,240,180,b);
   let maxDifference=0,different=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);maxDifference=Math.max(maxDifference,d);if(d)different++;}
   if(maxDifference)throw Error(`Reply search changed pixels: ${JSON.stringify({count,maxDifference,different})}`);
   results.push({count,maxDifference,different});
  }
  return{passed:true,results};
 }finally{replies.forEach(reply=>reply.dispose());fast.dispose();reference.dispose();geometry.dispose();material.dispose();target.dispose();renderer.dispose();}
}
