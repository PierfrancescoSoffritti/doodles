import { rayEnvelope } from '../../audio/VeilRayVoice.js';
import { FaunaModel } from './FaunaModel.js?v=player-notes-13';
import { motor, damp, clamp, angleDelta } from './Locomotion.js';

export const RAY_LAKE = { x: 0, z: -20, radius: 44 };
const STEP = 1 / 60;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const routine = new Set(['skim', 'cross', 'rest', 'return', 'company']);

// A bounded character fixture. Convex routes stay inside a lake eroded by the
// entire membrane radius. The same simulation clock drives movement and events.
export class VeilRayStudy {
 constructor(seed = 'veil-lake', count = 1) { this.seed = seed; this.count = count; this.reset(); }
 reset(count = this.count) {
  this.count = count === 2 ? 2 : 1; this.time = 0; this.accumulator = 0;
  this.visitor = { x: -6, y: 11, z: 43, speed: 0 }; this.destination = { x: -6, z: 43 }; this.walkSpeed = 2.5;
  this.quiet = 0; this.demo = false; this.demoStep = 0; this.events = []; this.serial = 0;
  this.invitations = []; this.nextSocial = 22; this.pendingReply = null; this.socialCall = null; this.lastFeedback = 'The lake has its own rhythm.';
  const source = new FaunaModel(this.seed, { sample: () => ({ ground: -4, water: 0, slope: 0, wet: 1, foam: 0 }) });
  this.creatures = Array.from({ length: this.count }, (_, i) => {
   const c = source.addGroup('study-ray-' + i, 'ray', 0, -20, 1).members[0];
   c.pos = { x: -23 + i * 23, y: 7 + i * 2, z: this.count === 2 ? (i ? -36 : -4) : -12 }; c.prev = { ...c.pos };
   c.vel = { x: 2.8, y: 0, z: 0 }; c.yaw = c.prevYaw = 0; c.bank = c.prevBank = c.pitch = c.prevPitch = 0;
   c.born = -10; c.radius = 8.2 * c.size; c.pos.y = Math.max(c.pos.y, c.radius + 0.6); c.prev = { ...c.pos }; c.index = i; c.stop = i; c.nextInvite = 0; c.avoidUntil = 0;
   c.callAt = -100; c.callLength = 0; c.contacts = 0; c.acknowledgments = 0; c.followUntil = 0;
   this.route(c, { x: 19, y: 7, z: -7 - i * 16 }, 15, 'skim', { x: 1, z: 0 });
   return c;
  });
  this.groups = source.groups; this.listener = this.visitor;
 }
 safePoint(c, p) {
  const dx = p.x - RAY_LAKE.x, dz = p.z - RAY_LAKE.z, d = Math.hypot(dx, dz);
  const radius = RAY_LAKE.radius - c.radius - 2, f = Math.min(1, radius / Math.max(d, 0.001));
  const result = { x: RAY_LAKE.x + dx * f, y: clamp(p.y, c.radius + 0.6, 13), z: RAY_LAKE.z + dz * f };
  // Separate broad lanes keep the two full membranes apart throughout every curve.
  if (this.count === 2) {
   result.z = c.index ? Math.min(result.z, -32) : Math.max(result.z, -8);
   const reach = Math.sqrt(Math.max(0, radius * radius - (result.z - RAY_LAKE.z) ** 2));
   result.x = clamp(result.x, -reach, reach);
  }
  return result;
 }
 route(c, destination, duration, state, heading) {
  const end = this.safePoint(c, destination), dx = end.x - c.pos.x, dz = end.z - c.pos.z;
  const h = heading || { x: dx, z: dz }, length = Math.hypot(h.x, h.z) || 1;
  const speed = state === 'rest' ? 0.45 : state === 'retreat' ? 3.5 : 2.6;
  const p1 = this.safePoint(c, { x: c.pos.x + c.vel.x * duration / 3, y: c.pos.y + c.vel.y * duration / 3, z: c.pos.z + c.vel.z * duration / 3 });
  const p2 = this.safePoint(c, { x: end.x - h.x / length * speed * duration / 3, y: end.y, z: end.z - h.z / length * speed * duration / 3 });
  c.path = { points: [{ ...c.pos }, p1, p2, end], start: this.time, duration };
  c.state = state;
 }
 emit(c, kind) {
  if (this.time < c.avoidUntil || this.time - c.callAt < 7) return false;
  c.callAt = this.time; c.callPhrase = kind; c.callLength = kind === 'acknowledgment' ? 2.6 : 5.2;
  if (kind === 'acknowledgment') c.acknowledgments++; else c.contacts++;
  this.events.push({ sequence: ++this.serial, time: this.time, id: c.index, kind });
  return true;
 }
 command(action) {
  this.demo = false;
  this.act(action);
 }
 act(action) {
  if (action === 'approach') { this.destination = { x: this.visitor.x, z: 27 }; this.walkSpeed = 2.5; }
  if (action === 'wait') this.destination = { x: this.visitor.x, z: this.visitor.z };
  if (action === 'walk') { this.destination = { x: this.visitor.x < 4 ? 20 : -20, z: this.visitor.z }; this.walkSpeed = 1.2; }
  if (action === 'leave') { this.destination = { x: this.visitor.x, z: 43 }; this.walkSpeed = 3; }
  if (action === 'invite') this.invite();
  if (action === 'rush') { this.quiet = 0; this.disturb(); }
 }
 playEncounter() { this.reset(); this.demo = true; this.act('approach'); }
 invite(strength = 0.35, source = 'player') {
  if (source !== 'player') return false;
  this.events.push({ sequence: ++this.serial, time: this.time, kind: 'invitation' });
  this.invitations = this.invitations.filter(t => this.time - t < 5); this.invitations.push(this.time);
  if (strength > 0.75 || this.invitations.length >= 3) { this.disturb(); return false; }
  const c = this.creatures.filter(c => routine.has(c.state) && this.time >= c.nextInvite && this.time >= c.avoidUntil && distance(c.pos, this.visitor) < 60)
   .sort((a, b) => distance(a.pos, this.visitor) - distance(b.pos, this.visitor))[0];
  if (!c || this.quiet < 4 || this.visitor.z > 31) { this.lastFeedback = 'Give them a little quiet and room to turn.'; return false; }
  c.nextInvite = this.time + 55; c.passX = clamp(this.visitor.x, -12, 12); c.followUntil = 0;
  this.pendingReply = null; this.socialCall = null;
  const target = { x: c.passX - 11, y: 9, z: 10 };
  this.route(c, target, clamp(distance(c.pos, target) / 3.2, 7, 16), 'approach', { x: 1, z: 0 });
  this.lastFeedback = 'It has changed its course. Let it finish the turn.';
  return true;
 }
 disturb() {
  let affected = false;
  for (const c of this.creatures) {
   if (distance(c.pos, this.visitor) > 65) continue;
   affected = true; c.avoidUntil = this.time + 16 + c.index * 3; c.nextInvite = c.avoidUntil + 12;
   c.callAt = -100; c.energy = 0;
   if (c.state !== 'retreat') this.route(c, { x: c.index ? 16 : -16, y: 12, z: -37 }, 10, 'retreat', { x: -1, z: 0 });
  }
  if (affected) { this.pendingReply = null; this.socialCall = null; this.events.push({ sequence: ++this.serial, time: this.time, kind: 'silence' }); }
  this.lastFeedback = affected ? 'A few firmer strokes carry it toward shelter.' : 'The rays are too far away to be disturbed.';
 }
 nextRoute(c) {
  if (this.time < c.avoidUntil) {
   this.route(c, { x: c.pos.x + (c.index ? -3 : 3), y: 10, z: -36 }, 8, 'rest', { x: c.index ? -1 : 1, z: 0 }); return;
  }
  if (c.state === 'approach') {
   if (this.visitor.z > 33) { this.returnHome(c); return; }
   this.route(c, { x: c.passX + 11, y: 9, z: 10 }, 8.5, 'pass', { x: 1, z: 0 });
   this.emit(c, 'acknowledgment'); return;
  }
  if (c.state === 'pass' || c.state === 'follow') {
   if (this.visitor.speed > 0.2 && this.visitor.speed < 2 && this.visitor.z < 32 && distance(c.pos, this.visitor) < 40) {
    if (!c.followUntil) c.followUntil = this.time + 10;
    if (this.time < c.followUntil) {
     const direction = Math.sign(this.destination.x - this.visitor.x) || 1;
     this.route(c, { x: this.visitor.x + direction * 10, y: 8.5, z: 9 }, 4, 'follow', { x: direction, z: 0 }); return;
    }
   }
   this.returnHome(c); return;
  }
  if (c.state === 'retreat') { this.returnHome(c); return; }
  const stops = [{ x: -22, y: 7, z: -7 }, { x: 19, y: 6.5, z: 5 }, { x: 21, y: 11, z: -31 }, { x: -8, y: 10, z: -42 }];
  const index = c.stop++ % stops.length, p = { ...stops[index] };
  p.x += c.rnd.range(-2, 2); p.z += c.index * -5 + c.rnd.range(-2, 2);
  const state = index === 3 ? 'rest' : index === 2 ? 'cross' : 'skim';
  this.route(c, p, Math.max(9, distance(c.pos, p) / (state === 'rest' ? 1.8 : 2.7)), state);
 }
 returnHome(c) { this.route(c, { x: -12 + c.index * 24, y: 10, z: -30 }, 13, 'return', { x: -1, z: 0 }); }
 update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  this.accumulator += Math.min(dt, 0.25);
  while (this.accumulator + 1e-10 >= STEP) { this.step(STEP); this.accumulator -= STEP; }
 }
 step(dt) {
  this.time += dt;
  if (this.demo) {
   const script = [[7, 'wait'], [12, 'invite'], [24, 'walk'], [38, 'rush'], [41, 'leave']];
   while (this.demoStep < script.length && this.time >= script[this.demoStep][0]) this.act(script[this.demoStep++][1]);
   if (this.time >= 62) this.demo = false;
  }
  const dx = this.destination.x - this.visitor.x, dz = this.destination.z - this.visitor.z, d = Math.hypot(dx, dz);
  const stride = Math.min(d, this.walkSpeed * dt);
  this.visitor.x += dx / Math.max(d, 0.001) * stride; this.visitor.z += dz / Math.max(d, 0.001) * stride;
  this.visitor.speed = stride / dt; this.quiet = this.visitor.speed < 0.1 ? this.quiet + dt : 0;
  for (const c of this.creatures) {
   c.prev = { ...c.pos }; c.prevYaw = c.yaw; c.prevBank = c.bank; c.prevPitch = c.pitch; c.prevStroke = c.stroke;
   if (['approach', 'pass', 'follow'].includes(c.state) && this.visitor.z > 34) this.returnHome(c);
   if (this.time >= c.path.start + c.path.duration) this.nextRoute(c);
   const { points: p, duration, start } = c.path, t = clamp((this.time - start) / duration, 0, 1), u = 1 - t;
   for (const axis of ['x', 'y', 'z']) {
    c.pos[axis] = u ** 3 * p[0][axis] + 3 * u * u * t * p[1][axis] + 3 * u * t * t * p[2][axis] + t ** 3 * p[3][axis];
    c.vel[axis] = (3 * u * u * (p[1][axis] - p[0][axis]) + 6 * u * t * (p[2][axis] - p[1][axis]) + 3 * t * t * (p[3][axis] - p[2][axis])) / duration;
   }
   c.speed = Math.hypot(c.vel.x, c.vel.z);
   if (c.speed > 0.15) c.yaw += clamp(angleDelta(Math.atan2(-c.vel.z, c.vel.x), c.yaw), -0.65 * dt, 0.65 * dt);
   c.turnRate = (c.yaw - c.prevYaw) / dt;
   c.bank = damp(c.bank, clamp(c.turnRate * c.speed * 0.065, -0.45, 0.45), 3, dt);
   c.bend = damp(c.bend, clamp(c.turnRate * 0.7, -0.7, 0.7), 4, dt);
   c.pitch = damp(c.pitch, clamp(Math.atan2(c.vel.y, Math.max(1, c.speed)), -0.25, 0.25), 3, dt);
   c.energy = rayEnvelope(this.time - c.callAt, c.callPhrase) * 0.75;
   motor(c, dt, c.state === 'retreat');
   if (c.state === 'rest') c.effort = damp(c.effort, 0.12, 5, dt);
  }
  // A loose pair shares a crossing occasionally. Only the selected neighbor
  // answers, after the contact phrase ends, and that reply never schedules another.
  if (this.count === 2 && this.time >= this.nextSocial && this.creatures.every(c => routine.has(c.state) && this.time >= c.avoidUntil)) {
   const [a, b] = this.creatures;
   const x = a.pos.x > 0 ? -18 : 18, heading = { x: x > 0 ? 1 : -1, z: 0 };
   this.route(a, { x, y: 9, z: -4 }, 16, 'company', heading);
   this.route(b, { x, y: 9, z: -36 }, 16, 'company', heading);
   this.socialCall = this.time + 5;
   this.nextSocial = this.time + 38 + a.rnd.range(0, 12);
  }
  if (this.socialCall !== null && this.time >= this.socialCall) {
   const [a, b] = this.creatures;
   if (a.state === 'company' && b.state === 'company' && this.emit(a, 'contact')) this.pendingReply = { id: 1, at: this.time + 7 };
   this.socialCall = null;
  }
  if (this.pendingReply && this.time >= this.pendingReply.at) { const c = this.creatures[this.pendingReply.id]; if (routine.has(c.state)) this.emit(c, 'contact'); this.pendingReply = null; }
  this.events = this.events.filter(e => this.time - e.time < 8);
 }
 get caption() {
  const focus = this.creatures.find(c => ['retreat', 'approach', 'pass', 'follow'].includes(c.state)) || this.creatures[0];
  return ({ company: ['A shared crossing', 'Two independent rhythms, briefly traveling together.'], skim: ['A low crossing', 'A few strokes, then a long glide above the water.'], cross: ['Across the open water', 'A little height, a wide turn, another part of the lake.'], rest: ['A sheltered drift', 'Small corrections hold a quiet pocket of air.'], approach: ['A change of course', 'Let it finish the turn. It is making room for a passing glide.'], pass: ['A moment beside you', 'One airy acknowledgment, then space between you again.'], follow: ['Sharing the shoreline', 'It travels in your direction for a little while.'], retreat: ['A little more distance', 'Firmer strokes carry it toward shelter. Give it time.'], return: ['Its own way again', 'The encounter ends; the lake still has places to visit.'] })[focus.state];
 }
}
