import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js?v=stable-30-25';
import { lumenCheckpoint, restoreLumenModel, advanceLumen, applyLumenPresentation, LUMEN_STEP } from '../../js/world/fauna/LumenWorkerState.js?v=stable-30-25';
const sample=(x,z)=>({ground:-4,water:0,slope:0,foam:0,hardness:0,roof:false,forest:0,wet:1,coast:0});
function setup(){const env={sample,lakes:[]},m=new FaunaModel('worker-test',env);m.listener={x:10000,y:0,z:10000};m.addGroup('shoal','lumen',0,0,4);return m;}
function canonical(value){const seen=new Map();const walk=v=>{if(!v||typeof v!=='object')return v;if(seen.has(v))return{$ref:seen.get(v)};seen.set(v,seen.size);if(v instanceof Map)return [...v].map(([k,v])=>[k,walk(v)]);if(v instanceof Set)return [...v].map(walk);if(Array.isArray(v))return v.map(walk);return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,walk(v)]));};return JSON.stringify(walk(value));}
function state(m){return structuredClone(lumenCheckpoint(m));}
test('structured-cloned checkpoints retain RNGs, cyclic aliases and exact fixed-step motion',()=>{
 const a=setup(),b=restoreLumenModel(state(a),a.environment),ea=[],eb=[];
 for(const[m,events]of[[a,ea],[b,eb]]){m.onCall=c=>events.push(['call',m.time,c.id,{...c.pos}]);m.onEscape=c=>events.push(['escape',m.time,c.id,{...c.pos}]);m.onNoteReply=(kind,c,alarm)=>events.push(['reply',m.time,c.id,alarm]);}
 for(let i=0;i<240;i++){
  const c=a.creatures[0],input={steps:1,commands:i===80?[{type:'hear',note:{position:{...c.pos},strength:.35,layer:'player-note',radius:82.5}}]:[],listener:i>=20&&i<25?{...c.pos}:{x:10000,y:0,z:10000},observing:false,activity:0};
  advanceLumen(a,input);advanceLumen(b,structuredClone(input));
  if(i%30===0)assert.equal(canonical(state(b)),canonical(state(a)));
 }
 assert.deepEqual(ea,eb);assert.ok(ea.length);assert.equal(canonical(state(a)),canonical(state(b)));
});
test('presentation updates retain guide, audio and light identity and main-thread reply highlighting',()=>{
 const main=setup(),c=main.creatures[0],branch=c.navigation,worker=restoreLumenModel(state(main),main.environment);
 c.replyGlow=.8;c.replyProgress=.4;c.renderLod=2;
 worker.step(LUMEN_STEP);worker.creatures[0].replyGlow=0;worker.creatures[0].renderLod=0;
 applyLumenPresentation(main,state(worker));
 assert.equal(main.creatures[0],c);assert.equal(c.navigation,branch);assert.equal(c.replyGlow,.8);assert.equal(c.replyProgress,.4);assert.equal(c.renderLod,2);assert.deepEqual(c.pos,worker.creatures[0].pos);
});
test('external ownership leaves lumen state alone while the local clock advances',()=>{
 const m=setup(),before=structuredClone(m.creatures);m.externalLumen=true;m.step(LUMEN_STEP);m.hear({position:{...m.creatures[0].pos},strength:1,layer:'player-note'});
 assert.equal(canonical(m.creatures),canonical(before));assert.equal(m.time,LUMEN_STEP);
});

const {packLumenFrame,applyLumenFrame,encodeCheckpoint,decodeCheckpoint}=await import('../../js/world/fauna/LumenTransfer.js?v=stable-30-20');
test('packed motion preserves double precision and transfers without copying the simulation graph',()=>{
 const source=setup(),mirror=setup(),creatures=mirror.creatures.slice(),lakes=new Map();source.step(LUMEN_STEP);
 const frame=packLumenFrame(source);const received=structuredClone(frame,{transfer:[frame.values.buffer]});assert.equal(frame.values.byteLength,0);
 applyLumenFrame(mirror,received,creatures,lakes);
 for(let i=0;i<creatures.length;i++){const a=source.creatures[i],b=creatures[i];for(const key of ['pos','prev','vel','elastic','speed','energy','notePhase','stroke','breath'])assert.deepEqual(a[key],b[key]);}
});
test('binary recovery checkpoint preserves nonfinite values, RNG state, cycles and shore aliases',()=>{
 const source=setup();source.step(LUMEN_STEP);
 const lake=source.creatures[0].navigation.lake,lakes=[lake];source.groups.values().next().value.alias=lake;
 const before=state(source),bytes=encodeCheckpoint(lumenCheckpoint(source),lakes),after=decodeCheckpoint(bytes,lakes);
 assert.equal(canonical(after),canonical(before));assert.equal(after.groups.values().next().value.alias,lake);
 const restored=restoreLumenModel(after,source.environment);source.step(LUMEN_STEP);restored.step(LUMEN_STEP);assert.equal(canonical(state(restored)),canonical(state(source)));
});

