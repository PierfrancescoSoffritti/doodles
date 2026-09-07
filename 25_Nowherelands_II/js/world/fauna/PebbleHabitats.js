// Cave colonies own a floor sampler. A two-dimensional surface height cannot
// distinguish a gallery from the mountain directly above it.
export function pebbleCaveSampler(hm, surfaceSample, cave, anchorY) {
	const cache = new Map(), entrances = cave.entrances || [cave.entrance];
	const floor = (x, z) => {
		const surface = surfaceSample(x, z);
		const sections = hm.caves.candidates(x, z).filter(s => s.cave.id === cave.id)
			.map(s => hm.caves.section(s, x, z)).filter(q => q.wall > 1.8 && Math.abs(q.floor - anchorY) < 100)
			.sort((a, b) => Math.abs(a.floor - anchorY) - Math.abs(b.floor - anchorY));
		for (const q of sections) {
			const column = hm.caves.column(x, z, q.floor + 3, 2);
			if (!column || column.floor >= surface.ground) continue;
			return { ground: column.floor, water: column.water, cave: true,
				clearance: Math.min(column.ceiling - column.floor, hm.caves.rockClearance(x, column.floor + 1.5, z) * 2) };
		}
		// Only connect to the surface at a real mouth, never through a passage wall.
		if (!surface.roof && entrances.some(e => Math.hypot(x - e.x, z - e.z) < 90 && Math.abs(surface.ground - (e.y - 11)) < 25)) return surface;
		return { ground: NaN, water: 0, clearance: 0 };
	};
	const grid = (x, z) => {
		const key = `${x},${z}`;
		if (!cache.has(key)) { if (cache.size > 16384) cache.clear(); cache.set(key, floor(x, z)); }
		return cache.get(key);
	};
	return (x, z) => {
		// Smooth support on a one-unit grid, finer than the 3.2-unit cave mesh.
		// Cave interval unions are cached, so fast feet do not repeat them each substep.
		const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
		const a = grid(ix, iz), b = grid(ix + 1, iz), c = grid(ix, iz + 1), d = grid(ix + 1, iz + 1);
		const points = [a, b, c, d];
		if (points.some(p => !Number.isFinite(p.ground)) || Math.max(...points.map(p => p.ground)) - Math.min(...points.map(p => p.ground)) > 3) return { ground: NaN, water: 0, clearance: 0 };
		const ground = (a.ground * (1 - u) + b.ground * u) * (1 - v) + (c.ground * (1 - u) + d.ground * u) * v;
		const water = Math.max(...points.map(p => p.water)), caveFloor = points.some(p => p.cave);
		const slope = Math.hypot((b.ground - a.ground) * (1 - v) + (d.ground - c.ground) * v, (c.ground - a.ground) * (1 - u) + (d.ground - b.ground) * u);
		const s = { ...a, ground, water, slope, clearance: Math.min(...points.map(p => p.clearance ?? Infinity)) };
		if (caveFloor) Object.assign(s, { cave: true, forest: 0, wet: ground - water < 1.5 ? 0.65 : 0.12, hardness: 0.95, foam: 0, roof: false, coast: 0 });
		return s;
	};
}

export function pebbleHabitatSites(world, lakes, hm, sample) {
	const sites = [];
	for (const cave of world.caves || []) {
		for (const [i, entrance] of (cave.entrances || [cave.entrance]).entries()) {
			const path = cave.paths[entrance.path || 0], points = path.points;
			const p = entrance.end === 'end' ? points[points.length - 2] : points[1];
			sites.push({ id: `cave:${cave.id}:mouth:${i}`, x: p.x, z: p.z, y: p.floor, radius: 22, habitat: 'cave entrance', sample: pebbleCaveSampler(hm, sample, cave, p.floor) });
		}
		for (const [i, path] of cave.paths.entries()) for (const fraction of [0.4, 0.7]) {
			const p = path.points[Math.floor((path.points.length - 1) * fraction)];
			sites.push({ id: `cave:${cave.id}:gallery:${i}:${fraction}`, x: p.x, z: p.z, y: p.floor, radius: Math.max(12, p.width * 0.85), habitat: 'cave interior', sample: pebbleCaveSampler(hm, sample, cave, p.floor) });
		}
	}
	for (const lake of lakes) {
		if (lake.y < 150) continue;
		const shore = lake.shore || [lake], stride = Math.max(1, Math.ceil(shore.length / 8));
		for (let i = 0; i < shore.length; i += stride) {
			const p = shore[i], x = p.x - p.nx * 25, z = p.z - p.nz * 25;
			sites.push({ id: `mountain-lake:${lake.id}:${i}`, x, z, y: p.y, radius: 35, habitat: 'mountain lakeshore' });
		}
	}
	return sites;
}
