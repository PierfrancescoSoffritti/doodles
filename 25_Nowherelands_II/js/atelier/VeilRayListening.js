import { createReedAudioScene } from '../audio/ReedWalkerAudioScene.js';
import { FaunaAudio } from '../audio/FaunaAudio.js';

export function mountVeilRayListening(model, normalPlayback) {
 const $ = id => document.getElementById(id);
 let fixture = null, audio = null, mode = 'off', generation = 0, until = 0, seen = 0, nextPhrase = 0;
 function stop(message = 'Listening stopped.') {
  generation++; audio?.dispose(); audio = null;
  const old = fixture; fixture = null; void old?.dispose(); mode = 'off';
  $('stop-audio').disabled = true; $('sound-status').textContent = message;
  document.body.dataset.audio = JSON.stringify({ mode, voices: 0 });
 }
 async function listen(nextMode) {
  stop(); const token = generation;
  try {
   normalPlayback();
   const ctx = new AudioContext(); fixture = createReedAudioScene(ctx, { background: $('sound-bed').value });
   fixture.engine.master.gain.value = 0.9 * Number($('volume').value) / 100;
   audio = new FaunaAudio(fixture.engine, fixture.conductor);
   await ctx.resume(); if (token !== generation) return;
   if (nextMode === 'encounter') model.playEncounter();
   else if (nextMode !== 'background') model.reset();
   mode = nextMode; seen = model.serial; nextPhrase = ctx.currentTime;
   until = model.time + (mode === 'encounter' ? 63 : mode === 'background' ? 8 : mode === 'contact' ? 6 : 3.4);
   if (mode === 'contact' || mode === 'acknowledgment') model.emit(model.creatures[0], mode);
   $('stop-audio').disabled = false;
   $('sound-status').textContent = mode === 'encounter' ? 'Listening from the gold ring. Approach, wait, and hear the pass.' : mode === 'background' ? 'Background alone · eight seconds.' : 'One singing phrase, heard beside the ray. Watch the rim follow its breath.';
  } catch (e) { if (token === generation) stop('Audio could not start: ' + e.message); }
 }
 $('hear-contact').onclick = () => void listen('contact');
 $('hear-ack').onclick = () => void listen('acknowledgment');
 $('listen-encounter').onclick = () => void listen('encounter');
 $('background-only').onclick = () => void listen('background');
 $('stop-audio').onclick = () => stop();
 $('sound-bed').onchange = () => stop('Background changed. Choose an audition to listen.');
 $('volume').oninput = () => {
  $('volume-value').textContent = $('volume').value + '%';
  fixture?.engine.master.gain.setTargetAtTime(0.9 * Number($('volume').value) / 100, fixture.engine.now, 0.03);
 };
 document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
 addEventListener('pagehide', () => stop());
 return { stop, update() {
  if (!fixture) return;
  if (model.time >= until) { stop('Audition finished. Try another phrase or background.'); return; }
  const engine = fixture.engine, c = model.creatures[0], listener = mode === 'encounter' ? model.visitor : { x: c.pos.x, y: 11, z: c.pos.z + 15 };
  engine.updateListener(listener, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
  if (engine.now >= nextPhrase) { fixture.phrase(engine.now); nextPhrase = engine.now + 4.8; }
  for (const event of model.events) {
   if (event.sequence <= seen) continue; seen = event.sequence;
   if (event.kind === 'invitation') {
    if (mode === 'encounter') engine.playTone({ freq: fixture.conductor.scale.freq(0, 2), position: model.visitor, velocity: 0.3, attack: 0.08, duration: 0.3, release: 1, type: 'sine', layer: 'invitation', dest: engine.playerBus });
    continue;
   }
   if (event.kind === 'silence') { audio.silenceRays(); continue; }
   if (mode !== 'background') audio.call(model.creatures[event.id], false, false, event.kind);
  }
  audio.update();
  document.body.dataset.audio = JSON.stringify({ mode, voices: audio.voices.length, played: audio.history.length, background: $('sound-bed').value, listener });
 } };
}
