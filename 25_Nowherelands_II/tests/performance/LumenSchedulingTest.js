import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
 if (specifier === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
 if (specifier.startsWith('three/addons/')) return { url: new URL('../../../common/libs/three-0.185/examples/jsm/' + specifier.slice(13), import.meta.url).href, shortCircuit: true };
 return next(specifier, context);
} });
globalThis.location = { search: '?seed=scheduling' };
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = { hidden: false };
const { Fauna } = await import('../../js/world/fauna/Fauna.js?v=stable-30-29');

function setup() {
 const updates = [], rendered = [];
 const model = { time: 0, step(dt) { this.time += dt; } };
 const fauna = {
  shared: { player: { position: {x:0,y:0,z:0}, speed:0, velocity:{x:0,y:0,z:0} }, state:{}, sun:{height:0,intensity:0} },
  model, accumulator:0, streamTimer:100,
  simulation: { active:true, inflight:{}, update(steps) { updates.push(steps); if(steps)this.inflight={}; } },
  meshes:{update(model,alpha) { rendered.push(alpha); }}, light:{update(){}},
 };
 return { fauna, model, updates, rendered, tick:dt=>Fauna.prototype.update.call(fauna,dt) };
}

test('a busy lumen worker does not pause or bundle local fauna steps', () => {
 const {fauna,model,updates,rendered,tick}=setup();
 for(let i=0;i<100;i++)tick(1/30);
 assert.ok(Math.abs(model.time-100/30)<1e-12);
 assert.ok(updates.every(steps=>steps===1));
 assert.equal(rendered.length,100);
 assert.ok(rendered.every(alpha=>alpha>=0&&alpha<=1));
 fauna.simulation.inflight=null;
 tick(1/30);
 assert.equal(updates.at(-1),1);
 assert.ok(Math.abs(model.time-101/30)<1e-12);
});

test('worker failure does not change local cadence and long ticks retain the catch-up cap', () => {
 const {fauna,model,updates,tick}=setup();
 tick(1/30);tick(1/30);
 fauna.simulation.active=false;
 tick(1/30);
 assert.equal(updates.at(-1),1);
 assert.equal(model.time,.1);
 tick(1);
 assert.equal(updates.at(-1),3);
 assert.ok(Math.abs(model.time-.2)<1e-12);
});

test('independent local steps still trigger the real worker backlog bound',async()=>{
 const {LumenSimulation}=await import('../../js/world/fauna/LumenSimulation.js');
 const {fauna,tick,model}=setup();let failure;
 const simulation=fauna.simulation={active:true,pending:[],commands:[],inflight:{inputs:[{steps:1}]},stats:{maxLagSteps:0},model,fauna,
  obstacleSnapshot:{capture(){return[];}},dispatch(){},fail(reason){failure=reason;this.active=false;},update:LumenSimulation.prototype.update};
 for(let i=0;i<100;i++)tick(1/30);
 assert.match(failure,/twelve fixed steps/);
 assert.equal(simulation.stats.maxLagSteps,13);
 assert.equal(simulation.pending.length,12);
 assert.ok(Math.abs(model.time-100/30)<1e-12);
});

test('desktop play keeps the local simulation by default', () => {
 const previous=globalThis.Worker;
 globalThis.Worker=class { constructor(){throw Error('Desktop must not start an automatic worker');} };
 try {
  const fauna={lakes:[{}]};
  assert.equal(Fauna.prototype.startSimulationWorker.call(fauna),undefined);
  assert.equal(fauna.simulation,undefined);
 } finally {globalThis.Worker=previous;}
});

test('catch-up publishes bounded batches without dropping or reordering inputs',async()=>{
 const {LumenSimulation}=await import('../../js/world/fauna/LumenSimulation.js');
 const sent=[],inputs=Array.from({length:7},(_,i)=>({steps:1,commands:[{type:'hear',id:i}],obstacles:[]}));
 const simulation={active:true,sequence:0,pending:inputs.slice(),worker:{postMessage(message){sent.push(message);}},fail(reason){assert.fail(reason);}};
 while(simulation.pending.length){
  LumenSimulation.prototype.dispatch.call(simulation);clearTimeout(simulation.timeout);
  assert.ok(simulation.inflight.inputs.length<=2);simulation.inflight=null;
 }
 assert.deepEqual(sent.flatMap(message=>message.inputs.flatMap(input=>input.commands.map(command=>command.id))),[0,1,2,3,4,5,6]);
 assert.equal(sent.reduce((sum,message)=>sum+message.inputs.reduce((n,input)=>n+input.steps,0),0),7);
});

test('skipped presentation keeps simulation and audio running without uploading meshes', () => {
 const {fauna,model,rendered}=setup();
 fauna.simulation.active=false;
 const lightTimes=[];let audioUpdates=0;
 fauna.light.update=(_,dt)=>lightTimes.push(dt);
 fauna.audio={prepareRays(){},update(){audioUpdates++;}};
 for(let i=0;i<60;i++)Fauna.prototype.update.call(fauna,1/60,i%2===1);
 assert.ok(Math.abs(model.time-1)<1e-12);
 assert.equal(audioUpdates,60);
 assert.equal(rendered.length,30);
 assert.equal(lightTimes.length,30);
 assert.ok(lightTimes.every(dt=>Math.abs(dt-1/30)<1e-12));
 assert.equal(fauna.presentationTime,0);
});
