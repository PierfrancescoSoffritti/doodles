import test from 'node:test';import assert from 'node:assert/strict';
import { SurfaceWork } from '../../js/world/SurfaceWork.js?v=stable-30-25';
class WorkerStub{constructor(){this.messages=[];}postMessage(data,transfer=[]){this.messages.push(structuredClone(data,{transfer}));}terminate(){this.terminated=true;}}
const receive=port=>new Promise(resolve=>{port.onmessage=event=>resolve(event.data);});
test('simulation ports omit the duplicate world and isolate replies from surface jobs',async()=>{
 const previous=globalThis.Worker;globalThis.Worker=WorkerStub;let backend;
 try{
  const work=new SurfaceWork({world:{}},'fern'),adapter=work.simulationWorker();backend=work.worker.messages.at(-1).port;
  const incoming=receive(backend);adapter.postMessage({type:'init',waterLevel:7,world:{get forbidden(){throw Error('World was cloned');}}});assert.deepEqual(await incoming,{type:'init',waterLevel:7});
  const ready=new Promise(resolve=>adapter.onmessage=event=>resolve(event.data));backend.postMessage({type:'ready'});assert.deepEqual(await ready,{type:'ready'});assert.equal(work.ready,false,'simulation readiness cannot consume surface replies');
  const ended=receive(backend);adapter.terminate();assert.deepEqual(await ended,{type:'dispose'});assert.equal(work.simulations.size,0);assert.equal(work.worker.terminated,undefined);adapter.terminate();
 }finally{backend?.close();globalThis.Worker=previous;}
});
test('surface failure notifies every simulation channel and releases its clients',async()=>{
 const previous=globalThis.Worker,warn=console.warn;globalThis.Worker=WorkerStub;console.warn=()=>{};const ports=[];
 try{
  const work=new SurfaceWork({world:{}},'fern'),a=work.simulationWorker(),b=work.simulationWorker();ports.push(...work.worker.messages.filter(m=>m.port).map(m=>m.port));let failed=0;
  a.onerror=b.onerror=event=>{event.preventDefault();failed++;};work.fail();assert.equal(failed,2);assert.equal(work.simulations.size,0);assert.equal(work.failed,true);assert.equal(work.worker.terminated,true);assert.equal(work.simulationWorker(),null);
 }finally{for(const p of ports)p.close();globalThis.Worker=previous;console.warn=warn;}
});
