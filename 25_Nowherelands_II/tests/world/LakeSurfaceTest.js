import test from 'node:test';
import assert from 'node:assert/strict';
import { LakeSurface, clipShore } from '../../js/world/LakeSurface.js';
import { reconnectLakeBasins } from '../../js/world/gen/WorldGen.js';
import { RIVER_STRIDE as S, RV } from '../../js/world/gen/Rivers.js';

function basin() {
	const N = 8, ids = new Int32Array(N * N).fill(-1), height = new Float32Array(N * N).fill(20);
	const drainageLevel = new Float32Array(N * N), cells = [];
	for (let j = 2; j <= 5; j++) for (let i = 2; i <= 5; i++) {
		const k = j * N + i; ids[k] = 0; height[k] = 0; drainageLevel[k] = 10; cells.push(k);
	}
	return { res: N, cell: 10, size: 70, spawn: { x: 0, z: 0 }, lakeId: ids, height, drainageLevel, lakes: [{ id: 0, level: 10, cells }], rivers: [] };
}

test('basin reconnects an enclosed low pocket without flooding downhill', () => {
	const world = basin(), pocket = 3 * 8 + 6, downhill = 4 * 8 + 6;
	world.height[pocket] = world.height[downhill] = 2;
	world.drainageLevel[pocket] = 10;
	reconnectLakeBasins(world.height, world.lakes, world.lakeId, new Float32Array(64), world.drainageLevel, world.res);
	const lake = new LakeSurface(world);
	assert.equal(lake.ids[pocket], 0);
	assert.equal(lake.ids[downhill], -1);
	assert.equal(lake.levelAt(0, 0), 10);
	assert.ok(lake.levelAt(25, 5) < 0);
});

test('lake surface stops at the outlet lip and fills its upstream throat', () => {
	const world = basin(), data = new Float32Array(2 * S);
	data[RV.X] = 15; data[S + RV.X] = 35;
	data[RV.W] = 12; data[RV.D] = 2; data[RV.BANK] = 1;
	world.rivers.push({ fromLake: 0, count: 2, data });
	const lake = new LakeSurface(world);
	assert.ok(lake.coverage(0, 14, 0) > 0);
	assert.ok(lake.coverage(0, 16, 0) < 0);
	assert.ok(lake.coverage(0, 25, 0) < 0);
});

test('shoreline clipping preserves submerged triangles and trims crossing edges', () => {
	const triangle = [[-2, 0], [2, 0], [-2, 4]];
	const clipped = clipShore(triangle, ([x]) => -x);
	assert.equal(clipped.length, 4);
	assert.ok(clipped.every(([x]) => x <= 0.02));
	assert.deepEqual(clipShore(triangle, () => 1), triangle);
	assert.deepEqual(clipShore(triangle, () => -1), []);
});

test('inlet coverage and mesh candidates include the full channel outside the lake grid', () => {
	const world = basin(), data = new Float32Array(2 * S);
	for (let i = 0; i < 2; i++) {
		data[i * S + RV.X] = 25 - i * 10; data[i * S + RV.WL] = 10;
		data[i * S + RV.W] = 18; data[i * S + RV.D] = 2; data[i * S + RV.BANK] = 1;
		data[i * S + RV.ALONG] = i * 10;
	}
	world.rivers.push({ toLake: 0, count: 2, data });
	const lake = new LakeSurface(world);
	assert.equal(lake.levelAt(25, 0), 10);
	assert.ok(lake.cells[0].includes(3 * 8 + 6));
});

test('a channel returning to its source lake does not cut a false outlet', () => {
	const world = basin(), data = new Float32Array(2 * S);
	data[RV.X] = -10; data[S + RV.X] = 10;
	data[RV.W] = data[S + RV.W] = 12;
	world.rivers.push({ fromLake: 0, toLake: 0, count: 2, data });
	const lake = new LakeSurface(world);
	assert.equal(lake.outlets.size, 0);
	assert.equal(lake.levelAt(0, 0), 10);
});

test('the whole lake-level reach and submerged tributaries share one lake surface', () => {
	const world = basin();
	world.res = 32; world.cell = 10; world.size = 310;
	world.lakeId = new Int32Array(1024).fill(-1);
	world.lakes[0].cells = [];
	for (let z = 12; z <= 20; z++) for (let x = 16; x <= 24; x++) { const k = z * 32 + x; world.lakeId[k] = 0; world.lakes[0].cells.push(k); }
	const data = new Float32Array(12 * S);
	for (let i = 0; i < 12; i++) {
		data[i * S] = -100 + i * 10; data[i * S + RV.WL] = 10;
		data[i * S + RV.W] = 8; data[i * S + RV.D] = 2; data[i * S + RV.BANK] = 1; data[i * S + RV.ALONG] = i * 10;
	}
	const tributary = data.slice(0, 2 * S); tributary[RV.Z] = 10; tributary[S + RV.WL] = 9.7;
	world.rivers = [{ toLake: 0, count: 12, data }, { parentId: 0, count: 2, data: tributary }];
	const lake = new LakeSurface(world);
	assert.equal(lake.receivingLake[1], 0);
	for (let x = -100; x <= 10; x++) assert.equal(lake.levelAt(x, 0), 10, 'lake coverage cannot stop after an arbitrary mouth length');
});

test('drainage cannot leave detached pieces of lake beside its outlet', () => {
	const N = 12, ids = new Int32Array(N * N).fill(-1), cells = [];
	for (let z = 2; z <= 6; z++) for (let x = 2; x <= 5; x++) { const k = z * N + x; ids[k] = 0; cells.push(k); }
	for (let x = 6; x <= 9; x++) { const k = 4 * N + x; ids[k] = 0; cells.push(k); }
	const data = new Float32Array(2 * S);
	data[0] = data[S] = 5; data[1] = -25; data[S + 1] = 15;
	data[RV.WL] = 10; data[S + RV.WL] = 2;
	for (let i = 0; i < 2; i++) { data[i * S + RV.W] = 8; data[i * S + RV.D] = 2; data[i * S + RV.BANK] = 1; }
	const lake = new LakeSurface({ res: N, cell: 10, size: 110, spawn: { x: 0, z: 0 }, lakeId: ids, lakes: [{ id: 0, level: 10, cells }], rivers: [{ count: 2, fromLake: 0, data }] });
	assert.equal(lake.levelAt(-20, -20), 10);
	assert.ok(lake.coverage(0, 35, -15) < 0);
	assert.ok(lake.fillDisconnected(35, -15, 2) > 10, 'discarded water must become bank, not an empty pit');
});

test('raised terrain separates a stranded pool even when its lake mask stays connected', () => {
	const lake = new LakeSurface(basin(), false);
	lake.resolveConnectivity((x) => x > 5 && x < 10 ? 12 : 0);
	assert.equal(lake.levelAt(0, 0), 10);
	assert.ok(lake.coverage(0, 15, 0) < 0);
	assert.ok(lake.fillDisconnected(15, 0, 0) > 10);
	assert.equal(lake.fillDisconnected(0, 0, 0), 0);
});
