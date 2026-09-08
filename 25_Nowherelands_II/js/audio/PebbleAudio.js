import { PEBBLE_SOUNDS, pebbleSamples, pebbleImpulse } from './PebbleSoundBank.js?v=pebble-audio-10';

export const PEBBLE_VOICE_LIMIT=16;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// The dry sound and cave tail share one volume/mute gate, outside ambient ducking.
export class PebbleAudio {
 constructor(engine) {
  this.engine=engine;this.voices=[];this.history=[];this.buffers=new Map();this.last=new WeakMap();
  this.volume=1;this.muted=false;this.serial=0;this.lastDuck=-Infinity;
  const ctx=engine.ctx;
  this.out=ctx.createGain();
  // Colony overlap has its own headroom protection before the world's mix.
  this.limiter=ctx.createDynamicsCompressor();this.limiter.threshold.value=-7;this.limiter.knee.value=4;this.limiter.ratio.value=12;this.limiter.attack.value=.001;this.limiter.release.value=.09;
  this.safety=ctx.createWaveShaper();this.safety.curve=Float32Array.from({length:2049},(_,i)=>.65*Math.tanh((i/1024-1)/.65));this.safety.oversample='2x';
  this.out.connect(this.limiter);this.limiter.connect(this.safety);this.safety.connect(engine.master);
  this.reverb=ctx.createConvolver();this.reverb.buffer=pebbleImpulse(ctx);this.reverb.connect(this.out);
  this.meter=ctx.createAnalyser();this.meter.fftSize=512;this.safety.connect(this.meter);
  // Warm the small sample bank at audio startup, not during the first chase.
  for(const event of Object.keys(PEBBLE_SOUNDS))for(let variant=0;variant<3;variant++)this.buffer(event,variant);
 }
 buffer(event,variant) {
  const key=event+variant;
  if(!this.buffers.has(key)) {
   const data=pebbleSamples(event,this.engine.ctx.sampleRate,variant);
   const buffer=this.engine.ctx.createBuffer(1,data.length,this.engine.ctx.sampleRate);buffer.copyToChannel(data,0);this.buffers.set(key,buffer);
  }
  return this.buffers.get(key);
 }
 play(c,event,{cave=false,listener,at=this.engine.now}={}) {
  const spec=PEBBLE_SOUNDS[event],ctx=this.engine.ctx;
  if(!spec || ctx.state!=='running' || this.muted || this.volume<=0)return false;
  const distance=listener?Math.hypot(c.pos.x-listener.x,c.pos.y-listener.y,c.pos.z-listener.z):0;
  if(distance>spec.range)return false;
  const last=this.last.get(c)||{};
  const cadence=(event==='step'||event==='paddle') ? .085 : event==='creak' ? 5 : .2;
  if(at-(last[event]??-Infinity)<cadence)return false;
  const active=this.voices.filter(v=>v.start<=at+.015 && v.end>at);
  // Reserve four slots for startles, impacts, and water entries.
  const detail=['step','paddle','creak','drip'].includes(event);
  if(active.length>=(detail?PEBBLE_VOICE_LIMIT-4:PEBBLE_VOICE_LIMIT))return false;
  last[event]=at;this.last.set(c,last);
  const variant=this.serial++%3, source=ctx.createBufferSource(),gain=ctx.createGain(),pan=this.engine.makePanner(c.pos),send=ctx.createGain();
  source.buffer=this.buffer(event,variant);
  source.playbackRate.value=clamp(1/Math.sqrt(c.size||1)*(1+Math.sin(c.phase||0)*.06),.68,1.3);
  const start=at+.012,end=start+source.buffer.duration/source.playbackRate.value;
  gain.gain.value=spec.level;
  pan.refDistance=28;pan.rolloffFactor=1;pan.distanceModel='inverse';
  // Position before the wet send: distant creatures do not leave loud reverb behind.
  source.connect(gain);gain.connect(pan);pan.connect(this.out);pan.connect(send);
  send.gain.value=cave?.24:.035;send.connect(this.reverb);
  this.out.gain.setValueAtTime(clamp(this.volume,0,1.5),ctx.currentTime);
  const voice={creature:c,event,start,end,source,nodes:[source,gain,pan,send],pan};this.voices.push(voice);
  source.onended=()=>{voice.nodes.forEach(n=>n.disconnect());this.voices=this.voices.filter(v=>v!==voice);};
  source.start(start);source.stop(end+.01);
  // Only the initial warning dips the background, once per colony encounter.
  if(event==='startle' && at-this.lastDuck>.7) {this.engine.duck(.65,.5,at);this.lastDuck=at;}
  this.history.push({event,id:c.id,time:at,distance,cave,level:spec.level});if(this.history.length>64)this.history.shift();
  return true;
 }
 update() {
  const t=this.engine.now;this.out.gain.setTargetAtTime(this.muted?0:clamp(this.volume,0,1.5),t,.025);
  for(const v of this.voices) {
   if(v.start>t || v.end<t)continue;
   const p=v.creature.renderPosition||v.creature.pos;
   for(const axis of ['x','y','z'])v.pan['position'+axis.toUpperCase()].setTargetAtTime(p[axis],t,.025);
  }
 }
 dispose() {
  for(const v of this.voices){try{v.source.stop();}catch{}v.nodes.forEach(n=>n.disconnect());}
  this.voices=[];this.reverb.disconnect();this.out.disconnect();this.limiter.disconnect();this.safety.disconnect();this.meter.disconnect();this.buffers.clear();
 }
}
