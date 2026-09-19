import {mobileOption} from '../../core/MobileDetail.js?v=stable-30-3';
import { ObstacleSnapshot } from './ObstacleSnapshot.js?v=stable-30-19';
import { applyLumenFrame, decodeCheckpoint, LUMEN_STRIDE } from './LumenTransfer.js?v=stable-30-20';
import { lumenCheckpoint, restoreLumenModel, advanceLumen, LUMEN_STEP, PRESENTATION_OWNED } from './LumenWorkerState.js?v=streaming-60-30-19';

// One request in flight. Inputs retain their order and fixed steps; neither
// late messages nor a slow worker can accumulate an unbounded simulation queue.
export class LumenSimulation {
 constructor(fauna) {
  this.fauna=fauna;this.model=fauna.model;this.commands=[];this.pending=[];this.journal=[];this.creatures=this.model.creatures.filter(c=>c.kind==='lumen');this.lakes=new Map(fauna.lakes.map(l=>[l.id,l]));this.active=false;this.failed=false;this.sequence=0;
  this.ready=new Promise(resolve=>{this.resolveReady=resolve;});
  this.obstacleSnapshot=new ObstacleSnapshot();this.sentObstacles=null;
  this.stats={received:0,workerMs:0,applyMs:0,maxLagSteps:0};
  this.originalHear=this.model.hear;this.originalCall=this.model.call;
  this.model.hear=note=>{if(this.active)this.commands.push({type:'hear',note:structuredClone(note)});return this.originalHear.call(this.model,note);};
  this.model.call=c=>{if(this.active&&c?.kind==='lumen'){this.commands.push({type:'call',id:c.id,position:{...c.pos}});return;}return this.originalCall.call(this.model,c);};
  try{
   this.worker=(mobileOption('sharedSimulationWorker')&&fauna.shared.surfaceWork?.simulationWorker())||new Worker(new URL('./LumenWorker.js?v=streaming-60-30-19',import.meta.url),{type:'module'});
   this.stats.sharedWorker=!!this.worker.shared;
   this.worker.onmessage=({data})=>this.receive(data);
   this.worker.onerror=event=>{event.preventDefault();this.fail(event.message);};
   this.worker.onmessageerror=()=>this.fail('Unable to read simulation state');
   this.worker.postMessage({type:'init',world:fauna.shared.world,seed:this.model.seed,waterLevel:fauna.hm.waterLevel});
   this.timeout=setTimeout(()=>this.fail('Simulation worker did not initialize'),60000);
  }catch(error){this.fail(String(error));}
 }
 receive(data) {
  if(this.failed)return;
  if(data.type==='error'){this.fail(data.message);return;}
  if(data.type==='checkpoint'){
   if(data.id<=(this.checkpointSequence||0))return;
   const previous=this.checkpoint;this.checkpoint=data.checkpoint;this.checkpointSequence=data.id;
   if(previous instanceof ArrayBuffer && previous.byteLength)this.worker.postMessage({type:'recycleCheckpoint',buffer:previous},[previous]);
   this.journal=this.journal.filter(input=>input.checkpointSequence>data.id);
   this.stats.checkpointBytes=data.checkpoint.byteLength;
   this.stats.maxCheckpointEncodeMs=Math.max(this.stats.maxCheckpointEncodeMs||0,data.encodeMs||0);
   return;
  }
  if(data.type==='ready') {
   this.checkpoint=structuredClone(lumenCheckpoint(this.model));
   this.worker.postMessage({type:'start',state:lumenCheckpoint(this.model),lakes:this.fauna.lakes});
   return;
  }
  if(data.type==='started'){
   clearTimeout(this.timeout);this.checkpoint=data.checkpoint;this.active=this.model.externalLumen=true;this.resolveReady();
   return;
  }
  if(data.type!=='state'||data.id!==this.inflight?.id)return;
  this.stats.maxWorkerMs=Math.max(this.stats.maxWorkerMs||0,data.workMs||0);
  if(data.workMs>25){const slow=this.stats.slowFrames ||= [];slow.push({at:performance.now(),workMs:data.workMs,simulationMs:data.simulationMs,cloneMs:data.checkpointCloneMs||0,steps:data.steps});if(slow.length>120)slow.shift();}
  clearTimeout(this.timeout);
  if(data.frame?.values?.length!==this.creatures.length*LUMEN_STRIDE){this.fail('Invalid lumen motion buffer');return;}
  if(this.inflight.id>(this.checkpointSequence||0)){
   for(const input of this.inflight.inputs){input.checkpointSequence=this.inflight.id;this.journal.push(input);}
  }
  this.inflight=null;
  const now=performance.now();applyLumenFrame(this.model,data.frame,this.creatures,this.lakes);this.buffer=data.frame.values.buffer;
  this.receivedAt=now;this.stats.received++;this.stats.workerMs=data.workMs;this.stats.simulationMs=data.simulationMs;this.stats.steps=data.steps;this.stats.lagSteps=(this.model.time-data.frame.time)/LUMEN_STEP;this.stats.applyMs=performance.now()-now;
  this.deliver(data.events);
  this.dispatch();
 }
 deliver(events) {
  if(!events.length)return;
  const byId=new Map(this.model.creatures.map(c=>[c.id,c]));
  for(const event of events) {
   const c=byId.get(event.id);if(!c)continue;
   const position={...c.pos};if(event.position)Object.assign(c.pos,event.position);
   try{
    if(event.type==='call')this.model.onCall(c);
    if(event.type==='escape')this.model.onEscape(c);
    if(event.type==='reply')this.model.onNoteReply?.('lumen',c,event.alarm);
   }finally{Object.assign(c.pos,position);}
  }
 }
 update(steps) {
  if(!this.active)return;
  const m=this.model;
  if(steps||this.commands.length)this.pending.push({steps,commands:this.commands.splice(0),listener:{x:m.listener.x,y:m.listener.y,z:m.listener.z},observing:m.observing,activity:m.activity,
   obstacles:this.obstacleSnapshot.capture(this.fauna.obstacles)});
  const lag=this.pending.reduce((n,input)=>n+input.steps,0)+(this.inflight?.inputs.reduce((n,input)=>n+input.steps,0)||0);
  this.stats.maxLagSteps=Math.max(this.stats.maxLagSteps,lag);
  if(lag>12){this.fail('Simulation worker fell more than twelve fixed steps behind');return;}
  this.dispatch();
  this.model.lumenAlpha=this.receivedAt===undefined?1:Math.min(1,(performance.now()-this.receivedAt)/(LUMEN_STEP*1000));
 }
 dispatch() {
  if(!this.active||this.inflight||!this.pending.length)return;
  // Publish progress frequently during catch-up instead of turning a short
  // stall into an ever larger, uninterrupted simulation batch.
  this.inflight={type:'step',id:++this.sequence,inputs:this.pending.splice(0,2)};
  // Keep complete immutable inputs in the journal, but send unchanged obstacle
  // values only once. Each worker message still advances the same fixed steps.
  const inputs=this.inflight.inputs.map(input=>{
   const obstacles=input.obstacles===this.sentObstacles?undefined:input.obstacles;
   this.sentObstacles=input.obstacles;
   return {...input,obstacles};
  });
  try{this.worker.postMessage({...this.inflight,inputs,buffer:this.buffer},this.buffer?[this.buffer]:[]);this.buffer=null;}catch(error){this.fail(String(error));return;}
  this.timeout=setTimeout(()=>this.fail('Simulation worker stopped responding'),2000);
 }
 fail(reason) {
  if(this.failed)return;
  this.failed=true;this.reason=reason;this.resolveReady?.();clearTimeout(this.timeout);this.worker?.terminate();
  if(this.active) {
   // Recover from the last acknowledged complete state, then replay only the
   // unacknowledged inputs. Sound events from acknowledged states never repeat.
   const restored=restoreLumenModel(this.checkpoint instanceof ArrayBuffer?decodeCheckpoint(this.checkpoint,this.fauna.lakes):this.checkpoint,this.model.environment),events=[];
   restored.onCall=c=>events.push({type:'call',id:c.id,position:{...c.pos}});
   restored.onEscape=c=>events.push({type:'escape',id:c.id,position:{...c.pos}});
   restored.onNoteReply=(kind,c,alarm)=>events.push({type:'reply',id:c.id,alarm,position:{...c.pos}});
   if(this.commands.length)this.pending.push({steps:0,commands:this.commands.splice(0),listener:{...this.model.listener},observing:this.model.observing,activity:this.model.activity,obstacles:this.fauna.obstacles});
   const obstacles=this.fauna.obstacles;
   try{for(const input of this.journal){this.fauna.obstacles=input.obstacles;advanceLumen(restored,input);}events.length=0;for(const input of [...(this.inflight?.inputs||[]),...this.pending]){this.fauna.obstacles=input.obstacles;advanceLumen(restored,input);}}
   finally{this.fauna.obstacles=obstacles;}
   // Reconcile the complete cyclic graph into existing public objects so UI,
   // sounding voices and lights keep their creature/branch references.
   const aliases=new Map([[restored,this.model]]);
   for(const c of restored.creatures){const old=this.model.creatures.find(x=>x.id===c.id);if(old)aliases.set(c,old);}
   for(const[id,g]of restored.groups){const old=this.model.groups.get(id);if(old){aliases.set(g,old);for(const b of g.flow.branches){const previous=old.flow.branches.find(x=>x.id===b.id);if(previous)aliases.set(b,previous);}}}
   const visited=new Set();
   const copy=value=>{
    if(!value||typeof value!=='object')return value;
    const target=aliases.get(value)||value;
    if(target!==value)for(const key of Object.keys(target))if(!Object.hasOwn(value,key)&&!PRESENTATION_OWNED.has(key))delete target[key];
    if(visited.has(value))return target;visited.add(value);
    if(value instanceof Map){for(const[k,v]of value)value.set(k,copy(v));return value;}
    if(value instanceof Set)return value;
    for(const[key,item]of Object.entries(value))if(!(target.kind==='lumen'&&target.pos&&PRESENTATION_OWNED.has(key)))target[key]=copy(item);
    return target;
   };
   for(const c of restored.creatures)copy(c);
   for(const[id,g]of restored.groups)this.model.groups.set(id,copy(g));
   this.active=this.model.externalLumen=false;delete this.model.lumenTime;delete this.model.lumenAlpha;
   this.deliver(events);
  }
  this.model.hear=this.originalHear;this.model.call=this.originalCall;
 }
 dispose(){this.failed=true;this.resolveReady?.();clearTimeout(this.timeout);this.worker?.terminate();this.model.hear=this.originalHear;this.model.call=this.originalCall;this.active=this.model.externalLumen=false;}
}
