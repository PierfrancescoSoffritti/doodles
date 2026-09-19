import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js?v=stable-30-25';
import { selectLumenDetail } from '../../js/world/fauna/LumenDetail.js?v=stable-30-20';

function setup(lakes=[]) {
 let probes=0;
 const sample=(x,z)=>{probes++;const lake=lakes.find(l=>Math.hypot(x-l.x,z-l.z)<65);return{ground:lake?lake.y-6:18+Math.sin(x/150)*8,water:lake?lake.y:0,slope:.1,foam:0,wet:1,forest:.1};};
 const model=new FaunaModel('detail-replay',{lakes,sample});model.listener={x:0,y:10,z:0};
 const group=model.addGroup('school','lumen',0,0,4);
 return {model,group,probes:()=>probes};
}

test('nearby full-detail animals retain their motion and note responses',()=>{
 const a=setup(),b=setup();b.model.distantLumen=true;b.model.lumenDetailScale=.6;
 for(let i=0;i<300;i++){
  if(i===100)for(const s of [a,b])s.model.hear({position:{...s.model.creatures[0].pos},strength:.35,layer:'player-note',radius:110});
  a.model.step(1/30);b.model.step(1/30);
 }
 assert.ok(b.group.flow.branches.every(g=>!g.coarse));
 for(let i=0;i<640;i++)for(const field of ['pos','vel','elastic','calls','noteGlow','notePhase'])assert.deepEqual(b.model.creatures[i][field],a.model.creatures[i][field]);
});

test('detail selection wakes the whole spread-out flock without resetting positions',()=>{
 const {model,group}=setup();
 model.listener={x:10000,y:0,z:10000};selectLumenDetail(group,model.listener,true);
 assert.ok(group.flow.branches.every(b=>b.coarse));
 const b=group.flow.branches[0],c=b.members[0],pos={...c.pos};
 model.listener={x:c.pos.x+990,y:c.pos.y,z:c.pos.z};
 selectLumenDetail(group,model.listener,true);
 assert.equal(b.coarse,false);assert.deepEqual(c.pos,pos);assert.equal(c.floorTimer,0);
 const far={x:10000,y:0,z:10000};selectLumenDetail(group,far,false);
 assert.ok(group.flow.branches.every(b=>!b.coarse));
});

test('detail hysteresis and shared encounters avoid repeatedly changing simulation',()=>{
 const member=()=>({pos:{x:0,y:0,z:0},acceleration:{x:1,y:1,z:1}});
 const a={coarse:false,members:[member()]},b={coarse:false,members:[member()]};
 b.members[0].pos.x=4000;const group={flow:{branches:[a,b]}};
 selectLumenDetail(group,{x:1100,y:0,z:0},true);assert.equal(a.coarse,false);
 selectLumenDetail(group,{x:1300,y:0,z:0},true);assert.equal(a.coarse,true);
 selectLumenDetail(group,{x:1100,y:0,z:0},true);assert.equal(a.coarse,true);
 a.weave=b.weave={branches:[a,b]};selectLumenDetail(group,{x:0,y:0,z:0},true);
 assert.equal(a.coarse,false);assert.equal(b.coarse,false);
});

test('distant flocks keep migrating and landing while reducing clearance probes',()=>{
 const lakes=[{id:0,x:0,y:0,z:0,radius:35},{id:1,x:600,y:25,z:180,radius:35},{id:2,x:1800,y:70,z:-300,radius:35}];
 const {model,group,probes}=setup(lakes);model.distantLumen=true;model.listener={x:-10000,y:0,z:-10000};
 const identities=model.creatures.slice();const branch=group.flow.branches[0];branch.departAt=0;
 let arrived=false,maxRange=0;const start=probes();let steps=0;
 for(;steps<9000;steps++){
  model.step(1/30);maxRange=Math.max(maxRange,Math.hypot(branch.center.x,branch.center.z));
  if(steps%30===0)for(const c of model.creatures){assert.ok(Number.isFinite(c.pos.x+c.pos.y+c.pos.z+c.speed));assert.ok(Math.hypot(c.pos.x-c.navigation.center.x,c.pos.y-c.navigation.center.y,c.pos.z-c.navigation.center.z)<600);}
  if(branch.state==='resting'&&branch.visits.length>1){arrived=true;break;}
 }
 assert.ok(arrived,`flock did not land: ${branch.state}`);assert.ok(maxRange>400);
 assert.ok(probes()-start<steps*640*.3,'far clearance should be substantially less frequent than every step');
 assert.equal(model.creatures.length,640);assert.ok(model.creatures.every((c,i)=>c===identities[i]));
 const c=branch.members[0],before={...c.pos};model.listener={...c.pos};model.observing=true;model.step(1/30);
 assert.equal(branch.coarse,false);assert.ok(Math.hypot(c.pos.x-before.x,c.pos.y-before.y,c.pos.z-before.z)<8,'wake-up teleported an animal');
});
