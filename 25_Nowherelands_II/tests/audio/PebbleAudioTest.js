import test from 'node:test';
import assert from 'node:assert/strict';
import { pebbleSamples, PEBBLE_SOUNDS } from '../../js/audio/PebbleSoundBank.js?v=pebble-audio-10';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js?v=pebble-voice-4b';
const sample=()=>({ground:2,water:-4,slope:0,hardness:1,forest:0,wet:0});

test('all foley samples are finite, deterministic, tapered and have usable headroom',()=>{
 for(const event of Object.keys(PEBBLE_SOUNDS)) {
  const a=pebbleSamples(event,44100,1),b=pebbleSamples(event,44100,1);
  assert.deepEqual(a,b);let peak=0,sum=0;
  for(const v of a){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  assert.ok(peak>.85 && peak<.91,event);assert.ok(Math.sqrt(sum/a.length)>.025,event);
  assert.ok(Math.abs(a[0])<.001 && Math.abs(a.at(-1))<.001,event+' has an abrupt edge');
 }
});

test('an actual encounter emits distinct startle, bounded strides, and settling events',()=>{
 const model=new FaunaModel('sound-events',{sample}),g=model.addGroup('sound','hopper',0,0,1),c=g.members[0];
 model.creatures=g.members=[c];g.stones=[];
 const events=[];model.onPebbleSound=(c,event)=>events.push({event,t:model.time});
 model.listener={x:c.pos.x+4,y:c.ground+11,z:c.pos.z};
 for(let i=0;i<900;i++)model.step(1/30);
 assert.equal(events.filter(e=>e.event==='startle').length,1);
 assert.equal(events.filter(e=>e.event==='settle').length,1);
 const steps=events.filter(e=>e.event==='step');assert.ok(steps.length>=6 && steps.length<150);
 for(let i=1;i<steps.length;i++)assert.ok(steps[i].t-steps[i-1].t>.08,'no foot-substep sound storm');
 assert.ok(events.findIndex(e=>e.event==='startle')<events.findIndex(e=>e.event==='step'));
 assert.equal(c.pebble.stand,0);
 model.listener={x:c.pos.x+4,y:c.ground+11,z:c.pos.z};
 for(let i=0;i<15;i++)model.step(1/30);
 assert.equal(events.filter(e=>e.event==='startle').length,2,'folding fully back into rest rearms the cue');
});

test('crossing a cave stream emits water entry, paddles and exit drips',()=>{
 const at=(x,z)=>({...sample(),cave:true,clearance:25,water:0,ground:2-5*Math.max(0,Math.min(1,(x+4)/5,(24-x)/5))});
 const model=new FaunaModel('wet-sounds',{sample}),g=model.addGroup('wet','hopper',0,0,1),c=g.members[0];model.creatures=g.members=[c];g.stones=[];g.sample=at;
 c.pos={x:-8,y:3.5,z:0};c.prev={...c.pos};c.ground=2;c.yaw=c.prevYaw=0;
 Object.assign(c.pebble,{state:'flee',stand:1,prevStand:1,origin:{...c.pos},refuge:{x:100,z:0},alarmSource:{x:-20,z:0},steerAt:0,heading:0});
 const events=[];model.onPebbleSound=(c,event)=>events.push(event);
 for(let i=0;i<90;i++){model.listener={x:c.pos.x-12,y:11,z:0};model.step(1/30);}
 for(const e of ['splash','paddle','drip'])assert.ok(events.includes(e),e);
 assert.ok(events.indexOf('splash')<events.indexOf('drip'));
});

test('startle cues require folded rest, while upright pauses still resume escaping',()=>{
 for(const [state,stand,expected] of [['rest',0,1],['notice',0,1],['wait',1,0],['regroup',1,0],['brake',1,0],['settle',.5,0]]) {
  const model=new FaunaModel('restart-sounds',{sample}),g=model.addGroup('restart','hopper',0,0,1),c=g.members[0];
  model.creatures=g.members=[c];g.stones=[];
  const b=c.pebble,events=[];
  Object.assign(b,{state,stand,prevStand:stand,alarmAt:0,alarmSource:{x:c.pos.x-4,y:13,z:c.pos.z},refuge:{x:c.pos.x+80,z:c.pos.z},settleFrom:stand});
  model.listener={x:c.pos.x-4,y:13,z:c.pos.z};
  model.onPebbleSound=(_,event)=>events.push(event);
  const escapes=b.escapes;
  for(let i=0;i<15;i++)model.step(1/30);
  assert.ok(b.escapes>escapes,state+' must still escape');
  assert.equal(events.filter(e=>e==='startle').length,expected,state+' startle cue');
 }
});

test('idle eye movement stays sparse and blinking never makes a sound',()=>{
 const model=new FaunaModel('idle-sounds',{sample}),g=model.addGroup('idle','hopper',0,0,1),c=g.members[0];model.creatures=g.members=[c];model.listener={x:300,y:11,z:0};
 const events=[];model.onPebbleSound=(c,event)=>events.push(event);
 for(let i=0;i<1800;i++)model.step(1/30);
 assert.ok(events.length>=2 && events.length<=8);assert.ok(events.every(e=>e==='creak'));
});
