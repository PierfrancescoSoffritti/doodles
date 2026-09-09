import test from 'node:test';
import assert from 'node:assert/strict';
import { ReedWalkerWorldModel } from '../../js/world/fauna/ReedWalkerWorldModel.js';
import { createReedFamily, reedHabitat, reedLocalPoint, REED_FAMILY_CAP, REED_FAMILY_SEPARATION, REED_WORLD_STEP_SECONDS, reedWorldTraits } from '../../js/world/fauna/ReedWalkerHabitat.js';
import { reedIndividual } from '../../js/world/fauna/ReedWalkerTraits.js';
import { reedJoint } from '../../js/world/fauna/ReedWalkerMotion.js';
const sample=(x,z)=>({ground:12+Math.sin(x*.02)*.15+Math.sin(z*.02)*.12,water:11,slope:.03,foam:.01,roof:false});
const sites=Array.from({length:8},(_,i)=>({id:`test:${i}`,x:i*150,z:0,yaw:.2,radius:30,form:['reedbed','peat','tarn'][i%3]}));

test('whole families spawn only on safe freshwater ground, and stream within a cap',()=>{
 for(const s of [{ground:0,water:0},{ground:0,water:8},{ground:12,water:11,roof:true},{ground:12,water:11,foam:.8}, {ground:10,water:11}])assert.equal(reedHabitat(s),false);
 assert.equal(createReedFamily(sites[0],3,()=>({ground:0,water:0}),()=>false),null);
 assert.equal(createReedFamily(sites[0],3,sample,()=>true),null);
 const a=createReedFamily(sites[0],3,sample,()=>false),b=createReedFamily(sites[0],3,sample,()=>false);
 assert.ok(a.members.length===3||a.members.length===4);assert.deepEqual(a.members.map(m=>m.origin),b.members.map(m=>m.origin));
 const model=new ReedWalkerWorldModel('world-test',sites,sample);
 for(let x=0;x<1800;x+=40){model.stream({x,z:0});assert.ok(model.groups.size<=REED_FAMILY_CAP);}
});
test('terrain contacts remain planted through resting, grazing and complete wandering strides',()=>{
 const model=new ReedWalkerWorldModel('contact-test',sites,sample);model.stream({x:0,z:0});
 let steps=0,feeding=0,calls=0;model.onSound=()=>calls++;
 const previous=new Map();
 for(let frame=0;frame<60*200;frame++){
  model.update(1/60,{x:80,y:20,z:80});
  for(const g of model.groups.values())for(const m of g.members){
   const {pose,origin,yaw,feet}=m.draw,old=previous.get(m);
   assert.ok(Object.values(m.position).every(Number.isFinite));
   if(old)assert.ok(Math.hypot(m.position.x-old.position.x,m.position.y-old.position.y,m.position.z-old.position.z)<.35,'no body snap at state transitions');
   for(let i=0;i<4;i++){
    const fore=i<2?1:-1,side=i%2?1:-1,x=fore*m.traits.length*.65;
    const hip=[pose.body[0]+x*Math.cos(pose.tilt),pose.body[1]+x*Math.sin(pose.tilt),pose.body[2]+side*m.traits.width*.64];
    assert.ok(reedJoint(hip,reedLocalPoint(origin,yaw,feet[i],m.scale),m.traits.legs*.61,side,fore).every(Number.isFinite));
    if(m.state!=='step')assert.ok(Math.abs(m.origin.y-sample(m.origin.x,m.origin.z).ground)<1e-8,'root follows the riverbed after each stride');
    if(m.state!=='step')assert.ok(Math.abs(feet[i].y-sample(feet[i].x,feet[i].z).ground-.065*m.scale)<1e-8);
    if(old&&m.state!=='step'&&old.state!=='step')assert.deepEqual(feet[i],old.feet[i]);
   }
   if(pose.graze===1){feeding++;assert.ok(Math.abs((origin.y+(pose.body[1]-.83)*m.scale)-m.feedingHeight)<1e-8);}
   steps=Math.max(steps,m.steps);previous.set(m,{position:{...m.position},feet:feet.map(f=>({...f})),state:m.state});
  }
 }
 assert.ok(steps>=3);assert.ok(feeding>100);assert.ok(calls>5);
});


test('most walkers retain the original scale; giant adults are rare and repeatable',()=>{
 let giants=0;
 for(let i=0;i<1000;i++){
  const normal=reedIndividual('reedbed',i,'adult','male'),world=reedWorldTraits(normal);
  assert.deepEqual(world,reedWorldTraits(normal));
  if(world.giant){giants++;assert.ok(world.scale>=1.7&&world.scale<=2);}
  else assert.ok(world.legs*world.scale>4.6&&world.legs*world.scale<6.3);
  assert.equal(reedWorldTraits(reedIndividual('reedbed',i,'young','male')).giant,false);
 }
 assert.ok(giants>10&&giants<45,`${giants} giant adults per thousand`);
});

test('streaming and repeated guided visits never stack families in the same patch',()=>{
 const dense=Array.from({length:100},(_,i)=>({...sites[0],id:`bank:${i}`,x:i*20}));
 const model=new ReedWalkerWorldModel('spacing',dense,sample);
 model.stream({x:0,z:0});let current;
 for(let visit=0;visit<12;visit++){
  current=model.findFamily(current?.site||{x:0,z:0},current);
  assert.ok(current);
  model.stream(current.site);
  const groups=[...model.groups.values()];assert.ok(groups.length<=REED_FAMILY_CAP);
  for(const a of groups)for(const b of groups)if(a!==b)assert.ok(Math.hypot(a.site.x-b.site.x,a.site.z-b.site.z)>=REED_FAMILY_SEPARATION);
 }
});

test('a bank family makes sustained progress at a visibly quicker walking pace',()=>{
 const model=new ReedWalkerWorldModel('walking-pace',sites,sample),group=model.add(sites[0]);
 let distance=0,walking=0,previous=new Map(),steps=0;
 for(let frame=0;frame<30*180;frame++){
  model.update(1/30,{x:300,z:300});
  for(const m of group.members){
   const old=previous.get(m);
   if(old&&m.state==='step'&&old.state==='step'){distance+=Math.hypot(m.draw.origin.x-old.x,m.draw.origin.z-old.z);walking+=1/30;}
   previous.set(m,{x:m.draw.origin.x,z:m.draw.origin.z,state:m.state});steps=Math.max(steps,m.steps);
   assert.ok(sample(m.draw.origin.x,m.draw.origin.z).ground>11);
   for(const f of m.draw.feet)assert.ok(sample(f.x,f.z).ground>11,'all feet stay on land');
  }
 }
 assert.ok(REED_WORLD_STEP_SECONDS<=3);assert.ok(steps>=15);assert.ok(distance/walking>.55,`walking speed ${distance/walking}`);
});


test('families stay on the dry side of a river throughout their walking routes',()=>{
 const river=(x,z)=>({ground:z<0?10:12+Math.sin(x*.03)*.1,water:z<0?11:0,slope:.04,foam:0});
 const site={...sites[0],id:'dry-bank',z:5,water:11,yaw:0};
 const model=new ReedWalkerWorldModel('bank-test',[site],river),group=model.add(site);assert.ok(group);
 for(let frame=0;frame<30*240;frame++){
  model.update(1/30,{x:150,z:100});
  for(const m of group.members){
   assert.ok(m.draw.origin.z>=0,'body stays on the bank');
   for(const f of m.draw.feet)assert.ok(f.z>=0,'feet never enter the channel');
  }
 }
});
