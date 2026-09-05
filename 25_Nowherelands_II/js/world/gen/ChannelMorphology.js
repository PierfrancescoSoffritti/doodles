// Reach-scale geomorphology. All lengths are world metres; no per-frame simulation.
// Pool/riffle spacing and alluvial bends scale with bankfull width, while confinement
// suppresses lateral migration. These are landscape synthesis rules, not a flood model.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const CHANNEL = { ALLUVIAL: 0, GRAVEL: 1, STEP_POOL: 2, TORRENT: 3 };

export function reachCharacter(slope, hardness, relief) {
	const confinement = clamp(relief * 0.65 + smooth(0.015, 0.16, slope) * 0.6, 0, 1);
	const type = slope > 0.12 ? CHANNEL.TORRENT : slope > 0.026 ? CHANNEL.STEP_POOL : slope > 0.004 || hardness > 0.65 ? CHANNEL.GRAVEL : CHANNEL.ALLUVIAL;
	return { type, confinement, roughness: 0.032 + confinement * 0.028 + hardness * 0.012,
		mobility: (1 - confinement) * (1 - hardness * 0.65) * (1 - smooth(0.012, 0.045, slope)) };
}

// Broad sediment shelves on the inside, a narrow scoured thalweg on the outside.
// A positive value is submerged; negative inner shelves are exposed point bars.
export function channelSection(u, bend = 0) {
	const b = clamp(bend, -0.95, 0.95), peak = b * 0.48;
	const v = (u - peak) / (u < peak ? 1 + peak : 1 - peak);
	const inside = smooth(0.02, 0.92, -u * Math.sign(b));
	const edge = 0.26 + 0.32 * b * u - 0.3 * Math.abs(b) * inside;
	const bowl = Math.pow(Math.max(0, 1 - v * v), 0.62 + 2.6 * Math.abs(b) * inside);
	return edge + (1 - edge) * bowl;
}

// Period is accumulated in channel widths, so larger rivers have longer sequences.
export function bedSequence(phase, confinement, bend) {
	const pool = 0.5 + 0.5 * Math.cos(phase);
	const scour = Math.abs(bend) * 0.28;
	return { width: 0.82 + 0.36 * pool - confinement * 0.12,
		depth: 0.72 + 0.64 * pool + scour,
		riffle: Math.pow(1 - pool, 3) };
}

// Reach-aware recruitment: reeds and submerged ribbons require sheltered shallow water;
// bramble roots stay above ordinary flow. Alpine banks carry low scrub, not tall reeds.
export function riverHabitat(heightAboveWater, speed, foam, elevation) {
	const shelter = (1 - smooth(0.55, 1.8, speed)) * (1 - smooth(0.12, 0.55, foam));
	const lowland = 1 - smooth(300, 700, elevation);
	return {
		reed: shelter * lowland * smooth(-1.3, -0.2, heightAboveWater) * (1 - smooth(1.2, 4, heightAboveWater)),
		aquatic: shelter * lowland * smooth(-3, -1.5, heightAboveWater) * (1 - smooth(-0.4, 0.15, heightAboveWater)),
		bramble: smooth(0.7, 2.4, heightAboveWater) * (1 - smooth(8, 20, heightAboveWater)) * (1 - smooth(620, 950, elevation)),
		sedge: smooth(-0.2, 0.4, heightAboveWater) * (1 - smooth(2, 5, heightAboveWater)),
	};
}
