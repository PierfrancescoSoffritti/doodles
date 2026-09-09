import { Random } from '../../core/Random.js';

// Shared habitat forms for the character study and freshwater world families.
export const REED_FORMS = {
 reedbed: { name: 'Reedbed grazer', place: 'Sheltered reedbeds', subtitle: 'A dark body suspended above the reeds.', color: '#514c44', legs: 5.5, width: 1.02, length: 2.15, foot: .24, pitch: 83, depth: .42, reeds: 65, ground: '#777765', water: '#647e78', detail: 'Long stilts clear dense reeds. Feeds on submerged growth along slow river margins. Returns to the same sheltered grazing patches.' },
 peat: { name: 'Peat grazer', place: 'Peat pools & wet heath', subtitle: 'Heavy, weathered, almost part of the bog.', color: '#524944', legs: 4.2, width: 1.35, length: 2.4, foot: .42, pitch: 67, depth: .12, reeds: 22, ground: '#645f54', water: '#585f59', detail: 'A broader body and wide contact pads spread its weight on soft peat. Grazes the soft margins of backwaters and peat pools.' },
 tarn: { name: 'Tarn grazer', place: 'Sheltered mountain lake margins', subtitle: 'A pale silhouette at the edge of still water.', color: '#929086', legs: 4.8, width: .94, length: 2.0, foot: .2, pitch: 105, depth: .28, reeds: 14, ground: '#84877c', water: '#819592', detail: 'Lean, pale and close-footed. Picks across firm shelves beside mountain lakes, sheltering from wind behind rocks.' },
};
// Shared shape families keep the tusks recognizable while varying their silhouette.
export function reedTuskPair(form, seed, age, sex) {
 if (sex !== 'male') return [];
 const r = new Random(`reed-tusks:${form}:${seed}`);
 const profile = r.pick([
  { name: 'Long sweep', length: 1.3, radius: .9, spread: .4, rise: .24, taper: .8 },
  { name: 'Upright curve', length: .9, radius: 1, spread: .23, rise: .7, taper: .75 },
  { name: 'Wide arc', length: 1.05, radius: 1.05, spread: .72, rise: .34, taper: .7 },
  { name: 'Short and worn', length: .68, radius: 1.2, spread: .32, rise: .25, taper: .58 },
 ]);
 const young = age === 'young', asymmetry = age === 'old' ? .14 : young ? .04 : .08;
 const length = (young ? .36 : 1.25) * profile.length * r.range(.88, 1.12);
 const radius = (young ? .065 : .14) * profile.radius * r.range(.88, 1.12);
 const spread = profile.spread * r.range(.84, 1.16), rise = profile.rise * r.range(.85, 1.15);
 return [-1, 1].map(side => ({
  side, style: young && profile.name === 'Short and worn' ? 'Short buds' : profile.name,
  length: length * r.range(1 - asymmetry, 1 + asymmetry),
  radius: radius * r.range(.95, 1.05),
  spread: spread * r.range(1 - asymmetry, 1 + asymmetry),
  rise: rise * r.range(1 - asymmetry, 1 + asymmetry),
  taper: profile.taper,
  tip: !young && profile.name === 'Short and worn' ? r.range(.016, .03) : .004,
 }));
}
export function reedIndividual(form = 'reedbed', seed = 1, age = 'adult', sex = 'male') {
 if (!REED_FORMS[form]) throw new Error('Unknown reed habitat: ' + form);
 if (!['young', 'adult', 'old'].includes(age)) throw new Error('Unknown reed age: ' + age);
 if (!['male', 'female'].includes(sex)) throw new Error('Unknown reed sex: ' + sex);
 const r = new Random(`reed:${form}:${seed}`), base = REED_FORMS[form];
 const scale = age === 'young' ? .7 : age === 'old' ? 1.09 : 1;
 const traits = { ...base, form, seed, age, scale, legs: base.legs * r.range(.91, 1.09), width: base.width * r.range(.91, 1.1), length: base.length * r.range(.94, 1.07), tilt: r.range(-.08, .08), hue: r.range(-.025, .025), patience: r.range(.9, 1.2) * (age === 'old' ? 1.2 : 1), pitch: base.pitch * r.range(.94, 1.06) / Math.sqrt(scale), marks: age === 'old' ? 7 : age === 'young' ? 1 : 4 };
 const young = age === 'young', male = sex === 'male';
 const palette = {
  reedbed: ['#555f58', '#85826a', '#89947e', '#aaa184'],
  peat: ['#625751', '#93836b', '#958c79', '#b0a082'],
  tarn: ['#777f81', '#a6a68d', '#a4b1a0', '#c2baa0'],
 }[form];
 traits.sex = sex; traits.color = palette[(young ? 2 : 0) + (male ? 0 : 1)];
 traits.width *= young ? 1.08 : male ? 1.2 : .97;
 traits.length *= young ? .84 : male ? 1.06 : 1;
 traits.crown = young ? 1.28 : male ? .84 : 1.18;
 traits.legs *= young ? 1.04 : 1;
 if (young) traits.scale *= r.range(.92, 1.04);
 traits.tusks = reedTuskPair(form, seed, age, sex);
 traits.tuskLength = traits.tusks.length ? Math.max(...traits.tusks.map(t => t.length)) : 0;
 traits.tuskRadius = traits.tusks.length ? Math.max(...traits.tusks.map(t => t.radius)) : 0;
 traits.stride = young ? .65 : .85;
 traits.rock = young ? .9 : male ? 1.05 : .8;
 traits.patience *= young ? .85 : male ? 1.05 : .98;
 traits.pitch *= male ? .91 : 1.05;
 traits.callPace = young ? .76 : 1;
 return traits;
}
// Sample a loose group inside the river, independently of each member's role.
function familyPositions(seed, count) {
 const r = new Random(`reed-placement:${seed}:${count}`);
 let points = [];
 for (let attempt = 0; attempt < 128; attempt++) {
  points = [];
  for (let sample = 0; sample < 160 && points.length < count; sample++) {
   const x = r.range(-5.6, 5.6), z = Math.sin(x * .25) * .5 + r.range(-3.4, 3.4);
   if (points.every(p => Math.hypot(p[0] - x, p[2] - z) >= 5.5)) points.push([x, 0, z]);
  }
  if (points.length === count) break;
 }
 // A bounded fallback also gets shuffled, so roles never reserve a side.
 if (points.length !== count) points = [[-4.7, 0, -2.8], [4.7, 0, -2.8], [-3, 0, 2.8], [3, 0, 2.8]].slice(0, count);
 for (let i = points.length - 1; i > 0; i--) { const j = r.int(0, i); [points[i], points[j]] = [points[j], points[i]]; }
 return points;
}
// A bonded pair shares a feeding patch with one or two youngsters.
export function reedFamily(form = 'reedbed', seed = 1, children = null) {
 const count = children ?? (new Random(`reed-family:${seed}`).chance(.5) ? 1 : 2);
 if (![1, 2].includes(count)) throw new Error('Reed families have one or two youngsters');
 const ages = new Random(`reed-parents:${seed}`), positions = familyPositions(seed, count + 2);
 const family = [
  { role: 'father', label: 'Father', sex: 'male', age: ages.chance(.5) ? 'old' : 'adult', offset: positions[0], delay: 0 },
  { role: 'mother', label: 'Mother', sex: 'female', age: ages.chance(.5) ? 'old' : 'adult', offset: positions[1], delay: 1.4 },
  { role: 'son', label: 'Son', sex: 'male', age: 'young', offset: positions[2], delay: 2.3 },
 ];
 if (count === 2) {
  const sex = new Random(`reed-sibling:${seed}`).chance(.5) ? 'male' : 'female';
  family.push({ role: 'sibling', label: sex === 'male' ? 'Second son' : 'Daughter', sex, age: 'young', offset: positions[3], delay: 3.1 });
 }
 return family.map((member, i) => ({ ...member, traits: reedIndividual(form, i < 3 ? seed * 3 + i : `${seed}:sibling`, member.age, member.sex) }));
}
export function reedVoice(individual, event = 'rumble') {
 const f = individual.pitch;
 const events = {
  rumble: [{ at: 0, frequency: f, duration: 4.8, gain: .3, attack: .9, air: .1 }, { at: 2.5, frequency: f * .82, duration: 3.4, gain: .13, attack: .8, air: .12 }],
  breath: [{ at: 0, frequency: f * .7, duration: 4.1, gain: .2, attack: .65, air: .9 }],
  grazing: [{ at: 0, frequency: f * .83, duration: 2, gain: .2, attack: .25, air: 1.2 }, { at: 2.1, frequency: f * .73, duration: 2.5, gain: .12, attack: .4, air: 1 }],
 };
 if (!events[event]) throw new Error('Unknown reed voice: ' + event);
 const pace = individual.callPace ?? 1;
 return events[event].map(note => ({ ...note, at: note.at * pace, duration: note.duration * pace, attack: note.attack * pace }));
}
