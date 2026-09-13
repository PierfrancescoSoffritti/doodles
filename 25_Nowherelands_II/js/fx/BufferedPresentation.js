export class BufferedPresentation {
 static async create(options) {
  if(!globalThis.Worker||!globalThis.createImageBitmap||!options.source.transferControlToOffscreen)return null;
  let instance;
  try { instance=new BufferedPresentation(options);await instance.ready;return instance; }
  catch(error) { instance?.dispose();console.warn('Separate presentation unavailable',error);return null; }
 }
 constructor({source,produce,present,onFrame,depth=3}) {
  this.source=source;this.produce=produce;this.present=present;this.onFrame=onFrame;this.depth=depth;
  this.lastResponse=performance.now();this.visibility=()=>{if(document.hidden)this.suspend();};document.addEventListener("visibilitychange",this.visibility);
  this.epoch=0;this.nextId=0;this.active=false;this.failed=false;this.disposed=false;this.busy=false;this.credits=0;
  this.measurement=null;this.originalOpacity=source.style.opacity;this.pending=new Map();this.nextRequest=0;
  try {
  const display=this.display=document.createElement('canvas');
  display.width=source.width;display.height=source.height;
  display.style.cssText='position:fixed;inset:0;width:100%;height:100dvh;pointer-events:none;z-index:1;display:none';
  source.insertAdjacentElement('afterend',display);
  const canvas=display.transferControlToOffscreen();
  const worker=this.worker=new Worker(new URL('./FramePresenterWorker.js?v=stable-30-28',import.meta.url),{type:'module'});
  this.ready=new Promise((resolve,reject)=>{
   this.resolveReady=resolve;this.rejectReady=reject;
   this.readyTimer=setTimeout(()=>reject(Error('Presentation worker timed out')),5000);
  });
  worker.onmessage=event=>this.receive(event.data);
  worker.onerror=error=>this.fail(error);
  worker.postMessage({type:'init',canvas,origin:performance.timeOrigin,depth},[canvas]);
  }catch(error){this.dispose();throw error;}
 }
 receive(message) {
  if(message.type==='ready') {
   clearTimeout(this.readyTimer);this.readyTimer=null;
   message.supported?this.resolveReady():this.rejectReady(Error('No bitmap renderer'));return;
  }
  if(message.type==='reply') {
   const pending=this.pending.get(message.request);if(!pending)return;
   this.pending.delete(message.request);clearTimeout(pending.timer);pending.resolve(message.result);return;
  }
  if(message.epoch!==this.epoch||!this.active)return;
  if(message.type==='reset') {
   this.lastResponse=performance.now();this.display.style.display='';this.credits=this.depth;this.pump();
  } else if(message.type==='frame') {
   this.lastResponse=performance.now();this.source.style.opacity='0';this.onFrame(message.at);
   this.credits++;this.pump();
  } else if(message.type==='error')this.fail(Error(message.message));
 }
 resume() {
  if(this.active||this.failed||this.disposed)return;
  this.active=true;this.lastResponse=performance.now();this.epoch++;this.credits=0;
  this.worker.postMessage({type:'reset',epoch:this.epoch,width:this.source.width,height:this.source.height});
 }
 suspend() {
  if(!this.active)return;
  this.active=false;this.epoch++;this.credits=0;
  this.worker.postMessage({type:'stop',epoch:this.epoch});
  this.display.style.display='none';this.source.style.opacity=this.originalOpacity;
 }
 resize() {
  if(!this.active)return;
  this.suspend();this.resume();
 }
 async pump() {
  if(this.busy||!this.active||!this.credits)return;
  this.busy=true;
  try {
   while(this.active&&this.credits>0) {
    this.credits--;const epoch=this.epoch,trace=this.measurement,startedAt=trace?performance.now():0;
    this.produce(1/30);this.present();const producedAt=trace?performance.now():0;
    let bitmap;
    try { bitmap=await createImageBitmap(this.source); }
    catch(error) { if(!this.active||epoch!==this.epoch)continue;throw error; }
    if(!this.active||epoch!==this.epoch){bitmap.close();continue;}
    try {const id=this.nextId++,capturedAt=trace?performance.now():0;this.worker.postMessage({type:'frame',epoch,id,bitmap,producedAt},[bitmap]);
     if(trace&&capturedAt-startedAt>25){if(trace.count<2000){const i=trace.count++*4;trace.rows[i]=id;trace.rows[i+1]=startedAt;trace.rows[i+2]=producedAt;trace.rows[i+3]=capturedAt;}else trace.dropped++;}}

    catch(error){bitmap.close();throw error;}
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }catch(error){this.fail(error);}
  finally{this.busy=false;}
 }
 healthy() {
  if(this.active&&!this.probing&&performance.now()-this.lastResponse>1000) {
   const epoch=this.epoch;this.probing=true;
   this.request('stats').then(()=>{if(epoch===this.epoch)this.lastResponse=performance.now();},error=>{
    if(this.active&&epoch===this.epoch)this.fail(error);
   }).finally(()=>{this.probing=false;});
  }
  return !this.failed&&!this.disposed;
 }
 request(type,options={}) {
  if(this.failed||this.disposed)return Promise.reject(Error('Presentation worker unavailable'));
  const request=++this.nextRequest;
  if(type==='beginMeasurement')this.measurement={rows:new Float64Array(8000),count:0,dropped:0};
  const trace=type==='endMeasurement'?this.measurement:null;if(trace)this.measurement=null;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(request);reject(Error('Presentation worker did not respond'));},5000);
   this.pending.set(request,{resolve,reject,timer});this.worker.postMessage({type,request,...options});
  }).then(result=>trace?{...result,producer:{rows:Array.from(trace.rows.subarray(0,trace.count*4)),dropped:trace.dropped}}:result);
 }
 fail(error) {
  if(this.failed)return;
  this.failed=true;this.rejectReady?.(error);this.dispose();console.warn('Using direct presentation',error);
 }
 dispose() {
  if(this.disposed)return;this.disposed=true;
  this.suspend();document.removeEventListener("visibilitychange",this.visibility);clearTimeout(this.readyTimer);this.worker?.terminate();this.display?.remove();
  this.source.style.opacity=this.originalOpacity;
  for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Presentation worker disposed'));}
  this.pending.clear();
 }
}
