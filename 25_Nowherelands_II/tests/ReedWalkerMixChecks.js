import { createReedAudioScene } from '../js/audio/ReedWalkerAudioScene.js?family=6';
import { reedIndividual } from '../js/world/fauna/ReedWalkerTraits.js?family=4';

// Render stereo mix and isolated pre-compressor stems separately. Every pass
// has identical seeded ambience and scheduled voices; no nonlinear subtraction.
async function renderCase({ form = 'peat', age = 'old', sex = 'male', event = 'breath', distance = 20, background = 'busy', muted = false, startup = false, count = 1, ducked = false }) {
 const rate = 22050;
 async function render(stem) {
  const ctx = new OfflineAudioContext(2, 9 * rate, rate);
  const fixture = createReedAudioScene(ctx, { background, startup }), { engine, audio } = fixture;
  if (stem !== 'mix') {
   engine.analyser.disconnect();
   if (stem === 'voice') audio.out.connect(ctx.destination);
   else { engine.layerBus.connect(ctx.destination); engine.reverbGain.connect(ctx.destination); engine.delayFilter.connect(ctx.destination); }
  }
  if (ducked) engine.layerBus.gain.value = .15;
  audio.muted = muted; fixture.phrase(.3);
  for (let i = 0; i < count; i++) audio.play(reedIndividual(form, i + 1, age, sex), event, { position: { x: i * 5, y: 5, z: -distance }, listener: fixture.listener, at: .7 + i * .1, offline: true });
  const buffer = await ctx.startRendering(); fixture.dispose();
  let peak = 0, sum = 0, samples = 0;
  for (let channel = 0; channel < 2; channel++) {
   const data = buffer.getChannelData(channel);
   for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) throw new Error('Non-finite audio output');
    peak = Math.max(peak, Math.abs(data[i]));
    if (i >= 1.3 * rate && i < 2.5 * rate) { sum += data[i] ** 2; samples++; }
   }
  }
  return { peak, rms: Math.sqrt(sum / samples) };
 }
 const mix = await render('mix'), foreground = await render('voice'), ambient = await render('background');
 const voice = foreground.rms, bed = ambient.rms;
 return { form, age, sex, event, distance, background, muted, startup, count, ducked, peak: mix.peak, voice, bed, marginDb: voice && bed ? 20 * Math.log10(voice / bed) : null };
}
export async function checkReedMix(progress = () => {}) {
 const cases = [];
 for (const form of ['reedbed', 'peat', 'tarn']) for (const event of ['rumble', 'breath', 'grazing']) for (const distance of [20, 45]) cases.push({ form, event, distance });
 cases.push({ distance: 90 }, { muted: true }, { startup: true }, { count: 3 }, { ducked: true });
 for (const form of ['reedbed', 'peat', 'tarn']) for (const [age, sex] of [['old', 'female'], ['young', 'male'], ['young', 'female']]) for (const distance of [20, 45]) cases.push({ form, age, sex, event: 'grazing', distance });
 const reports = [];
 for (const [i, spec] of cases.entries()) { progress(i + 1, cases.length); reports.push(await renderCase(spec)); }
 const failures = [];
 for (const r of reports) {
  if (r.peak >= .95) failures.push(`Clipped ${r.form}/${r.age}/${r.sex}/${r.event}`);
  if (r.muted ? r.voice !== 0 : r.voice < .001) failures.push('Incorrect mute or silent voice');
  if (!r.muted && !r.ducked && r.distance <= 45 && (r.marginDb === null || r.marginDb < (r.distance === 20 ? 3 : 0))) failures.push(`${r.form}/${r.age}/${r.sex}/${r.event} at ${r.distance}: ${r.marginDb?.toFixed(1)} dB`);
 }
 const near = reports.find(r => r.form === 'peat' && r.event === 'breath' && r.distance === 20), far = reports.find(r => r.distance === 90), ducked = reports.find(r => r.ducked);
 if (far.voice >= near.voice * .5) failures.push('Distant voice does not fade');
 if (Math.abs(ducked.voice - near.voice) > .00001) failures.push('Ambient ducking attenuated the animal');
 return { passed: failures.length === 0, failures, reports };
}
