import { createReedAudioScene } from '../js/audio/ReedWalkerAudioScene.js';
import { FaunaAudio } from '../js/audio/FaunaAudio.js';

// Compare independently rendered, identically scheduled dry voice/background
// stems before compression. Measure the complete nonlinear mix separately.
export async function checkVeilRayMix() {
 const reports = [];
 for (const background of ['river', 'busy']) for (const phrase of ['contact', 'acknowledgment']) for (const distance of [15, 35]) {
  const render = async stem => {
   const rate = 22050, ctx = new OfflineAudioContext(2, rate * 8, rate);
   const fixture = createReedAudioScene(ctx, { background }), { engine, conductor } = fixture;
   const audio = new FaunaAudio(engine, conductor);
   if (stem !== 'mix') {
    engine.analyser.disconnect();
    if (stem === 'voice') audio.rayOut.connect(ctx.destination);
    else { engine.layerBus.connect(ctx.destination); engine.reverbGain.connect(ctx.destination); engine.delayFilter.connect(ctx.destination); }
   }
   fixture.phrase(0.3);
   const scheduled = ctx.suspend(0.68).then(async () => {
    engine.ctx = new Proxy(ctx, { get(target, key) { if (key === 'state') return 'running'; const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v; } });
    audio.call({ kind: 'ray', id: 'test', degree: 0, voice: 0, size: 1.1, phase: 0.4, pos: { x: 0, y: 11, z: -distance } }, false, false, phrase);
    if (stem === 'background') audio.voices[0].send.disconnect();
    await ctx.resume();
   });
   const buffer = await ctx.startRendering(); await scheduled;
   let peak = 0, sum = 0, n = 0;
   const end = phrase === 'contact' ? 4.7 : 2.6;
   for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
     if (!Number.isFinite(data[i])) throw new Error('Non-finite ray mix');
     peak = Math.max(peak, Math.abs(data[i]));
     if (i >= 1.1 * rate && i < end * rate) { sum += data[i] ** 2; n++; }
    }
   }
   audio.dispose(); await fixture.dispose(); return { peak, rms: Math.sqrt(sum / n) };
  };
  const voice = await render('voice'), bed = await render('background'), mix = await render('mix');
  reports.push({ background, phrase, distance, voice: voice.rms, backgroundRms: bed.rms, marginDb: 20 * Math.log10(voice.rms / bed.rms), peak: mix.peak });
 }
 const failures = [];
 for (const r of reports) {
  if (r.marginDb < (r.distance === 15 ? 3 : 0)) failures.push(`${r.background}/${r.phrase} at ${r.distance}: ${r.marginDb.toFixed(1)} dB`);
  if (r.peak >= 0.95) failures.push(`${r.background}/${r.phrase}: clipped mix`);
 }
 return { passed: failures.length === 0, failures, reports };
}
