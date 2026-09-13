// Exact PCM is prepared away from rendering. Share requests and bound retained
// clips; a worker failure uses small cooperative slices, never a blocking call.
export class AudioSampleBank {
 constructor(ctx,{workerFactory,build,key,limit=12}) {
  this.build=build;this.keyFor=key;this.limit=limit;
  this.ctx=ctx;this.cache=new Map();this.pending=new Map();this.serial=0;this.disposed=false;
  try{this.worker=workerFactory();this.worker.onmessage=({data})=>{const job=this.pending.get(data.id);if(!job)return;if(data.error)this.fallback(job);else this.finish(job,data.samples);};this.worker.onerror=this.worker.onmessageerror=event=>{event.preventDefault?.();this.worker?.terminate();this.worker=null;for(const job of this.pending.values())this.fallback(job);};}catch{this.worker=null;}
 }
 key(o){return this.keyFor(o);}
 get(options){return this.cache.get(this.key(options));}
 request(options) {
  if(this.disposed)return Promise.resolve(null);
  const key=this.key(options),cached=this.cache.get(key);if(cached)return Promise.resolve(cached);
  for(const job of this.pending.values())if(job.key===key)return job.promise;
  let resolve;const promise=new Promise(r=>{resolve=r}),job={id:++this.serial,key,options,resolve,promise};this.pending.set(job.id,job);job.timeout=setTimeout(()=>this.fallback(job),5000);
  if(this.worker){try{this.worker.postMessage({id:job.id,options});}catch{this.fallback(job);}}else this.fallback(job);
  return promise;
 }
 fallback(job) {
  if(job.work||this.disposed)return;job.work=this.build(job.options);
  const step=()=>{if(this.disposed)return;const deadline=performance.now()+1;let result;do{result=job.work.next();}while(!result.done&&performance.now()<deadline);if(result.done)this.finish(job,result.value);else job.timer=setTimeout(step,0);};
  job.timer=setTimeout(step,0);
 }
 finish(job,samples) {
  if(this.disposed||!this.pending.has(job.id))return;
  clearTimeout(job.timer);clearTimeout(job.timeout);const buffer=this.ctx.createBuffer(1,samples.length,job.options.sampleRate);buffer.copyToChannel(samples,0);
  if(this.cache.size>=this.limit)this.cache.delete(this.cache.keys().next().value);
  this.cache.set(job.key,buffer);this.pending.delete(job.id);job.resolve(buffer);
 }
 dispose(){this.disposed=true;this.worker?.terminate();for(const job of this.pending.values()){clearTimeout(job.timer);clearTimeout(job.timeout);job.resolve(null);}this.pending.clear();this.cache.clear();}
}
