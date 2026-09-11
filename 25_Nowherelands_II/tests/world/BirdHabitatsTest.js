import test from 'node:test';
import assert from 'node:assert/strict';
import {BirdHabitats} from '../../js/world/fauna/BirdHabitats.js';
import {BIRD_SPECIES} from '../../js/world/fauna/BirdSpecies.js';
import {BirdEncounter} from '../../js/world/fauna/BirdEncounter.js?v=outline-2';
import {BIRD_JOURNEY_TIME} from '../../js/world/fauna/BirdJourney.js';

const sites=[];
for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)for(let i=0;i<12;i++)sites.push({position:{x:x*300+130+i*3,y:12,z:z*300+140+i*2},id:`${x},${z},${i}`});

test('habitats keep their identity across travel, negative coordinates and reloads',()=>{
 const a=new BirdHabitats(421),b=new BirdHabitats(421),c=new BirdHabitats(422),observer={x:0,z:0};
 const initial=a.groups(sites,observer);a.groups(sites,{x:1000,z:-500});
 assert.deepEqual(a.groups(sites,observer),initial);assert.deepEqual(b.groups(sites,observer),initial);
 assert.notDeepEqual(c.groups(sites,observer),initial);
 assert.deepEqual(a.at(-1,-1),a.at(-299,-299));assert.notEqual(a.at(-1,-1).id,a.at(0,0).id);
 const descriptions=sites.map(s=>a.at(s.position.x,s.position.z));
 assert.ok(descriptions.some(a=>a.count===0));assert.ok(descriptions.some(a=>a.count===1));
 assert.deepEqual(new Set(descriptions.map(a=>a.species)),new Set([0,1,2]));
});

test('population reaches separate territories before filling groups and stays bounded',()=>{
 const h=new BirdHabitats(421),groups=h.groups(sites,{x:0,z:0}),birds=[],used=new Set();
 const spawn=(site,area)=>{if(used.has(site))return null;used.add(site);return {habitat:area,site};};
 h.populate(groups,birds,28,spawn);
 assert.equal(birds.length,28);
 const first=birds.slice(0,groups.length);assert.equal(new Set(first.map(b=>b.habitat.id)).size,Math.min(groups.length,28));
 for(const g of groups)assert.ok(birds.filter(b=>b.habitat.id===g.id).length<=g.count);
 const before=[...birds];h.populate(groups,birds,28,spawn);assert.deepEqual(birds,before);
 assert.ok(Math.max(...birds.map(b=>b.site.position.x))-Math.min(...birds.map(b=>b.site.position.x))>600);
});

test('an unsuitable territory does not stop other groups from populating',()=>{
 const h=new BirdHabitats(421),groups=h.groups(sites,{x:0,z:0}),birds=[],used=new Set();
 h.populate(groups,birds,28,(site,area)=>{
  if(area.id===groups[0].id||used.has(site))return null;
  used.add(site);return {site,habitat:area};
 });
 assert.equal(birds.length,28);assert.ok(birds.every(b=>b.habitat.id!==groups[0].id));
 assert.ok(new Set(birds.map(b=>b.habitat.id)).size>5);
});

test('each anatomy keeps its identity and temperament through branch transfers',()=>{
 for(const [species,profile] of BIRD_SPECIES.entries()){
  const e=new BirdEncounter({x:0,y:0,z:0},{x:32,y:14,z:0},profile.size,{species});
  e.enableForaging({seed:1});
  assert.equal(e.forage.hopDuration,profile.hopDuration);
  e.journey.start();e.journey.seek(BIRD_JOURNEY_TIME);e.pose=e.sample();
  assert.equal(e.pose.state,'perched');assert.equal(e.pose.species,species);
  e.update(1);assert.notEqual(e.pose.activity,'peck');
  const target={x:60,y:18,z:20};assert.ok(e.travelTo(target));
  assert.equal(e.journey.flapRate,profile.flapRate);assert.equal(e.journey.idleTempo,profile.idleTempo);
  for(let i=0;i<300;i++)e.update(.01);
  assert.equal(e.pose.species,species);assert.equal(e.pose.state,'perched');
  assert.ok(Math.abs(e.pose.position.y+e.pose.footY*e.size-target.y)<1e-8);
 }
});
