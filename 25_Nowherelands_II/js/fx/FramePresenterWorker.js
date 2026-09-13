import {FrameMailbox} from './FrameMailbox.js?v=stable-30-27';
import {FramePacer} from '../core/FramePacer.js';
let canvas,context,mailbox,origin,active=false,started=false,starved=false,measurement=null,timer=null;
const pacer=new FramePacer(),stats={presented:0,starvations:0,rejected:0};
function arm() {
 if(timer!==null||!active||!started||(!mailbox.length&&starved))return;
 timer=setTimeout(()=>{timer=null;tick(performance.now());arm();},Math.max(0,Math.ceil(pacer.next-performance.now())));
}
function tick(timestamp) {
 if(!active||!started)return;
 if(!mailbox.length) {
  if(!starved&&timestamp>=pacer.next-.5){stats.starvations++;starved=true;}
  return;
 }
 const deadline=pacer.next;if(!pacer.accept(timestamp,30))return;
 const frame=mailbox.take(),began=performance.now();context.transferFromImageBitmap(frame.bitmap);const copyMs=performance.now()-began;starved=false;
 const at=performance.timeOrigin+performance.now()-origin;
 stats.presented++;
 if(measurement) {
  if(measurement.count<measurement.rows.length/7){const i=measurement.count++*7;measurement.rows[i]=at;measurement.rows[i+1]=frame.id;measurement.rows[i+2]=mailbox.length;measurement.rows[i+3]=performance.timeOrigin+began-origin;measurement.rows[i+4]=performance.timeOrigin+deadline-origin;measurement.rows[i+5]=copyMs;measurement.rows[i+6]=frame.producedAt||0;}
  else measurement.dropped++;
 }
 self.postMessage({type:'frame',epoch:mailbox.epoch,at});
}
self.onmessage=({data})=>{
 try {
  if(data.type==='init') {
   canvas=data.canvas;origin=data.origin;mailbox=new FrameMailbox(data.depth);
   context=canvas.getContext('bitmaprenderer');self.postMessage({type:'ready',supported:!!context});

  } else if(data.type==='reset'||data.type==='stop') {
   clearTimeout(timer);timer=null;mailbox.reset(data.epoch);active=data.type==='reset';started=false;starved=false;pacer.reset();
   if(active){canvas.width=data.width;canvas.height=data.height;self.postMessage({type:'reset',epoch:data.epoch});}
  } else if(data.type==='frame') {
   if(!mailbox.push(data)){stats.rejected++;if(data.epoch===mailbox.epoch)throw Error('Presentation queue overflow or frame order violation');return;}
   if(!started&&mailbox.length===mailbox.depth){started=true;pacer.reset();}arm();
  } else if(data.type==='beginMeasurement') {
   measurement={rows:new Float64Array(Math.min(100000,Math.max(1,data.capacity||20000))*7),count:0,dropped:0,start:{...stats}};
   self.postMessage({type:'reply',request:data.request,result:{at:performance.timeOrigin+performance.now()-origin}});
  } else if(data.type==='endMeasurement') {
   const result=measurement?{stride:7,rows:Array.from(measurement.rows.subarray(0,measurement.count*7)),dropped:measurement.dropped,start:measurement.start,end:{...stats}}:null;
   measurement=null;self.postMessage({type:'reply',request:data.request,result});
  } else if(data.type==='markClock'){performance.mark('presentation-clock-'+(performance.timeOrigin+performance.now()-origin));self.postMessage({type:'reply',request:data.request,result:{}});}
  else if(data.type==='stats')self.postMessage({type:'reply',request:data.request,result:{...stats,queued:mailbox.length,epoch:mailbox.epoch}});
 } catch(error){self.postMessage({type:'error',epoch:mailbox?.epoch,message:String(error)});}
};
