import { lowMemoryMobile } from './MobileDetail.js?v=stable-30-3';
import { Random, hashString } from './Random.js';

const WORDS = ['umbra', 'lumen', 'vesper', 'ondine', 'halcyon', 'aster', 'nimbus', 'sable', 'orphic', 'zephyr', 'lyra', 'cinder', 'vellum', 'ether', 'ossia', 'tenebra'];

function seedFromUrl() {
	const params = new URLSearchParams(location.search);
	const s = params.get('seed');
	if (s && s.trim()) return s.trim();
	const r = new Random(Date.now() ^ (Math.random() * 1e9));
	return r.pick(WORDS) + '-' + r.pick(WORDS);
}

export const config = {
	seed: seedFromUrl(),
	get seedHash() { return hashString(this.seed); },

	world: {
		chunkSize: 256,         // vegetation chunk
		vegetationRadius: [2,3,4].includes(Number(new URLSearchParams(location.search).get('plantRadius'))) ? Number(new URLSearchParams(location.search).get('plantRadius')) : lowMemoryMobile ? 2 : 4,
		giantRadius: 6,         // far chunks of two vegetation chunks a side: the giants stand out to 3 km
		waterLevel: 0,          // sea level
		eyeHeight: 11,
		far: 30000,
	},

	audio: {
		bpm: 64,
		stepsPerBeat: 2,
		keyChangeEvery: [40, 65],   // seconds
	},

	isTouch: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches,
};
