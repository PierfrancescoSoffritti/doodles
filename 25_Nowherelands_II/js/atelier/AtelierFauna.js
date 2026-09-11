import * as THREE from 'three';
import { FaunaModel } from '../world/fauna/FaunaModel.js?v=player-notes-13';
import { FaunaMeshes } from '../world/fauna/FaunaMeshes.js?v=pebble-full-1';
import { PebbleMeshes } from '../world/fauna/PebbleMeshes.js?v=pebble-full-1';
import { BirdMesh } from '../world/fauna/BirdMesh.js?v=outline-2';
import { BirdEncounter } from '../world/fauna/BirdEncounter.js?v=outline-2';
import { BIRD_SPECIES } from '../world/fauna/BirdSpecies.js';
import { Fireflies } from '../world/Fireflies.js';
import { createFogUniforms } from '../world/FogGlsl.js';
import { damp } from '../world/fauna/Locomotion.js';

export class AtelierFauna {
 constructor(scene,renderer,species){
  this.scene=scene;this.renderer=renderer;this.species=species;this.time=0;this.serial=0;this.group=false;this.mode='rest';this.palette=0;
  this.shared={moon:{dir:new THREE.Vector3(-.3,1,.4).normalize(),intensity:2.5},sun:{intensity:0},night:1,fogUniforms:createFogUniforms()};this.shared.fogUniforms.uFogDensity.value=0;
  this.root=new THREE.Group();scene.add(this.root);
  const id=species.id;
  this.meshes=id==='lumen'?new FaunaMeshes(this.root,this.shared):id==='hopper'?new PebbleMeshes(this.root,this.shared):species.bird!==undefined?new BirdMesh(this.root,3):null;
  if(id==='hopper')for(const mesh of [this.meshes.bodies,this.meshes.stones,this.meshes.legs])mesh.castShadow=true;
  if(id==='firefly')this.flies=new Fireflies(this.root,{height:()=>0,_water:0,waterLevel:0},this.shared);
  this.reset();
 }
 reset(){
  this.serial++;let seed=97+this.serial*167;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  this.mode='rest';this.time=0;this.accumulator=0;this.destination=null;
  const id=this.species.id;
  if(id==='lumen'||id==='hopper'){
   this.sample=()=>({ground:0,water:id==='lumen'?3:-8,slope:.12,wet:id==='lumen'?1:.2,forest:id==='lumen'?1:.08,hardness:.83,foam:0});
   this.model=new FaunaModel('atelier-'+id+'-'+this.serial,{sample:this.sample});
   const group=this.model.addGroup(id,id,0,0,1);this.subject=group.members[0];
   if(!this.group)group.members=[this.subject];else if(id==='lumen')group.members=group.members.slice(0,9);
   this.model.creatures=group.members;this.model.time=10;this.model.listener={x:70,y:11,z:0};
   for(const [i,c] of group.members.entries()){
    c.born=-10;
    if(id==='lumen'){
     const a=i*Math.PI*2/group.members.length;c.pos={x:this.group?Math.cos(a)*4:0,y:3+(this.group?Math.sin(i*2)*1.2:0),z:this.group?Math.sin(a)*4:0};c.prev={...c.pos};c.atelierOrigin={...c.pos};c.size=.8+rnd()*.5;
     c.yaw=c.prevYaw=c.bank=c.prevBank=c.pitch=c.prevPitch=0;c.speed=1;
    }
   }
  }else if(this.species.bird!==undefined){
   this.birds=Array.from({length:this.group?3:1},(_,i)=>{
    const z=this.group?(i-1)*2.5:0,e=new BirdEncounter({x:-5,y:0,z},{x:5,y:8,z},BIRD_SPECIES[this.species.bird].size*(.92+rnd()*.16),{species:this.species.bird});
    e.variant=this.group?(this.palette+i)%3:this.palette;e.journey.idleTime=rnd()*7;e.enableForaging({seed:seed+i*71,sample:()=>0});return e;
   });
  }else{
   this.flies.items=Array.from({length:this.group?48:1},()=>{
    const f=this.flies.make((rnd()-.5)*17,(rnd()-.5)*13,false);Object.assign(f,{phase:rnd()*6.28,hue:rnd(),size:.8+rnd()*1.4,drift:rnd()*6.28,speed:.3+rnd()*.5});f.home={x:f.x,z:f.z};return f;
   });this.flies.rebuild();
  }
  this.update(0);
 }
 act(mode){
  this.mode=mode;
  if(this.species.bird!==undefined){for(const b of this.birds){if(mode==='fly'||b.pose.state==='perched')b.pendingFlight=true;}return;}
  if(this.species.id==='hopper'){
   const p=this.subject.pos,l=this.model.listener,dx=l.x-p.x,dz=l.z-p.z,d=Math.hypot(dx,dz)||1,range=mode==='rest'?36:3;
   this.destination={x:p.x+dx/d*range,z:p.z+dz/d*range};
  }
 }
 center(){
  if(this.species.id==='hopper'){
   const members=this.model.creatures;return members.reduce((v,c)=>v.add(new THREE.Vector3(c.pos.x,c.pos.y+4.5,c.pos.z)),new THREE.Vector3()).multiplyScalar(1/members.length);
  }
  if(this.species.id==='firefly'&&!this.group){const f=this.flies.items[0];return new THREE.Vector3(f.x,f.y,f.z);}
  if(this.birds&&!this.group){const p=this.birds[0].pose.position;return new THREE.Vector3(p.x,p.y+1,p.z);}
  return new THREE.Vector3(0,this.species.bird!==undefined?4:4,0);
 }
 distance(){return this.species.id==='hopper'?(this.group?65:30):this.species.id==='firefly'?(this.group?35:9):this.species.bird!==undefined?(this.group?38:20):this.group?32:17;}
 update(dt){
  this.time+=dt;const id=this.species.id;
  if(id==='lumen'){
   this.model.time+=dt;
   for(const [i,c] of this.model.creatures.entries()){
    const speed=this.mode==='flee'?90:this.mode==='swim'?18:1,t=this.time+i*.8;
    c.speed=damp(c.speed,speed,3,dt);c.effort=damp(c.effort,Math.min(1,c.speed/26),3,dt);c.stroke+=dt*Math.PI*2*(.2+c.effort*1.3);c.breath+=dt;
    c.vel={x:Math.cos(t*.6)*c.speed,y:Math.sin(t*.43)*c.speed*.35,z:Math.sin(t*.6)*c.speed};c.oldVX=c.vel.x;c.oldVY=c.vel.y;c.oldVZ=c.vel.z;
    c.elastic={x:Math.sin(t*.8)*.6,y:Math.cos(t)*.4,z:Math.cos(t*.8)*.6};c.prevStroke=c.stroke;c.bend=Math.sin(t*.22)*.24;
   }
   this.meshes.update(this.model,1,dt,this.sample);this.status=this.mode==='rest'?'Resting · rounded, breathing light':this.mode==='swim'?'Swimming · an elastic stroke through the body':'Fleeing · a rising flutter and stretched light';
  }else if(id==='hopper'){
   this.accumulator+=dt;
   while(this.accumulator>=1/30){
    if(this.destination){const l=this.model.listener,d=this.destination,dx=d.x-l.x,dz=d.z-l.z,n=Math.hypot(dx,dz),stride=Math.min(n,(this.mode==='run'?18:4.5)/30);l.x+=dx/Math.max(n,.001)*stride;l.z+=dz/Math.max(n,.001)*stride;if(n<.1)this.destination=null;}
    this.model.step(1/30);this.accumulator-=1/30;
   }
   this.meshes.update(this.model,1);this.status=({rest:'Resting · watchful eyes',notice:'Alert · watching the visitor',rise:'Startled · unfolding',flee:'Scattering at full speed',regroup:'Returning to the colony',wait:'Waiting for the colony',brake:'Braking · finding balance',settle:'Settling back into stone'})[this.subject.pebble.state]||this.subject.pebble.state;
  }else if(this.birds){this.meshes.update(this.birds.map(b=>{if(dt&&b.pendingFlight&&!b.journey.active){const ok=b.pose.state==='perched'?b.travelTo(b.ground,{ground:true}):b.start();if(ok)b.pendingFlight=false;}return b.update(dt);}));this.status=this.birds[0].pose.state+' · '+this.species.name;}
  else{
   this.shared.audio={analysis:{attack:this.mode==='pulse'?Math.pow(Math.max(0,Math.sin(this.time*2)),8):0}};
   for(const f of this.flies.items){f.x=f.home.x+Math.sin(this.time*f.speed+f.drift)*3;f.z=f.home.z+Math.cos(this.time*f.speed*.8+f.drift)*3;}
   this.flies.update(this.time,dt,{x:0,y:0,z:0},this.renderer);
   // Magnify the production point sprite for inspection; keep its pulse and color.
   this.flies.material.uniforms.uPixelRatio.value*=4;this.status=this.mode==='pulse'?'Brighter pulses · previewing a sound response':'Drifting · independent rhythms in the dark';
  }
 }
}
