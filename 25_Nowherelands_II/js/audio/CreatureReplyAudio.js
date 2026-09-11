export const REPLY_DURATION={reed:2.6,hopper:1.15,bird:1.7,mite:1.8,lumen:2.2,ray:1.8};
export function synthesizeCreatureReply(kind,alarm=false,sampleRate=44100) {
 const duration=REPLY_DURATION[kind],samples=new Float32Array(Math.ceil(duration*sampleRate));let phase=0,peak=0;
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate,u=t/duration;
  let hz,env,v;
  if(kind==='reed'){hz=(alarm?155:112)*(1+.06*Math.sin(t*2));env=Math.sin(Math.PI*u)**.7;}
  else if(kind==='hopper'){hz=alarm?410:310;const a=t%.48;env=t<.96?Math.min(1,a/.008)*Math.exp(-a*6.5):0;}
  else if(kind==='bird'){const a=t%.43;hz=(alarm?1500:1050)*(1+.6*Math.sin(Math.min(1,a/.32)*Math.PI));env=t<1.29?Math.sin(Math.min(1,a/.34)*Math.PI)**2:0;}
  else if(kind==='mite'){hz=(alarm?1350:780)*(1+.035*Math.sin(t*17));env=Math.sin(Math.PI*u)**.7*(.5+.5*Math.sin(t*13)**2);}
  else {hz=(kind==='ray'?240:570)*(alarm?1.45:1)*(1+.35*u);env=Math.sin(Math.PI*u)**.8*(.65+.35*Math.sin(t*8)**2);}
  phase+=Math.PI*2*hz/sampleRate;
  v=Math.sin(phase)+.24*Math.sin(phase*2.003)+.08*Math.sin(phase*3.01);
  if(kind==='hopper')v+=.35*Math.sin(phase*2.73);
  if(kind==='reed')v+=.22*Math.sin(phase*.501);
  samples[i]=v*env*Math.min(1,t/.012,(duration-t)/.04);peak=Math.max(peak,Math.abs(samples[i]));
 }
 for(let i=0;i<samples.length;i++)samples[i]*=.82/Math.max(.01,peak);
 return samples;
}
export class CreatureReplyAudio {
 constructor(engine){this.engine=engine;this.voices=[];this.pending=[];this.buffers=new Map();this.history=[];this.muted=false;this.out=engine.ctx.createGain();this.out.gain.value=.95;this.out.connect(engine.master);}
 play(kind,creature,alarm=false){
  const e=this.engine,ctx=e.ctx;this.voices=this.voices.filter(v=>v.end>e.now);
  if(this.muted||ctx.state!=='running')return false;
  if(this.voices.length>=4){
   if(this.pending.length>=8||this.pending.filter(v=>v.kind===kind).length>=2)return false;
   this.pending.push({kind,creature,alarm,expires:e.now+3});return true;
  }
  const key=kind+alarm;let buffer=this.buffers.get(key);
  if(!buffer){const samples=synthesizeCreatureReply(kind,alarm,ctx.sampleRate);buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.copyToChannel(samples,0);this.buffers.set(key,buffer);}
  const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=e.makePanner(creature.pos||creature.position),send=ctx.createGain();
  source.buffer=buffer;gain.gain.value=kind==='hopper'?1.4:kind==='bird'?1.35:.8;pan.refDistance=55;pan.rolloffFactor=1.1;send.gain.value=.12;
  source.connect(gain);gain.connect(pan);pan.connect(this.out);pan.connect(send);send.connect(e.reverb);
  const end=e.now+buffer.duration+.02,voice={source,gain,pan,send,creature,end};this.voices.push(voice);
  source.onended=()=>{this.onEnd?.(creature);for(const n of [source,gain,pan,send])n.disconnect();this.voices=this.voices.filter(v=>v!==voice);};
  source.start(e.now+.015);this.onStart?.(creature,buffer.duration,e.now+.015);e.duck(.3,buffer.duration+.3);
  this.history.push({kind,alarm,time:e.now});if(this.history.length>24)this.history.shift();return true;
 }
 update(){this.pending=this.muted?[]:this.pending.filter(v=>v.expires>this.engine.now);while(this.pending.length&&this.voices.length<4){const v=this.pending.shift();this.play(v.kind,v.creature,v.alarm);}this.out.gain.setTargetAtTime(this.muted?0:.95,this.engine.now,.04);for(const v of this.voices){const p=v.creature.pos||v.creature.position;for(const axis of ['x','y','z'])v.pan['position'+axis.toUpperCase()].setTargetAtTime(p[axis],this.engine.now,.04);v.send.gain.setTargetAtTime(this.muted?0:.12,this.engine.now,.04);}}
 silence(){this.pending=[];for(const v of [...this.voices]){try{v.source.stop();}catch{}}}
 dispose(){this.silence();this.out.disconnect();this.buffers.clear();}
}