const {LumenSimulation}=await import('../../js/world/fauna/LumenSimulation.js?v=stable-30-25');
test('worker recovery replays unacknowledged inputs once and preserves active public references',()=>{
 const main=setup(),original=main.creatures[0],branch=original.navigation,checkpoint=state(main),reference=restoreLumenModel(structuredClone(checkpoint),main.environment);
 const input=(steps,call=false)=>({steps,listener:{x:10000,y:0,z:10000},observing:false,activity:0,obstacles:[],commands:call?[{type:'call',id:original.id}]:[]});
 const journal=[input(2,true)],inflight={id:4,inputs:[input(2,true)]},pending=[input(1)];
 for(const entry of [...journal,...inflight.inputs,...pending])advanceLumen(reference,entry);
 main.time=reference.time;main.externalLumen=true;original.replyGlow=.75;
 const heard=[];main.onCall=c=>heard.push(c.id);
 const simulation=Object.assign(Object.create(LumenSimulation.prototype),{model:main,fauna:{model:main,obstacles:[],lakes:[]},active:true,failed:false,checkpoint,journal,inflight,pending,commands:[],originalHear:main.hear,originalCall:main.call,worker:{terminate(){}}});
 simulation.fail('test failure');
 assert.equal(main.externalLumen,false);assert.equal(main.creatures[0],original);assert.equal(original.navigation,branch);assert.equal(original.replyGlow,.75);
 assert.deepEqual(original.pos,reference.creatures[0].pos);assert.deepEqual(original.vel,reference.creatures[0].vel);assert.equal(original.rnd.state,reference.creatures[0].rnd.state);assert.equal(original.calls,reference.creatures[0].calls);
 assert.deepEqual(heard,[original.id],'acknowledged call must not sound a second time');
 main.step(LUMEN_STEP);reference.step(LUMEN_STEP);assert.deepEqual(original.pos,reference.creatures[0].pos);
});

test('startup failure releases loading and restores the synchronous methods',async()=>{
 const previous=globalThis.Worker;let fake;
 globalThis.Worker=class{constructor(){fake=this;}postMessage(){}terminate(){this.terminated=true;}};
 try{const model=setup(),hear=model.hear,call=model.call,s=new LumenSimulation({model,lakes:[],shared:{world:{}},hm:{waterLevel:0}});fake.onerror({message:'test startup failure',preventDefault(){}});await s.ready;assert.equal(s.active,false);assert.equal(s.failed,true);assert.equal(model.hear,hear);assert.equal(model.call,call);assert.equal(fake.terminated,true);}
 finally{globalThis.Worker=previous;}
});

test('merged flock metadata retains canonical branch membership for the guide',()=>{
 const source=setup(),mirror=setup(),g=source.groups.values().next().value;
 const encounter={stage:'merged',branches:g.flow.branches.slice(0,2)};for(const b of encounter.branches)b.weave=encounter;
 source.creatures[0].landed=true;mirror.creatures[0].replyGlow=.7;
 const frame=packLumenFrame(source);applyLumenFrame(mirror,frame,mirror.creatures,new Map());
 const b=mirror.groups.values().next().value.flow.branches[0];
 assert.equal(b.weave.branches[0],b);assert.equal(b.weave.branches[1],mirror.groups.values().next().value.flow.branches[1]);assert.ok(b.weave.branches.reduce((n,b)=>n+b.members.length,0)>0);assert.equal(mirror.creatures[0].landed,true);assert.equal(mirror.creatures[0].replyGlow,.7);
});

