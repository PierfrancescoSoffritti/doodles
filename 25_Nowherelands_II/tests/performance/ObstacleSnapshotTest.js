import test from 'node:test';
import assert from 'node:assert/strict';
import { ObstacleSnapshot } from '../../js/world/fauna/ObstacleSnapshot.js?v=stable-30-19';

test('obstacle snapshots preserve historical values through mutation, reorder and removal', () => {
 const cache = new ObstacleSnapshot();
 const source = [{position:{x:1,y:2,z:3},radius:4},{position:{x:-0,y:NaN,z:Infinity},radius:-Infinity}];
 const a = cache.capture(source);
 assert.equal(cache.capture(source.map(o=>({...o}))), a);
 source[0].position.x = 5;
 const b = cache.capture(source);
 assert.equal(a[0].position.x, 1); assert.equal(b[0].position.x, 5);
 assert.equal(a[1], b[1]); assert.notEqual(a[0], b[0]);
 source.reverse(); const c = cache.capture(source);
 assert.deepEqual(c, source); assert.equal(b[0].position.x, 5);
 source[0].position.x = 0; const d = cache.capture(source);
 assert.ok(Object.is(c[0].position.x, -0)); assert.notEqual(c, d);
 source.pop(); assert.equal(cache.capture(source).length, 1);
 assert.equal(cache.capture([]).length, 0);
});
