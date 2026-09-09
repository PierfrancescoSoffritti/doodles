import test from 'node:test';
import assert from 'node:assert/strict';
import { reedIndividual } from '../../js/world/fauna/ReedWalkerTraits.js';
import { reedPoseFits } from '../../js/world/fauna/ReedWalkerMotion.js';
import { reedDrinkPose, reedSprayProfile, reedSprayDrops, reedDropPoint } from '../../js/world/fauna/ReedWalkerDrink.js';

test('drink, store and release preserve support and never spray an empty reservoir',()=>{
 for(const form of ['reedbed','peat','tarn'])for(const age of ['young','adult','old'])for(const sex of ['male','female'])for(let seed=0;seed<10;seed++){
  const traits=reedIndividual(form,seed,age,sex),profile=reedSprayProfile(traits),start=reedDrinkPose(traits,0,profile);
  let old=start,previousLoad=0;
  for(let frame=0;frame<=Math.ceil((profile.duration+1)*60);frame++){
   const t=frame/60,p=reedDrinkPose(traits,t,profile);
   assert.deepEqual(p.feet,start.feet,'all support pads remain planted');
   assert.ok(reedPoseFits(traits,p,p.feet,0),'the shell shift does not stretch legs');
   assert.ok(Math.hypot(...p.body.map((v,i)=>v-old.body[i]))<.11,'smooth motion through each phase');
   assert.ok(p.waterLoad>=0&&p.waterLoad<=1);
   if(t<profile.sprayAt)assert.ok(p.waterLoad>=previousLoad,'water remains stored until spraying');
   else assert.ok(p.waterLoad<=previousLoad+1e-9,'spraying only empties the reservoir');
   previousLoad=p.waterLoad;old=p;
  }
  assert.equal(reedDrinkPose(traits,0,profile).waterLoad,0);
  assert.equal(reedDrinkPose(traits,12,profile).waterLoad,1);
  assert.equal(old.waterLoad,0);assert.equal(old.phase,'complete');
 }
});

test('youngsters have smaller separated spurts; adults have one sustained plume',()=>{
 for(let seed=0;seed<30;seed++){
  const adult=reedIndividual('reedbed',seed,'adult'),young=reedIndividual('reedbed',seed,'young');
  const a=reedSprayProfile(adult),y=reedSprayProfile(young);
  assert.deepEqual(a,reedSprayProfile(adult));assert.equal(a.bursts.length,1);assert.equal(y.bursts.length,2);
  assert.ok(y.bursts[1].at>y.bursts[0].at+y.bursts[0].duration);
  assert.ok(y.bursts.every(b=>b.power<a.bursts[0].power&&b.duration<a.bursts[0].duration));
  assert.ok(a.sprayAt>16&&a.sprayAt<20);
 }
});

test('droplets can be replayed or scrubbed and return below the emission point',()=>{
 const traits=reedIndividual(),profile=reedSprayProfile(traits),drops=reedSprayDrops(traits,profile);
 assert.deepEqual(drops,reedSprayDrops(traits,profile));assert.ok(drops.length<=280);
 for(const d of drops){
  assert.equal(reedDropPoint(d,-.1,traits),null);
  const start=reedDropPoint(d,0,traits);assert.equal(Math.hypot(start.x,start.y,start.z),0);
  assert.ok(reedDropPoint(d,.4,traits).y>0);
  assert.ok(reedDropPoint(d,4,traits).y<0);
  const a=reedDropPoint(d,1,traits);reedDropPoint(d,3,traits);assert.deepEqual(reedDropPoint(d,1,traits),a);
 }
});
