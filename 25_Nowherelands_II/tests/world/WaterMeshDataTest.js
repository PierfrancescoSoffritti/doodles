import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterMeshData, nearCoverageRadius, NEAR_RADIUS, NEAR_BUILD } from '../../js/world/WaterMeshData.js';

function lakeFixture() {
	const N = 16, cell = 16, size = 240, cells = [];
	for (let z = 4; z <= 11; z++) for (let x = 4; x <= 11; x++) cells.push(z * N + x);
	const world = { res: N, cell, size, spawn: { x: 0, z: 0 }, rivers: [], lakes: [{ id: 0, level: 5, cells }, { id: 1, level: 8, cells: [] }] };
	return { world, ox: 0, oz: 0, height: () => 0, gx: x => (x + size / 2) / cell, gz: z => (z + size / 2) / cell,
		rivers: { segmentsIn: () => new Set() },
		lakes: { cells: [cells, []], joinCells: new Map(), coverage: (id,x,z) => Math.min(56 - Math.abs(x), 56 - Math.abs(z)), waveWeight: () => 1 } };
}

function area(mesh) {
	const p = mesh.attributes.position.array, indices = mesh.index; let sum = 0;
	for (let i = 0; i < indices.length; i += 3) {
		const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
		sum += Math.abs((p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (p[b + 2] - p[a + 2])) * 0.5;
	}
	return sum;
}

test('indexed lake vertices preserve shoreline area with fewer transferable vertices', () => {
	const builder = new WaterMeshData(lakeFixture());
	assert.equal(builder.lakeGrids.length, 1, 'empty disconnected basins need no masks');
	for (const mesh of [builder.buildStatic(), builder.buildNear(0,0)]) {
		const count = mesh.attributes.position.array.length / 3;
		assert.ok(count < mesh.index.length / 3, 'adjacent triangles should share vertices');
		// Seven shoreline bisections put an edge within half a sub-cell / 128.
		const areaTolerance = 4 * 112 * (8 / 256) + 0.01;
		assert.ok(Math.abs(area(mesh) - 112 * 112) < areaTolerance, `area ${area(mesh)}`);
		for (const a of Object.values(mesh.attributes)) { assert.equal(a.array.length, count * a.size); assert.ok(a.array.every(Number.isFinite)); }
		assert.ok(mesh.index.every(i => i < count));
	}
	assert.equal(builder.buildNear(5000, 5000).index.length, 0, 'remote basins must not enter a local build');
});

test('water keeps complete coverage while detail streams or the camera teleports', () => {
	assert.equal(nearCoverageRadius(0,0,0,0), NEAR_RADIUS);
	assert.equal(nearCoverageRadius(0,0,40,0), NEAR_RADIUS);
	for (let distance = 0; distance < 400; distance += 10) {
		const radius = nearCoverageRadius(0,0,distance,0);
		assert.ok(radius >= 0 && radius <= NEAR_RADIUS);
		if (radius) assert.ok(radius + distance < NEAR_BUILD, 'near detail cannot claim uncovered pixels');
	}
	assert.equal(nearCoverageRadius(0,0,5000,5000), 0, 'the static surface must cover a teleport immediately');
});

test('a worker-style world clone preserves terrain, lake coverage and large-wood wakes', async () => {
	globalThis.location = { search: '?seed=umbra' }; // Workers have location, but no window/matchMedia.
	const [{ generateWorld }, { Heightmap }, { WatersideFeatures }] = await Promise.all([
		import('../../js/world/gen/WorldGen.js'), import('../../js/world/Heightmap.js'), import('../../js/world/WatersideFeatures.js')
	]);
	const world = generateWorld('umbra', null, { res: 256 });
	const heightmap = new Heightmap('umbra', world);
	new WatersideFeatures(heightmap, 'umbra');
	const clone = new Heightmap('umbra', structuredClone(world));
	const local = new WaterMeshData(heightmap), remote = new WaterMeshData(clone);
	const river = world.rivers.find(r => r.count > 10);
	assert.ok(river);
	const x = river.data[0], z = river.data[1];
	const expected = local.buildNear(x, z), actual = remote.buildNear(x, z);
	assert.ok(expected.index.length > 0);
	assert.deepEqual(actual, expected);
	const packed = structuredClone(actual, { transfer: [...Object.values(actual.attributes).map(a => a.array.buffer), actual.index.buffer] });
	assert.equal(actual.index.byteLength, 0, 'worker messages transfer ownership instead of copying large buffers');
	assert.deepEqual(packed, expected);
});
