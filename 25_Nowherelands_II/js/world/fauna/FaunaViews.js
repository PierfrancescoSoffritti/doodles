import * as THREE from 'three';

// Instanced creatures need per-instance culling. Include planar reflections,
// which can see animals outside the player's direct view. Environment probes
// already hide fauna, and the game's reflectors do not recursively capture.
export class FaunaViews {
 constructor(scene) {
  this.scene=scene;this.views=[];this.reflectors=null;
  this.matrix=new THREE.Matrix4();this.rotation=new THREE.Matrix4();
  this.normal=new THREE.Vector3();this.origin=new THREE.Vector3();
  this.position=new THREE.Vector3();this.look=new THREE.Vector3();this.up=new THREE.Vector3();
  this.camera=new THREE.PerspectiveCamera();this.sphere=new THREE.Sphere();
 }
 update(camera) {
  camera.updateWorldMatrix(true,false);
  const put=(index,c,reflection=false)=>{
   const view=this.views[index] ||= {frustum:new THREE.Frustum()};
   view.reflection=reflection;view.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));
  };
  put(0,camera);let count=1;
  if(!this.reflectors){this.reflectors=[];this.scene.traverse(o=>{if(o.isReflector)this.reflectors.push(o);});}
  for(const mirror of this.reflectors){
   if(mirror.reflectorMaterial&&mirror.material!==mirror.reflectorMaterial)continue;
   let visible=true;for(let p=mirror;p;p=p.parent)if(!p.visible){visible=false;break;}
   if(!visible)continue;
   mirror.updateWorldMatrix(true,false);
   if(mirror.frustumCulled&&!this.views[0].frustum.intersectsObject(mirror))continue;
   this.origin.setFromMatrixPosition(mirror.matrixWorld);
   this.normal.set(0,0,1).applyMatrix4(this.rotation.extractRotation(mirror.matrixWorld));
   this.position.setFromMatrixPosition(camera.matrixWorld);
   if(this.up.subVectors(this.position,this.origin).dot(this.normal)<0&&!mirror.forceUpdate)continue;
   this.rotation.extractRotation(camera.matrixWorld);
   this.look.set(0,0,-1).applyMatrix4(this.rotation).add(this.position);
   const reflect=p=>p.sub(this.origin).reflect(this.normal).add(this.origin);
   reflect(this.position);reflect(this.look);
   this.camera.position.copy(this.position);
   this.camera.up.set(0,1,0).applyMatrix4(this.rotation).reflect(this.normal);
   this.camera.lookAt(this.look);this.camera.updateMatrixWorld();
   this.camera.projectionMatrix.copy(camera.projectionMatrix);
   put(count++,this.camera,true);
  }
  this.count=count;
 }
 contains(position,radius) {
  this.sphere.center.copy(position);this.sphere.radius=radius;
  for(let i=0;i<this.count;i++){
   const {frustum,reflection}=this.views[i];
   // Oblique reflection clipping changes depth planes. Omitting them is
   // conservative while retaining the exact four side planes of its view.
   if(!reflection){if(frustum.intersectsSphere(this.sphere))return true;continue;}
   let inside=true;
   for(let k=0;k<4;k++)if(frustum.planes[k].distanceToPoint(position)<-radius){inside=false;break;}
   if(inside)return true;
  }
  return false;
 }
}
