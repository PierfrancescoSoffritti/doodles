import test from 'node:test';
import assert from 'node:assert/strict';
import { ReedWalkerWorldModel } from '../../js/world/fauna/ReedWalkerWorldModel.js?v=player-notes-13';
import { reedPoseFits } from '../../js/world/fauna/ReedWalkerMotion.js';
import { updateReedReservoir } from '../../js/world/fauna/ReedWalkerReservoir.js';
const sample=(x,z)=>({ground:10.6+Math.sin(x*.02)*.15+Math.sin(z*.02)*.12,water:11,slope:.03,foam:.01,roof:false});
const site={id:'reservoir',x:0,z:0,yaw:.2,radius:30,form:'reedbed'};

test('world families drink, carry water while walking, release with planted feet, then resume',()=>{
 const model=new ReedWalkerWorldModel('water-test',[site],sample),g=model.add(site);
 const previous=new Map();let releases=0,carryingSteps=0,emptyAgain=0,resumed=0;
 for(let frame=0;frame<60*600;frame++){
  model.update(1/60,{x:100,z:100});
  assert.ok(g.members.filter(m=>m.release).length<=1,'only one release per family');
  for(const m of g.members){
   const old=previous.get(m),r=m.reservoir;
   assert.ok(r.load>=0&&r.load<=1);
   if(m.state==='step'&&r.load>.99)carryingSteps++;
   if(m.release){
    assert.equal(m.state,'stand');assert.ok(reedPoseFits(m.traits,m.draw.pose),'release pose stays supported');
    assert.ok(!g.moment||g.moment.child!==m&&g.moment.parent!==m);
    if(old?.release){
     assert.deepEqual(m.origin,old.origin);assert.equal(m.yaw,old.yaw);assert.deepEqual(m.draw.feet,old.feet);
     assert.ok(r.load<=old.load,'a release cannot refill');
    }else{releases++;assert.ok(old?.load>=.99,'drink before spraying');}
   }
   if(old?.release&&!m.release){emptyAgain++;assert.equal(r.load,0);assert.ok(r.nextAt>=model.time+29);}
   if(r.serial&&m.state==='step')resumed++;
   if(old){const d=Math.hypot(...m.draw.pose.body.map((v,i)=>(v-old.body[i])*m.scale));assert.ok(d<.35,`continuous body motion: ${d}`);}
   previous.set(m,{release:!!m.release,load:r.load,origin:{...m.origin},yaw:m.yaw,feet:structuredClone(m.draw.feet),body:[...m.draw.pose.body]});
  }
 }
 assert.ok(releases>=6);assert.ok(carryingSteps>100);assert.ok(emptyAgain>=6);assert.ok(resumed>100);
});

test('empty, walking and socially occupied animals cannot start a release',()=>{
 const model=new ReedWalkerWorldModel('guards',[site],sample),g=model.add(site),m=g.members[0];
 m.state='stand';m.clock=2;updateReedReservoir(m,0,0);assert.equal(m.release,undefined);
 Object.assign(m.reservoir,{load:1,readyAt:0,nextAt:0});m.state='step';updateReedReservoir(m,100,0);assert.equal(m.release,undefined);
 m.state='stand';g.moment={child:m,parent:g.members[1]};updateReedReservoir(m,100,0);assert.equal(m.release,undefined);
 g.moment=null;m.reservoir.nextAt=101;updateReedReservoir(m,100,0);assert.equal(m.release,undefined);
 updateReedReservoir(m,102,0);assert.ok(m.release);
 const second=g.members[1];second.state='stand';second.clock=2;updateReedReservoir(second,0,0);Object.assign(second.reservoir,{load:1,readyAt:0,nextAt:0});
 updateReedReservoir(second,102,0);assert.equal(second.release,undefined);
});
