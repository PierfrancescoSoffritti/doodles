import test from 'node:test';
import assert from 'node:assert/strict';
import {BirdEncounter} from '../../js/world/fauna/BirdEncounter.js?v=pebble-voice-4b';
import {BirdForage} from '../../js/world/fauna/BirdForage.js?v=player-notes-13';
import {BirdJourney} from '../../js/world/fauna/BirdJourney.js';

test('feeding birds repeatedly hop, stay near their patch, and land with planted feet',()=>{
 const e=new BirdEncounter({x:0,y:0,z:0},{x:30,y:10,z:0}).enableForaging({seed:71,sample:()=>0});
 let airborne=0,travel=0,last=e.pose.position;
 for(let k=0;k<6000;k++){
  e.update(.01);const p=e.pose;
  assert.ok(Math.hypot(e.ground.x,e.ground.z)<=7.01);
  assert.ok(Object.values(p.position).every(Number.isFinite));
  travel+=Math.hypot(p.position.x-last.x,p.position.z-last.z);last=p.position;
  if(e.forage.hop){airborne++;assert.equal(p.activity,'hop');assert.equal(p.contact,0);}
  else{assert.equal(p.contact,1);assert.ok(Math.abs(p.position.y+p.footY*e.size)<1e-8);}
 }
 assert.ok(e.forage.hops>12);assert.ok(airborne>500);assert.ok(travel>25);
});

test('hops reject unsafe feeding surfaces and finish before takeoff',()=>{
 const blocked=new BirdForage({x:0,y:0,z:0},{valid:()=>false});
 for(let k=0;k<1000;k++)blocked.update(.01);assert.equal(blocked.hops,0);assert.deepEqual(blocked.position,{x:0,y:0,z:0});
 const e=new BirdEncounter({x:0,y:0,z:0},{x:30,y:10,z:0}).enableForaging({seed:3,sample:()=>0});
 while(!e.forage.hop)e.update(.01);assert.equal(e.start(),false);
 while(e.forage.hop)e.update(.01);
 const before=e.pose.position;assert.equal(e.start(),true);e.update(0);
 assert.ok(Math.hypot(e.pose.position.x-before.x,e.pose.position.z-before.z)<1e-8);
 for(let k=0;k<300;k++)e.update(.01);assert.equal(e.pose.state,'perched');
});

test('resting motion includes frequent pecks, stretches and feather shakes',()=>{
 const j=new BirdJourney(),activities=new Set();let stretchSpan=1;
 for(let k=0;k<1120;k++){const p=j.update(.01);activities.add(p.activity);stretchSpan=Math.min(stretchSpan,p.fold);assert.equal(p.contact,1);}
 for(const a of ['peck','stretch','ruffle','shift'])assert.ok(activities.has(a),a);
 assert.ok(stretchSpan<=.51);
});
