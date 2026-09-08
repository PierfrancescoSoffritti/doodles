import test from 'node:test';
import assert from 'node:assert/strict';
import {BirdPassages,passagePoint,SKY_LANE_SPACING} from '../../js/world/fauna/BirdPassages.js';

test('slower wingbeats and appearance remain distinct and stable through glides',()=>{
 const m=new BirdPassages({seed:192}),looks=new Map(),types=new Set();let min=10,max=0;
 for(let k=0;k<7200;k++){
  const old=new Map(m.birds.map(b=>[b.id,{phase:b.phase,glide:b.glide}]));m.update(1/60);
  for(const b of m.birds){
   const style=[b.variant,b.size,b.flapRate,b.tint];
   if(looks.has(b.id))assert.deepEqual(style,looks.get(b.id));else looks.set(b.id,style);
   types.add(b.variant);min=Math.min(min,b.flapRate);max=Math.max(max,b.flapRate);
   const before=old.get(b.id);
   if(before){assert.ok(b.phase-before.phase<=b.flapRate/60+1e-7);if(before.glide&&b.glide)assert.equal(b.phase,before.phase);}
  }
 }
 assert.equal(types.size,3);assert.ok(min>1.2&&max<2.5);assert.ok(max-min>.8);
 assert.ok(new Set([...looks.values()].map(s=>s[1].toFixed(2))).size>20);
});

test('route lanes remain exclusive when the player moves across the landscape',()=>{
 for(const seed of [1,35,7831]){
  const m=new BirdPassages({seed});
  for(let k=0;k<14400;k++){
   m.setObserver({x:k/30,y:0,z:Math.sin(k/2500)*260});m.update(1/60);
   const lanes=new Map();
   for(const b of m.birds){
    const r=b.route;if(lanes.has(r.lane))assert.equal(lanes.get(r.lane),b.group);else lanes.set(r.lane,b.group);
    const cross=-(b.p.x-r.start.x)*r.dz+(b.p.z-r.start.z)*r.dx;
    assert.ok(Math.abs(cross)<SKY_LANE_SPACING/2-5);
   }
  }
 }
});

test('occasional flocks complete a real turn, exit tangentially and depart',()=>{
 const m=new BirdPassages({seed:71}),turns=new Map(),completed=new Set(),ids=new Set();
 for(let k=0;k<14400;k++){
  m.update(1/60);
  for(const b of m.birds){
   if(b.pattern==='circling'){
    ids.add(b.id);const old=turns.get(b.id);turns.set(b.id,{first:old?.first??b.heading,last:b.heading});
   }else if(ids.has(b.id))completed.add(b.id);
  }
 }
 assert.ok(completed.size>20);assert.ok([...turns.values()].some(t=>t.last-t.first>Math.PI*1.8));
 const route={start:{x:0,z:0},heading:0,dx:1,dz:0,circle:true,radius:38,enter:260,orbitLength:Math.PI*2*38};
 for(const s of [route.enter,route.enter+route.orbitLength]){
  const a=passagePoint(route,s-.001),b=passagePoint(route,s+.001);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.003);assert.ok(Math.abs(a.z-b.z)<1e-6);
 }
 assert.ok(m.departures>100);
});