test('a snapshot encoded between later simulation steps restores its original clock, RNGs and lake aliases',()=>{
 const source=setup(),lake=source.creatures[0].navigation.lake,lakes=[lake];
 const snapshot=structuredClone({state:lumenCheckpoint(source),lakes});
 const expected=restoreLumenModel(state(source),source.environment);
 for(let i=0;i<20;i++)source.step(LUMEN_STEP);
 const recovered=restoreLumenModel(decodeCheckpoint(encodeCheckpoint(snapshot.state,snapshot.lakes),lakes),source.environment);
 assert.equal(recovered.time,expected.time);assert.equal(recovered.creatures[0].navigation.lake,lake);
 for(let i=0;i<90;i++){expected.step(LUMEN_STEP);recovered.step(LUMEN_STEP);}
 assert.equal(canonical(state(recovered)),canonical(state(expected)));
});

test('late recovery checkpoints retain later acknowledged inputs and ignore older snapshots',()=>{
 const s=Object.assign(Object.create(LumenSimulation.prototype),{failed:false,stats:{},checkpointSequence:3,checkpoint:'old',journal:[{checkpointSequence:4,steps:1},{checkpointSequence:5,steps:2},{checkpointSequence:6,steps:1}],inflight:{id:7,inputs:[{steps:1}]}});
 const checkpoint=new ArrayBuffer(16);
 s.receive({type:'checkpoint',id:5,checkpoint,cloneMs:2,maxSliceMs:1});
 assert.equal(s.checkpoint,checkpoint);assert.deepEqual(s.journal,[{checkpointSequence:6,steps:1}]);assert.equal(s.inflight.id,7);
 s.receive({type:'checkpoint',id:4,checkpoint:new ArrayBuffer(8)});
 assert.equal(s.checkpoint,checkpoint);assert.equal(s.checkpointSequence,5);
});

test('checkpoint graph encoding retains special numbers, UTF-16 strings, Map keys and Set aliases',()=>{
 const lake={reference:12},lakes=[lake],key={label:'🌲\ud800'},state={nan:NaN,negativeZero:-0,infinity:Infinity,missing:undefined,key,lake};
 state.self=state;state.map=new Map([[key,state]]);state.set=new Set([key,state]);
 const copy=decodeCheckpoint(encodeCheckpoint(state,lakes),lakes);
 assert.ok(Number.isNaN(copy.nan));assert.ok(Object.is(copy.negativeZero,-0));assert.equal(copy.infinity,Infinity);assert.equal(copy.key.label,key.label);assert.equal(copy.lake,lake);assert.equal(copy.self,copy);assert.equal(copy.map.get(copy.key),copy);assert.ok(copy.set.has(copy.key));assert.ok(copy.set.has(copy));assert.ok(Object.hasOwn(copy,'missing'));
});

test('motion buffers retain the established field order and every scalar through reuse',()=>{
 const source=setup(),mirror=setup(),vectors=['pos','prev','vel','elastic'],scalars=['oldVX','oldVY','oldVZ','speed','energy','noteGlow','notePhase','noteAlarm','yaw','pitch','bank','bend','turnRate','effort','stroke','breath','resting','ground','water','prevStroke','prevYaw','prevPitch','prevBank','calls','landed'],booleans=new Set(['noteAlarm','resting','landed']);
 let n=0;const expected=[];
 for(const c of source.creatures){for(const key of vectors)for(const axis of ['x','y','z'])expected.push(c[key][axis]=++n/7);for(const key of scalars){c[key]=booleans.has(key)?!!(++n%2):++n/11;expected.push(Number(c[key]));}expected.push(c.navigation.index);}
 const frame=packLumenFrame(source);assert.deepEqual([...frame.values],expected);assert.equal(packLumenFrame(source,frame.values.buffer).values.buffer,frame.values.buffer);
 applyLumenFrame(mirror,frame,mirror.creatures,new Map());
 for(let i=0;i<source.creatures.length;i++)for(const key of [...vectors,...scalars])assert.deepEqual(mirror.creatures[i][key],source.creatures[i][key]);
});

