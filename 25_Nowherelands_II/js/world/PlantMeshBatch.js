import * as THREE from 'three';

// Flatten articulated parts into one draw per material. The rig still owns the
// animation; these persistent buffers follow its transforms without rebuilding meshes.
export class PlantMeshBatch {
 constructor(rig,parent) {
  this.rig=rig;this.batches=[];this.inverse=new THREE.Matrix4();this.matrix=new THREE.Matrix4();this.normal=new THREE.Matrix3();this.point=new THREE.Vector3();
  const groups=new Map();
  rig.root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isReflector||mesh===rig.visitor)return;
   if(!groups.has(mesh.material))groups.set(mesh.material,[]);
   groups.get(mesh.material).push(mesh);mesh.visible=false;
  });
  for(const [material,parts] of groups){
   const count=parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count),0);
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
   const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;parent.add(mesh);
   this.batches.push({mesh,parts});
  }
  this.parent=parent;this.update();
 }
 update(){
  this.parent.updateWorldMatrix(true,false);this.rig.root.updateWorldMatrix(true,true);this.inverse.copy(this.parent.matrixWorld).invert();
  for(const {mesh,parts} of this.batches){
   const pos=mesh.geometry.attributes.position,norm=mesh.geometry.attributes.normal;let at=0;
   for(const part of parts){
    this.matrix.multiplyMatrices(this.inverse,part.matrixWorld);this.normal.getNormalMatrix(this.matrix);
    const p=part.geometry.attributes.position,n=part.geometry.attributes.normal,index=part.geometry.index,count=index?.count??p.count;
    for(let i=0;i<count;i++){
     const source=index?index.getX(i):i;
     this.point.fromBufferAttribute(p,source).applyMatrix4(this.matrix);pos.setXYZ(at,this.point.x,this.point.y,this.point.z);
     this.point.fromBufferAttribute(n,source).applyNormalMatrix(this.normal);norm.setXYZ(at++,this.point.x,this.point.y,this.point.z);
    }
   }
   pos.needsUpdate=true;norm.needsUpdate=true;
  }
 }
 dispose(){for(const {mesh} of this.batches){mesh.geometry.dispose();mesh.removeFromParent();}this.batches=[];}
}
