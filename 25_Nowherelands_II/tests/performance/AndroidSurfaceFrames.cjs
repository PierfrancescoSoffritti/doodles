const {execFileSync}=require('node:child_process');

// AOSP FrameTracker prints desired-present, actual-present and ready times in
// nanoseconds. Collect the Chrome content surface, independently of JS timing.
// https://android.googlesource.com/platform/frameworks/native/+/refs/heads/main/services/surfaceflinger/FrameTracker.cpp
class AndroidSurfaceFrames {
 constructor(adb,serial){this.adb=adb;this.serial=serial;this.rows=new Map();this.errors=[];}
 shell(...args){return execFileSync(this.adb,['-s',this.serial,'shell',...args],{encoding:'utf8',timeout:10000});}
 sample(){
  const raw=this.shell('dumpsys','SurfaceFlinger','--latency',this.layer);
  const lines=raw.trim().split('\n');this.refreshNs=Number(lines.shift());
  return lines.map(line=>line.trim().split(/\s+/).map(Number)).filter(r=>r.length===3&&r[1]>0&&r[1]<1e18);
 }
 start(){
  const layers=this.shell('dumpsys','SurfaceFlinger','--list');
  this.layer=[...layers.matchAll(/\{(com\.android\.chrome\/ChromeChildSurface#\d+)/g)].at(-1)?.[1];
  if(!this.layer)throw Error('Chrome content surface was not found');
  this.cutoff=Math.max(0,...this.sample().map(r=>r[1]));this.started=performance.now();
  const poll=()=>{try{for(const r of this.sample())if(r[1]>this.cutoff)this.rows.set(r[1],r);}catch(e){this.errors.push(String(e));}};
  this.poll=poll;this.timer=setInterval(poll,400);
 }
 stop(){
  clearInterval(this.timer);this.poll?.();const ended=performance.now();
  const rows=[...this.rows.values()].sort((a,b)=>a[1]-b[1]),intervals=rows.slice(1).map((r,i)=>(r[1]-rows[i][1])/1e6).sort((a,b)=>a-b);
  const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  return{layer:this.layer,refreshNs:this.refreshNs,rows,errors:this.errors,coverage:rows.length>1?(rows.at(-1)[1]-rows[0][1])/1e6/(ended-this.started):0,fps:1000/mean,
   interval:{n:intervals.length,mean,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)],p99:intervals[Math.floor(intervals.length*.99)],max:intervals.at(-1),over50:intervals.filter(x=>x>50.5).length,over67:intervals.filter(x=>x>67).length,over100:intervals.filter(x=>x>100).length}};
 }
}
module.exports={AndroidSurfaceFrames};
