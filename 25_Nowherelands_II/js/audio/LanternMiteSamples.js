// Shared timing for the physical voice and the visible light signal.
export function lanternNotes(mite, reply = false) {
 const size = Math.max(0.1, Math.min(0.15, mite.size ?? 0.12));
 const frequency = 820 * Math.pow(0.12 / size, 0.7) * (1 + ((mite.id ?? 0) - 2) * 0.023);
 const gap = 0.225 + ((mite.id ?? 0) % 3) * 0.023;
 return reply
  ? [{ at: 0, frequency: frequency * 1.13, duration: 0.3, level: 0.82 }]
  : [{ at: 0, frequency, duration: 0.2, level: 0.78 }, { at: gap, frequency: frequency * 1.24, duration: 0.28, level: 1 }];
}

export function lanternLight(age, mite, reply = false) {
 return Math.max(0, ...lanternNotes(mite, reply).map(note => {
  const t = age - note.at;
  if (t < 0 || t > note.duration) return 0;
  return note.level * Math.min(1, t / 0.025) * Math.exp(-Math.max(0, t - 0.025) / 0.085)
   * Math.min(1, (note.duration - t) / 0.03);
 }));
}

export function lanternSamples(mite, reply = false, sampleRate = 44100) {
 const work=buildLanternSamples({mite,reply,sampleRate});let result;do{result=work.next();}while(!result.done);return result.value;
}

export function* buildLanternSamples({mite, reply = false, sampleRate = 44100}) {
 const notes = lanternNotes(mite, reply);
 const duration = Math.max(...notes.map(n => n.at + n.duration));
 const data = new Float32Array(Math.ceil((duration + 0.01) * sampleRate));
 let seed = 731 + (mite.id ?? 0) * 193, air = 0;
 for (const note of notes) {
  const start = Math.floor(note.at * sampleRate), length = Math.ceil(note.duration * sampleRate);
  for (let i = 0; i < length && start + i < data.length; i++) {
   const t = i / sampleRate;
   seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
   const noise = seed / 2147483648 - 1;
   air += (noise - air) * (1 - Math.exp(-2 * Math.PI * 2300 / sampleRate));
   // A soft hollow fundamental, short inharmonic wood-like modes, and a breath of air.
   const phase = 2 * Math.PI * note.frequency * (t - 0.035 * t * t / note.duration);
   const body = Math.sin(phase) * Math.exp(-t / 0.073)
    + Math.sin(phase * 2.47) * 0.27 * Math.exp(-t / 0.029)
    + Math.sin(phase * 4.13) * 0.075 * Math.exp(-t / 0.016)
    + air * 0.105 * Math.exp(-t / 0.065);
   const envelope = Math.min(1, t / 0.006) ** 2 * Math.min(1, (note.duration - t) / 0.025);
   data[start + i] += body * envelope * note.level * 0.73;
   if((i&511)===511)yield;
  }
 }
 return data;
}

