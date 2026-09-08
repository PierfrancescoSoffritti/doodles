import {BirdHabitats,birdHash} from './BirdHabitats.js?v=birds-10';
import {BIRD_SPECIES} from './BirdSpecies.js?v=birds-10';
import * as THREE from 'three';
import {BirdPassages,SKY_BIRD_CAPACITY} from './BirdPassages.js?v=birds-10';
import {BirdSprites} from './BirdSprites.js?v=birds-10';
import {BirdMesh} from './BirdMesh.js?v=birds-10';
import {BirdEncounter} from './BirdEncounter.js?v=birds-10';
import {BIRD_JOURNEY_TIME} from './BirdJourney.js?v=birds-10';

const SCALE=4,MAX_ENCOUNTERS=28;
export class WorldBirds {
 constructor(scene,heightmap,shared,vegetation,seed){
  this.shared=shared;this.hm=heightmap;this.vegetation=vegetation;this.time=0;this.nextStream=0;
  this.root=new THREE.Group();this.root.name='Birds';scene.add(this.root);
  this.sky=new BirdPassages({seed,ground:(x,z)=>Math.max(0,heightmap.height(x*SCALE,z*SCALE))/SCALE});
  this.sprites=new BirdSprites(this.root,SKY_BIRD_CAPACITY,{size:5.3,fogNear:800,fogFar:2400,nearFade:100,farFade:2200});this.sprites.mesh.scale.setScalar(SCALE);
  this.mesh=new BirdMesh(this.root,MAX_ENCOUNTERS);
  // A little diffuse lift keeps charcoal plumage readable in this moonlit world.
  this.mesh.material.color.setScalar(1.25);this.mesh.material.emissive.set('#171a28');this.mesh.material.emissiveIntensity=.35;
  this.encounters=[];this.habitats=new BirdHabitats(seed);this.rejectedSites=new WeakSet();
 }
 prime(){this.stream();this.update(0);}
 stream(){
  const p=this.shared.player.position,v=this.vegetation,hm=this.hm;
  const liveChunks=new Set(v.chunks.values());
  this.encounters=this.encounters.filter(e=>liveChunks.has(e.site.chunk)&&Math.hypot(e.ground.x-p.x,e.ground.z-p.z)<850);
  this.habitatStats={perches:[...v.chunks.values()].reduce((n,c)=>n+(c.birdPerches?.length||0),0),candidates:0,surface:0,blocked:0,attempts:0};
  const used=new Set(this.encounters.flatMap(e=>e.journey.active&&e.sourceSite?[e.site,e.sourceSite]:[e.site]));
  this.sites=[...v.chunks.values()].flatMap(c=>c.birdPerches||[]).filter(s=>v.time-s.born[s.index]>3);
  const groups=this.habitats.groups(this.sites,p);
  this.habitatStats.candidates=groups.reduce((n,g)=>n+g.sites.length,0);this.habitatStats.areas=groups.length;
  // Give every territory its first bird before filling companions in any one.
  this.habitats.populate(groups,this.encounters,MAX_ENCOUNTERS,(site,area)=>{
   if(used.has(site)||this.rejectedSites.has(site))return null;
   if(this.encounters.filter(e=>e.site.treeId===site.treeId).length>=3)return null;
   if(this.encounters.some(e=>Math.hypot(e.perch.x-site.position.x,e.perch.y-site.position.y,e.perch.z-site.position.z)<3.5))return null;
   const encounter=this.spawnAt(site,area);if(encounter)used.add(site);return encounter;
  });
 }

