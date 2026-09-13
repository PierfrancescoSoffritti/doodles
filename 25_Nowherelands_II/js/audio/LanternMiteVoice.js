import { ensureReedMixHeadroom } from './ReedWalkerAudio.js?v=lantern-1';

import { lanternNotes } from './LanternMiteSamples.js?v=stable-30-3';
export { lanternNotes, lanternLight, lanternSamples } from './LanternMiteSamples.js?v=stable-30-3';
import { LanternMiteBuffers } from './LanternMiteBuffers.js?v=stable-30-3';

// Nearby contact notes briefly get room in the ambient bed, like other fauna
// voices. Distant animals do not lower the landscape's sound.
export function lanternAmbientDip(engine, mite, reply, at, listener, scale = 1) {
 if (!listener || Math.hypot(mite.pos.x - listener.x, mite.pos.y - listener.y, mite.pos.z - listener.z) > 5 * scale) return;
 const notes = lanternNotes(mite, reply), duration = Math.max(...notes.map(n => n.at + n.duration));
 const gain = engine.layerBus.gain, level = Math.min(gain.value, 0.32);
 gain.cancelScheduledValues(at); gain.setValueAtTime(gain.value, at);
 gain.linearRampToValueAtTime(level, at + 0.025);
 gain.setValueAtTime(level, at + duration);
 gain.linearRampToValueAtTime(1, at + duration + 0.35);
}

export class LanternMiteAudio {
 constructor(engine, scale = 1) { ensureReedMixHeadroom(engine); this.engine = engine; this.scale = scale; this.voices = new Set(); this.bank = new LanternMiteBuffers(engine.ctx); this.buffers = this.bank.cache; this.pending = new Set(); this.played = 0; }

 prepare(mites) {return Promise.all(mites.flatMap(mite=>[false,true].map(reply=>this.bank.request({mite:{id:mite.id,size:mite.size},reply,sampleRate:this.engine.ctx.sampleRate}))));}

 play(mite, reply = false, at = this.engine.now, listener = null, prepared = null) {
  if (this.disposed || this.voices.size + this.pending.size >= 3) return false;
  const ctx=this.engine.ctx,options={mite:{id:mite.id,size:mite.size},reply,sampleRate:ctx.sampleRate};
  const buffer=prepared||this.bank.get(options);
  if(!buffer){
   const pending={colonyId:mite.colonyId,cancelled:false};this.pending.add(pending);
   const voiceMite={...mite,pos:{...mite.pos}};
   return this.bank.request(options).then(ready=>{
    this.pending.delete(pending);
    return ready&&!pending.cancelled?this.play(voiceMite,reply,Math.max(at,this.engine.now),listener,ready):false;
   });
  }
  const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = this.engine.makePanner(mite.pos);
  source.buffer = buffer; gain.gain.value = 1.35;
  panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2 * this.scale;
  panner.rolloffFactor = 1.5; panner.maxDistance = 40 * this.scale;
  source.connect(gain); gain.connect(panner); panner.connect(this.engine.master);
  const voice = { source, gain, panner, colonyId: mite.colonyId }; this.voices.add(voice); this.played++;
  lanternAmbientDip(this.engine, mite, reply, at, listener, this.scale);
  source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice); };
  source.start(at);
  return true;
 }

 silence(colonyId = null) {
  const now = this.engine.now;
  for(const pending of this.pending)if(colonyId===null||pending.colonyId===colonyId){pending.cancelled=true;this.pending.delete(pending);}
  for (const voice of this.voices) {
   if (colonyId !== null && voice.colonyId !== colonyId) continue;
   voice.gain.gain.cancelScheduledValues(now);
   voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
   voice.gain.gain.linearRampToValueAtTime(0, now + 0.012);
   voice.source.stop(now + 0.015);
   this.voices.delete(voice);
  }
 }
 dispose() { this.disposed=true;this.silence();this.bank.dispose(); }
}
