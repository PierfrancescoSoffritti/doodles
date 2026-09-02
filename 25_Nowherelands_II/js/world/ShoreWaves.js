// The shore-wave system, shared with the terrain shader so the swash on the sand keeps time with
// the breakers. Needs shoreDistAt() (ShoreMap) and vnoise() (TerrainMaterial) declared before it.
export const shoreWaveGlsl = /* glsl */`
	const float SHORE_K = 6.2832 / 15.0;      // 15 m between crests
	const float SHORE_W = 6.2832 / 5.6;       // one every 5.6 s
	// waves come in sets: the amplitude swells and eases over a minute, differently along the coast
	float shoreSet(vec2 p, float t) {
		return 0.6 + 0.4 * sin(t * 0.09 + vnoise(p * 0.004) * 6.2832);
	}
	// phase of the wave crossing the point at distance d from the shore; crests bend with the
	// coast and wander a little so they do not read as ruled lines
	float shorePhase(float d, vec2 p, float t) {
		return d * SHORE_K + t * SHORE_W + (vnoise(p * 0.03) - 0.5) * 2.6;
	}
	// 0..1 over one period, 0 right behind the crest
	float shoreAge(float ph) { return fract((ph - 1.5708) / 6.2832); }
	// the wave grows as it shoals then collapses on the last metres
	float shoreEnv(float d) { return (1.0 - smoothstep(18.0, 110.0, d)) * smoothstep(-3.0, 4.0, d); }
	// where it breaks
	float shoreBreak(float d) { return (1.0 - smoothstep(12.0, 30.0, d)) * smoothstep(-2.0, 3.0, d); }
	// the height of the shore wave
	float shoreLift(float d, vec2 p, float t) {
		float c = 0.5 + 0.5 * sin(shorePhase(d, p, t));
		return 0.55 * shoreEnv(d) * shoreSet(p, t) * (2.0 * pow(c, 1.7) - 0.85);
	}
	// how far up the beach the sheet has run since the last crest hit the waterline, in metres
	float shoreRunUp(vec2 p, float t) {
		float age = shoreAge(shorePhase(0.0, p, t));
		float f = age < 0.32 ? sin(age / 0.32 * 1.5708) : cos((age - 0.32) / 0.68 * 1.5708);
		return 7.5 * shoreSet(p, t) * f;
	}`;