 spawnAt(site,area){
  const v=this.vegetation,hm=this.hm,perch=v.birdPerchPosition(site),out=Math.atan2(perch.z-site.trunk.z,perch.x-site.trunk.x);
  const identity=birdHash(Math.round(site.position.x*13),Math.round(site.position.z*13+site.position.y),this.habitats.seed);
  const profile=BIRD_SPECIES[area.species],size=profile.size*(.94+(identity%13)*.01);
  let occupied=false;
  for(let i=0;i<8;i++){
   const angle=out+(i%2?1:-1)*Math.ceil(i/2)*.35,distance=29+i*2;
   const x=perch.x+Math.cos(angle)*distance,z=perch.z+Math.sin(angle)*distance,y=hm.sample(x,z);
   this.habitatStats.attempts++;
   if(!Number.isFinite(y)||y<hm._water+2||hm._slope>.35||perch.y-y<6||perch.y-y>35||hm.caves.hasOpening(x,z))continue;
   this.habitatStats.surface++;
   if(this.encounters.some(e=>Math.hypot(e.ground.x-x,e.ground.z-z)<5)){occupied=true;continue;}
   if(this.shared.colliders.some(c=>Math.hypot(x-c.position.x,z-c.position.z)<(c.radius||c.r||0)+5))continue;
   const e=new BirdEncounter({x,y,z},perch,size,{species:area.species});let clear=true;
   for(let direction=0;direction<2&&clear;direction++){
    e.start();
    for(let k=0;k<=24;k++){
     e.journey.seek(k/24*BIRD_JOURNEY_TIME);const q=e.sample().position;
     if(q.y<hm.height(q.x,q.z)+.2){clear=false;break;}
     if(k>3&&k<21&&this.shared.colliders.some(c=>Math.hypot(q.x-c.position.x,q.z-c.position.z)<(c.radius||c.r||0)+3)){clear=false;break;}
    }
   }
   if(!clear){this.habitatStats.blocked++;continue;}
   e.journey.reset();e.site=site;e.habitat={id:area.id,x:area.x,z:area.z,count:area.count,species:area.species};e.safeTime=0;e.variant=[0,2,1][area.species];
   e.personality=(identity%101)/101;e.restTime=e.personality*3;e.visitedTrees=new Set();e.treeMoves=0;e.hopsSinceGround=0;e.nextChoiceAt=0;
   e.initialPerched=identity%5<3;
   if(e.initialPerched){e.journey.start();e.journey.seek(BIRD_JOURNEY_TIME);e.visitedTrees.add(site.treeId);}
   e.journey.idleTime=(identity%560)*.01;e.flights=0;e.pose=e.sample();
   e.enableForaging({seed:identity||1,sample:(x,z)=>hm.height(x,z),valid:(x,y,z)=>{
    hm.sample(x,z);return y>hm._water+2&&hm._slope<.35&&!hm.caves.hasOpening(x,z)&&!this.shared.colliders.some(c=>Math.hypot(x-c.position.x,z-c.position.z)<(c.radius||c.r||0)+4)&&!this.encounters.some(o=>o!==e&&Math.hypot(x-o.ground.x,z-o.ground.z)<2.5);
   }});
   e.update(0);return e;
  }
  // Geometry failures are stable for this loaded tree; occupancy can change.
  if(!occupied)this.rejectedSites.add(site);
  return null;
 }
 clearRoute(from,to,size){
  const probe=new BirdEncounter(from,to,size);probe.start();
  for(let i=0;i<=32;i++){
   probe.journey.seek(i/32*BIRD_JOURNEY_TIME);const q=probe.sample().position;
   if(q.y<this.hm.height(q.x,q.z)+.2)return false;
   if(i>2&&i<30&&this.shared.colliders.some(c=>Math.hypot(q.x-c.position.x,q.z-c.position.z)<(c.radius||c.r||0)+2))return false;
  }
  return true;
 }
 changeTree(e){
  const reserved=new Set(this.encounters.flatMap(b=>b.journey.active&&b.sourceSite?[b.site,b.sourceSite]:[b.site]));
  const occupied=new Map();for(const b of this.encounters)occupied.set(b.site.treeId,(occupied.get(b.site.treeId)||0)+1);
  const from=e.perch;
  const choices=(this.sites||[]).filter(s=>s.treeId!==e.site.treeId&&!reserved.has(s)).map(site=>{
   const p=site.position,d=Math.hypot(p.x-from.x,p.z-from.z);
   return {site,d,score:d+(e.visitedTrees.has(site.treeId)?25:0)-Math.min(2,occupied.get(site.treeId)||0)*7};
  }).filter(c=>c.d>12&&c.d<95&&Math.abs(c.site.position.y-from.y)<22&&c.site.position.y-e.ground.y<40&&c.site.position.y-e.ground.y>4&&Math.hypot(c.site.position.x-e.ground.x,c.site.position.z-e.ground.z)<115).sort((a,b)=>a.score-b.score);
  for(const {site} of choices.slice(0,12)){
   const target=this.vegetation.birdPerchPosition(site);
   if(!this.clearRoute(from,target,e.size))continue;
   const source=e.site;if(!e.travelTo(target))return false;
   e.sourceSite=source;e.site=site;e.perch=target;e.treeMoves++;e.hopsSinceGround++;e.safeTime=0;return true;
  }
  return false;
 }

 update(dt){
  this.time+=dt;const p=this.shared.player.position;
  this.root.visible=this.shared.surfaceStreaming!==false;
  if(!this.root.visible)return;
  this.sky.setObserver({x:p.x/SCALE,y:p.y/SCALE,z:p.z/SCALE});
  this.sprites.update(this.sky.update(dt));this.sprites.material.uniforms.uFog.value.copy(this.shared.fogColor);
  // Cool reflected moonlight gives a solid silhouette against the dark dome.
  // Stay below bloom; this is plumage contrast, not a luminous creature.
  this.sprites.material.uniforms.uInk.value.setRGB(.13,.15,.20);
  if(this.time>=this.nextStream){this.nextStream=this.time+2;this.stream();}
  for(const e of this.encounters){
   e.perch=this.vegetation.birdPerchPosition(e.site);
   if(e.leg){
    if(!e.leg.fromGround)e.leg.from=this.vegetation.birdPerchPosition(e.sourceSite||e.site);
    if(!e.leg.toGround)e.leg.to={...e.perch};
   }
   const distance=Math.hypot(p.x-e.ground.x,p.z-e.ground.z);
   const perched=e.pose.state==='perched';
   if(!e.journey.active){
    if(!perched&&((distance<25&&Math.abs(p.y-e.ground.y)<30)||e.restTime>e.profile.groundRest+e.personality*6)){e.sourceSite=null;e.start();}
    else if(perched){
     e.safeTime=distance>40?e.safeTime+dt:0;
     if(e.restTime>e.profile.perchRest+e.personality*5&&this.time>=e.nextChoiceAt){
      e.nextChoiceAt=this.time+2;
      const moved=(e.hopsSinceGround<2||distance<40)&&this.changeTree(e);
      if(!moved&&e.safeTime>e.profile.perchRest+e.personality*5&&this.clearRoute(e.perch,e.ground,e.size)){
       e.sourceSite=e.site;e.start();e.safeTime=0;
      }
     }
    }
   }
   const flying=e.journey.active;e.update(dt);
   if(flying&&!e.journey.active){
    if(e.pose.state==='perched')e.visitedTrees.add(e.site.treeId);
    else if(e.pose.state==='ground')e.hopsSinceGround=0;
   }
  }
  this.mesh.update(this.encounters.map(e=>e.pose));
 }
 nearest(){const p=this.shared.player.position;return [...this.encounters].sort((a,b)=>Math.hypot(a.ground.x-p.x,a.ground.z-p.z)-Math.hypot(b.ground.x-p.x,b.ground.z-p.z))[0];}
 dispose(){this.sprites.dispose();this.mesh.dispose();this.root.removeFromParent();}
}
