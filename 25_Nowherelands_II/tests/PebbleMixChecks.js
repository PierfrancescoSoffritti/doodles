import { checkLockedGameLayers } from './PebbleGameMixChecks.js?v=3';
import { createPebbleAudioScene, pebbleEncounter } from '../js/audio/PebbleAudioScene.js?v=pebble-audio-10';
import { PEBBLE_VOICE_LIMIT } from '../js/audio/PebbleAudio.js?v=pebble-audio-10';

const windows={startle:[.32,.75],running:[1,3.5],settle:[4.05,4.4],tail:[5.7,6.8]};
export function measurePebbleBuffer(buffer) {
 const report={peak:0};
 for(const [name,[start,end]] of Object.entries(windows)) {
  let sum=0,count=0;
  for(let ch=0;ch<buffer.numberOfChannels;ch++) {
   const samples=buffer.getChannelData(ch);
   for(let i=Math.floor(start*buffer.sampleRate);i<Math.min(samples.length,end*buffer.sampleRate);i++) {sum+=samples[i]**2;count++;}
  }
  report[name]=Math.sqrt(sum/Math.max(count,1));
 }
 for(let ch=0;ch<buffer.numberOfChannels;ch++)for(const v of buffer.getChannelData(ch)) {
  if(!Number.isFinite(v))throw new Error('Non-finite pebble mix');report.peak=Math.max(report.peak,Math.abs(v));
 }
 return report;
}

export async function renderPebbleMix(options={}) {
 const {mode='mixed',scene='hill',distance=20,size=1.2,count=1,volume=1,muted=false,ducked=false,startup=false,reference=false,muteAt=null}=options;
 const ctx=new OfflineAudioContext(2,44100*7,44100);
 const s=createPebbleAudioScene(ctx,{scene,background:mode!=='solo',startup});
 s.audio.pebbles.volume=volume;s.audio.muted=muted;
 let accepted=0,rejected=0,maxActive=0;
 const events=pebbleEncounter({scene,distance,size,count});
 const scheduled=ctx.suspend(.02).then(async()=>{
  s.engine.ctx=new Proxy(ctx,{get(target,key){if(key==='state')return 'running';const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
  if(ducked)s.engine.layerBus.gain.setValueAtTime(.05,ctx.currentTime);
  if(reference)s.reference(.3);
  else if(mode==='background')s.engine.duck(.65,.5,.3);
  else for(const e of events) {
   if(s.audio.pebble(e.creature,e.event,{at:e.time,cave:scene!=='hill',listener:s.listener}))accepted++;else rejected++;
   maxActive=Math.max(maxActive,s.audio.pebbles.voices.filter(v=>v.start<=e.time+.015 && v.end>e.time).length);
  }
  await ctx.resume();
 });
 const muting=muteAt===null?null:ctx.suspend(muteAt).then(async()=>{s.audio.muted=true;s.audio.update();await ctx.resume();});
 const buffer=await ctx.startRendering();await scheduled;if(muting)await muting;
 const measured=measurePebbleBuffer(buffer);s.dispose();
 return {buffer,...measured,accepted,rejected,maxActive};
}

export async function checkPebbleMix(progress=()=>{}) {
 const lockedLayers=await checkLockedGameLayers();
 const reports=[];
 const run=async(label,options)=>{
  progress('Rendering '+label+'…');const {buffer,...r}=await renderPebbleMix(options);reports.push({label,...r});
  if(r.peak>=.95)throw new Error(label+': clipped output '+r.peak);
  if(r.maxActive>PEBBLE_VOICE_LIMIT)throw new Error(label+': voice limit exceeded');
  return r;
 };
 for(const scene of ['hill','cave','stream']) {
  const bg=await run(scene+' background',{scene,mode:'background'});
  const near=await run(scene+' close solo',{scene,mode:'solo'});
  const chase=await run(scene+' chase solo',{scene,mode:'solo',distance:55});
  const far=await run(scene+' distant solo',{scene,mode:'solo',distance:120});
  const mixed=await run(scene+' colony mix',{scene,count:6});
  const expected=scene==='stream'?[29,28,16]:[27,26,25];
  if([near,chase,far].some((r,i)=>r.accepted!==expected[i]))throw new Error(scene+': missing encounter events '+JSON.stringify([near.accepted,chase.accepted,far.accepted]));
  if(near.startle<.008 || near.running<.004 || near.settle<.002)throw new Error(scene+': silent or underpowered foreground '+JSON.stringify(near));
  if(near.startle<bg.startle*.7 || chase.running<bg.running*.2)throw new Error(scene+': foreground masked by background '+JSON.stringify({bg,near,chase}));
  if(!(near.running>chase.running && chase.running>far.running && far.running<near.running*.65))throw new Error(scene+': broken distance falloff');
  if(mixed.accepted<100)throw new Error(scene+': too many colony sounds rejected');
 }
 const baseline=await run('baseline',{mode:'solo'}),ducked=await run('ambient ducked',{mode:'solo',ducked:true});
 if(Math.abs(baseline.running-ducked.running)>.000001)throw new Error('Ambient ducking suppresses pebble footsteps');
 const muted=await run('muted cave',{mode:'solo',muted:true,scene:'stream'});
 if(muted.peak!==0 || muted.accepted!==0)throw new Error('Mute leaks dry sound or cave reverb');
 const zero=await run('zero volume',{mode:'solo',volume:0});if(zero.peak!==0)throw new Error('Zero volume leaks sound');
 const tailMute=await run('mute during cave playback',{mode:'solo',scene:'stream',muteAt:.85});
 if(tailMute.running>.001 || tailMute.tail>.000001)throw new Error('Mute leaks already playing sounds or reverb');
 const startup=await run('startup',{mode:'solo',startup:true});if(startup.startle<.002)throw new Error('Startle disappears during startup');
 const cave=reports.find(r=>r.label==='cave close solo'),hill=reports.find(r=>r.label==='hill close solo');
 if(cave.tail<=hill.tail*2)throw new Error('Cave room response is missing');
 const player=await run('player reference',{mode:'solo',reference:true});
 const relativeDb=20*Math.log10(baseline.startle/player.startle);
 if(relativeDb< -14 || relativeDb>6)throw new Error('Startle is not calibrated to the player reference: '+relativeDb.toFixed(1)+' dB');
 await run('six large pebbles at maximum volume',{count:6,size:1.75,volume:1.5,scene:'stream'});
 return {...lockedLayers,startleToPlayerDb:+relativeDb.toFixed(1),voiceLimit:PEBBLE_VOICE_LIMIT,maxObservedVoices:Math.max(...reports.map(r=>r.maxActive)),reports};
}

export function encodeWav(buffer) {
 const length=buffer.length*buffer.numberOfChannels*2,bytes=new ArrayBuffer(44+length),view=new DataView(bytes);
 const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,36+length,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,buffer.numberOfChannels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*buffer.numberOfChannels*2,true);view.setUint16(32,buffer.numberOfChannels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length,true);
 let offset=44;for(let i=0;i<buffer.length;i++)for(let ch=0;ch<buffer.numberOfChannels;ch++){const v=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));view.setInt16(offset,Math.round(v*(v<0?32768:32767)),true);offset+=2;}
 return bytes;
}
