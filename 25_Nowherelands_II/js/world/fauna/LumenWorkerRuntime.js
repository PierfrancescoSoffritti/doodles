import { packLumenFrame, encodeCheckpoint } from './LumenTransfer.js?v=stable-30-20';
import { Heightmap } from '../Heightmap.js?v=stable-30-6';
import { lumenCheckpoint, restoreLumenModel, lumenAvoid, advanceLumen, LUMEN_STEP } from './LumenWorkerState.js?v=streaming-60-30-19';
export function createLumenRuntime(heightmap, send) {
let hm=heightmap,model,obstacles=[],events=[],checkpointAt=0,checkpointBuffer=null;
const sample=(x,z,clearanceOnly=false)=>{
 const ground=hm.sample(x,z),water=hm._water;
 if(clearanceOnly)return{ground,water};
 const lake=hm.lakes.shoreId,slope=hm._slope||0,foam=hm._foam||0,hardness=hm._hardness,roof=hm.caves.surfaceDensity(x,ground,z)>-2,hab=hm.habitat(x,z);
 return{ground,water,lake,slope,foam,hardness,roof,forest:hab.forest,wet:hab.wet,coast:hab.coast};
};
return ({data})=>{
 try{
  if(data.type==='recycleCheckpoint'){checkpointBuffer=data.buffer;return;}
  if(data.type==='init') {if(!hm)hm=new Heightmap(data.seed,data.world);hm.waterLevel=data.waterLevel;send({type:'ready'});return;}
  if(data.type==='start') {
   checkpointAt=data.state.time+2;
   const environment={sample,lakes:data.lakes,avoid:p=>lumenAvoid(obstacles,p)};
   const warm=restoreLumenModel(structuredClone(data.state),environment);
   for(let i=0;i<30;i++)warm.step(LUMEN_STEP);
   model=restoreLumenModel(data.state,environment);
   model.onCall=c=>events.push({type:'call',id:c.id,time:model.time,position:{...c.pos}});
   model.onEscape=c=>events.push({type:'escape',id:c.id,time:model.time,position:{...c.pos}});
   model.onNoteReply=(kind,c,alarm)=>events.push({type:'reply',id:c.id,alarm,time:model.time,position:{...c.pos}});
   const checkpoint=encodeCheckpoint(lumenCheckpoint(model),data.lakes,new ArrayBuffer(1048576));
   send({type:'started',checkpoint},[checkpoint]);return;
  }
  if(data.type==='step') {
   events=[];const started=performance.now();
   for(const input of data.inputs){if(input.obstacles!==undefined)obstacles=input.obstacles;advanceLumen(model,input);}
   const simulationMs=performance.now()-started;
   const state=lumenCheckpoint(model);
   const frame=packLumenFrame(model,data.buffer),transfer=[frame.values.buffer];
   if(data.validate){send({type:'state',id:data.id,state,frame,events,workMs:performance.now()-started,simulationMs,steps:data.inputs.reduce((n,input)=>n+input.steps,0)},transfer);return;}
   send({type:'state',id:data.id,frame,events,workMs:performance.now()-started,simulationMs,steps:data.inputs.reduce((n,input)=>n+input.steps,0)},transfer);
   if(model.time>=checkpointAt){
    const at=performance.now(),reusable=checkpointBuffer || new ArrayBuffer(1048576);checkpointBuffer=null;
    const checkpoint=encodeCheckpoint(state,model.environment.lakes,reusable),ms=performance.now()-at;
    checkpointAt=model.time+2;
    send({type:'checkpoint',id:data.id,checkpoint,encodeMs:ms},[checkpoint]);
   }
  }
 }catch(error){send({type:'error',message:String(error),stack:error.stack});}
};

}
