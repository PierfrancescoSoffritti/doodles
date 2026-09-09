import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLumenGrid, nearestLumen } from '../../js/world/fauna/LumenFlow.js';

test('neighbours cross negative cells and branch boundaries without attracting distant animals', () => {
	const c={id:'listener',prev:{x:-40.1,y:-.1,z:-40.1},branch:0};
	const near=Array.from({length:7},(_,id)=>({id,branch:1,prev:{x:c.prev.x+id+1,y:c.prev.y,z:c.prev.z}}));
	const far={id:'distant',prev:{x:6000,y:0,z:0}};
	const group={members:[c,...near,far]};buildLumenGrid(group);
	assert.deepEqual(nearestLumen(c,group).map(c=>c.id),[0,1,2,3,4,5,6]);
	assert.deepEqual(nearestLumen(far,group),[]);
	near[0].prev.x=8000;buildLumenGrid(group);
	assert.deepEqual(nearestLumen(c,group).map(c=>c.id),[1,2,3,4,5,6]);
});
