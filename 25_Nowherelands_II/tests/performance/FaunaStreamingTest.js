import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
 if (s === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
 return next(s, c);
} });
globalThis.location = { search: '?seed=stream' };
const { Fauna } = await import('../../js/world/fauna/Fauna.js?v=stable-30-25');
const { FaunaModel } = await import('../../js/world/fauna/FaunaModel.js?v=stable-30-25');
const sample = () => ({ ground: 2, water: -4, slope: .08, forest: .1, wet: .2, hardness: .8, foam: 0 });
const position = { x: 0, y: 3, z: 0 };
const finish = work => { for (;;) { const s = work.next(); if (s.done) return s.value; } };
function fixture() {
 const f = Object.create(Fauna.prototype);
 Object.assign(f, { model: new FaunaModel('stream', { sample }), shared: { caveAmount: 0 },
  cells: new Set(), lakes: [{}], pebbleSites: [], pebbleSiteRetries: new Map(),
  pebbleTour: { remember() {} }, refreshObstacles() {}, streamRays() {} });
 return f;
}

test('cancelling a habitat search leaves its cell eligible for retry', () => {
 const f = fixture();
 // Force a slow failed habitat search for any species chosen for this cell.
 f.model.addGroupSteps = function* () { for (let i = 0; i < 100; i++) yield; return null; };
 const work = f.streamSteps(position);
 assert.equal(work.next().done, false); work.return();
 assert.equal(f.cells.size, 0);
 finish(f.streamSteps(position)); assert.equal(f.cells.size, 1);
});

test('cancelled authored-site preparation does not publish members or impose a retry delay', () => {
 const f = fixture();
 f.pebbleSites = [{ id: 'site', x: 0, y: 3, z: 0, radius: 10 }];
 const work = f.streamPebbleSitesSteps(position);
 for (let i = 0; i < 100; i++) assert.equal(work.next().done, false);
 work.return();
 assert.equal(f.model.groups.size, 0); assert.equal(f.model.creatures.length, 0);
 assert.equal(f.pebbleSiteRetries.size, 0);
 finish(f.streamPebbleSitesSteps(position));
 assert.ok(f.model.groups.has('pebble-site:site'));
 assert.equal(f.pebbleSiteRetries.get('site'), 15);
});
