import { createReedAudioScene } from '../audio/ReedWalkerAudioScene.js';
import { LanternMiteAudio } from '../audio/LanternMiteVoice.js';

export function mountLanternListening(model, normalPlayback) {
 const $ = id => document.getElementById(id);
 let fixture = null, audio = null, generation = 0, mode = 'off', startTime = 0, until = Infinity;
 let nextPhrase = 0, alarmUntil = 0, seen = new Set();

 function stop(message = 'Listening stopped.') {
  const played = audio?.played ?? 0, previousMode = mode;
  generation++; audio?.dispose(); audio = null;
  const old = fixture; fixture = null; void old?.dispose(); mode = 'off'; seen.clear();
  $('sound-status').textContent = message; $('stop-audio').disabled = true;
  document.body.dataset.audio = JSON.stringify({ mode: 'off', voices: 0, played, previousMode });
 }

 async function listen(nextMode) {
  stop(); const token = generation;
  try {
   normalPlayback();
   const ctx = new AudioContext();
   fixture = createReedAudioScene(ctx, { background: $('sound-bed').value });
   fixture.engine.master.gain.value = 0.9 * Number($('volume').value) / 100;
   audio = new LanternMiteAudio(fixture.engine);
   await ctx.resume();
   if (token !== generation) return;
   if (nextMode === 'exchange') {
    model.reset(); model.visitor.z = model.destination = 3.8;
   }
   mode = nextMode; startTime = model.time; until = mode === 'exchange' ? startTime + 3.5 : Infinity;
   nextPhrase = ctx.currentTime; alarmUntil = model.alarmUntil;
   $('stop-audio').disabled = false;
   if (mode === 'exchange') {
    const id = Number($('voice-mite').value);
    // Auditions use the same event and response machinery as a natural exchange.
    model.pulse(model.mites[id], false, 'audition', (id + 2) % model.mites.length);
    $('sound-status').textContent = `Mite ${id + 1} calls; mite ${(id + 2) % 5 + 1} answers. Listening from beside the hollow.`;
   } else if (mode === 'background') {
    until = startTime + 8; $('sound-status').textContent = 'Background alone · eight seconds for comparison.';
   } else $('sound-status').textContent = 'Listening to their conversations. Your position controls distance.';
  } catch (error) { if (token === generation) stop('Audio could not start: ' + error.message); }
 }

 $('hear-exchange').onclick = () => void listen('exchange');
 $('listen-colony').onclick = () => void listen('colony');
 $('background-only').onclick = () => void listen('background');
 $('stop-audio').onclick = () => stop();
 $('sound-bed').onchange = () => stop('Background changed. Choose an audition to listen.');
 $('voice-mite').onchange = () => stop('Voice selected. Hear the exchange to compare.');
 $('volume').oninput = () => {
  $('volume-value').textContent = $('volume').value + '%';
  if (fixture) fixture.engine.master.gain.setTargetAtTime(0.9 * Number($('volume').value) / 100, fixture.engine.now, 0.025);
 };
 document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
 addEventListener('pagehide', () => stop());

 return {
  stop,
  update() {
   if (!fixture || mode === 'off') return;
   if (model.time < startTime || model.time >= until) { stop('Audition finished. Choose another voice or listen to the colony.'); return; }
   const now = fixture.engine.now;
   const listener = mode === 'colony' ? { ...model.visitor, y: 1.2 } : { x: 0, y: 1.2, z: 2.2 };
   fixture.engine.updateListener(listener, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
   if (now >= nextPhrase) { fixture.phrase(now); nextPhrase = now + 4.8; }
   if (model.alarmUntil !== alarmUntil) { audio.silence(); alarmUntil = model.alarmUntil; }
   for (const event of model.events) {
    const key = `${event.id}:${event.time}:${event.kind}:${event.reply}`;
    if (seen.has(key) || event.time < startTime) continue;
    seen.add(key);
    const wanted = mode === 'exchange' ? event.kind === 'audition' : mode === 'colony' && event.kind !== 'audition';
    if (wanted && model.time >= model.alarmUntil) audio.play(model.mites[event.id], event.reply, now, listener);
   }
   // Old model events expire after five seconds; retain only that short deduplication window.
   const activeKeys = new Set(model.events.map(e => `${e.id}:${e.time}:${e.kind}:${e.reply}`));
   seen = new Set([...seen].filter(key => activeKeys.has(key)));
   document.body.dataset.audio = JSON.stringify({ mode, background: $('sound-bed').value, voices: audio.voices.size, played: audio.played, listener, volume: Number($('volume').value) });
  },
 };
}
