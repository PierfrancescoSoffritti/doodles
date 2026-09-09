import { RIVER_STRIDE as S, RV, surfaceHalfWidth } from '../gen/Rivers.js';
import { Random, hashString } from '../../core/Random.js';
import { reedFamily } from './ReedWalkerTraits.js?v=reed-5';
import { reedPose, reedPoseFits, REED_GRAZE_SECONDS } from './ReedWalkerMotion.js?v=graze-1';

export const REED_WORLD_SCALE = 1;
export const REED_FAMILY_CAP = 2;
export const REED_FAMILY_SEPARATION = 420;
export const REED_WORLD_STEP_SECONDS = 2.5;
export const REED_WORLD_GRAZE_SECONDS = REED_GRAZE_SECONDS;

export function reedWorldTraits(traits) {
 const r = new Random(`reed-world-size:${traits.seed}`);
 const giant = traits.age !== 'young' && r.chance(.025);
 return { ...traits, giant, scale: traits.scale * (giant ? r.range(1.7,2) : r.range(.94,1.04)), stride: traits.stride * 3 };
}
// Keep the body over ankle-deep water; individual feet may straddle the shore.
export const REED_EDGE_DEPTH = .75;
export const REED_FOOT_DEPTH = 1.1;
export function reedHabitat(s, reserve = 0) {
 const depth = s.water-s.ground;
 return Number.isFinite(depth) && s.water > .5 && depth > .04 + reserve && depth <= REED_EDGE_DEPTH - reserve && !s.roof && (s.foam || 0) < .38 && (s.slope || 0) < .35;
}
export function reedShallowFooting(s, bankWater = s.water, reserve = 0) {
 const depth = Math.max(s.water,bankWater)-s.ground;
 return Number.isFinite(depth) && depth >= -.8 + reserve && depth <= REED_FOOT_DEPTH - reserve && !s.roof && (s.slope || 0) <= .5;
}
export function reedSites(world, lakes = []) {
 const sites = [];
 for (const [ri, river] of (world.rivers || []).entries()) {
  const d = river.data;
  for (let i = 2; i < river.count - 2; i += 12) {
   const o = i * S, dx = d[o + S + RV.X] - d[o - S + RV.X], dz = d[o + S + RV.Z] - d[o - S + RV.Z], len = Math.hypot(dx, dz) || 1;
   if (d[o + RV.FOAM] > .35 || d[o + RV.WL] < .5) continue;
   for (const side of [-1, 1]) {
    const across = (surfaceHalfWidth(d[o+RV.W],d[o+RV.D],d[o+RV.BANK],side,d[o+RV.BEND]) - 2) * side;
    sites.push({ id: `river:${ri}:${i}:${side}`, x: d[o + RV.X] - dz / len * across, z: d[o + RV.Z] + dx / len * across, yaw: -Math.atan2(dz, dx), radius: 26, water: d[o+RV.WL], form: d[o + RV.WL] > 140 ? 'tarn' : d[o + RV.SPEED] < .65 ? 'peat' : 'reedbed' });
   }
  }
 }
 for (const lake of lakes) for (const [i, shore] of lake.shore.entries()) {
  sites.push({ id: `lake:${lake.id}:${i}`, x: shore.x - shore.nx * 6, z: shore.z - shore.nz * 6, yaw: -Math.atan2(shore.tz, shore.tx), radius: 26, water: shore.y, form: shore.y > 140 ? 'tarn' : 'peat' });
 }
 return sites;
}
export function reedWorldPoint(origin, yaw, point, scale) {
 const c = Math.cos(yaw), s = Math.sin(yaw);
 return { x: origin.x + (point[0] * c + point[2] * s) * scale, y: origin.y + point[1] * scale, z: origin.z + (-point[0] * s + point[2] * c) * scale };
}
export function reedLocalPoint(origin, yaw, point, scale) {
 const dx = point.x - origin.x, dz = point.z - origin.z, c = Math.cos(yaw), s = Math.sin(yaw);
 return [(dx * c - dz * s) / scale, (point.y - origin.y) / scale, (dx * s + dz * c) / scale];
}
export function reedFootprint(traits, origin, yaw, sample, blocked = () => false, bankWater) {
 const scale = traits.scale * REED_WORLD_SCALE, center = sample(origin.x, origin.z);
 bankWater ??= center.water;
 if (!reedHabitat(center,.03) || blocked(origin.x, origin.z, 3 * scale, center.ground)) return null;
 const feet = reedPose(traits).feet.map(p => {
  const q = reedWorldPoint(origin, yaw, p, scale), s = sample(q.x, q.z);
  return { ...q, y: s.ground + .065 * scale, surface: s };
 });
 if (feet.some(f => !Number.isFinite(f.y) || !reedShallowFooting(f.surface,bankWater,.08) || blocked(f.x, f.z, .4 * scale, f.surface.ground))) return null;
 const localFeet = feet.map(f => reedLocalPoint(origin, yaw, f, scale));
 // The underside meets the surface while the feet hold the shallow riverbed.
 const feedingHeight = center.water;
 const fitTraits = { ...traits, depth: (feedingHeight - origin.y) / REED_WORLD_SCALE };
 // Check the full sway and feeding cycle, not just a few representative poses.
 for (const [mode, duration] of [['stand',18],['graze',REED_GRAZE_SECONDS]]) {
  for (let time=0;time<=duration;time+=.25) {
   if (!reedPoseFits(fitTraits, reedPose(fitTraits,time,mode), localFeet)) return null;
  }
 }
 return { feet, water: center.water, bankWater, feedingHeight, traits: fitTraits };
}
export function createReedFamily(site, seed, sample, blocked) {
 const identity = hashString(`${seed}:reed:${site.id}`), family = reedFamily(site.form, identity), r = new Random(`${identity}:placement`), members = [];
 for (const definition of family) {
  const traits=reedWorldTraits(definition.traits), scale=traits.scale*REED_WORLD_SCALE;
  let member;
  for (let i = 0; i < 90; i++) {
   const p = i === 0 ? reedWorldPoint({ x: site.x, y: 0, z: site.z }, site.yaw, definition.offset, REED_WORLD_SCALE)
    : reedWorldPoint({x:site.x,y:0,z:site.z},site.yaw,[r.range(-site.radius,site.radius),0,r.range(-6,6)],1);
   if (members.some(m => Math.hypot(m.origin.x - p.x, m.origin.z - p.z) < Math.max(8,(m.scale+scale)*3.5))) continue;
   const surface = sample(p.x, p.z); if (!reedHabitat(surface)) continue;
   const origin = { ...p, y: surface.ground }, yaw = site.yaw + r.range(-.4, .4);
   const footprint = reedFootprint(traits, origin, yaw, sample, blocked,site.water); if (!footprint) continue;
   member = { ...definition, ...footprint, origin, yaw, home: { ...origin }, scale, state: 'graze', clock: r.range(0, REED_WORLD_GRAZE_SECONDS), rest: r.range(1.5, 4), nextCall: r.range(5, 18), steps: 0, r: new Random(`${identity}:${definition.role}:motion`) };
   break;
  }
  // Keep the family together: a habitat must support every member.
  if (!member) return null;
  members.push(member);
 }
 return { id: site.id, site, members, seed: identity };
}
