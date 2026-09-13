import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaModel, SPECIES } from '../../js/world/fauna/FaunaModel.js?v=stable-30-25';
import { prepareFaunaGroup } from '../../js/world/fauna/PrepareFaunaGroup.js?v=stable-30-25';

const sample = () => ({ ground: 2, water: -4, slope: .08, forest: .1, wet: .2, hardness: .8, foam: 0 });
const model = seed => new FaunaModel(seed, { sample });
function finish(work) { for (;;) { const step = work.next(); if (step.done) return step.value; } }
function start(m, id = 'new') { const work = prepareFaunaGroup(m, id, 'hopper', 0, 0, 10); assert.equal(work.next().done, false); return work; }

// Include random generators and shared group/member references in the comparison.
function graph(value) {
 const ids = new Map(), nodes = [];
 function ref(v) {
  if (typeof v === 'function') return 'function';
  if (!v || typeof v !== 'object') return v;
  if (ids.has(v)) return { ref: ids.get(v) };
  const id = nodes.length; ids.set(v, id); nodes.push(null);
  nodes[id] = v instanceof Map ? { map: [...v].map(([k, a]) => [ref(k), ref(a)]) } :
   Array.isArray(v) ? v.map(ref) : Object.fromEntries(Object.keys(v).sort().map(k => [k, ref(v[k])]));
  return { ref: id };
 }
 ref(value); return nodes;
}

test('staged colony stays private and preserves seeded construction and subsequent motion', () => {
 for (let i = 0; i < 8; i++) {
  const before = model(`staged-${i}`), after = model(`staged-${i}`);
  before.time = after.time = 13;
  before.listener = after.listener = { x: 300, y: 12, z: 300 };
  const args = ['colony', 'hopper', i * 7, i * -4, 100];
  if (i % 2) args.push({ sample: () => ({ ...sample(), cave: true, clearance: 10 }), habitat: 'cave' });
  const expected = before.addGroup(...args), work = prepareFaunaGroup(after, ...args);
  let slices = 0;
  for (;;) {
   const step = work.next();
   if (step.done) { assert.equal(!!step.value, !!expected); break; }
   slices++; assert.equal(after.creatures.length, 0); assert.equal(after.groups.size, 0);
  }
  assert.ok(slices > 70);
  assert.deepEqual(graph(after.groups), graph(before.groups));
  assert.deepEqual(graph(after.creatures), graph(before.creatures));
  for (let j = 0; j < 240; j++) { before.step(1 / 30); after.step(1 / 30); }
  assert.deepEqual(graph(after.groups), graph(before.groups));
 }
});

test('commit preserves live movement, newly added groups, and removal during construction', () => {
 const m = model('membership'), old = m.addGroup('old', 'hopper', 0, 0, 10);
 assert.ok(old?.members.length);
 const work = start(m), survivor = old.members[0];
 survivor.pos.x = 12345;
 const removed = old.members[1];
 m.creatures = m.creatures.filter(c => c !== removed);
 old.members = old.members.filter(c => c !== removed);
 const added = { id: 'unrelated', kind: 'ray', members: [] };
 m.groups.set(added.id, added);
 const result = finish(work);
 assert.ok(result?.members.length);
 assert.equal(m.creatures.find(c => c === survivor).pos.x, 12345);
 assert.ok(!m.creatures.includes(removed));
 assert.equal(m.groups.get(added.id), added);
 assert.equal(m.creatures.length, old.members.length + result.members.length);
 const next = start(m, 'third');
 m.groups.delete('old'); m.creatures = m.creatures.filter(c => c.group !== old);
 finish(next);
 assert.ok(!m.groups.has('old')); assert.ok(!m.creatures.includes(survivor));
});

test('cancellation never publishes a partially initialized colony', () => {
 const m = model('cancel'), work = start(m);
 for (let i = 0; i < 100; i++) assert.equal(work.next().done, false);
 work.return();
 assert.equal(m.creatures.length, 0); assert.equal(m.groups.size, 0);
});

test('capacity and ID races are checked against current membership at commit', () => {
 const m = model('capacity'), work = start(m);
 m.creatures = Array.from({ length: SPECIES.hopper.cap }, () => ({ kind: 'hopper' }));
 assert.equal(finish(work), null);
 assert.equal(m.creatures.length, SPECIES.hopper.cap); assert.equal(m.groups.size, 0);
 const race = model('identity'), pending = start(race);
 const existing = { id: 'new', members: [], kind: 'hopper' };
 race.groups.set(existing.id, existing);
 assert.equal(finish(pending), existing); assert.equal(race.creatures.length, 0);
});

test('requesting another lumen ID does not duplicate or alias the existing flock', () => {
 const m = new FaunaModel('flock', { sample: () => ({ ...sample(), water: 10 }) });
 const flock = m.addGroup('original', 'lumen', 0, 0, 10), members = m.creatures.slice();
 assert.ok(flock?.members.length);
 assert.equal(finish(prepareFaunaGroup(m, 'alias', 'lumen', 0, 0, 10)), flock);
 assert.equal(m.groups.size, 1); assert.ok(!m.groups.has('alias'));
 assert.deepEqual(m.creatures, members);
});
