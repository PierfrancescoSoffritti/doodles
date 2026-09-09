import { reedPoseFits } from './ReedWalkerMotion.js?v=graze-1';
const clamp = x => Math.max(0, Math.min(1, x));
export const socialEase = x => { x = clamp(x); return x * x * x * (10 + x * (-15 + 6 * x)); };
export const socialDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Affection is a planted weight shift. The same pose is used by the world and atelier.
// Keep the foot contacts and bone lengths, including on sloping riverbeds.
export function reedSocialPose(traits, pose, kind, time, weight, direction = [0, 1]) {
 const offset = kind === 'distracted'
  ? [.18 * Math.sin(time * .8), -.25 * (1 + Math.sin(time * .6)) / 2, .26 * Math.sin(time * .47)]
  : [direction[0] * (kind === 'lean' ? .72 : .12), kind === 'lean' ? -.12 : -.24, direction[1] * (kind === 'lean' ? .72 : .12)];
 const make = w => ({ ...pose, body: pose.body.map((v, i) => v + offset[i] * w), tilt: pose.tilt + (kind === 'distracted' ? Math.sin(time * .7) * .045 : -direction[0] * (kind === 'lean' ? .12 : .03)) * w, roll: (kind === 'distracted' ? .035*Math.sin(time*.6) : direction[1]*(kind === 'lean' ? .15 : .035))*w });
 let safe = weight;
 for (let i = 0; i < 12 && !reedPoseFits(traits, make(safe)); i++) safe *= .7;
 return make(safe);
}

export function socialCaption(moment) {
 if (!moment) return 'Together again · back to their own rhythm';
 const name = moment.parent.label || 'parent';
 return moment.phase === 'distracted' ? 'A youngster lingers · something in the water'
  : moment.phase === 'catchup' ? 'Remembering the family · a few quicker steps'
  : moment.phase === 'approach' ? `A quiet approach to ${name.toLowerCase()}`
  : `Leaning against ${name.toLowerCase()} · a little room made without fuss`;
}
