export const REED_STRIDE_SECONDS = 8;
export const REED_GRAZE_TIMING = { lower: 2.5, feed: 4, rise: 3.5, rest: 2 };
export const REED_GRAZE_SECONDS = Object.values(REED_GRAZE_TIMING).reduce((a,b)=>a+b,0);
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { const t = clamp(x); return t * t * t * (10 + t * (-15 + 6 * t)); };

// Study coordinates are relative to the riverbed. Foot positions stay fixed
// throughout lowering: bent joints, rather than scaled bones, absorb the motion.
export function reedPose(traits, time = 0, mode = 'stand', lowering = 0) {
 const t = Math.max(0, time), h = traits.legs;
 const cycle = t % REED_GRAZE_SECONDS;
 const lowerEnd=REED_GRAZE_TIMING.lower, feedEnd=lowerEnd+REED_GRAZE_TIMING.feed, riseEnd=feedEnd+REED_GRAZE_TIMING.rise;
 const graze = mode === 'manual' ? clamp(lowering)
  : mode === 'graze' ? cycle < lowerEnd ? ease(cycle / lowerEnd) : cycle < feedEnd ? 1 : ease((riseEnd - cycle) / REED_GRAZE_TIMING.rise) : 0;
 const step = mode === 'step' ? clamp(t / REED_STRIDE_SECONDS) : 0;
 const resting = mode === 'stand';
 const stridePhase = step * 4, swingIndex = Math.min(3, Math.floor(stridePhase));
 const swingFore = swingIndex % 2 === 0 ? -1 : 1;
 const walkTilt = mode === 'step' ? swingFore * Math.sin(Math.PI * (stridePhase - swingIndex)) ** 2 * .045 : 0;
 const settlePhase = clamp(((t % 18) - 5) / 6);
 const settle = Math.sin(settlePhase * Math.PI) ** 2;
 const stride = traits.stride ?? .85;
 const bodyX = stride * ease(step) + (resting ? Math.sin(t * .32) * .18 + settle * .18 : 0);
 const bodyZ = resting ? Math.sin(t * .26) * .16 : 0;
 const water = traits.depth / traits.scale;
 // The underside feeding pad reaches the surface at full lowering.
 const targetY = water + .83;
 const bodyY = h + (targetY - h) * graze + Math.sin(t * (resting ? .7 : .52)) * (resting ? .11 : .026) * (1 - graze) - (resting ? settle * .13 : 0);
 const feet = Array.from({ length: 4 }, (_, i) => {
  const fore = i < 2 ? 1 : -1, side = i % 2 ? 1 : -1;
  const order = [2, 0, 3, 1], phase = clamp(step * 4 - order.indexOf(i));
  const advance = stride * ease(phase), lift = Math.sin(phase * Math.PI) ** 2 * .32;
  return [fore * traits.length * .94 + advance, .065 + lift, side * (traits.width + .65)];
 });
 return { body: [bodyX, bodyY, bodyZ], tilt: (traits.tilt + (traits.rock ?? 1) * (walkTilt + (resting ? Math.sin(t * .38) * .12 + settle * .03 : 0))) * (1 - graze), feet, graze,
  feeding: graze > .985, stage: mode === 'manual' ? 'Compare the posture' : mode === 'step' ? step < 1 ? 'Lift · place · transfer weight' : 'Settled after one slow stride' : mode === 'graze' ? cycle < lowerEnd ? 'Lowering toward the water' : cycle < feedEnd ? 'Grazing · a mouthful of river plants' : cycle < riseEnd ? 'Rising and settling' : 'Resting before the next mouthful' : 'Resting · almost indifferent to the world' };
}

// Analytic two-bone solve, independent of the renderer for contact/reach tests.
export function reedJoint(hip, foot, length, side, fore = 1) {
 const delta = foot.map((v, i) => v - hip[i]);
 const distance = Math.hypot(...delta);
 if (!Number.isFinite(distance) || distance < 1e-6 || distance > 2 * length) throw new Error('Unreachable reed foot');
 const direction = delta.map(v => v / distance), bend = [fore * .8, 0, side];
 const dot = bend.reduce((sum, v, i) => sum + v * direction[i], 0);
 const perpendicular = bend.map((v, i) => v - dot * direction[i]), norm = Math.hypot(...perpendicular);
 if (norm < 1e-6) throw new Error('Degenerate reed joint');
 const reach = Math.sqrt(Math.max(0, length * length - distance * distance / 4));
 return hip.map((v, i) => (v + foot[i]) / 2 + perpendicular[i] / norm * reach);
}

// Euler XYZ matches the shell: pitch around Z, followed by the sideways lean.
export function reedHip(traits, pose, i) {
 const x=(i<2?1:-1)*traits.length*.65,z=(i%2?1:-1)*traits.width*.64;
 const y=x*Math.sin(pose.tilt),roll=pose.roll||0;
 return [pose.body[0]+x*Math.cos(pose.tilt),pose.body[1]+y*Math.cos(roll)-z*Math.sin(roll),pose.body[2]+y*Math.sin(roll)+z*Math.cos(roll)];
}

// Use the renderer's hip transform when validating a world stance. The small
// reach reserve covers the motion between planning samples.
export function reedPoseFits(traits, pose, feet = pose.feet, reserve = .04) {
 return feet.every((foot, i) => {
  const hip=reedHip(traits,pose,i);
  const distance = Math.hypot(...foot.map((v,j)=>v-hip[j]));
  return Number.isFinite(distance) && distance > .001 && distance < traits.legs * 1.22 - reserve;
 });
}
