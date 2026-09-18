import * as THREE from 'three';
import { WaterFish } from '../atelier/WaterFish.js?v=4';
import { PoolLilies } from './PoolLilies.js?v=pool-life-6';
import { PoolLifeModel, waterSites } from './WaterHabitats.js?v=pool-life-8';
import { RIVER_STRIDE as S, RV } from './gen/Rivers.js';
import { playerNoteRadius } from './RippleWave.js';

const LOAD_DISTANCE=540,VIEW_DISTANCE=420,FADE_DISTANCE=120;

export class WorldWaterLife {
 constructor(scene,hm,shared,lakes,seed,{small=false}={}){
  this.hm=hm;this.shared=shared;this.seed=seed;this.cap=small?8:12;this.entries=new Map();this.streamAt=0;this.time=0;this.voices=[];
  this.pickGeometry=new THREE.SphereGeometry(1,10,8);this.pickMaterial=new THREE.MeshBasicMaterial();
  this.root=new THREE.Group();this.root.name='Scarlet fish and light lilies';scene.add(this.root);
  const sample=(x,z)=>{
   const ground=hm.sample(x,z),water=hm._water,foam=hm._foam||0,seg=hm._riverSeg;let speed=0;
   if(seg>=0){const r=hm.world.rivers[hm.rivers.segRiver[seg]];speed=r.data[hm.rivers.segIndex[seg]*S+RV.SPEED];}
   return {ground,water,foam,speed,roof:!!hm.caves?.hasOpening(x,z)};
  };
  this.sample=sample;
  this.sites=waterSites(shared.world,lakes,sample,seed,hm.waterLevel);
 }
 add(site){
  // Reuse sampled two-unit cells across fish and repeated blips. Clearance
  // includes the largest body and sample spacing; no terrain probes per frame.
  const wet=new Map(),cell=2;
  const canSwim=(x,z,f)=>{
   const ix=Math.round(x/cell),iz=Math.round(z/cell),bottom=f.maxDepth+f.size*(.8+.2*f.bodyWidth)*.4+.22;
   for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
    const key=`${ix+dx}:${iz+dz}`;let depth=wet.get(key);
    if(depth===undefined){const sample=this.sample(site.x+(ix+dx)*cell,site.z+(iz+dz)*cell);
     depth=!sample.roof&&sample.foam<.12&&sample.speed<.8&&Math.abs(sample.water-site.y)<.12?sample.water-sample.ground:0;
     wet.set(key,depth);
    }
    if(depth<bottom)return false;
   }
   return true;
  };
  const model=new PoolLifeModel(site,this.seed,{canSwim});model.update(this.time);
  const root=new THREE.Group();root.position.set(site.x,site.y,site.z);this.root.add(root);
  const fish=new WaterFish(root,model);if(fish.mesh){fish.mesh.boundingSphere.set(new THREE.Vector3(0,-1,0),site.radius+70);fish.material.emissive.set('#ffffff');fish.material.emissiveIntensity=.36;
   fish.material.customProgramCacheKey=()=> 'water-fish-world-3';
   const compile=fish.material.onBeforeCompile;fish.material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=diffuseColor.rgb*.36;');};}
  const lilies=new PoolLilies(root,model,this.shared);
  for(const mesh of [fish.mesh,...lilies.batches.map(b=>b.mesh)])if(mesh){mesh.material.alphaHash=true;mesh.material.opacity=0;}
  const entry={site,root,model,fish,lilies,fade:0,targets:[]};
  for(const p of model.plants.filter(p=>p.bloom)){
   const mesh=new THREE.Mesh(this.pickGeometry,this.pickMaterial);mesh.visible=false;
   mesh.position.set(p.x-.23*Math.cos(p.turn)*p.size,p.size*.2*(p.flowerHeight??.85),p.z+.23*Math.sin(p.turn)*p.size);mesh.scale.set(p.size*.85,p.size*.28*(p.flowerHeight??.85),p.size*.85);root.add(mesh);
   entry.targets.push({mesh,onHover:on=>{p.hovered=on;},onPress:charge=>{
    if(this.entries.get(site.id)!==entry||!this.root.visible)return;
    this.shared.playerNotes?.send(charge,{waterSite:site.id,plant:p.index});
   }});
  }
  this.entries.set(site.id,entry);return entry;
 }
 remove(entry){entry.fish.dispose();entry.lilies.dispose();entry.root.removeFromParent();this.entries.delete(entry.site.id);}
 stream(force=false){
  const {position:p,velocity:v}=this.shared.player;
  const lookAhead=Math.min(1.5,240/(Math.hypot(v?.x||0,v?.z||0)||1)),x=p.x+(v?.x||0)*lookAhead,z=p.z+(v?.z||0)*lookAhead;
  const near=this.sites.map(site=>{
   const distance=Math.hypot(site.x-p.x,site.z-p.z),ahead=Math.hypot(site.x-x,site.z-z);
   // A small residency bias avoids churn, without pinning patches behind the
   // player while closer ones wait. Prepare the route ahead during movement.
   return {site,distance,ahead,priority:Math.min(distance,ahead)-(this.entries.has(site.id)?24:0)};
  }).filter(s=>Math.min(s.distance,s.ahead)<LOAD_DISTANCE&&Math.abs(s.site.y-p.y)<180);
  near.sort((a,b)=>Number(b.site===this.focus)-Number(a.site===this.focus)||a.priority-b.priority);
  const chosen=near.slice(0,this.cap).map(s=>s.site);
  for(const e of this.entries.values())if(!chosen.includes(e.site))this.remove(e);
  for(const site of chosen)if(!this.entries.has(site.id)){this.add(site);if(!force)break;}
  return chosen.some(site=>!this.entries.has(site.id));
 }
 get targets(){return [...this.entries.values()].filter(e=>e.root.visible).flatMap(e=>e.targets);}
 hearNote(note){
  if(note.layer!=='player-note'||!note.position||!this.root.visible||(this.shared.caveAmount||0)>.4)return;
  const charge=Math.max(0,Math.min(1,((note.velocity??.35)-.35)/.6));
  for(const e of this.entries.values())if(Math.abs(e.site.y-note.position.y)<35||note.replyTarget?.waterSite===e.site.id)e.model.hear(note.position.x,note.position.z,note.radius??playerNoteRadius(note.velocity),charge,note.replyTarget?.waterSite===e.site.id?note.replyTarget.plant:null);
 }
 play(entry,event){
  const s=this.shared,a=s.audio;if(!a||a.ctx.state!=='running'||s.fauna?.audio?.muted||globalThis.document?.hidden||(s.caveAmount||0)>.4)return;
  const p=entry.model.plants[event.plant],position={x:entry.site.x+p.x,y:entry.site.y+p.size*.2,z:entry.site.z+p.z};
  if(Math.hypot(position.x-s.player.position.x,position.z-s.player.position.z)>playerNoteRadius(1)+30)return;
  this.voices=this.voices.filter(v=>v.end>a.now);if(this.voices.length>=6)this.voices.shift().handle?.stop();
  const degree=Math.max(0,Math.min(6,Math.round((7.5-p.size)/5.7*6))),duration=.8+p.size*.12;
  const handle=a.playBell({freq:s.conductor.scale.freq(degree,2),position,velocity:.15*event.strength*(event.chorus?.65:1),ratio:2.02,index:.3,decay:duration,reverb:.25,delay:0,dest:a.playerBus,layer:'plant-reply'});
  this.voices.push({end:a.now+duration+.1,handle});
 }
 update(dt){
  this.time+=dt;this.root.visible=this.shared.surfaceStreaming!==false&&(this.shared.caveAmount||0)<.8;if(!this.root.visible)return;
  // Drain a newly encountered cluster one patch per frame, rather than making
  // each patch wait another polling interval while the player runs past it.
  if(this.time>=this.streamAt)this.streamAt=this.time+(this.stream()?0:.2);
  const p=this.shared.player.position;
  for(const e of this.entries.values()){
   e.fade=Math.min(1,e.fade+dt*1.5);
   const distance=Math.hypot(e.site.x-p.x,e.site.z-p.z);e.root.visible=distance<VIEW_DISTANCE;if(!e.root.visible)continue;
   e.model.update(this.time);e.fish.update();e.lilies.update();for(const event of e.model.drainEvents())this.play(e,event);
   // Fade in place with screen-door coverage: submerged fish and floating pads
   // keep their world size and height, and still enter the opaque water capture.
   const coverage=e.fade*Math.min(1,Math.max(0,(VIEW_DISTANCE-distance)/FADE_DISTANCE));
   for(const m of [e.fish.mesh,...e.lilies.batches.map(b=>b.mesh)])if(m)m.material.opacity=coverage;
  }
 }
 visit(species,current,visited=new Set()){
  const p=this.shared.player.position;
  return this.sites.filter(s=>s.id!==current?.id&&(species==='scarlet-fish'?s.groups.length:s.plants.some(p=>p.bloom)))
   .sort((a,b)=>Number(visited.has(a.id))-Number(visited.has(b.id))||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||current||null;
 }
 dispose(){for(const v of this.voices)v.handle?.stop();this.voices=[];this.pickGeometry.dispose();this.pickMaterial.dispose();for(const e of this.entries.values())this.remove(e);this.root.removeFromParent();}
}
