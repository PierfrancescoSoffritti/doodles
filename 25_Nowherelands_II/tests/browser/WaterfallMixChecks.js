import { AudioEngine } from '../../js/audio/AudioEngine.js';
import { WaterfallAmbience } from '../../js/audio/WaterfallAmbience.js';
import { Wind } from '../../js/audio/layers/Wind.js';
import { WatersideAmbience } from '../../js/audio/WatersideAmbience.js';
import { RIVER_STRIDE as S, RV } from '../../js/world/gen/Rivers.js';

// Render real Web Audio nodes to check audibility, distance and stereo placement.
export async function waterfallMixChecks() {
	const results = {};
	for (const scenario of ['left', 'right', 'far', 'cave', 'calm', 'storm', 'fallSlow', 'fallFast', 'riverSlow', 'riverFast', 'riverFar']) {
		const ctx = new OfflineAudioContext(2, 44100 * 5, 44100);
		let now = 0, seed = 17;
		const clock = new Proxy(ctx, { get(target, key) {
			if (key === 'currentTime') return now;
			const value = Reflect.get(target, key, target);
			return typeof value === 'function' ? value.bind(target) : value;
		} });
		const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
		const engine = new AudioEngine(clock, random);
		engine.master.gain.value = 0.9;
		engine.updateListener({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
		const wind = scenario === 'calm' || scenario === 'storm';
		const data = new Float32Array(S * 2);
		data[RV.SPEED] = scenario === 'fallSlow' ? 1 : scenario === 'fallFast' ? 12 : 4;
		let sound = wind ? new Wind(engine) : new WaterfallAmbience(engine, [{ data, falls: [{
			x: scenario === 'far' ? 2000 : scenario === 'left' ? -25 : 25,
			z: -20, dx: 0, dz: 1, top: 40, bottom: 0, drop: 40, w: 45, seed: 3, i: 0,
		}] }]);
		if (scenario.startsWith('river')) {
			const x = scenario === 'riverFar' ? 2000 : 25, speed = scenario === 'riverSlow' ? 1 : 12;
			for (let i = 0; i < 2; i++) { data[i * S + RV.X] = x; data[i * S + RV.Z] = -50 + i * 100; data[i * S + RV.SPEED] = speed; }
			const hm = { world: { rivers: [{ data, falls: [] }] }, rivers: {
				segmentsIn: (x0, z0, x1) => x >= x0 && x <= x1 ? [0] : [], segRiver: [0], segIndex: [0],
				at: (i, t) => ({ x, z: -50 + t * 100, wl: 0, w: 30, foam: 0, dx: 0, dz: 100 }),
			} };
			// This branch renders the complete river mixer, including its quiet bank texture.
			sound = new WatersideAmbience(engine, hm, { query: () => [] });
		}
		const shared = wind ? { wind: scenario === 'storm' ? 1 : 0, storm: scenario === 'storm' ? 0.8 : 0,
			snow: 0, speed: 1, altitude: 1, turn: 1, wading: 1 } : {
			camera: { position: { x: 0, y: 10, z: 0 } }, caveAmount: scenario === 'cave' ? 1 : 0,
		};
		for (let frame = 0; frame < 5 * 60; frame++) { now = frame / 60; sound.update(1 / 60, shared); }
		const buffer = await ctx.startRendering();
		engine.offNote();
		const rms = [0, 1].map(ch => {
			const samples = buffer.getChannelData(ch); let sum = 0;
			for (let i = 44100; i < samples.length; i++) {
				if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) >= 1) throw new Error(scenario + ': invalid/clipping audio');
				sum += samples[i] * samples[i];
			}
			return Math.sqrt(sum / (samples.length - 44100));
		});
		results[scenario] = rms;
	}
	if (!(results.left[0] > results.left[1] * 1.2 && results.right[1] > results.right[0] * 1.2)) throw new Error('Waterfalls must pan toward their source');
	if (!(Math.max(...results.left) > 0.001 && Math.max(...results.storm) > 0.001)) throw new Error('Nearby waterfalls and storms must be audible');
	for (const name of ['far', 'cave', 'calm', 'riverFar']) if (Math.max(...results[name]) > 0.000001) throw new Error(name + ' must be silent');
	for (const kind of ['fall', 'river']) if (Math.max(...results[kind + 'Fast']) < Math.max(...results[kind + 'Slow']) * 2) throw new Error(kind + ' must get audibly stronger with speed');
	return results;
}
