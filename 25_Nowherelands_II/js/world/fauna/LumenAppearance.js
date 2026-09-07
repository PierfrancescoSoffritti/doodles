// One restrained appearance signal feeds the body, halo and surface lighting.
// Hue drifts within cyan / blue / lavender; motion changes it gradually, with
// independent timing per animal rather than synchronous flashing.
export function lumenAppearance(phase, speed, elastic, energy, time) {
	const motion = Math.min(1, Math.max(0, speed) / 90);
	const strain = Math.min(1, Math.max(0, elastic));
	const wave = Math.sin(time * 0.53 + phase + motion * 1.7);
	const hue = Math.max(0, Math.min(1, 0.45 + wave * 0.2 + motion * 0.16 + strain * 0.12));
	return {
		r: 0.33 + hue * 0.27,
		g: 0.82 - hue * 0.17,
		b: 0.96,
		brightness: Math.min(0.88, 0.61 + motion * 0.1 + strain * 0.055 + wave * 0.065 + Math.min(1,Math.max(0,energy)) * 0.045),
	};
}
