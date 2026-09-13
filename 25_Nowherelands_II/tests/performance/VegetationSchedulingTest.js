import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
	if (specifier === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
	if (specifier.startsWith('three/addons/')) return { url: new URL('../../../common/libs/three-0.185/examples/jsm/' + specifier.slice(13), import.meta.url).href, shortCircuit: true };
	return next(specifier, context);
} });
globalThis.location = { search: '?seed=scheduling' };
globalThis.matchMedia = () => ({ matches: false });
const { Terrain } = await import('../../js/world/Terrain.js?v=stable-30-26');
const { config } = await import('../../js/core/Config.js?v=stable-30-3');

function setup() {
	let returned = 0;
	const job = { return() { returned++; }, next() { throw Error('Expired budget must not advance construction'); } };
	const vegetation = { chunks: new Map(), farChunks: { has: () => true }, key: (x,z) => `${x},${z}`, farKey: (x,z) => `f${x},${z}`, update() {} };
	const terrain = { vegKey: '0,0', vegJob: job, vegJobCell: {x:0,z:0}, vegQueue: [], vegetation };
	return { terrain, job, returns: () => returned };
}

test('crossing a chunk boundary retains useful partial work without enqueueing it twice', () => {
	const { terrain, job, returns } = setup();
	Terrain.prototype.updateVegetation.call(terrain, {x:config.world.chunkSize,z:0}, 1/60, -Infinity);
	assert.equal(terrain.vegJob, job);assert.equal(returns(), 0);
	assert.ok(!terrain.vegQueue.some(e => !e.far && e.x === 0 && e.z === 0));
	assert.ok(terrain.vegQueue.length > 0, 'other missing chunks still queue');
});

test('leaving the retained chunk radius cancels the partial build exactly once', () => {
	const { terrain, returns } = setup();
	const position = {x:(config.world.vegetationRadius+1)*config.world.chunkSize,z:0};
	Terrain.prototype.updateVegetation.call(terrain, position, 1/60, -Infinity);
	assert.equal(returns(), 1);assert.equal(terrain.vegJob, null);assert.equal(terrain.vegJobCell, null);
	Terrain.prototype.updateVegetation.call(terrain, position, 1/60, -Infinity);
	assert.equal(returns(), 1);
});

test('extra streaming time is reserved for nearby unfinished work', () => {
	const { terrain } = setup(); terrain.vegJob=null;terrain.vegJobCell=null;
	const size=config.world.chunkSize;
	terrain.vegQueue=[{x:4,z:0}];
	assert.equal(Terrain.prototype.needsVegetationCatchUp.call(terrain,{x:0,z:0}),false);
	assert.equal(Terrain.prototype.needsVegetationCatchUp.call(terrain,{x:size*.75,z:0}),true);
	terrain.vegQueue=[{far:true,x:0,z:0}];
	assert.equal(Terrain.prototype.needsVegetationCatchUp.call(terrain,{x:0,z:0}),false);
	terrain.vegJob={};terrain.vegJobCell={x:2,z:0};
	assert.equal(Terrain.prototype.needsVegetationCatchUp.call(terrain,{x:0,z:0}),true);
});
