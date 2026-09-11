import test from 'node:test';
import assert from 'node:assert/strict';
import { VeilRayStudy, RAY_LAKE } from '../../js/world/fauna/VeilRayStudy.js?v=pebble-voice-4b';
const advance = (m, seconds, check = () => {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) { m.update(1 / 60); check(m); } };
const collect = (m, events) => { for (const event of m.events) events.set(event.sequence, event); };

test('the encounter earns a delayed passing reply, brief accompaniment, retreat and recovery', () => {
 const m = new VeilRayStudy(); m.playEncounter(); const states = new Set(), events = new Map();
 advance(m, 63, m => { states.add(m.creatures[0].state); collect(m, events); });
 for (const state of ['skim', 'approach', 'pass', 'follow', 'retreat', 'rest']) assert.ok(states.has(state), state);
 const replies = [...events.values()].filter(e => e.kind === 'acknowledgment');
 assert.equal(replies.length, 1); assert.ok(replies[0].time > 19 && replies[0].time < 29);
 assert.equal(m.demo, false); assert.ok(['skim', 'cross', 'rest'].includes(m.creatures[0].state));
 assert.ok(m.visitor.z > 42); assert.equal(m.creatures[0].acknowledgments, 1);
});

test('manual invitations require quiet proximity and end when the visitor leaves', () => {
 const m = new VeilRayStudy(); assert.equal(m.invite(), false);
 m.command('approach'); advance(m, 7); assert.equal(m.invite(), false);
 advance(m, 5); assert.equal(m.invite(), true); const start = { ...m.creatures[0].pos };
 advance(m, 4); assert.ok(Math.hypot(m.creatures[0].pos.x - start.x, m.creatures[0].pos.z - start.z) > 2);
 m.command('leave'); advance(m, 15);
 assert.ok(!['pass', 'follow', 'approach'].includes(m.creatures[0].state));
 assert.equal(m.creatures[0].acknowledgments, 0);
});

test('repeated invitations cancel an approach and extend quiet recovery without a reply', () => {
 const m = new VeilRayStudy(); m.command('approach'); advance(m, 12); assert.equal(m.invite(), true);
 advance(m, 1); m.invite(); advance(m, 1); m.invite();
 assert.equal(m.creatures[0].state, 'retreat'); const firstRecovery = m.creatures[0].avoidUntil;
 advance(m, 5); m.disturb(); assert.ok(m.creatures[0].avoidUntil > firstRecovery);
 advance(m, 8); assert.equal(m.invite(), false); assert.equal(m.creatures[0].acknowledgments, 0);
 advance(m, 30); assert.ok(['skim', 'cross', 'rest', 'return'].includes(m.creatures[0].state));
});

test('ambient music and other animal voices cannot create player invitations', () => {
 const a = new VeilRayStudy(), b = new VeilRayStudy();
 for (const m of [a, b]) m.command('approach');
 for (let i = 0; i < 60 * 60; i++) { a.invite(0.4, 'ambient'); a.invite(0.5, 'fauna:ray'); a.update(1 / 60); b.update(1 / 60); }
 assert.deepEqual(a.creatures, b.creatures); assert.deepEqual(a.events, b.events);
});

test('all routes preserve full membrane clearance and continuous motion across encounters', () => {
 for (const count of [1, 2]) for (const seed of ['veil-lake', 'rain', 'quiet']) {
  const m = new VeilRayStudy(seed, count); m.playEncounter(); let previous = m.creatures.map(c => ({ ...c.pos }));
  advance(m, 180, m => {
   m.creatures.forEach((c, i) => {
    assert.ok(Object.values(c.pos).every(Number.isFinite));
    assert.ok(Math.hypot(c.pos.x - RAY_LAKE.x, c.pos.z - RAY_LAKE.z) + c.radius <= RAY_LAKE.radius - 1.99, 'membrane remains above water');
    assert.ok(Math.hypot(c.pos.x - previous[i].x, c.pos.y - previous[i].y, c.pos.z - previous[i].z) < 0.2, 'no teleport or sudden leap');
    assert.ok(c.pos.y >= c.radius + 0.59 && c.pos.y <= 13, 'even fully banked tips clear the surface');
    assert.ok(Math.abs(c.yaw - c.prevYaw) <= 0.011);
   });
   if (count === 2) { const [a, b] = m.creatures; assert.ok(Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > a.radius + b.radius, 'pair membranes remain separate'); }
   previous = m.creatures.map(c => ({ ...c.pos }));
  });
 }
});

test('a loose pair shares crossings and makes bounded, delayed social exchanges', () => {
 const m = new VeilRayStudy('veil-lake', 2), events = new Map(); let together = 0;
 advance(m, 180, m => { collect(m, events); if (m.creatures.every(c => c.state === 'company')) together++; });
 assert.ok(together > 60 * 20);
 const calls = [...events.values()].filter(e => e.kind === 'contact');
 assert.ok(calls.length >= 4 && calls.length <= 10);
 for (let i = 1; i < calls.length; i++) assert.ok(calls[i].time - calls[i - 1].time >= 6.9);
 assert.ok(m.creatures.every(c => c.contacts > 0)); assert.ok(m.creatures.every(c => c.acknowledgments === 0));
});

test('fixed steps agree across frame rates, zero-time updates pause, and reset preserves identity', () => {
 const a = new VeilRayStudy('quiet', 2), b = new VeilRayStudy('quiet', 2); a.playEncounter(); b.playEncounter();
 for (let i = 0; i < 63 * 30; i++) { a.update(1 / 30); b.update(1 / 60); b.update(1 / 60); }
 assert.deepEqual(a.creatures, b.creatures); assert.deepEqual(a.events, b.events);
 const snapshot = () => a.creatures.map(c => ({ pos: { ...c.pos }, stroke: c.stroke, energy: c.energy, state: c.state }));
 const before = snapshot(); a.update(0); assert.deepEqual(snapshot(), before);
 a.reset(); const fresh = new VeilRayStudy('quiet', 2); assert.deepEqual(a.creatures, fresh.creatures);
});
