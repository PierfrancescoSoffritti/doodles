import { RIVER_STRIDE as S, RV } from '../gen/Rivers.js';
import { Random, hashString } from '../../core/Random.js';
import { reedFamily } from './ReedWalkerTraits.js';
import { reedPose, reedPoseFits } from './ReedWalkerMotion.js?v=world-2';

export const REED_WORLD_SCALE = 2.2;
export const REED_FAMILY_CAP = 3;
export function reedHabitat(s) {
 const depth = s.water - s.ground;
 return Number.isFinite(depth) && s.water > .5 && depth > .08 && depth < 3.4 && !s.roof && (s.foam || 0) < .38 && (s.slope || 0) < .38;
}
export function reedSites(world, lakes = []) {
 const sites = [];
 for (const [ri, river] of (world.rivers || []).entries()) {
  const d = river.data;
  for (let i = 2; i < river.count - 2; i += 12) {
   const o = i * S, dx = d[o + S + RV.X] - d[o - S + RV.X], dz = d[o + S + RV.Z] - d[o - S + RV.Z], len = Math.hypot(dx, dz) || 1;
   if (d[o + RV.FOAM] > .35 || d[o + RV.WL] < .5) continue;
   for (const side of [-1, 1]) {
    const across = d[o + RV.W] * .48 * side;
    sites.push({ id: `river:${ri}:${i}:${side}`, x: d[o + RV.X] - dz / len * across, z: d[o + RV.Z] + dx / len * across, yaw: -Math.atan2(dz, dx), radius: 32, form: d[o + RV.WL] > 140 ? 'tarn' : d[o + RV.SPEED] < .65 ? 'peat' : 'reedbed' });
   }
  }
 }
 for (const lake of lakes) for (const [i, shore] of lake.shore.entries()) {
  sites.push({ id: `lake:${lake.id}:${i}`, x: shore.x, z: shore.z, yaw: -Math.atan2(shore.tz, shore.tx), radius: 35, form: shore.y > 140 ? 'tarn' : 'peat' });
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
export function reedFootprint(traits, origin, yaw, sample, blocked = () => false) {
 const scale = traits.scale * REED_WORLD_SCALE, center = sample(origin.x, origin.z);
 if (!reedHabitat(center) || blocked(origin.x, origin.z, 3 * scale, center.ground)) return null;
 const feet = reedPose(traits).feet.map(p => {
  const q = reedWorldPoint(origin, yaw, p, scale), s = sample(q.x, q.z);
  return { ...q, y: s.ground + .065 * scale, surface: s };
 });
 if (feet.some(f => !Number.isFinite(f.y) || f.surface.roof || f.surface.slope > .5 || f.surface.water - f.surface.ground > 4 || blocked(f.x, f.z, .4 * scale, f.surface.ground))) return null;
 const localFeet = feet.map(f => reedLocalPoint(origin, yaw, f, scale));
 const fitTraits = { ...traits, depth: (center.water - origin.y) / REED_WORLD_SCALE };
 // Check the full sway and feeding cycle, not just a few representative poses.
 for (const [mode, duration] of [['stand',18],['graze',38]]) {
  for (let time=0;time<=duration;time+=.25) {
   if (!reedPoseFits(fitTraits, reedPose(fitTraits,time,mode), localFeet)) return null;
  }
 }
 return { feet, water: center.water, traits: fitTraits };
}
export function createReedFamily(site, seed, sample, blocked) {
 const identity = hashString(`${seed}:reed:${site.id}`), family = reedFamily(site.form, identity), r = new Random(`${identity}:placement`), members = [];
 for (const definition of family) {
  let member;
  for (let i = 0; i < 90; i++) {
   const p = i === 0 ? reedWorldPoint({ x: site.x, y: 0, z: site.z }, site.yaw, definition.offset, REED_WORLD_SCALE)
    : { x: site.x + r.range(-site.radius, site.radius), z: site.z + r.range(-site.radius, site.radius) };
   if (members.some(m => Math.hypot(m.origin.x - p.x, m.origin.z - p.z) < 12)) continue;
   const surface = sample(p.x, p.z); if (!reedHabitat(surface)) continue;
   const origin = { ...p, y: surface.ground }, yaw = site.yaw + r.range(-.4, .4);
   const footprint = reedFootprint(definition.traits, origin, yaw, sample, blocked); if (!footprint) continue;
   member = { ...definition, ...footprint, origin, yaw, home: { ...origin }, scale: definition.traits.scale * REED_WORLD_SCALE, state: 'graze', clock: r.range(0, 35), rest: r.range(7, 17), nextCall: r.range(5, 18), steps: 0, r: new Random(`${identity}:${definition.role}:motion`) };
   break;
  }
  // Keep the family together: a habitat must support every member.
  if (!member) return null;
  members.push(member);
 }
 return { id: site.id, site, members, seed: identity };
}
