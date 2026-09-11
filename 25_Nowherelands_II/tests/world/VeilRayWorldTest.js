import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js';
import { rayHabitatSite } from '../../js/world/fauna/VeilRayHabitat.js';

const lake={id:3,y:20,shore:[{x:0,z:7,y:20,nx:0,nz:1,tx:-1,tz:0}]};
const sample=(x,z)=>({ground:z<1?21:16,water:20,foam:0,slope:0.01,roof:false,lake:3});
const habitat=(sampler=sample,blocked)=>{
 for(let i=0;i<10;i++){const s=rayHabitatSite(lake,'seed'+i,sampler,blocked);if(s)return s;}
 return null;
};
function make(count=1){
 const site={...habitat(),count};assert.ok(site.id);
 const m=new FaunaModel('rays',{sample,raySites:true});
 m.listener={...site.view};m.playerSpeed=0;m.playerVelocity={x:0,z:0};
 const events=[];m.onCall=(c,landing,phrase)=>{events.push({id:c.id,phrase,time:m.time});return true;};
 const g=m.addGroup(site.id,'ray',site.x,site.z,1,{raySite:site});return {m,g,events,site};
}
const advance=(m,s)=>{for(let i=0;i<Math.round(s*30);i++)m.step(1/30);};
const invite=m=>m.hear({position:m.listener,layer:'ray-player',strength:0.35});

test('habitats require an accessible bank and a full open-water pocket in one lake',()=>{
 assert.ok(habitat());assert.deepEqual(habitat(),habitat());
 for(const patch of [{foam:0.8},{lake:4},{roof:true},{water:0},{slope:0.9}])assert.equal(habitat((x,z)=>({...sample(x,z),...patch})),null);
 assert.equal(habitat((x,z)=>({...sample(x,z),ground:Math.hypot(x,z-48)<6?25:sample(x,z).ground})),null,'interior island rejects pocket');
 assert.equal(habitat(sample,()=>true),null,'obstructed pocket rejects habitat');
 const {m}=make();assert.equal(m.addGroup('generic','ray',0,0),null,'world cannot use depth-only fallback');
});

test('real-player quiet invitation earns one pass and a bounded accompaniment',()=>{
 const {m,g,events,site}=make();advance(m,5);invite(m);assert.equal(g.members[0].state,'approach');
 let pass=false,follow=false;const c=g.members[0];
 for(let i=0;i<30*45;i++){
  if(c.state==='pass'){pass=true;m.playerSpeed=1;m.playerVelocity={x:site.tx,z:site.tz};}
  if(c.state==='follow')follow=true;
  m.step(1/30);
 }
 assert.ok(pass);assert.ok(follow);assert.equal(events.filter(e=>e.phrase==='acknowledgment').length,1);
 assert.ok(!['approach','pass','follow'].includes(c.state));
});

test('ambient sounds cannot invite; repeated invitations and sprinting cancel replies and fade calls',()=>{
 const {m,g}=make(2);let silenced=0;m.onRaySilence=()=>silenced++;
 advance(m,5);
 for(const layer of ['fauna:ray','sequencer','wind','footstep'])m.hear({position:m.listener,layer,strength:1});
 assert.ok(g.members.every(c=>!['approach','retreat'].includes(c.state)));
 invite(m);invite(m);invite(m);assert.ok(g.members.every(c=>c.state==='retreat'));assert.equal(g.reply,null);assert.ok(silenced>0);
 const avoid=g.avoidUntil;advance(m,20);m.playerSpeed=80;m.listener={...g.members[0].pos};advance(m,0.1);assert.ok(g.avoidUntil>avoid);
});

test('departure, cave entry, storms and refused audio do not produce a phantom acknowledgment',()=>{
 for(const leave of ['distance','cave','storm']){
  const {m,g,events}=make();advance(m,5);invite(m);
  if(leave==='distance')m.listener={x:2000,y:30,z:2000};if(leave==='cave')m.raysHidden=true;if(leave==='storm')m.rayWeather={storm:1};
  advance(m,30);assert.equal(events.filter(e=>e.phrase==='acknowledgment').length,0);assert.ok(!['approach','pass','follow'].includes(g.members[0].state));
 }
 const {m,g}=make();m.onCall=()=>false;advance(m,5);invite(m);advance(m,22);
 assert.equal(g.members[0].calls,0);assert.equal(g.members[0].energy,0);
});

test('three minutes of routes preserve full-span water clearance and pair separation',()=>{
 for(const count of [1,2]){
  const {m,g,site}=make(count);
  for(let i=0;i<30*180;i++){
   m.step(1/30);
   for(const c of g.members){
    assert.ok(Object.values(c.pos).every(Number.isFinite));
    assert.ok(Math.hypot(c.pos.x-site.x,c.pos.z-site.z)+c.radius+1.99<=site.radius);
    assert.ok(c.pos.y-c.radius>site.y);
    assert.ok(Math.hypot(c.pos.x-c.prev.x,c.pos.y-c.prev.y,c.pos.z-c.prev.z)<0.4,'continuous movement');
   }
   if(count===2){const [a,b]=g.members;assert.ok(Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)>a.radius+b.radius+2);}
  }
 }
});

test('social replies stay bounded, unloading restores identity, and 30/60 Hz produce the same encounter',()=>{
 const {m,g,events,site}=make(2);advance(m,160);
 assert.ok(events.length>=4&&events.length<12);
 for(let i=1;i<events.length;i++)assert.ok(events[i].time-events[i-1].time>=6.99);
 const identity=g.members.map(c=>[c.id,c.size,c.voice]);m.removeFar({x:2000,z:2000});assert.equal(m.creatures.length,0);
 const again=m.addGroup(site.id,'ray',site.x,site.z,1,{raySite:site});assert.deepEqual(again.members.map(c=>[c.id,c.size,c.voice]),identity);
 const a=make(),b=make();advance(a.m,5);advance(b.m,5);invite(a.m);invite(b.m);
 for(let i=0;i<30*40;i++){a.m.step(1/30);b.m.step(1/60);b.m.step(1/60);}
 assert.equal(a.g.members[0].state,b.g.members[0].state);
 assert.ok(Math.hypot(a.g.members[0].pos.x-b.g.members[0].pos.x,a.g.members[0].pos.z-b.g.members[0].pos.z)<0.3);
});

test('population caps include paired sites and streamed obstacles trigger safe rerouting',()=>{
 const {m,g,site}=make(2);
 for(let i=1;i<8;i++)m.addGroup('lake-'+i,'ray',i*200,0,1,{raySite:{...site,id:'lake-'+i,x:i*200}});
 assert.equal(m.creatures.filter(c=>c.kind==='ray').length,5);
 const a=make();advance(a.m,3);const c=a.g.members[0],end=c.path.points.at(-1),before={...c.pos};
 const blocked=(x,z,r)=>Math.hypot(x-end.x,z-end.z)<r+1;
 a.m.environment.blocked=blocked;
 let rerouted=false;
 for(let i=0;i<30*30;i++){
  a.m.step(1/30);if(c.state==='return')rerouted=true;
  assert.ok(!blocked(c.pos.x,c.pos.z,c.radius+1.9),'full membrane stays outside new collider');
 }
 assert.ok(rerouted);assert.ok(Math.hypot(c.pos.x-before.x,c.pos.z-before.z)>1,'does not remain frozen before the obstacle');
});
