import * as THREE from 'three';
import { VegetationStudy, reedVoice } from '../atelier/VegetationStudy.js?v=reed-chorus-1';
import { VegetationMeshes } from '../atelier/VegetationMeshes.js';
import { PlantMeshBatch } from './PlantMeshBatch.js?v=gpu-parts-1';
import { plantSites } from './PlantHabitats.js?v=lowland-plants-1';
import { playerNoteRadius } from './RippleWave.js';
import { replyOutline } from './fauna/ReplyOutline.js?v=pendant-feedback-1';
import { replyHighlight } from './fauna/ReplyHighlight.js';
import { bus, Events } from '../core/EventBus.js';

export const PLANT_SPECIES=['bell-reed','veil-willow'];
export const PLANT_RANGE={fade:380,hide:520,load:600,retire:700,animate:180};
export class WorldPlants {
 constructor(scene,hm,shared,lakes,seed,{small=false}={}) {
  this.shared=shared;this.hm=hm;this.seed=seed;this.small=small;this.root=new THREE.Group();this.root.name='Bell reeds and veil willows';scene.add(this.root);
  this.entries=new Map();this.time=0;this.streamAt=0;this.voices=[];this.reflecting=new Set();this.buildQueue=[];
  const sample=(x,z)=>{
   const ground=hm.sample(x,z),water=hm._water,slope=hm._slope,foam=hm._foam||0,hab={...hm.habitat(x,z)};
   return {ground,water,slope,foam,...hab,roof:hm.caves?.hasOpening(x,z)||hm.caves?.surfaceDensity(x,ground,z)>-2};
  };
  this.sites=plantSites(shared.world,lakes,sample,seed);
 }
 blocked(site){return this.shared.colliders.some(c=>c!==this.entries.get(site.id)?.collider&&Math.hypot(site.x-c.position.x,site.z-c.position.z)<(c.radius||c.r||0)+(site.species==='veil-willow'?8:3)&&Math.abs(site.y-c.position.y)<Math.max(30,(c.radius||c.r||0)*2));}
 add(site){
  const model=new VegetationStudy({species:site.species,form:site.form,seed:`${this.seed}:${site.id}`,pendants:site.pendants});
  for(const [i,companion] of (site.companions||[]).entries()){
   const plant=new VegetationStudy({species:'bell-reed',form:companion.form,seed:`${this.seed}:${site.id}:companion:${i}`}).plants[0];
   plant.id=model.plants.length;plant.x=(companion.x-site.x)/site.scale;plant.z=(companion.z-site.z)/site.scale;plant.y=(companion.y-site.y)/site.scale;plant.scale*=companion.scale/site.scale;model.plants.push(plant);
  }
  const root=new THREE.Group();root.position.set(site.x,site.y,site.z);root.scale.setScalar(site.scale);this.root.add(root);
  const rig=new VegetationMeshes(root,model,this.shared.camera);rig.update(this.shared.camera);
  // Match the world's existing ambient lift: shaded foliage remains readable at night.
  for(const [material,intensity] of [[rig.leafMat,.18],[rig.bark,.1],[rig.stalk,.08],[rig.basalMat,.12]]){material.emissive.copy(material.color);material.emissiveIntensity=intensity;}
  for(const {shell} of rig.stems){const material=shell.children[0].material;material.emissive.copy(material.color);material.emissiveIntensity=.1;}
  const batch=new PlantMeshBatch(rig,root);
  // The explicit animation update maintains source transforms. Do not traverse
  // hundreds of hidden source parts again during each scene/reflection render.
  rig.root.updateMatrixWorld=()=>{};
  const entry={site,root,model,rig,batch,nextUpdate:0};
  batch.range.value.set(PLANT_RANGE.fade,PLANT_RANGE.hide);
  entry.pendants=rig.mirrors.map(mirror=>{
   // A small volume is easier to aim at than a thin, swaying mirror plane.
   const hitbox=new THREE.Mesh(new THREE.SphereGeometry(.37,10,8),new THREE.MeshBasicMaterial());hitbox.visible=false;mirror.turn.add(hitbox);
   const item={entry,mirror,mesh:mirror.reflector,reply:replyOutline(mirror.reflector)};
   item.target={mesh:hitbox,onPress:charge=>this.touchPendant(item,charge),onHover:on=>{mirror.hovered=on;}};
   return item;
  });
  entry.reeds=rig.stems.map(stem=>{
   // Pick the visible husk geometry, even though its rendering is batched.
   const target={mesh:stem.shell.children[0],onHover:()=>{},onPress:charge=>{
    if(this.entries.get(site.id)!==entry||!this.root.visible)return;
    this.shared.playerNotes?.send(charge,{site:site.id,plant:stem.plant.id,part:stem.spec.id});
   }};
   return {stem,target};
  });
  // Real player proximity drives bending, expressed in the specimen's local units.
  model.visitor=()=>{const p=this.shared.player.position;return {active:false,x:(p.x-site.x)/site.scale,z:(p.z-site.z)/site.scale};};
  model.brushBend=plant=>{
   const p=this.shared.player.position,v=model.visitor();
   if(Math.abs(p.y-(site.y+(plant.y||0)*site.scale+11))>15)return 0;
   return Math.exp(-((v.x-plant.x)**2+(v.z-plant.z)**2)/1.7)*.3;
  };
  if(site.species==='veil-willow'){
   entry.collider={position:new THREE.Vector3(site.x,site.y+12,site.z),radius:site.scale*.34};this.shared.colliders.push(entry.collider);
  }
  this.entries.set(site.id,entry);return entry;
 }
 remove(entry){
  for(const item of entry.pendants)item.reply.dispose();
  entry.batch.dispose();entry.rig.dispose();entry.root.removeFromParent();this.entries.delete(entry.site.id);
  if(entry.collider){const i=this.shared.colliders.indexOf(entry.collider);if(i>=0)this.shared.colliders.splice(i,1);}
 }
 stream(force=false){
  const p=this.shared.player.position,distance=s=>Math.hypot(s.x-p.x,s.z-p.z);
  // Keep every site in the visible neighbourhood. No nearest-N substitutions.
  for(const entry of this.entries.values())if(distance(entry.site)>PLANT_RANGE.retire)this.remove(entry);
  this.buildQueue=this.sites.filter(s=>distance(s)<PLANT_RANGE.load&&!this.entries.has(s.id)&&!this.blocked(s))
   .sort((a,b)=>distance(a)-distance(b));
  if(force){while(this.buildQueue.length)this.buildNext();}else this.buildNext();
 }
 buildNext(){
  const site=this.buildQueue.shift();if(!site||this.entries.has(site.id))return;
  const p=this.shared.player.position;if(Math.hypot(site.x-p.x,site.z-p.z)>=PLANT_RANGE.load)return;
  this.add(site);
 }
 hearNote(note){
  if(note.layer!=='player-note'||!note.position||!this.root.visible||(this.shared.caveAmount||0)>.4)return;
  const radius=note.radius??playerNoteRadius(note.velocity),charge=Math.max(0,Math.min(1,((note.velocity??.35)-.35)/.6));
  const aimed=this.entries.get(note.replyTarget?.site);
  for(const entry of this.entries.values())if(entry.site.species==='bell-reed'&&(entry===aimed||Math.hypot(entry.site.x-note.position.x,entry.site.z-note.position.z)<=radius&&Math.abs(entry.site.y+8-note.position.y)<25)){
   entry.model.offerNote(charge,'player',entry===aimed?note.replyTarget:null,aimed&&entry!==aimed?.12:0);
  }
 }
 play(entry,event){
  const s=this.shared,e=s.audio;if(!e||e.ctx.state!=='running'||s.fauna?.audio?.muted||(s.caveAmount||0)>.4||globalThis.document?.hidden)return;
  if(event.kind!=='reed')return;
  this.voices=this.voices.filter(voice=>voice.end>e.now);
  const stem=entry.rig.stems.find(s=>s.plant.id===event.plant&&s.spec.id===event.part);
  const position=stem?.bulb.getWorldPosition(new THREE.Vector3());if(!position||position.distanceTo(s.player.position)>playerNoteRadius(1)+20)return;
  const voice=reedVoice(stem.plant,stem.spec),duration=voice.decay;
  // A simultaneous patch-wide answer is a bounded chord. Share matching pitches
  // instead of starting and immediately stealing dozens of identical oscillators.
  if(event.chorus){
   if(this.chorusFrame!==this.time){
    this.chorusFrame=this.time;this.chorusStart=e.now+.01;this.chorusDegrees=new Set();
    for(const voice of this.voices)voice.handle?.stop();this.voices=[];
   }
   if(this.chorusDegrees.has(voice.degree)||this.chorusDegrees.size>=6)return;
   this.chorusDegrees.add(voice.degree);
  }
  // Fade the oldest tail to make room; never discard the new answering note.
  if(this.voices.length>=6)this.voices.shift().handle?.stop();
  const handle=e.playBell({freq:s.conductor.scale.freq(voice.degree,voice.octave),time:event.chorus?this.chorusStart:e.now,position,velocity:.12*event.strength*(event.chorus?.6:1),ratio:2.02,index:.35,decay:duration,reverb:.25,delay:0,dest:e.playerBus,layer:'plant-reply'});
  this.voices.push({end:e.now+duration+.1,handle});
 }
 get hasReplyHighlights(){
  if(!this.root.visible)return false;
  for(const entry of this.entries.values())if(entry.root.visible&&entry.pendants.some(item=>item.reply.signal.value>.01))return true;
  return false;
 }
 get targets(){return [...this.entries.values()].filter(entry=>entry.root.visible&&(entry.distance??0)<PLANT_RANGE.animate).flatMap(entry=>[...entry.pendants,...entry.reeds].map(item=>item.target));}
 get pendants(){return [...this.entries.values()].filter(entry=>entry.root.visible&&(entry.distance??0)<PLANT_RANGE.animate).flatMap(entry=>entry.pendants);}
 touchPendant(item,charge=0){
  if(this.entries.get(item.entry.site.id)!==item.entry||!this.root.visible)return;
  const {mirror,entry}=item,position=mirror.reflector.getWorldPosition(new THREE.Vector3());
  entry.model.touchMirror(mirror.plant.id,mirror.spec.id,charge,false);
  this.shared.conductor?.mirrorTouch(position,'pendant');
  bus.emit(Events.RIPPLE,{x:entry.site.x,z:entry.site.z,size:2+Math.max(0,Math.min(1,charge))*2,hue:.95});
 }
 update(dt){
  this.time+=dt;this.root.visible=this.shared.surfaceStreaming!==false&&(this.shared.caveAmount||0)<.8;if(!this.root.visible)return;
  if(this.time>=this.streamAt){this.streamAt=this.time+.35;this.stream();}else if(this.buildQueue.length)this.buildNext();
  const camera=this.shared.camera,p=this.shared.player.position;
  for(const entry of this.entries.values()){
   const distance=Math.hypot(entry.site.x-p.x,entry.site.z-p.z);entry.distance=distance;entry.root.visible=distance<PLANT_RANGE.hide;
   entry.batch.viewer.value.set(p.x,p.z);
   if(!entry.root.visible)continue;
   // Distant plants are static GPU batches; their full rigs only animate nearby.
   for(const m of entry.rig.mirrors)m.reflector.visible=distance<PLANT_RANGE.animate;
   if(distance>PLANT_RANGE.animate){
    for(const {reply} of entry.pendants)reply.signal.value=0;
    entry.model.pending.length=0;entry.model.events.length=0;
    continue;
   }
   entry.model.wind=Math.min(1,.18+(this.shared.weather?.local?.windSpeed||0)/22);entry.model.update(dt);
   const active=entry.model.pending.length||entry.model.plants.some(p=>[...p.stems,...p.mirrors].some(s=>s.energy>.01));
   if(distance<100||active||this.time>=entry.nextUpdate){entry.nextUpdate=this.time+.1;entry.rig.update(camera);entry.batch.update();}
   // World reflection selection is global, shared with the mirror landmarks.
   for(const m of entry.rig.mirrors){const enabled=this.reflecting.has(m.reflector);m.reflector.material=enabled?m.reflectionMaterial:entry.rig.metal;m.reflector.onBeforeRender=enabled?m.render:()=>{};m.frame.material.emissive.set(m.hovered?'#ff6ad5':'#000000');m.frame.material.emissiveIntensity=m.hovered?.7:0;}
   for(const {mirror,reply} of entry.pendants){
    const start=mirror.spec.echoStart;
    reply.signal.value=replyHighlight(entry.model.time,start,start+.9);
    reply.echo.value.set(Math.max(0,Math.min(1,(entry.model.time-start)/.9)),mirror.spec.echoCharged?1:0);
   }
   for(const event of entry.model.drainEvents())this.play(entry,event);
  }
 }
 visit(species,current,visited=new Set()){
  const p=this.shared.player.position,candidates=this.sites.filter(s=>s.species===species&&s.id!==current?.id&&!this.blocked(s));
  candidates.sort((a,b)=>Number(visited.has(a.id))-Number(visited.has(b.id))||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));return candidates[0]||current||null;
 }
 dispose(){for(const voice of this.voices)voice.handle?.stop();this.voices=[];for(const e of this.entries.values())this.remove(e);this.root.removeFromParent();}
}
