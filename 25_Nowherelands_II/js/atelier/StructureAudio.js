import { AudioEngine } from '../audio/AudioEngine.js?v=structures-play-4';
import { Conductor } from '../audio/Conductor.js?v=structures-place-4';
import { foldMusic } from './StructureStudy.js?v=structures-place-4';

// Atelier-only adapter around the actual game conductor, layers and voice engine.
export class StructureAudio {
 constructor(){this.engine=null;this.conductor=null;this.volume=.45;this.music=false;this.amount=0;this.mix=foldMusic(0);this.generation=0;this.lastVoice=-100;this.replyVoices=[];}
 async unlock(){
  const generation=this.generation;
  if(!this.engine){
   const ctx=new AudioContext();this.engine=new AudioEngine(ctx);this.conductor=new Conductor(this.engine);

  }
  const engine=this.engine;await engine.ctx.resume();
  if(generation!==this.generation||this.engine!==engine)return false;
  this.setVolume(this.volume);return true;
 }
 setVolume(value){this.volume=value;this.engine?.master.gain.setTargetAtTime(value*.8,this.engine.now,.08);}
 async startMusic(){
  if(!await this.unlock())return false;
  if(!this.music){for(const id of ['spiral','octahedrons','timeMonolith','wanderer'])this.conductor.unlock(id);this.conductor.start();this.music=true;}
  return true;
 }
 async note(accepted,charge=0,shelter=0,kind='resonant-gate'){
  if(!await this.unlock())return;
  const e=this.engine,now=e.now;
  if(now-this.lastVoice<.12)return;this.lastVoice=now;
  const freq=this.conductor.scale.freq(0,1);
  e.playTone({freq,time:now,velocity:.25,duration:.18,release:.65,type:'sine',cutoff:1800,reverb:.2+shelter*.35,dest:e.playerBus,layer:'structure-invitation'});
  if(accepted)for(const f of (kind==='listening-fold'?[freq/2,freq*.75]:[kind==='horizon-frame'?freq:freq/2])){while(this.replyVoices.length>=4)this.replyVoices.shift()?.stop?.();this.replyVoices.push(e.playTone({freq:f,time:now+.065,velocity:.3,duration:.12,release:.65+charge*.3,voices:1,type:kind==='horizon-frame'?'sine':'triangle',cutoff:1400,reverb:kind==='listening-fold'?.8:.4,dest:e.playerBus,layer:'structure-reply'}));}
 }
 update(dt,model){
  this.amount=model.shelter;this.mix=foldMusic(this.amount,this.mix);
  if(!this.engine||this.engine.ctx.state!=='running')return;
  const e=this.engine;
  e.updateListener({x:model.visitor.x,y:11,z:model.visitor.z},{x:0,y:0,z:-1},{x:0,y:1,z:0});
  if(!this.music)return;
  // Constant world conditions make the fold comparison about shelter alone.
  this.conductor.update(dt,{player:{position:{y:11},speed:16,pitch:.12,yawRate:0,wading:false,looking:true},heightmap:{waterLevel:0},structureShelter:this.amount,moon:{intensity:.7,height:.5},sun:{intensity:0,height:-1},state:{hum:0,snowVisible:0,rainVisible:0,wind:.12,storm:0,hailVisible:0,eclipse:0},weather:{exposure:1}});
 }
 stop(){
  for(const voice of this.replyVoices)voice?.stop?.();this.replyVoices.length=0;
  this.generation++;this.music=false;this.lastVoice=-100;
  const e=this.engine;this.conductor?.dispose();e?.offNote?.();
  this.engine=null;this.conductor=null;
  if(e){e.master.gain.cancelScheduledValues(e.now);e.master.gain.value=0;void e.ctx.close().catch(()=>{});}
 }
}
