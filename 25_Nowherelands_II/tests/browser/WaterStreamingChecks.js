import { SurfaceWork } from '../../js/world/SurfaceWork.js?v=stable-30-25';
import { InlandWater } from '../../js/world/InlandWater.js?v=stable-30-23';

export function checkWaterStreaming() {
 const OriginalWorker=globalThis.Worker, originalWarn=console.warn;
 const workers=[];
 class StubWorker {
  constructor(){this.messages=[];workers.push(this);}
  postMessage(data){this.messages.push(data);}
  terminate(){this.terminated=true;}
  reply(data){this.onmessage({data});}
 }
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 globalThis.Worker=StubWorker;console.warn=()=>{};
 try {
  const stream=new SurfaceWork({world:{}},'fern'), surface=workers[0];
  surface.reply({type:'ready'});
  const water=Object.assign(Object.create(InlandWater.prototype),{surfaceWork:stream,world:{},requestId:0,pending:false,workerReady:false,completed:null});
  const installed=[];
  stream.request('terrain:one',{type:'terrain'},0,data=>installed.push(data));
  water.rebuildNear(10,20);
  check(surface.messages.at(-1).type==='water','Near water must dispatch ahead of queued terrain');
  water.rebuildNear(50,60);check(stream.jobs.size===2,'Only one water request may be pending');
  surface.reply({result:'water-geometry'});check(surface.messages.at(-1).type==='terrain','Terrain must continue after water');
  surface.reply({result:'terrain-geometry'});stream.drain(Infinity);
  check(!water.pending&&water.completed.x===10&&water.completed.z===20&&water.completed.data==='water-geometry','Transferred geometry must retain its requested centre');
  check(installed[0]==='terrain-geometry','Terrain result must install');
  water.completed=null;water.rebuildNear(200,300);
  stream.fail();water.rebuildNear(400,500);
  const fallback=workers[1];check(fallback&&water.surfaceWork===null&&!water.pending,'Failure must release a pending request and create fallback worker');
  fallback.reply({type:'ready'});water.rebuildNear(400,500);
  const request=fallback.messages.at(-1);check(request.type==='near'&&request.x===400,'Fallback must use current player location');
  fallback.reply({type:'near',id:request.id-1,x:200,z:300,data:'stale'});
  check(water.pending&&water.completed===null,'Stale replies must not install');
  fallback.reply({...request,data:'fallback-geometry'});
  check(!water.pending&&water.completed.data==='fallback-geometry','Fallback result must install');
  return {checks:9};
 } finally {globalThis.Worker=OriginalWorker;console.warn=originalWarn;}
}