test('recycled checkpoint buffers preserve complete state through transfer and growth', async()=>{
 const {encodeCheckpoint,decodeCheckpoint}=await import('../../js/world/fauna/LumenCheckpoint.js?v=stable-30-20');
 const m=setup(),lakes=m.environment.lakes;
 let buffer=new ArrayBuffer(1048576);
 for(let i=0;i<12;i++){
  m.step(LUMEN_STEP);const state=lumenCheckpoint(m),packed=encodeCheckpoint(state,lakes,buffer);
  assert.equal(packed,buffer,'the reserved storage must be reused');
  assert.equal(canonical(decodeCheckpoint(packed,lakes)),canonical(decodeCheckpoint(encodeCheckpoint(state,lakes),lakes)));
  buffer=structuredClone(packed,{transfer:[packed]});assert.equal(packed.byteLength,0);
 }
 const grown=encodeCheckpoint(lumenCheckpoint(m),lakes,new ArrayBuffer(16));
 assert.ok(grown.byteLength>16);assert.equal(canonical(decodeCheckpoint(grown,lakes)),canonical(decodeCheckpoint(encodeCheckpoint(lumenCheckpoint(m),lakes),lakes)));
});

test('a new recovery checkpoint returns only the superseded buffer to the worker',()=>{
 const main=setup(),previous=encodeCheckpoint(lumenCheckpoint(main),[],new ArrayBuffer(1048576)),messages=[];
 main.step(LUMEN_STEP);const current=encodeCheckpoint(lumenCheckpoint(main),[],new ArrayBuffer(1048576));
 const s=Object.assign(Object.create(LumenSimulation.prototype),{failed:false,stats:{},checkpointSequence:1,checkpoint:previous,journal:[],worker:{postMessage(message,transfer){messages.push(structuredClone(message,{transfer}));}}});
 s.receive({type:'checkpoint',id:2,checkpoint:current});
 assert.equal(previous.byteLength,0);assert.equal(s.checkpoint,current);assert.equal(current.byteLength,1048576);
 assert.equal(messages.length,1);assert.equal(messages[0].type,'recycleCheckpoint');
 assert.equal(canonical(decodeCheckpoint(current,[])),canonical(decodeCheckpoint(encodeCheckpoint(lumenCheckpoint(main),[]),[])));
 s.receive({type:'checkpoint',id:1,checkpoint:messages[0].buffer});
 assert.equal(s.checkpoint,current);assert.equal(messages.length,1);
});

test('worker messages omit unchanged obstacles while recovery inputs retain every exact snapshot',()=>{
 const sent=[],oldWorker=globalThis.Worker;
 globalThis.Worker=class{postMessage(data){sent.push(structuredClone(data));}terminate(){}};
 let s;
 try {
  const model=setup(),obstacles=[{position:{x:1,y:2,z:3},radius:4}];
  s=new LumenSimulation({model,lakes:[],obstacles,shared:{world:{}},hm:{waterLevel:0}});
  clearTimeout(s.timeout);s.active=true;sent.length=0;
  const dispatch=()=>{s.update(1);const input=s.inflight.inputs[0];clearTimeout(s.timeout);s.inflight=null;return input;};
  const a=dispatch(),b=dispatch();
  assert.deepEqual(sent[0].inputs[0].obstacles,obstacles);
  assert.equal(sent[1].inputs[0].obstacles,undefined);
  assert.equal(a.obstacles,b.obstacles);
  obstacles[0].position.x=9;const c=dispatch();
  assert.deepEqual(sent[2].inputs[0].obstacles,obstacles);
  assert.equal(a.obstacles[0].position.x,1);assert.equal(c.obstacles[0].position.x,9);
  obstacles.length=0;const d=dispatch();
  assert.deepEqual(sent[3].inputs[0].obstacles,[]);assert.deepEqual(d.obstacles,[]);
 } finally {s?.dispose();globalThis.Worker=oldWorker;}
});

test('Lumen checkpoints exclude the main-thread cave steering scheduler and pending generators',()=>{
 const m=setup();m.pebbleSteering={now:()=>performance.now(),jobs:new Map([[m, (function*(){yield;})()]])};
 const checkpoint=structuredClone(lumenCheckpoint(m));
 assert.equal('pebbleSteering' in checkpoint,false);
 assert.equal(restoreLumenModel(checkpoint,m.environment).creatures.length,m.creatures.filter(c=>c.kind==='lumen').length);
});
