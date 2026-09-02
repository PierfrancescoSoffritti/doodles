import { generateWorld } from './WorldGen.js';

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
	delete world.area;
	const transfer = [world.height.buffer, world.lakeLevel.buffer, world.lakeId.buffer, world.rock.buffer, world.habitat.buffer];
	for (const l of world.lakes) transfer.push(l.cells.buffer);
	for (const r of world.rivers) transfer.push(r.data.buffer, r.rocks.buffer, r.wakes.buffer);
	self.postMessage({ type: 'done', world }, transfer);
};
