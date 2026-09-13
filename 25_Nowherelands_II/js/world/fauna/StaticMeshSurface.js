import * as THREE from 'three';

// Nearest double-sided hit on immutable, undeformed geometry. Habitat probes
// need a point, so avoid constructing every hit's UV, normal and face records.
export class StaticMeshSurface {
 constructor(geometry) {
  this.position=geometry.attributes.position;this.index=geometry.index;
  this.start=Math.max(0,geometry.drawRange.start);
  this.end=Math.min(this.index?.count??this.position.count,this.start+geometry.drawRange.count);
  const count=Math.max(0,Math.floor((this.end-this.start)/3));
  this.bounds=new Float64Array(count*6);
  this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.c=new THREE.Vector3();
  this.ray=new THREE.Ray();this.inverse=new THREE.Matrix4();this.box=new THREE.Box3();
  this.point=new THREE.Vector3();this.worldPoint=new THREE.Vector3();
  for(let i=0;i<count;i++){
   this.triangle(this.start+i*3);const a=this.a,b=this.b,c=this.c,k=i*6,v=this.bounds;
   v[k]=Math.min(a.x,b.x,c.x);v[k+1]=Math.min(a.y,b.y,c.y);v[k+2]=Math.min(a.z,b.z,c.z);
   v[k+3]=Math.max(a.x,b.x,c.x);v[k+4]=Math.max(a.y,b.y,c.y);v[k+5]=Math.max(a.z,b.z,c.z);
  }
 }
 triangle(offset){
  const p=this.position,index=this.index;
  this.a.fromBufferAttribute(p,index?index.getX(offset):offset);
  this.b.fromBufferAttribute(p,index?index.getX(offset+1):offset+1);
  this.c.fromBufferAttribute(p,index?index.getX(offset+2):offset+2);
 }
 intersect(matrix,raycaster,target){
  this.inverse.copy(matrix).invert();this.ray.copy(raycaster.ray).applyMatrix4(this.inverse);
  const v=this.bounds,box=this.box;let nearest=Infinity,hit=false;
  for(let k=0;k<v.length;k+=6){
   box.min.set(v[k],v[k+1],v[k+2]);box.max.set(v[k+3],v[k+4],v[k+5]);
   if(!this.ray.intersectsBox(box))continue;
   this.triangle(this.start+k/6*3);
   if(!this.ray.intersectTriangle(this.a,this.b,this.c,false,this.point))continue;
   this.worldPoint.copy(this.point).applyMatrix4(matrix);
   const distance=raycaster.ray.origin.distanceTo(this.worldPoint);
   if(distance<raycaster.near||distance>raycaster.far||distance>=nearest)continue;
   nearest=distance;target.copy(this.worldPoint);hit=true;
  }
  return hit?target:null;
 }
}
