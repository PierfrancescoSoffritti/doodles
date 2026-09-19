import { hypot2, hypot3 } from '../../core/NumericDistance.js?v=stable-30-6';

// Cave colonies own a floor sampler. A two-dimensional surface height cannot
// distinguish a gallery from the mountain directly above it.
export function pebbleCaveSampler(hm, surfaceSample, cave, anchorY, {cacheQueries=true}={}) {
	const cache = new Map(), keys = [], entrances = cave.entrances || [cave.entrance];
	let nextKey=0;
	const floor = (x, z) => {
		const surface = surfaceSample(x, z);
		// Column unions need all passages, but each section is evaluated once.
		const candidates=hm.caves.candidates(x,z),sampled=new Array(candidates.length),own=[];
		for(let i=0;i<candidates.length;i++)if(candidates[i].cave.id===cave.id)own.push(sampled[i]=hm.caves.section(candidates[i],x,z));
		const sections = own.filter(q => q.wall > 1.8 && Math.abs(q.floor - anchorY) < 100)
			.sort((a, b) => Math.abs(a.floor - anchorY) - Math.abs(b.floor - anchorY));
		if(sections.length)for(let i=0;i<candidates.length;i++)if(!sampled[i])sampled[i]=hm.caves.section(candidates[i],x,z);
		for (const q of sections) {
			const column = hm.caves.column(x, z, q.floor + 3, 2, sampled);
			if (!column || column.floor >= surface.ground) continue;
			return { ground: column.floor, water: column.water, cave: true,
				clearance: Math.min(column.ceiling - column.floor, hm.caves.rockClearance(x, column.floor + 1.5, z) * 2) };
		}
		// Only connect to the surface at a real mouth, never through a passage wall.
		if (!surface.roof && entrances.some(e => Math.hypot(x - e.x, z - e.z) < 90 && Math.abs(surface.ground - (e.y - 11)) < 25)) return surface;
		return { ground: NaN, water: 0, clearance: 0 };
	};
	const grid = (x, z) => {
		// Pack the signed 16-bit coordinates without offsetting x. Ordinary
		// world keys remain small integers; coordinates outside this range use
		// the original string key. Both representations are collision-free.
		const key = x >= -32768 && x < 32768 && z >= -32768 && z < 32768 ? (x << 16) | (z & 65535) : `${x},${z}`;
		let value = cache.get(key);
		if (!value) {
			// Evict one old query instead of forcing every nearby animal to refill
			// its entire floor cache. Allocate the key ring only as sites are used.
			if (cache.size === 16384) cache.delete(keys[nextKey]);
			value = floor(x, z); cache.set(key, value);
			keys[nextKey] = key; nextKey = (nextKey + 1) & 16383;
		}
		return value;
	};
	const sample = (x, z) => {
		// Smooth support on a one-unit grid, finer than the 3.2-unit cave mesh.
		// Cave interval unions are cached, so fast feet do not repeat them each substep.
		const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
		const a = grid(ix, iz), b = grid(ix + 1, iz), c = grid(ix, iz + 1), d = grid(ix + 1, iz + 1);
		if (!Number.isFinite(a.ground) || !Number.isFinite(b.ground) || !Number.isFinite(c.ground) || !Number.isFinite(d.ground) || Math.max(a.ground,b.ground,c.ground,d.ground) - Math.min(a.ground,b.ground,c.ground,d.ground) > 3) return { ground: NaN, water: 0, clearance: 0 };
		let ground = (a.ground * (1 - u) + b.ground * u) * (1 - v) + (c.ground * (1 - u) + d.ground * u) * v;
		const water = Math.max(a.water,b.water,c.water,d.water), caveFloor = !!(a.cave || b.cave || c.cave || d.cave);
		let slope = hypot2((b.ground - a.ground) * (1 - v) + (d.ground - c.ground) * v, (c.ground - a.ground) * (1 - u) + (d.ground - b.ground) * u);
		let clearance=Math.min(a.clearance??Infinity,b.clearance??Infinity,c.clearance??Infinity,d.clearance??Infinity);
		if(caveFloor && hm.caveFloorSurface) {
			const support=hm.caveFloorSurface.sample(cave.id,x,z,ground,ground+clearance);
			if(!support)return {ground:NaN,water:0,clearance:0};
			clearance-=Math.max(0,support.ground-ground);ground=support.ground;slope=support.slope;
		}
		if (caveFloor) {
			let entranceDistance=Infinity;
			for(const e of entrances)entranceDistance=Math.min(entranceDistance,hypot3(x-e.x,ground-e.y,z-e.z));
			return { ...a, ground, water, slope, clearance, cave: true, daylight: Math.exp(-entranceDistance * 0.024), forest: 0, wet: ground - water < 1.5 ? 0.65 : 0.12, hardness: 0.95, foam: 0, roof: false, coast: 0 };
		}
		return { ...a, ground, water, slope, clearance };
	};
	if(!cacheQueries)return sample;
	// Foot contacts and body support repeat exact positions across the 120 Hz
	// substeps. Cache the complete immutable query, not a coarser approximation.
	// Return copies so callers cannot change retained support data.
	let queries=[],mesh=hm.caveFloorSurface;
	return (x,z)=>{
		if(mesh!==hm.caveFloorSurface){queries=[];mesh=hm.caveFloorSurface;}
		const slot=(Math.imul((x*1024)|0,73856093)^Math.imul((z*1024)|0,19349663))&511;
		let entry=queries[slot];
		if(!entry||!Object.is(entry.x,x)||!Object.is(entry.z,z))queries[slot]=entry={x,z,value:sample(x,z)};
		return {...entry.value};
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
