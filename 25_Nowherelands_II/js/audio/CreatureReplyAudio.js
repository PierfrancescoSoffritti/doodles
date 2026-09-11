import {pebbleSamples} from './PebbleSoundBank.js?v=pebble-audio-10';

export const REPLY_DURATION={reed:2.6,hopper:.85,bird:1.7,mite:1.8,lumen:2.2,ray:1.8};
// Keep the size/phase pitch relationship used by PebbleAudio's footsteps.
// Identity adds a stable sample choice and answering rhythm.
export function pebbleReplyProfile(identity='pebble',size=1,phase=0){
 let seed=2166136261;
 for(const char of String(identity))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return {rate:Math.max(.68,Math.min(1.3,1/Math.sqrt(size||1)*(1+Math.sin(phase)*.06))),
  variant:Math.floor(random()*3),spacing:.11+.045*random(),closing:.31+.065*random(),
  weight:.55+.18*random(),onset:.055*random()};
}
// Answer with the actual walking/settling foley: two light stone contacts and a
// rounded closing knock. A stronger blip adds one quick contact to the rhythm.
function pebbleReply(alarm,sampleRate,profile=pebbleReplyProfile()){
 const samples=new Float32Array(Math.ceil(REPLY_DURATION.hopper*sampleRate));
 const notes=alarm?[[0,'step',1],[profile.spacing*.8,'step',profile.weight],
  [profile.spacing*1.6,'step',.8],[profile.closing+.05,'settle',.75]]:
  [[0,'step',1],[profile.spacing,'step',profile.weight],[profile.closing,'settle',.8]];
 let peak=0;
 for(const [start,event,strength] of notes){
  const contact=pebbleSamples(event,sampleRate,profile.variant),offset=Math.round(start*sampleRate);
  let softened=0;
  const smoothing=1-Math.exp(-2*Math.PI*3800/sampleRate);
  // The same size-dependent transposition as walking, with a little top-end
  // softening because a foreground reply is more exposed than a footstep.
  for(let j=0;j<Math.ceil(contact.length/profile.rate)+Math.ceil(sampleRate*.008);j++){
   const position=j*profile.rate,index=Math.floor(position),fraction=position-index;
   const value=(contact[index]??0)*(1-fraction)+(contact[index+1]??0)*fraction;
   softened+=(value-softened)*smoothing;
   if(offset+j<samples.length)samples[offset+j]+=softened*strength;
  }
 }
 for(const value of samples)peak=Math.max(peak,Math.abs(value));
 for(let i=0;i<samples.length;i++)samples[i]*=.82/Math.max(.01,peak);
 return samples;
}
export function synthesizeCreatureReply(kind,alarm=false,sampleRate=44100,profile) {
 if(kind==='hopper')return pebbleReply(alarm,sampleRate,profile);
 const duration=REPLY_DURATION[kind],samples=new Float32Array(Math.ceil(duration*sampleRate));let phase=0,peak=0;
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate,u=t/duration;
  let hz,env,v;
  if(kind==='reed'){hz=(alarm?155:112)*(1+.06*Math.sin(t*2));env=Math.sin(Math.PI*u)**.7;}
  else if(kind==='bird'){const a=t%.43;hz=(alarm?1500:1050)*(1+.6*Math.sin(Math.min(1,a/.32)*Math.PI));env=t<1.29?Math.sin(Math.min(1,a/.34)*Math.PI)**2:0;}
  else if(kind==='mite'){hz=(alarm?1350:780)*(1+.035*Math.sin(t*17));env=Math.sin(Math.PI*u)**.7*(.5+.5*Math.sin(t*13)**2);}
  else {hz=(kind==='ray'?240:570)*(alarm?1.45:1)*(1+.35*u);env=Math.sin(Math.PI*u)**.8*(.65+.35*Math.sin(t*8)**2);}
  phase+=Math.PI*2*hz/sampleRate;
  v=Math.sin(phase)+.24*Math.sin(phase*2.003)+.08*Math.sin(phase*3.01);
  if(kind==='reed')v+=.22*Math.sin(phase*.501);
  samples[i]=v*env*Math.min(1,t/.012,(duration-t)/.04);peak=Math.max(peak,Math.abs(samples[i]));
 }
 for(let i=0;i<samples.length;i++)samples[i]*=.82/Math.max(.01,peak);
 return samples;
}
export class CreatureReplyAudio {
 constructor(engine){this.engine=engine;this.voices=[];this.pending=[];this.buffers=new Map();this.history=[];this.pebbleProfiles=new WeakMap();this.pebbleSerial=0;this.muted=false;this.out=engine.ctx.createGain();this.out.gain.value=.95;this.out.connect(engine.master);}
 play(kind,creature,alarm=false){
  const e=this.engine,ctx=e.ctx;this.voices=this.voices.filter(v=>v.end>e.now);
  if(this.muted||ctx.state!=='running')return false;
  if(this.voices.length>=4){
   if(this.pending.length>=8||this.pending.filter(v=>v.kind===kind).length>=2)return false;
   this.pending.push({kind,creature,alarm,expires:e.now+3});return true;
  }
  let profile;
  if(kind==='hopper'){
   profile=this.pebbleProfiles.get(creature);
   if(!profile){profile=pebbleReplyProfile(creature.id??`anonymous:${this.pebbleSerial++}`,creature.size,creature.phase);this.pebbleProfiles.set(creature,profile);}
  }
  const key=kind+alarm+(profile?JSON.stringify(profile):'');let buffer=this.buffers.get(key);
  if(!buffer){const samples=synthesizeCreatureReply(kind,alarm,ctx.sampleRate,profile);buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.copyToChannel(samples,0);}
  // LRU bounds memory while the player discovers more colonies.
  this.buffers.delete(key);this.buffers.set(key,buffer);
  if(this.buffers.size>64)this.buffers.delete(this.buffers.keys().next().value);
  const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=e.makePanner(creature.pos||creature.position),send=ctx.createGain();
  const start=e.now+.015+(profile?.onset??0),duration=buffer.duration;
  source.buffer=buffer;gain.gain.value=kind==='hopper'?1.2:kind==='bird'?1.35:.8;pan.refDistance=55;pan.rolloffFactor=1.1;send.gain.value=.12;
  source.connect(gain);gain.connect(pan);pan.connect(this.out);pan.connect(send);send.connect(e.reverb);
  const end=start+duration+.005,voice={source,gain,pan,send,creature,end};this.voices.push(voice);
  source.onended=()=>{this.onEnd?.(creature);for(const n of [source,gain,pan,send])n.disconnect();this.voices=this.voices.filter(v=>v!==voice);};
  source.start(start);this.onStart?.(creature,duration,start);e.duck(.3,duration+.3);
  this.history.push({kind,alarm,time:e.now});if(this.history.length>24)this.history.shift();return true;
 }
 update(){this.pending=this.muted?[]:this.pending.filter(v=>v.expires>this.engine.now);while(this.pending.length&&this.voices.length<4){const v=this.pending.shift();this.play(v.kind,v.creature,v.alarm);}this.out.gain.setTargetAtTime(this.muted?0:.95,this.engine.now,.04);for(const v of this.voices){const p=v.creature.pos||v.creature.position;for(const axis of ['x','y','z'])v.pan['position'+axis.toUpperCase()].setTargetAtTime(p[axis],this.engine.now,.04);v.send.gain.setTargetAtTime(this.muted?0:.12,this.engine.now,.04);}}
 silence(){this.pending=[];for(const v of [...this.voices]){try{v.source.stop();}catch{}}}
 dispose(){this.silence();this.out.disconnect();this.buffers.clear();}
}
