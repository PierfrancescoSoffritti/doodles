import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generateWorld } from '../../js/world/gen/WorldGen.js';
import { terrainMeshSteps } from '../../js/world/TerrainMeshData.js';
import { shoreTileSteps } from '../../js/world/ShoreTileData.js';
import { WaterMeshData } from '../../js/world/WaterMeshData.js';

function hash(value) {
 const h = createHash('sha256');
 function visit(v) {
  if (ArrayBuffer.isView(v)) {
   h.update(v.constructor.name); h.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  } else if (v && typeof v === 'object') {
   for (const [key, item] of Object.entries(v)) { h.update(key); visit(item); }
  } else h.update(JSON.stringify(v));
 }
 visit(value); return h.digest('hex');
}

test('interleaved heightmap access preserves geometry and shore data from the synchronous implementation', async () => {
 const previous = globalThis.location;
 globalThis.location = { search: '?seed=fern' };
 try {
  const { Heightmap } = await import('../../js/world/Heightmap.js');
  const hm = new Heightmap('fern', generateWorld('fern', null, { res: 128 }));
  const water = new WaterMeshData(hm);
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/cooperative-surface.json', import.meta.url)));
  for (const row of fixtures) {
   const work = row.kind === 'terrain' ? terrainMeshSteps(hm, ...row.args)
    : row.kind === 'water' ? water.buildNearSteps(...row.args) : shoreTileSteps(hm, ...row.args);
   let slices = 0;
   for (;;) {
    const step = work.next();
    if (step.done) { assert.equal(hash(step.value), row.hash, row.kind); break; }
    slices++;
    // The simulation uses this same scratch-bearing heightmap between jobs.
    hm.sample(Math.sin(slices) * 3000, Math.cos(slices) * 3000);
    hm.habitat(slices * .123, slices * -.7);
   }
   assert.ok(slices > 1, `${row.kind} must make progress in multiple slices`);
  }
 } finally { globalThis.location = previous; }
});
