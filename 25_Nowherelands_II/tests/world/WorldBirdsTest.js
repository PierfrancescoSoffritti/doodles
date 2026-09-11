import test from 'node:test';
import assert from 'node:assert/strict';
import {BirdPassages,SKY_BIRD_CAPACITY,SKY_LANE_SPACING} from '../../js/world/fauna/BirdPassages.js';
import {BirdEncounter} from '../../js/world/fauna/BirdEncounter.js?v=player-notes-13';
import {BIRD_JOURNEY_TIME} from '../../js/world/fauna/BirdJourney.js';

test('separate flocks arrive, circle occasionally, depart, and remain bounded for ten minutes',()=>{
 const m=new BirdPassages({seed:421,ground:(x,z)=>20+Math.sin(x*.01)*10});
 let max=0,glides=0;const ids=new Set();
 for(let k=0;k<36000;k++){
  m.update(1/60);max=Math.max(max,m.birds.length);
  for(const b of m.birds){
   ids.add(b.id);assert.ok(Object.values(b.p).every(Number.isFinite));
   assert.ok(b.speed>12,'bird maintains airspeed');
   const r=b.route,across=-(b.p.x-r.start.x)*r.dz+(b.p.z-r.start.z)*r.dx;
   assert.ok(Math.abs(across)<SKY_LANE_SPACING/2-5,'bird stays inside its reserved lane');
   assert.ok(b.p.y>70,'terrain corridor clearance');assert.ok(b.opacity>=0&&b.opacity<=1);
   if(b.glide){glides++;assert.ok(b.v.y<=0);}
  }
 }
 assert.ok(m.arrivals>30);assert.ok(m.departures>40);assert.ok(max<=SKY_BIRD_CAPACITY&&max>=30);assert.ok(ids.size>40);assert.ok(glides>1000);
});

test('walking does not change a passage already in flight',()=>{
 const a=new BirdPassages({seed:31}),b=new BirdPassages({seed:31});
 for(let k=0;k<600;k++){
  if(k>0)b.setObserver({x:k*10,y:0,z:k*-10});
  a.update(1/60);b.update(1/60);
 }
 assert.deepEqual(a.birds,b.birds);
 b.reset();b.update(1/60);assert.ok(b.birds.length);assert.ok(b.birds.every(b=>b.route));
});

test('world encounters rotate and scale into real ground and branch contacts in both directions',()=>{
 for(const heading of [0,.7,2.4,-1.8]){
  const ground={x:136,y:82,z:-753},perch={x:136+Math.cos(heading)*34,y:90.4,z:-753+Math.sin(heading)*34};
  const e=new BirdEncounter(ground,perch);
  const foot=()=>({x:e.pose.position.x,y:e.pose.position.y+e.pose.footY*e.size,z:e.pose.position.z});
  let p=foot();assert.ok(Math.abs(p.y-ground.y)<1e-9);assert.ok(Math.hypot(p.x-ground.x,p.z-ground.z)<1e-9);
  for(let journey=0;journey<2;journey++){
   assert.ok(e.start());let prev=e.pose.position;
   for(let k=0;k<300;k++){
    e.update(BIRD_JOURNEY_TIME/240);
    assert.ok(Object.values(e.pose.position).every(Number.isFinite));
    assert.ok(Math.hypot(e.pose.position.x-prev.x,e.pose.position.y-prev.y,e.pose.position.z-prev.z)<.65,'continuous world movement');prev=e.pose.position;
   }
   const target=journey===0?perch:ground;p=foot();assert.ok(Math.abs(p.y-target.y)<1e-9);assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<1e-9);
  }
 }
});

test('fitting higher branches keeps the glide descending on outward and return flights',()=>{
 for(const rise of [6,18,35]){
  const e=new BirdEncounter({x:0,y:0,z:0},{x:34,y:rise,z:0});let glides=0;
  for(let journey=0;journey<2;journey++){
   e.start();
   for(let k=0;k<280;k++){
    const old=e.pose.position;e.update(.01);
    if(e.pose.state==='glide'){assert.ok(e.pose.position.y<old.y);glides++;}
    assert.ok(Math.hypot(e.pose.position.x-old.x,e.pose.position.y-old.y,e.pose.position.z-old.z)<.85);
   }
  }
  assert.ok(glides>30);
 }
});


test('encounter visits multiple branches and returns to feeding without a pose jump',()=>{
 const ground={x:0,y:0,z:0},branches=[{x:30,y:12,z:0},{x:62,y:20,z:18},{x:12,y:18,z:38}];
 const e=new BirdEncounter(ground,branches[0]);
 for(const [i,target] of [...branches,ground].entries()){
  const before={...e.pose.position},yaw=e.pose.yaw;
  assert.ok(e.travelTo(target,{ground:i===3}));
  assert.ok(!e.travelTo(branches[1]),'active flight cannot be interrupted');
  const start=e.sample();
  assert.ok(Math.hypot(start.position.x-before.x,start.position.y-before.y,start.position.z-before.z)<1e-9);
  assert.ok(Math.abs(Math.sin(start.yaw-yaw))<1e-9);
  let previous=before;
  for(let k=0;k<600;k++){
   e.update(.01);
   assert.ok(Math.hypot(e.pose.position.x-previous.x,e.pose.position.y-previous.y,e.pose.position.z-previous.z)<1.5,'continuous chained flight');
   previous={...e.pose.position};
   if(e.pose.state==='perched')assert.notEqual(e.pose.activity,'peck','branch idle has no ground feeding');
  }
  assert.equal(e.pose.state,i===3?'ground':'perched');
  assert.ok(Math.hypot(e.pose.position.x-target.x,e.pose.position.z-target.z)<1e-9);
  assert.ok(Math.abs(e.pose.position.y+e.pose.footY*e.size-target.y)<1e-9,'feet meet selected branch');
 }
 assert.equal(e.flights,4);
 assert.ok(e.start(),'can take off again after returning to the ground');
});
