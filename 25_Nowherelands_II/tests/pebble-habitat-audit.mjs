import { buildCaveMeshes } from '../js/world/caves/CaveMeshData.js';
import { CaveFloorSurface } from '../js/world/caves/CaveFloorSurface.js';
// Real generated caves and mountain lakes, including underground support and locomotion.
import assert from 'node:assert/strict';
import { generateWorld } from '../js/world/gen/WorldGen.js';
import { generateCaves } from '../js/world/caves/CaveGen.js';
import { CaveField } from '../js/world/caves/CaveField.js';
import { erodeEntrances, EntranceTerrain } from '../js/world/caves/EntranceTerrain.js';
import { entranceHabitat } from '../js/world/caves/EntranceHabitat.js';
import { FaunaModel } from '../js/world/fauna/FaunaModel.js';
import { lumenLakes } from '../js/world/fauna/LumenSchool.js';
import { pebbleHabitatSites } from '../js/world/fauna/PebbleHabitats.js';
const seed = process.argv[3] || 'umbra'; globalThis.location = { search: '?seed=' + seed };
const { Heightmap } = await import('../js/world/Heightmap.js');
const world = generateWorld(seed, null, { res: Number(process.argv[2] || 512) }), hm = new Heightmap(seed, world);
world.caves = generateCaves(hm, seed); world.caveTerrain = erodeEntrances(hm, world.caves);
hm.entranceTerrain = new EntranceTerrain(world.caveTerrain); world.caveHabitat = entranceHabitat(hm, world.caves);
hm.caves = new CaveField(world.caves, world.caveHabitat.flatMap(h => h.rocks));
hm.caveFloorSurface=new CaveFloorSurface(buildCaveMeshes(hm,world.caves));
const sample = (x, z) => {
	const ground = hm.sample(x, z), water = hm._water, slope = hm._slope, hardness = hm._hardness, foam = hm._foam;
	const hab = hm.habitat(x, z), roof = hm.caves.surfaceDensity(x, ground, z) > -2;
	return { ground, water, slope, hardness, foam, roof, forest: hab.forest, wet: hab.wet, coast: hab.coast };
};
const sites = pebbleHabitatSites(world, lumenLakes(world, sample), hm, sample), reports = [];
const exercised = new Map();
for (const site of sites.filter(s => !process.argv[4] || s.id === process.argv[4])) {
	const model = new FaunaModel(seed, { sample }), at = site.sample || sample;
	const group = model.addGroup(`pebble-site:${site.id}`, 'hopper', site.x, site.z, site.radius, site);
	if (!group) { reports.push({ id: site.id, habitat: site.habitat, count: 0 }); continue; }
	let underground = 0; const origins = group.members.map(c => ({ ...c.pos }));
	for (const c of group.members) if (c.ground < sample(c.pos.x, c.pos.z).ground - 5) underground++;
	const maxDistance=group.members.map(()=>0);
	const c = group.members[0]; model.listener = { x: c.pos.x + 4, y: c.ground + 11, z: c.pos.z };
	const run = (exercised.get(site.habitat) || 0) < 2;
	if (run) { exercised.set(site.habitat, (exercised.get(site.habitat) || 0) + 1); console.error(`Checking ${site.id}: ${group.members.length} animals`); }
	for (let frame = 0; frame < (run ? 450 : 1); frame++) {
		model.step(1 / 30);
		for (const [i,o] of group.members.entries()) {
			maxDistance[i]=Math.max(maxDistance[i],Math.hypot(o.pos.x-origins[i].x,o.pos.z-origins[i].z));
			const s = at(o.pos.x, o.pos.z);
			assert.ok([o.yaw,o.pitch,o.bank,o.pebble.restPitch,o.pebble.restBank].every(Number.isFinite),`${site.id}: invalid body rotation at frame ${frame}`);
			assert.ok(Object.values(o.pos).every(Number.isFinite), `${site.id}: nonfinite`);
			assert.ok(Math.abs(o.ground - s.ground) < 0.1, `${site.id}: wrong floor`);
			assert.ok(o.pos.y >= s.ground + 0.5 * o.size - 0.03, `${site.id}: sank`);
			assert.ok(s.cave ? o.pos.y >= s.water - .8 * o.size - .001 : s.ground > s.water + .4, `${site.id}: lost swimming depth`);
			if (['rest','settle'].includes(o.pebble.state)) assert.ok(s.ground >= s.water + .7, `${site.id}: resting in water`);
		}
	}
	reports.push({ id: site.id, habitat: site.habitat, count: group.members.length, underground, exercised: run,
		states: group.members.map(c => c.pebble.state), escapes: group.members.map(c => c.pebble.escapes), alarms: group.members.map(c => c.pebble.alarmAt),
		moved: maxDistance.filter(d=>d>4).length, maxDistance,
		distances: group.members.map((c, i) => +Math.hypot(c.pos.x - origins[i].x, c.pos.z - origins[i].z).toFixed(1)) });
}
const categories = Object.fromEntries(['cave entrance', 'cave interior', 'mountain lakeshore'].map(h => [h, reports.filter(r => r.habitat === h && r.count > 0).length]));
console.log(JSON.stringify({ seed, res: world.res, categories, reports }, null, 2));
if (!process.argv[4]) for (const [habitat, count] of Object.entries(categories)) assert.ok(count > 0, `No usable ${habitat} colonies`);
if (!process.argv[4]) assert.ok(reports.some(r => r.habitat === 'cave interior' && r.underground === r.count && r.count > 0), 'No genuinely underground animals');

assert.ok(reports.filter(r => r.exercised).every(r => r.moved === r.count), 'Every animal in the exercised colonies must escape');
