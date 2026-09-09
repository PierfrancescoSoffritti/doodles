import { reedVoice } from '../world/fauna/ReedWalkerTraits.js?v=reed-5';

// Quiet, woody attacks inside an airy hollow resonance. Sound is opt-in in the study.
export function playReedVoice(ctx, destination, traits, event = 'rumble', { at = ctx.currentTime, onended = () => {} } = {}) {
 const start = at + .02;
 let notesRemaining = reedVoice(traits, event).length;
 for (const note of reedVoice(traits, event)) {
  const t = start + note.at, end = t + note.duration;
  const envelope = ctx.createGain(); envelope.gain.setValueAtTime(0, t);
  envelope.gain.linearRampToValueAtTime(note.gain, t + note.attack);
  envelope.gain.exponentialRampToValueAtTime(note.gain * .72, t + note.attack + .65);
  envelope.gain.exponentialRampToValueAtTime(.0001, end); envelope.connect(destination);
  const nodes = [envelope], sources = [];
  for (const [ratio, level] of [[1, .5], [2.01, .24], [3.03, .13], [4.02, .1], [6.01, .065]]) {
   const oscillator = ctx.createOscillator(), gain = ctx.createGain();
   oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(note.frequency * ratio, t);
   oscillator.frequency.exponentialRampToValueAtTime(note.frequency * ratio * .94, end);
   gain.gain.value = level; oscillator.connect(gain); gain.connect(envelope);
   oscillator.start(t); oscillator.stop(end + .02); nodes.push(oscillator, gain); sources.push(oscillator);
  }
  const size = Math.ceil(ctx.sampleRate * note.duration), buffer = ctx.createBuffer(1, size, ctx.sampleRate), data = buffer.getChannelData(0);
  let seed = 731;
  for (let i = 0; i < size; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = (seed / 2147483648 - 1) * note.air; }
  const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(); noise.buffer = buffer;
  filter.type = 'lowpass'; filter.frequency.value = 470; filter.Q.value = .6;
  noise.connect(filter); filter.connect(envelope); noise.start(t); noise.stop(end + .02); nodes.push(noise, filter); sources.push(noise);
  let remaining = sources.length;
  sources.forEach(source => { source.onended = () => { if (--remaining === 0) { nodes.forEach(n => n.disconnect()); if (--notesRemaining === 0) onended(); } }; });
 }
 return Math.max(...reedVoice(traits, event).map(n => n.at + n.duration)) + .04;
}
