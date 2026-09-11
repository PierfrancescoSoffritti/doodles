import test from 'node:test';
import assert from 'node:assert/strict';
import { LanternMiteStudy } from '../../js/world/fauna/LanternMiteStudy.js?v=pebble-voice-4b';

const advance = (model, seconds, observe = () => {}) => {
 for (let i = 0; i < Math.round(seconds * 60); i++) { model.update(1 / 60); observe(model); }
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('the encounter earns one approach, a delayed answer, a dim retreat and a staggered recovery', () => {
 const model = new LanternMiteStudy(); model.playEncounter();
 const states = new Set(), calls = new Map(), emerged = new Map();
 advance(model, 35.1, m => {
  for (const mite of m.mites) {
   states.add(mite.state);
   if (mite.state === 'investigate') assert.equal(mite.bold, true, 'the whole colony never follows');
   if (mite.state === 'emerge' && !emerged.has(mite.id)) emerged.set(mite.id, m.time);
  }
  for (const event of m.events) calls.set(`${event.id}:${event.time}`, event);
  if (m.time > 22 && m.time < 25) {
   assert.ok(m.mites.every(mite => mite.state === 'hidden'));
   assert.ok(m.mites.every(mite => mite.brightness < 0.02));
  }
 });
 for (const state of ['notice', 'investigate', 'contact', 'retreat', 'hidden', 'emerge', 'rest']) assert.ok(states.has(state), state);
 const call = [...calls.values()].find(e => e.id === 2 && !e.reply && e.kind === 'visitor');
 const reply = [...calls.values()].find(e => e.reply && e.kind === 'visitor' && e.time > call.time);
 assert.ok(reply.time - call.time > 1 && reply.time - call.time < 2.5);
 assert.equal(emerged.size, 5);
 assert.ok(Math.max(...emerged.values()) - Math.min(...emerged.values()) > 2);
 assert.equal(model.demo, false);
 assert.equal(model.visitor.z, 7);
});

test('manual approach and stillness produce curiosity without the scripted encounter', () => {
 const model = new LanternMiteStudy();
 model.command('approach'); advance(model, 2);
 assert.ok(model.mites.every(m => m.state !== 'investigate'));
 model.command('wait');
 const stopped = model.visitor.z; advance(model, 3);
 assert.equal(model.visitor.z, stopped);
 assert.ok(model.mites.every(m => m.state !== 'investigate'));
 advance(model, 10);
 assert.ok(model.mites[2].visitorContacts > 0);
 assert.equal(model.demo, false);
 model.command('leave'); advance(model, 9);
 assert.ok(model.mites.every(m => !['investigate', 'contact', 'notice'].includes(m.state)));
 assert.ok(model.mites.every(m => m.pos.z < 2), 'everyone returns to the home patch, including feeding journeys');
});

test('an alarm cancels a pending answer and repeated disturbances delay emergence', () => {
 const model = new LanternMiteStudy(); model.command('approach');
 for (let i = 0; i < 1200 && model.mites[2].visitorContacts === 0; i++) model.update(1 / 60);
 assert.equal(model.mites[2].visitorContacts, 1);
 assert.ok(model.mites.some(m => Number.isFinite(m.replyAt)));
 const callsBeforeAlarm = model.mites.map(m => m.contacts);
 model.command('startle'); advance(model, 3);
 assert.ok(model.mites.every(m => m.state === 'hidden'));
 assert.deepEqual(model.mites.map(m => m.contacts), callsBeforeAlarm, 'fear cancels scheduled replies');
 model.command('startle'); advance(model, 5);
 assert.ok(model.mites.every(m => m.state === 'hidden'));
 advance(model, 10);
 assert.ok(model.mites.every(m => !['hidden', 'retreat', 'emerge'].includes(m.state)));
});

test('distant movement leaves the colony alone and autonomous excursions stay close to home', () => {
 const model = new LanternMiteStudy(); model.command('startle');
 assert.equal(model.alarmUntil, 0);
 const seen = new Set();
 advance(model, 120, m => {
  for (const mite of m.mites) {
   seen.add(mite.state);
   assert.ok(distance(mite.pos, mite.perch) < 3, 'feeding and neighbor visits remain within the hollow');
   assert.ok(!['investigate', 'contact', 'hidden', 'retreat'].includes(mite.state));
  }
 });
 assert.ok(seen.has('forage') && seen.has('rest') && seen.has('return'));
});

test('repeated encounters remain finite, continuous and contained', () => {
 for (const seed of ['root-hollow', 'moss', 'rain']) {
  const model = new LanternMiteStudy(seed); let previous = model.mites.map(m => ({ ...m.pos }));
  for (let frame = 0; frame < 60 * 180; frame++) {
   if (frame % 1800 === 0) model.command('approach');
   if (frame % 1800 === 1100) model.command('startle');
   if (frame % 1800 === 1600) model.command('leave');
   model.update(1 / 60);
   model.mites.forEach((m, i) => {
    assert.ok(Object.values(m.pos).every(Number.isFinite));
    assert.ok(distance(previous[i], m.pos) <= 0.071, 'no teleport on state changes');
    assert.ok(m.pos.y >= 0.2 && m.pos.y <= 1.6 && Math.abs(m.pos.x) < 2.5 && Math.abs(m.pos.z) < 2.4);
    assert.ok(m.brightness >= 0 && m.brightness < 1.3);
   });
   previous = model.mites.map(m => ({ ...m.pos }));
  }
 }
});

test('the hollow stays visibly active with or without a quiet visitor, and every mite still rests', () => {
 for (const nearby of [false, true]) for (const seed of ['root-hollow', 'moss', 'rain']) {
  const model = new LanternMiteStudy(seed);
  if (nearby) model.command('approach');
  advance(model, 10);
  let activeFrames = 0, frames = 0;
  const travel = model.mites.map(() => 0), rest = model.mites.map(() => 0);
  let previous = model.mites.map(m => ({ ...m.pos }));
  advance(model, 90, m => {
   let moving = 0;
   for (const mite of m.mites) {
    const d = distance(mite.pos, previous[mite.id]); travel[mite.id] += d;
    if (d * 60 > 0.08) moving++;
    if (mite.state === 'rest') rest[mite.id]++;
   }
   activeFrames += moving >= 2; frames++;
   previous = m.mites.map(mite => ({ ...mite.pos }));
  });
  assert.ok(activeFrames / frames > 0.75, `${seed}: multiple animals visibly moving during most of the encounter`);
  assert.ok(travel.every(d => d > 20), 'no individual parks indefinitely beside a quiet visitor');
  assert.ok(rest.every(n => n > 60 && n / frames < 0.35), 'real but brief rests, rather than perpetual flight');
 }
});

test('neighbor visits travel before a call and answers stay delayed and bounded', () => {
 const model = new LanternMiteStudy();
 const visits = new Map(), callers = new Set();
 let previousEvents = new Set(), socialCalls = 0, replies = 0;
 advance(model, 120, m => {
  for (const mite of m.mites) {
   if (mite.state === 'visit' && !visits.has(mite.id)) visits.set(mite.id, { ...mite.pos });
  }
  const currentEvents = new Set();
  for (const event of m.events) {
   const key = `${event.id}:${event.time}`; currentEvents.add(key);
   if (previousEvents.has(key) || event.kind !== 'social') continue;
   if (event.reply) { replies++; continue; }
   socialCalls++; callers.add(event.id);
   assert.ok(visits.has(event.id));
   assert.ok(distance(visits.get(event.id), m.mites[event.id].pos) > 0.15, 'a visit involves actual travel');
   const pending = m.mites.filter(mite => Number.isFinite(mite.replyAt));
   assert.equal(pending.length, 1, 'one answering neighbor, not a chorus');
   assert.ok(pending[0].replyAt - m.time > 1);
   visits.delete(event.id);
  }
  previousEvents = currentEvents;
 });
 assert.ok(socialCalls >= 8 && socialCalls <= 18);
 assert.ok(callers.size >= 3, 'social exchanges are shared across the colony');
 assert.ok(replies >= socialCalls - 1 && replies <= socialCalls);
});

test('reset reproduces the fixture and 30/60 Hz callers agree', () => {
 const a = new LanternMiteStudy(), b = new LanternMiteStudy();
 a.playEncounter(); b.playEncounter();
 for (let frame = 0; frame < 35 * 30; frame++) { a.update(1 / 30); b.update(1 / 60); b.update(1 / 60); }
 assert.deepEqual(a.mites.map(m => m.pos), b.mites.map(m => m.pos));
 assert.deepEqual(a.mites.map(m => m.contacts), b.mites.map(m => m.contacts));
 a.reset(); const initial = new LanternMiteStudy();
 assert.deepEqual(a.mites, initial.mites);
 assert.equal(a.time, 0); assert.equal(a.events.length, 0); assert.equal(a.demo, false);
});
