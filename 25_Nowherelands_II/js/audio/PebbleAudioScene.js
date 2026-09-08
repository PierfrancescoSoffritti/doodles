import { AudioEngine } from './AudioEngine.js?v=pebble-audio-10';
import { FaunaAudio } from './FaunaAudio.js?v=pebble-audio-10';
import { Conductor } from './Conductor.js?v=pebble-audio-10';
import { WatersideAmbience } from './WatersideAmbience.js';

// Shared by the listening studio and offline mix checks: production routing,
// background voices, HRTF distance, room response, and final compression.
export function createPebbleAudioScene(ctx,{scene='hill',background=true,startup=false}={}) {
 let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const engine=new AudioEngine(ctx,random),conductor=new Conductor(engine),scale=conductor.scale;
 if(startup)engine.master.gain.setTargetAtTime(.9,0,1.5);else engine.master.gain.value=.9;
 const listener={x:0,y:11,z:0};engine.updateListener(listener,{x:0,y:0,z:-1},{x:0,y:1,z:0});
 // Construct every game layer, including locked ones, so leaked effect sends
 // cannot hide behind a smaller audition-only graph.
 const {drone,wind}=conductor.layers;
 const hm={rivers:{segmentsIn:()=>[]},world:{rivers:[]}},features={query:()=>[]};
 const water=new WatersideAmbience(engine,hm,features);
 water.update(1,{camera:{position:listener},caveAmount:scene==='stream'?1:0,caveColumn:{water:0}});
 const levels=[scene==='hill'?.12:.08,scene==='hill'?.08:.02];
 const gains=[drone.out.gain,wind.out.gain];
 const waterLevels=water.voices.map(v=>v.amount);
 const setBackground=on=>{
  gains.forEach((g,j)=>g.setTargetAtTime(on?levels[j]:0,engine.now,.1));
  water.voices.forEach((v,j)=>{v.gain.gain.cancelScheduledValues(engine.now);v.gain.gain.setValueAtTime(on?waterLevels[j]:0,engine.now);});
 };
 setBackground(background);
 const audio=new FaunaAudio(engine,{scale});
 return {engine,audio,listener,scene,setBackground,
  reference(at=engine.now){engine.playTone({freq:scale.freq(0,2),time:at,position:listener,velocity:.42,attack:.05,duration:.3,release:1,type:'sine',layer:'invitation',dest:engine.playerBus});},
  dispose(){audio.dispose();conductor.dispose();engine.offNote?.();engine.ctx.close?.().catch(()=>{});},
 };
}

export function pebbleEncounter({distance=20,size=1.2,count=1,scene='hill'}={}) {
 const events=[];
 for(let j=0;j<count;j++) {
  const creature={id:'audition-'+j,kind:'hopper',size:size*(count===1?1:.8+j*.08),phase:1.1+j*1.7,pos:{x:count===1?0:(j-(count-1)/2)*3,y:1.4*size,z:-distance}};
  const offset=j*.027;
  events.push({creature,event:'startle',time:.3+offset});
  for(let k=0;k<24;k++)events.push({creature,event:scene==='stream' && k>=7 && k<17?'paddle':'step',time:.7+k*.125+offset});
  if(scene==='stream')events.push({creature,event:'splash',time:1.5+offset},{creature,event:'drip',time:2.85+offset});
  events.push({creature,event:'settle',time:4+offset},{creature,event:'creak',time:5.1+offset});
 }
 return events.sort((a,b)=>a.time-b.time);
}
