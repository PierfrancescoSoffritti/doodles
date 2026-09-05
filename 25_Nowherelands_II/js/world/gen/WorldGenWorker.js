import { entranceHabitat } from '../caves/EntranceHabitat.js';
import { generateWorld } from './WorldGen.js';
import { Heightmap } from '../Heightmap.js';
import { generateCaves } from '../caves/CaveGen.js';
import { erodeEntrances, EntranceTerrain } from '../caves/EntranceTerrain.js';
import { buildCaveMeshes } from '../caves/CaveMeshData.js';

// Bakes the world off the main thread. One message in (seed, options), progress out, then the
// finished world with its typed arrays transferred rather than copied.
self.onmessage = (e) => {
	const { seed, opts } = e.data;
	let last = 0;
	const world = generateWorld(seed, (label, p) => {
		const now = performance.now();
		if (now - last < 40 && p < 1) return;
		last = now;
		self.postMessage({ type: 'progress', label, p });
	}, opts);
	self.postMessage({type:'progress',label:'opening the deep',p:.96});
	const heightmap=new Heightmap(seed,world);
	world.caves=generateCaves(heightmap,seed);
	world.caveTerrain=erodeEntrances(heightmap,world.caves);
	heightmap.entranceTerrain=new EntranceTerrain(world.caveTerrain);
	world.caveHabitat=entranceHabitat(heightmap,world.caves);
	const caveMeshes=buildCaveMeshes(heightmap,world.caves,p=>self.postMessage({type:'progress',label:'carving caverns',p:.96+p*.035}));
	delete world.area;
	const transfer = [world.height.buffer, world.lakeLevel.buffer, world.lakeId.buffer, world.rock.buffer, world.habitat.buffer];
	for(const p of world.caveTerrain)transfer.push(p.delta.buffer,p.mask.buffer);
	for (const l of world.lakes) transfer.push(l.cells.buffer);
	for (const r of world.rivers) transfer.push(r.data.buffer, r.rocks.buffer, r.wakes.buffer);
	for (const group of [caveMeshes.chunks,caveMeshes.decorations,caveMeshes.water]) for (const mesh of group) for(const value of Object.values(mesh)) if(ArrayBuffer.isView(value)) transfer.push(value.buffer);
	self.postMessage({ type: 'done', world, caveMeshes }, transfer);
};
