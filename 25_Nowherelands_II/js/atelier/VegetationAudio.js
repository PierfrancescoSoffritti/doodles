// A bounded audition voice: no ambient autoplay and no scheduled response timers.
export class VegetationAudio {
 constructor() { this.context = null; this.master = null; this.sources = new Set(); this.retiring = new Set(); this.volume = .55; this.enabled = true; this.wanted = false; }
 async unlock() {
  if (!this.enabled) return;
  this.wanted = true;
  if (!this.context) {
   const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
   if (!Context) return;
   this.context = new Context(); this.master = this.context.createGain();
   this.master.gain.value = this.volume * .32; this.master.connect(this.context.destination);
  }
  const context = this.context;
  await context.resume();
  if (!this.wanted && context.state === 'running') await context.suspend();
 }
 setVolume(value) { this.volume = value; this.master?.gain.setTargetAtTime(value * .32, this.context.currentTime, .04); }
 play(event, model) {
  const ctx = this.context;
  if (!this.enabled || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime, plant = model.plants[event.plant], stem = plant?.stems[event.part];
  const degrees = [0, 2, 4, 7, 9];
  const freq = event.kind === 'invitation' ? 220 : event.kind === 'mirror' ? 440 * 2 ** (event.part * 7 / 12)
   : 220 * 2 ** ((degrees[event.part % 5] + (stem?.size < .31 ? 12 : 0)) / 12);
  if (event.kind === 'brush') { this.noise(now, .65, .11); return; }
  this.makeRoom(event.kind === 'reed' ? 4 : 3);
  const mirror = event.kind === 'mirror', duration = mirror ? 2.6 : event.kind === 'invitation' ? .4 : 1.25;
  const ratios = mirror ? [1, 2.76, 4.07] : [1, 2.02, 3.9];
  ratios.forEach((ratio, i) => {
   if (this.sources.size >= 24) return;
   const oscillator = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
   oscillator.type = 'sine'; oscillator.frequency.value = freq * ratio;
   pan.pan.value = Math.max(-.65, Math.min(.65, (plant?.x || 0) / 9));
   const level = (mirror ? .2 : .27) / (1 + i * 3);
   gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + .018);
   gain.gain.exponentialRampToValueAtTime(.0001, now + duration / (1 + i * .5));
   oscillator.connect(gain); gain.connect(pan); pan.connect(this.master);
   this.track(oscillator, [gain, pan]); oscillator.start(now); oscillator.stop(now + duration);
  });
  if (event.kind === 'reed') this.noise(now, .18, .035);
 }
 noise(now, duration, level) {
  this.makeRoom(1);
  const ctx = this.context, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = .7;
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + .025); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  source.connect(filter); filter.connect(gain); gain.connect(this.master); this.track(source, [filter, gain]); source.start(now);
 }
 makeRoom(count) {
  while(this.sources.size + count > 24) {
   const source=this.sources.values().next().value;
   this.sources.delete(source);this.retiring.add(source);source.fadeOut();
  }
 }
 track(source, nodes) {
  const gain=nodes.find(node=>node.gain)?.gain;
  source.fadeOut=()=>{const now=this.context.currentTime;gain?.cancelAndHoldAtTime(now);gain?.setTargetAtTime(.0001,now,.005);source.stop(now+.03);};
  let ended=false;
  this.sources.add(source); source.onended = () => { if(ended)return;ended=true;source.disconnect(); nodes.forEach(n => n.disconnect()); this.sources.delete(source);this.retiring.delete(source); };
 }
 stop() { this.wanted=false; for (const source of [...this.sources,...this.retiring]) { try { source.stop(); } catch {} } }
 async suspend() { this.stop(); if (this.context?.state === 'running') await this.context.suspend(); }
 async dispose() { this.stop(); const context = this.context; this.context = null; this.master = null; await context?.close(); }
}
