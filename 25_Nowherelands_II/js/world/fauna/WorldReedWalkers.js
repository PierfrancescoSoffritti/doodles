import * as THREE from 'three';
import { reedSites } from './ReedWalkerHabitat.js?v=world-2';
import { ReedWalkerWorldModel } from './ReedWalkerWorldModel.js?v=world-2';
import { ReedWalkerRig } from './ReedWalkerRig.js?v=world-1';
import { ReedWalkerAudio } from '../../audio/ReedWalkerAudio.js?family=6';
import { bus, Events } from '../../core/EventBus.js';

export class WorldReedWalkers {
 constructor(scene, heightmap, shared, fauna) {
  this.shared=shared;this.hm=heightmap;this.root=new THREE.Group();this.root.name='Reed walker families';scene.add(this.root);
  this.rigs=new Map();this.streamAt=0;
  const blocked=(x,z,r,y)=>shared.colliders.some(c=>Math.hypot(x-c.position.x,z-c.position.z)<(c.radius||c.r||0)+r&&Math.abs(y-c.position.y)<Math.max(12,(c.radius||c.r||0)*2));
  this.model=new ReedWalkerWorldModel(fauna.model.seed,reedSites(shared.world,fauna.lakes),fauna.sample,blocked);
  this.model.onSound=(m,event)=>this.call(m,event);
  this.model.onRipple=m=>{if(Math.hypot(m.position.x-shared.player.position.x,m.position.z-shared.player.position.z)<180)bus.emit(Events.RIPPLE,{x:m.position.x,z:m.position.z,size:.25,hue:shared.hue,saturation:.15});};
 }
 sync() {
  const members=[...this.model.groups.values()].flatMap(g=>g.members),live=new Set(members);
  for(const [m,rig] of this.rigs) if(!live.has(m)){rig.root.removeFromParent();rig.dispose();this.rigs.delete(m);}
  for(const m of members) if(!this.rigs.has(m)) {
   const rig=new ReedWalkerRig(m.traits);rig.root.scale.setScalar(m.scale);
   const materials=new Set();rig.root.traverse(o=>{if(o.material)materials.add(o.material);});
   for(const material of materials) if(material.emissive)material.emissive.copy(material.color).multiplyScalar(.10);
   this.root.add(rig.root);this.rigs.set(m,rig);
  }
 }
 call(m,event='rumble') {
  if(!m||!this.shared.audio||(this.shared.caveAmount||0)>.4)return false;
  this.audio ||= new ReedWalkerAudio(this.shared.audio);
  return this.audio.play(m.traits,event,{position:m.position,listener:this.shared.player.position});
 }
 update(dt) {
  const p=this.shared.player.position;this.root.visible=this.shared.surfaceStreaming!==false;
  if(!this.root.visible)return;
  if(this.model.time>=this.streamAt){this.streamAt=this.model.time+2;this.model.stream(p);this.sync();}
  this.model.update(Math.min(dt,.05),p);
  if(this.audio)this.audio.muted=!!this.shared.fauna.audio?.muted;
  for(const [m,rig] of this.rigs){
   rig.root.visible=Math.hypot(m.origin.x-p.x,m.origin.z-p.z)<320;
   if(!rig.root.visible)continue;
   rig.root.position.set(m.draw.origin.x,m.draw.origin.y,m.draw.origin.z);rig.root.rotation.y=m.draw.yaw;
   rig.update(m.clock,m.state,0,m.draw.pose);
  }
 }
 visit(current) {const g=this.model.findFamily(this.shared.player.position,current);this.sync();return g;}
 dispose(){this.audio?.dispose();for(const rig of this.rigs.values())rig.dispose();this.rigs.clear();this.root.removeFromParent();}
}
