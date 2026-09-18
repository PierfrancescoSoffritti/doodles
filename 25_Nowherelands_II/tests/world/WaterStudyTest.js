import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterStudy, WATER_RADIUS, SCHOOL_COUNTS } from '../../js/atelier/WaterStudy.js';
import { atelierURL } from '../../js/atelier/AtelierCatalog.js';

test('seeded identities include solitary fish and independently sized schools',()=>{
 const a=new WaterStudy({seed:'pool'}),b=new WaterStudy({seed:'pool'});
 assert.deepEqual(a,b);assert.notDeepEqual(a.fish,new WaterStudy({seed:'other'}).fish);
 assert.deepEqual([...new Set(a.fish.map(f=>f.count))],[1,4,15]);
 for(const [school,counts] of Object.entries(SCHOOL_COUNTS))assert.equal(new WaterStudy({school}).fish.length,counts.reduce((a,b)=>a+b));
 for(const [species,counts] of [['scarlet-fish',[20,0]],['light-lily',[0,3]]]){
  const m=new WaterStudy({species});assert.deepEqual([m.fish.length,m.plants.length],counts);
 }
});

test('all school sizes stay underwater and inside the pool through repeated edge disturbances',()=>{
 for(const school of Object.keys(SCHOOL_COUNTS)){
  const m=new WaterStudy({school});
  for(let i=0;i<2400;i++){
   if(i%180===0)m.touch(5.8,0,true);m.update(1/30);
   for(const f of m.fish){
    assert.ok([f.x,f.y,f.z,f.yaw,f.stroke].every(Number.isFinite));
    assert.ok(Math.hypot(f.x,f.z)+f.size*1.3<WATER_RADIUS);
    assert.ok(f.y+f.size*.4<0,'entire body remains submerged');assert.ok(f.y-f.size*.4>-1.8,'body clears the bed');
   }
  }
 }
});

test('replies follow ripple distance once and settle without feedback or unbounded queues',()=>{
 const m=new WaterStudy();assert.equal(m.touch(NaN,0),false);assert.equal(m.touch(100,0),false);
 m.touch(m.plants[2].x,m.plants[2].z);const order=[],peaks=m.plants.map(()=>0);
 assert.equal(m.touch(0,0),false,'rapid duplicate taps are bounded');
 for(let i=0;i<480;i++){m.update(1/60);order.push(...m.drainEvents().map(e=>e.plant));m.plants.forEach((p,j)=>peaks[j]=Math.max(peaks[j],p.glow));}
 assert.equal(order[0],2);assert.equal(new Set(order).size,3);assert.equal(order.length,3);assert.ok(peaks.every(p=>p>.55));
 assert.ok(m.plants.every(p=>p.glow<.001));assert.equal(m.ripples.length,0);assert.equal(m.pending.length,0);
 for(let i=0;i<100;i++){m.touch(0,0,true);m.update(.01);}assert.ok(m.ripples.length<=4);assert.equal(m.pending.length,0);
});

test('pause does not advance pending replies or swimming',()=>{
 const m=new WaterStudy();m.touch();const before=JSON.stringify(m);for(let i=0;i<100;i++)m.update(0);assert.equal(JSON.stringify(m),before);
});

test('fish routes and fin beats are independent of every water interaction',()=>{
 for(const school of Object.keys(SCHOOL_COUNTS)){
  const quiet=new WaterStudy({school}),touched=new WaterStudy({school});
  for(let i=0;i<600;i++){
   if(i%120===0)touched.touch(2,-1);
   if(i%120===60)touched.touch(-3,1,true);
   if(i%120===100)touched.settle();
   quiet.update(1/30);touched.update(1/30);
   assert.deepEqual(touched.fish,quiet.fish);
  }
 }
 const fishOnly=new WaterStudy({species:'scarlet-fish'}),before=JSON.stringify(fishOnly);
 assert.equal(fishOnly.touch(),false);assert.equal(fishOnly.touch(0,0,true),false);
 assert.equal(JSON.stringify(fishOnly),before);
});

test('water navigation retains world seeds without redirecting existing plants or fauna',()=>{
 for(const id of ['pool','scarlet-fish','light-lily'])assert.equal(atelierURL(id,'a & b'),`./water-atelier.html?species=${id}&seed=a+%26+b`);
 assert.equal(atelierURL('bell-reed'),'./vegetation-atelier.html?species=bell-reed');assert.equal(atelierURL('reed'),'./reed-study.html');
});
