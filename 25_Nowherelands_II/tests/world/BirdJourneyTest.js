import test from 'node:test';
import assert from 'node:assert/strict';
import { BirdJourney, BIRD_GROUND, BIRD_PERCH, BIRD_JOURNEY_TIME, BIRD_FLIGHT_TIME, BIRD_ANTICIPATION } from '../../js/world/fauna/BirdJourney.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('bird stays on its feet until startled, completes the perch journey and can return',()=>{
 const j=new BirdJourney(),rest=j.sample().position;
 for(let i=0;i<600;i++){const p=j.update(1/30);assert.equal(p.position.x,rest.x);assert.equal(p.position.z,rest.z);assert.ok(Math.abs(p.position.y+p.footY)<1e-8);}
 for(const destination of [BIRD_PERCH,BIRD_GROUND,BIRD_PERCH]){
  assert.equal(j.start(),true);assert.equal(j.start(),false);
  const states=new Set();
  for(let i=0;i<750;i++){
   const p=j.update(1/120);states.add(p.state);
   assert.ok(Object.values(p.position).every(Number.isFinite));
   assert.ok(p.position.y>=.30);assert.ok(p.speed<15);
  }
  for(const state of ['alert','crouch','takeoff','flight','glide','landing','settle'])assert.ok(states.has(state),state);
  const p=j.sample();assert.equal(p.state,destination===BIRD_PERCH?'perched':'ground');
  assert.equal(p.position.x,destination.x);assert.equal(p.position.z,destination.z);assert.ok(Math.abs(p.position.y+p.footY-destination.y)<1e-8);
  assert.ok(p.fold>=.5&&p.fold<=1);assert.equal(p.contact,1);assert.equal(p.speed,0);
  for(let i=0;i<300;i++){const p=j.update(1/30);assert.equal(p.position.x,destination.x);assert.equal(p.position.z,destination.z);assert.ok(Math.abs(p.position.y+p.footY-destination.y)<1e-8);}
 }
});

test('flight position and orientation remain continuous through segment and phase boundaries',()=>{
 const j=new BirdJourney();j.start();let previous=j.sample();
 for(let i=1;i<=Math.round(BIRD_JOURNEY_TIME*1000);i++){
  j.seek(i/1000);const p=j.sample();
  assert.ok(distance(p.position,previous.position)<.016,`position jump at ${j.time}`);
  const yaw=Math.atan2(Math.sin(p.yaw-previous.yaw),Math.cos(p.yaw-previous.yaw));
  assert.ok(Math.abs(yaw)<.08,`heading jump at ${j.time}`);
  assert.ok(Math.abs(p.pitch-previous.pitch)<.03,`pitch jump at ${j.time}`);
  assert.ok(Math.abs(p.fold-previous.fold)<.03,`wing fold jump at ${j.time}`);
  previous=p;
 }
});

test('arrival slows to contact and feet remain planted while the body settles',()=>{
 const j=new BirdJourney();j.start();let lastSpeed=Infinity;
 for(let t=BIRD_ANTICIPATION+1.42;t<BIRD_ANTICIPATION+BIRD_FLIGHT_TIME;t+=.001){j.seek(t);const p=j.sample();assert.ok(p.speed<lastSpeed+.001);lastSpeed=p.speed;}
 assert.ok(lastSpeed<.1);
 for(let t=BIRD_ANTICIPATION+BIRD_FLIGHT_TIME;t<=BIRD_JOURNEY_TIME;t+=.01){j.seek(t);const p=j.sample();assert.equal(p.contact,1);assert.ok(Math.abs(p.position.y+p.footY-BIRD_PERCH.y)<1e-8);}
});

test('render rate does not change the journey and timeline supports backward inspection',()=>{
 const a=new BirdJourney(),b=new BirdJourney();a.start();b.start();
 for(let i=0;i<90;i++)a.update(1/30);for(let i=0;i<432;i++)b.update(1/144);
 assert.ok(distance(a.sample().position,b.sample().position)<1e-10);
 a.seek(6);assert.equal(a.sample().state,'perched');a.seek(1.3);assert.equal(a.sample().state,'glide');assert.equal(a.completed,false);
 a.reset();assert.equal(a.active,false);assert.equal(a.sample().state,'ground');
});


test('short flight keeps momentum and every glide sample descends',()=>{
 const j=new BirdJourney();j.start();let glides=0;
 assert.ok(BIRD_FLIGHT_TIME<1.8);
 for(let f=.15;f<1.30;f+=.002){
  j.seek(BIRD_ANTICIPATION+f);const p=j.sample();assert.ok(p.speed>3.5);
  if(p.state==='glide'){j.seek(BIRD_ANTICIPATION+f+.001);assert.ok(j.sample().position.y<p.position.y);glides++;}
 }
 assert.ok(glides>50);
});


test('ground idle pecks and shifts with planted feet; perching has no ground pecks',()=>{
 const j=new BirdJourney();let pecks=0,shifts=0,lowest=Infinity;
 for(let i=0;i<1000;i++){const p=j.update(.01);if(p.activity==='peck')pecks++;if(p.activity==='shift')shifts++;lowest=Math.min(lowest,p.position.y);assert.ok(Math.abs(p.position.y+p.footY)<1e-8);assert.equal(p.contact,1);}
 assert.ok(pecks>50&&shifts>20&&lowest<.33);
 j.reset();j.update(1.52);const before=j.sample();assert.equal(before.activity,'peck');j.start();const after=j.sample();assert.equal(after.position.y,before.position.y);assert.equal(after.headPitch,before.headPitch);
 j.seek(BIRD_JOURNEY_TIME);for(let i=0;i<1000;i++)assert.notEqual(j.update(.01).activity,'peck');
});
