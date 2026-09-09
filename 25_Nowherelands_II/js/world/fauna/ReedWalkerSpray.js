import * as THREE from 'three';
import { reedDrinkPose, reedSprayProfile, reedSprayDrops, reedDropPoint } from './ReedWalkerDrink.js?v=world-spray-1';
const up=new THREE.Vector3(0,1,0);

// Fixed-size, deterministic droplets make pause, replay and seeking reliable.
export class ReedWalkerSpray {
 constructor(rig,scene){
  this.rig=rig;this.profile=reedSprayProfile(rig.traits);this.drops=reedSprayDrops(rig.traits,this.profile);
  this.geometry=new THREE.IcosahedronGeometry(1,0);
  this.material=new THREE.MeshBasicMaterial({color:'#739fae',transparent:true,opacity:.78,depthWrite:false});
  this.mesh=new THREE.InstancedMesh(this.geometry,this.material,this.drops.length);this.mesh.frustumCulled=false;this.mesh.visible=false;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);
  const color=new THREE.Color();this.drops.forEach((d,i)=>this.mesh.setColorAt(i,color.setScalar(d.shade)));
  this.dummy=new THREE.Object3D();this.origin=new THREE.Vector3();this.velocity=new THREE.Vector3();this.rotation=new THREE.Euler();this.live=0;
  this.configure(this.profile);
 }
 configure(profile,poseAt=time=>reedDrinkPose(this.rig.traits,time,profile),resting=false){
  this.profile=profile;
  const updated=reedSprayDrops(this.rig.traits,profile);
  for(let i=0;i<this.drops.length;i++){
   const d=this.drops[i];d.at=updated[i].at;
   const birth=poseAt(d.at);
   this.rotation.set(birth.roll||0,0,birth.tilt);
   d.origin=this.rig.sprayAnchor.clone();
   d.origin.y*=1+((birth.waterLoad||0)*.075+Math.sin(d.at*(resting?.7:.52))*(resting?.035:.018))/.87;
   d.origin.applyEuler(this.rotation).add(new THREE.Vector3().fromArray(birth.body));
  }
 }

 update(time,visible=true,waterLevel=this.rig.root.position.y+this.rig.traits.depth){
  this.mesh.visible=visible;this.live=0;if(!visible)return;
  const rig=this.rig,traits=rig.traits;
  rig.root.updateMatrixWorld(true);
  for(let i=0;i<this.drops.length;i++){
   const d=this.drops[i],age=time-d.at,p=age<5?reedDropPoint(d,age,traits):null,dummy=this.dummy;
   dummy.scale.setScalar(0);
   if(p){
    dummy.position.set(d.origin.x+p.x,d.origin.y+p.y,d.origin.z+p.z).applyMatrix4(rig.root.matrixWorld);
    const water=waterLevel;
    if(dummy.position.y>water+.025){
     this.velocity.set(p.vx,p.vy,p.vz).normalize().transformDirection(rig.root.matrixWorld);
     dummy.quaternion.setFromUnitVectors(up,this.velocity);
     const size=d.size*rig.root.scale.x;
     dummy.scale.set(size,size*d.length,size);this.live++;
    }
   }
   dummy.updateMatrix();this.mesh.setMatrixAt(i,dummy.matrix);
  }
  this.mesh.instanceMatrix.needsUpdate=true;
 }
 setLight(dark){this.material.color.set(dark?'#bde5e8':'#739fae');}
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
