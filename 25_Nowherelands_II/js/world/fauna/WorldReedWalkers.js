import { warmStreamedMaterials } from '../../fx/StreamedMaterialWarmup.js?v=streaming-60-30-19';
import { mobileDetail } from '../../core/MobileDetail.js?v=stable-30-3';
import { reedIndividual } from './ReedWalkerTraits.js';
import {replyOutline} from './ReplyOutline.js?v=streaming-60-30-19';
import { noteGlow } from './NoteGlow.js?v=player-notes-13';
import * as THREE from 'three';
import { reedSites } from './ReedWalkerHabitat.js?v=graze-1';
import { ReedWalkerWorldModel } from './ReedWalkerWorldModel.js?v=pebble-voice-4b';
import { ReedWalkerRig } from './ReedWalkerRig.js?v=stable-30-3';
import { ReedWalkerSpray } from './ReedWalkerSpray.js?v=world-spray-1';
import { reedWorldSprayPose } from './ReedWalkerReservoir.js?v=1';
import { ReedWalkerAudio } from '../../audio/ReedWalkerAudio.js?v=reed-7';
import { bus, Events } from '../../core/EventBus.js';

export class WorldReedWalkers {
 constructor(scene, heightmap, shared, fauna, seed) {
  this.shared=shared;this.hm=heightmap;this.root=new THREE.Group();this.root.name='Reed walker families';scene.add(this.root);
  this.rigs=new Map();this.pendingRigs=new Map();this.streamAt=0;this.buildBudget=mobileDetail?1.5:Infinity;this.maxBuildStepMs=0;
  const blocked=(x,z,r,y)=>shared.colliders.some(c=>Math.hypot(x-c.position.x,z-c.position.z)<(c.radius||c.r||0)+r&&Math.abs(y-c.position.y)<Math.max(12,(c.radius||c.r||0)*2));
  this.model=new ReedWalkerWorldModel(seed,reedSites(shared.world,fauna.lakes),fauna.sample,blocked);
  this.model.onNoteReply=(m,alarm)=>shared.playerNotes?.reply('reed',m,alarm);
  this.model.onSound=(m,event)=>this.call(m,event);
  this.model.onRipple=m=>{if(m.water>=m.feedingHeight-.2&&Math.hypot(m.position.x-shared.player.position.x,m.position.z-shared.player.position.z)<180)bus.emit(Events.RIPPLE,{x:m.position.x,z:m.position.z,size:.25,hue:shared.hue,saturation:.15});};
 }
 sync() {
  const members=[...this.model.groups.values()].flatMap(g=>g.members),live=new Set(members);
  for(const [m,rig] of this.rigs) if(!live.has(m)){rig.spray?.dispose();rig.root.removeFromParent();rig.dispose();this.rigs.delete(m);}
  for(const[m,work]of this.pendingRigs)if(!live.has(m)){work.return();this.pendingRigs.delete(m);}
  for(const m of members)if(!this.rigs.has(m)&&!this.pendingRigs.has(m))this.pendingRigs.set(m,this.buildRig(m));
  if(this.buildBudget===Infinity)this.drainRigs();
 }
 createRig(m) {
   const rig=new ReedWalkerRig(m.traits);return this.decorateRig(rig,m);
 }
 decorateRig(rig,m) {
   rig.noteUniforms={uNoteGlow:{value:0},uNotePhase:{value:0},uNoteAlarm:{value:0},uNoteFloor:{value:0},uNoteHeight:{value:m.traits.legs*m.scale}};
   const materials=new Set();rig.root.traverse(o=>{if(o.material)materials.add(o.material);});for(const material of materials)noteGlow(material,rig.noteUniforms);rig.root.scale.setScalar(m.scale);
   rig.replySignal={value:0};rig.replyEcho={value:new THREE.Vector2()};const parts=[];rig.root.traverse(o=>{if(o.isMesh)parts.push(o);});rig.replyOutlines=parts.map(part=>replyOutline(part,{signal:rig.replySignal,echo:rig.replyEcho}));
  return rig;
 }
 *buildRig(m) {
  const rig=new ReedWalkerRig(m.traits,true);let complete=false;
  try {yield* rig.work;this.decorateRig(rig,m);complete=true;return rig;}
  finally {if(!complete)rig.dispose();}
 }
 drainRigs() {
  if(!this.pendingRigs.size)return;
  const deadline=performance.now()+this.buildBudget;
  for(const[m,work]of this.pendingRigs){
   do {
    const start=performance.now(),step=work.next();this.maxBuildStepMs=Math.max(this.maxBuildStepMs,performance.now()-start);
    if(step.done){this.rigs.set(m,step.value);this.pendingRigs.delete(m);break;}
   }while(performance.now()<deadline);
   if(performance.now()>=deadline)break;
  }
  // Publish a complete family together; no half-built bodies enter the scene.
  for(const group of this.model.groups.values())if(group.members.every(m=>this.rigs.has(m)))for(const m of group.members){const rig=this.rigs.get(m);if(rig.root.parent!==this.root)this.root.add(rig.root);}
 }
 async prewarm() {
  const scene=new THREE.Scene();
  const rig=this.createRig({traits:reedIndividual('reedbed',1,'adult','male'),scale:1});
  scene.add(rig.root);rig.update(0);
  const spray=new ReedWalkerSpray(rig,scene);spray.mesh.visible=true;
  await warmStreamedMaterials(this.shared,[scene],{includeHidden:true});
  // Retain these exact program owners when the last streamed family retires.
  this.warmup={dispose(){spray.dispose();rig.dispose();scene.clear();}};
 }
 prepareAudio(){this.audio ||= new ReedWalkerAudio(this.shared.audio);}
 call(m,event='rumble') {
  if(!m||!this.shared.audio||(this.shared.caveAmount||0)>.4)return false;
  this.prepareAudio();
  return this.audio.play(m.traits,event,{position:m.position,listener:this.shared.player.position});
 }
 hearNote(note){if(this.root.visible&&(this.shared.caveAmount||0)<.4)this.model.hearNote(note);}
 update(dt) {
  const p=this.shared.player.position;this.root.visible=this.shared.surfaceStreaming!==false;
  if(!this.root.visible)return;
  if(this.model.time>=this.streamAt){this.streamAt=this.model.time+2;this.model.stream(p);this.sync();}
  this.drainRigs();
  this.model.update(Math.min(dt,.05),p);
  if(this.audio)this.audio.muted=!!this.shared.fauna.audio?.muted;
  for(const [m,rig] of this.rigs){
   if(rig.root.parent!==this.root)continue;
   rig.root.visible=Math.hypot(m.origin.x-p.x,m.origin.z-p.z)<320;
   if(!rig.root.visible){rig.spray?.update(0,false);continue;}
   rig.root.position.set(m.draw.origin.x,m.draw.origin.y,m.draw.origin.z);rig.root.rotation.y=m.draw.yaw;
   for(const reply of rig.replyOutlines)reply.setSignal(m.replyGlow||0);rig.replyEcho.value.set(m.replyProgress||0,m.replyCharged?1:0);
   rig.noteUniforms.uNoteGlow.value=m.noteGlow||0;rig.noteUniforms.uNotePhase.value=m.notePhase||0;rig.noteUniforms.uNoteAlarm.value=m.noteAlarm?1:0;rig.noteUniforms.uNoteFloor.value=m.origin.y;
   rig.update(m.release?.time??m.clock,m.state,0,m.draw.pose);
   const nearby=Math.hypot(m.origin.x-p.x,m.origin.z-p.z)<140;
   if(m.release&&nearby){
    rig.spray??=new ReedWalkerSpray(rig,this.root);
    if(rig.sprayRelease!==m.release.id){
     const release=m.release;
     rig.spray.configure(release.profile,time=>reedWorldSprayPose(m.traits,release,time),true);
     rig.spray.setLight(true);rig.sprayRelease=release.id;
    }
    rig.spray.update(m.release.time,true,m.bankWater);
   }else rig.spray?.update(0,false);
  }
 }
 visit(current) {const g=this.model.findFamily(this.shared.player.position,current);this.sync();return g;}
 dispose(){for(const work of this.pendingRigs.values())work.return();this.pendingRigs.clear();this.warmup?.dispose();this.audio?.dispose();for(const rig of this.rigs.values()){rig.spray?.dispose();rig.dispose();}this.rigs.clear();this.root.removeFromParent();}
}
