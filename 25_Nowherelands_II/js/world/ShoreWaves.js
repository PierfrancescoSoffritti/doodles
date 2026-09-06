// The shore-wave system, shared with the terrain shader so the swash on the sand keeps time with
// the breakers. Needs shoreDistAt() (ShoreMap) and vnoise() (TerrainMaterial) declared before it.
export const shoreWaveGlsl = /* glsl */`
	uniform float uSurfEnergy;
	const float SHORE_K = 6.2832 / 58.0;      // broad rollers readable from the peaks
	const float SHORE_W = 6.2832 / 8.4;       // shoreward travel at about 7 m/s
	// waves come in sets: the amplitude swells and eases over a minute, differently along the coast
	float shoreSet(vec2 p, float t) {
		return 0.78 + 0.22 * sin(t * 0.09 + vnoise(p * 0.004) * 6.2832);
	}
	// phase of the wave crossing the point at distance d from the shore; crests bend with the
	// coast and wander a little so they do not read as ruled lines
	float shorePhase(float d, vec2 p, float t) {
		return d * SHORE_K + t * SHORE_W + (vnoise(p * 0.006) - 0.5) * 2.0;
	}
	// 0..1 over one period, 0 right behind the crest
	float shoreAge(float ph) { return fract((ph - 1.5708) / 6.2832); }
	// One shared clock for the burst on the rock and the wash at its foot. The
	// fast rise and slower fall leave a quiet interval between impacts.
	float cliffAge(vec2 p, float t) { return shoreAge(shorePhase(0.0, p, t)); }
	float cliffPulse(float age) {
		return smoothstep(0.0, 0.07, age) * (1.0 - smoothstep(0.12, 0.65, age));
	}
	float cliffReach(vec2 p, float t) {
		return (3.0 + 8.0 * clamp(uSurfEnergy - 1.0, 0.0, 1.5)) * (0.65 + 0.35 * shoreSet(p, t));
	}
	// the wave grows as it shoals then collapses on the last metres
	float shoreEnv(float d) { return (1.0 - smoothstep(130.0, 360.0, d)) * smoothstep(-3.0, 6.0, d); }
	// where it breaks
	float shoreBreak(float d) { return (1.0 - smoothstep(65.0, 145.0, d)) * smoothstep(-2.0, 5.0, d); }
	// the height of the shore wave
	float shoreLift(float d, vec2 p, float t) {
		float c = 0.5 + 0.5 * sin(shorePhase(d, p, t));
		return 1.1 * clamp(uSurfEnergy, 1.0, 2.4) * shoreEnv(d) * shoreSet(p, t) * (2.0 * pow(c, 1.7) - 0.85);
	}
	// Carrier slope for distant shading, where the mesh normal no longer resolves
	// the rollers. The near water still uses its actual flat triangle normals.
	float shoreSlope(float d, vec2 p, float t) {
		float ph = shorePhase(d, p, t), c = 0.5 + 0.5 * sin(ph);
		return 1.1 * clamp(uSurfEnergy, 1.0, 2.4) * shoreEnv(d) * shoreSet(p, t) * 1.7 * pow(c, 0.7) * cos(ph) * SHORE_K;
	}
	// how far up the beach the sheet has run since the last crest hit the waterline, in metres
	float shoreRunUp(vec2 p, float t) {
		float age = shoreAge(shorePhase(0.0, p, t));
		float f = age < 0.32 ? sin(age / 0.32 * 1.5708) : cos((age - 0.32) / 0.68 * 1.5708);
		return 7.5 * shoreSet(p, t) * f;
	}
	// a lake's wind lap: the same thing writ small, short quick crests and a hand's breadth of run-up
	const float LAKE_K = 6.2832 / 4.5, LAKE_W = 6.2832 / 3.1;
	float lakePhase(float d, vec2 p, float t) { return d * LAKE_K + t * LAKE_W + (vnoise(p * 0.06) - 0.5) * 2.0; }
	float lakeRunUp(vec2 p, float t) {
		float age = shoreAge(lakePhase(0.0, p, t));
		float f = age < 0.35 ? sin(age / 0.35 * 1.5708) : cos((age - 0.35) / 0.65 * 1.5708);
		return 1.6 * (0.6 + 0.4 * vnoise(p * 0.01 + t * 0.02)) * f;
	}`;
