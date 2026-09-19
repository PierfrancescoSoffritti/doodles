import * as THREE from 'three';
import { sharedPlantGeometry } from './SharedPlantGeometry.js?v=stable-30-3';

// Chunk ownership, growth and collision stay unchanged. Opaque instances with
// the same silhouette/material share a draw after the usual chunk culling.
export class PlantBatches {
 constructor(renderer, world, {cullInstances=true}={}) {
  this.renderer=renderer;this.world=world;this.enabled=true;this.cullInstances=cullInstances;this.groups=new Map();this.depth=0;
  this.frustum=new THREE.Frustum();this.projection=new THREE.Matrix4();this.identity=new THREE.Matrix4();
  this.saved=[];this.savedEntries=new WeakMap();this.savedEpoch=0;this.membership={has:source=>this.savedEntries.get(source)?.epoch===this.savedEpoch};this.bounds=new WeakMap();this.selected=new Map();this.entries=new WeakMap();this.stats={sources:0,visibleSources:0,draws:0,instances:0,uploads:0};
  this.original=renderer.render;
  this.render=(scene,camera)=>{
   // Reply masks use their own child meshes. Rebatching vegetation for this
   // layer cannot help and needlessly repeats all instance visibility work.
   if(!this.enabled||scene!==world||scene.overrideMaterial||camera.layers.mask===(1<<30))return this.original.call(renderer,scene,camera);
   world.updateWorldMatrix(true,false);
   if(!world.matrixWorld.equals(this.identity))return this.original.call(renderer,scene,camera);
   const outer=this.depth++===0;
   try{
    if(outer){
     world.plantBatchSources=this.membership;this.saved.length=0;this.savedEpoch++;
     for(const source of world.children)if(this.eligible(source)){
      let entry=this.savedEntries.get(source);
      if(!entry){entry={source,visible:false,epoch:0};this.savedEntries.set(source,entry);}
      entry.visible=source.visible;entry.epoch=this.savedEpoch;this.saved.push(entry);
     }
    }
    this.prepare(camera);
    for(const entry of this.saved)entry.source.visible=false;
    return this.original.call(renderer,scene,camera);
   }finally{
    this.depth--;
    if(outer){delete world.plantBatchSources;for(const entry of this.saved)entry.source.visible=entry.visible;for(const group of this.groups.values())group.mesh.visible=false;}
   }
  };
  renderer.render=this.render;
 }
 eligible(mesh){
  return mesh.isInstancedMesh&&mesh.renderOrder===0&&mesh.plantGeometry&&!mesh.material.transparent&&!mesh.instanceColor&&!mesh.morphTexture&&mesh.geometry.attributes.aBorn?.itemSize===1&&mesh.matrix.equals(this.identity);
 }
 prepare(camera){
  camera.updateMatrixWorld();
  this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  this.frustum.setFromProjectionMatrix(this.projection,camera.coordinateSystem,this.renderer.reversedDepthBuffer);
  const selected=this.selected;let visibleSources=0,instances=0;
  for(const materials of selected.values())for(const list of materials.values())list.length=0;
  for(const{source,visible}of this.saved){
   if(!visible||!source.layers.test(camera.layers))continue;
   source.updateWorldMatrix(false,false);
   if(!source.matrixWorld.equals(this.identity)||source.frustumCulled&&!this.frustum.intersectsObject(source))continue;
   let materials=selected.get(source.plantGeometry);if(!materials)selected.set(source.plantGeometry,materials=new Map());
   let list=materials.get(source.material);if(!list)materials.set(source.material,list=[]);
   const selection=this.selectInstances(source);
   if(selection.count){let entry=this.entries.get(source);if(!entry){entry={source,selection};this.entries.set(source,entry);}list.push(entry);visibleSources++;instances+=selection.count;}
  }
  for(const group of this.groups.values())group.mesh.visible=false;
  let draws=0;
  for(const[geometry,materials]of selected)for(const[material,sources]of materials){
   const key=geometry.uuid+':'+material.uuid,count=sources.reduce((n,s)=>n+s.selection.count,0);
   if(!count)continue;
   let group=this.groups.get(key);
   if(!group||group.capacity<count){
    if(group){group.mesh.removeFromParent();group.mesh.dispose();group.mesh.geometry.dispose();}
    const capacity=2**Math.ceil(Math.log2(Math.max(64,count))),g=sharedPlantGeometry(geometry);
    g.setAttribute('aBorn',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
    const mesh=new THREE.InstancedMesh(g,material,capacity);mesh.name='batched-plants';mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.world.add(mesh);group={mesh,capacity,signature:[]};this.groups.set(key,group);
   }
   const signature=group.signature;let changed=signature.length!==sources.length*5,index=0;
   for(const{source:s,selection:v}of sources){
    if(signature[index]!==s.id||signature[index+1]!==v.count||signature[index+2]!==v.version||signature[index+3]!==s.instanceMatrix.version||signature[index+4]!==s.geometry.attributes.aBorn.version)changed=true;
    signature[index++]=s.id;signature[index++]=v.count;signature[index++]=v.version;signature[index++]=s.instanceMatrix.version;signature[index++]=s.geometry.attributes.aBorn.version;
   }
   signature.length=index;
   const mesh=group.mesh;
   if(changed){
    let offset=0;const matrices=mesh.instanceMatrix.array,born=mesh.geometry.attributes.aBorn;
    for(const{source,selection}of sources){
     if(selection.all){
      matrices.set(selection.matrixView,offset*16);
      born.array.set(selection.bornView,offset);offset+=selection.count;continue;
     }
     for(let j=0;j<selection.count;j++){
     const i=selection.indices[j],from=source.instanceMatrix.array;
     for(let k=0;k<16;k++)matrices[offset*16+k]=from[i*16+k];
     born.array[offset++]=source.geometry.attributes.aBorn.array[i];
     }
    }
    mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;
    born.clearUpdateRanges();born.addUpdateRange(0,count);born.needsUpdate=true;
    this.stats.uploads++;
   }
   mesh.layers.mask=camera.layers.mask;mesh.count=count;mesh.visible=true;draws++;
  }
  Object.assign(this.stats,{sources:this.saved.length,visibleSources,instances,draws});
 }
 selectInstances(source){
  let cache=this.bounds.get(source);
  if(!cache){cache={matrixVersion:-1,indices:new Uint32Array(source.count),count:0,version:0};this.bounds.set(source,cache);}
  if(cache.matrixVersion!==source.instanceMatrix.version||cache.indices.length!==source.count){
   if(cache.indices.length!==source.count)cache.indices=new Uint32Array(source.count);
   const local=source.geometry.boundingSphere,m=source.instanceMatrix.array,a=new Float64Array(source.count*4),c=local.center;
   for(let i=0;i<source.count;i++){
    const k=i*16,j=i*4;
    a[j]=m[k]*c.x+m[k+4]*c.y+m[k+8]*c.z+m[k+12];
    a[j+1]=m[k+1]*c.x+m[k+5]*c.y+m[k+9]*c.z+m[k+13];
    a[j+2]=m[k+2]*c.x+m[k+6]*c.y+m[k+10]*c.z+m[k+14];
    a[j+3]=local.radius*Math.sqrt(Math.max(m[k]**2+m[k+1]**2+m[k+2]**2,m[k+4]**2+m[k+5]**2+m[k+6]**2,m[k+8]**2+m[k+9]**2+m[k+10]**2));
   }
   cache.spheres=a;cache.matrixVersion=source.instanceMatrix.version;
  }
  let count=0,changed=false;const a=cache.spheres;
  for(let i=0;i<source.count;i++){
   const j=i*4,r=a[j+3];if(!r)continue;
   let visible=true;
   if(source.frustumCulled&&this.cullInstances)for(const p of this.frustum.planes)if(p.normal.x*a[j]+p.normal.y*a[j+1]+p.normal.z*a[j+2]+p.constant < -r){visible=false;break;}
   if(visible){if(cache.indices[count]!==i)changed=true;cache.indices[count++]=i;}
  }
  if(changed||count!==cache.count)cache.version++;
  cache.count=count;cache.all=count===source.count;
  if(cache.all){
   const matrix=source.instanceMatrix.array,born=source.geometry.attributes.aBorn.array;
   if(cache.matrixArray!==matrix||cache.matrixView?.length!==count*16){cache.matrixArray=matrix;cache.matrixView=matrix.subarray(0,count*16);}
   if(cache.bornArray!==born||cache.bornView?.length!==count){cache.bornArray=born;cache.bornView=born.subarray(0,count);}
  }
  return cache;
 }

 dispose(){
  if(this.renderer.render===this.render)this.renderer.render=this.original;
  for(const group of this.groups.values()){group.mesh.removeFromParent();group.mesh.dispose();group.mesh.geometry.dispose();}
  this.groups.clear();this.selected.clear();this.saved.length=0;
 }
}
