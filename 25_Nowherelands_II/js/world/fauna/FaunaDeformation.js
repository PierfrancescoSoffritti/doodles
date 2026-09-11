// Same vertex deformation is used by live fauna and the stationary motion study.
// Local +X is forwards. aMotion = integrated stroke, muscle effort, compression,
// breath phase. aLife.w is turn curvature, not a random per-frame wobble.
export const faunaDeformation = /* glsl */`
vec3 deformFauna(vec3 p) {
	float stroke = aMotion.x, effort = aMotion.y;
	#if KIND == 0
		// No forward axis or tail. The sphere deforms in world axes using the
		// instantaneous velocity and a bounded elastic response to acceleration.
		float speed = length(aVelocity.xyz);
		vec3 direction = aVelocity.xyz / max(speed, 0.001);
		float stretch = 1.0 + 0.50 * smoothstep(0.0, 85.0, speed);
		vec3 axial = direction * dot(p, direction);
		p = axial * stretch + (p - axial) / sqrt(stretch);
		float phase = aMotion.w + aLife.x;
		float strain = min(length(aElastic.xyz), 1.0);
		vec3 elastic = aElastic.xyz / max(1.0, length(aElastic.xyz));
		vec3 n = normalize(p);
		float ripple = sin(n.x * 3.2 + phase * 1.13) * sin(n.y * 2.7 - phase * 0.81)
			+ sin(n.z * 3.4 - phase * 0.93) * 0.55;
		p *= 1.0 + ripple * (0.08 + smoothstep(0.0, 80.0, speed) * 0.09 + strain * 0.055);
		// Opposite sides swell together, retaining a rounded, headless volume.
		p += n * dot(n, elastic) * dot(n, direction) * 0.30;
		// Broad shear lets accelerating volumes flex across their motion axis.
		p += (elastic - n * dot(n, elastic)) * sin(dot(n, direction) * 2.8) * 0.13;
		return p;

	#elif KIND == 3
		// Identity-only variation. The shell is stone: motion comes entirely
		// from the rigid pose and jointed legs, never breathing or squash.
		p.x *= 1.0 + sin(aLife.x * 2.1) * 0.13;
		p.z *= 1.0 + cos(aLife.x * 1.7) * 0.12;
		p.x += max(p.y + 0.55, 0.0) * sin(aLife.x * 3.7) * 0.09;
		return p;
	#elif KIND == 5
		float side = sign(p.z), span = abs(p.z) / 6.6;
		float rear = clamp((2.7 - p.x) / 6.7, 0.0, 1.0);
		// Outer fin follows the root; the trailing edge follows the leading edge.
		float asymmetry = 1.0 + side * aLife.w * 0.48;
		float wave = sin(stroke - span * 0.9 - rear * 1.4);
		float finAngle = 0.08 + wave * (0.12 + effort * 0.56) * asymmetry;
		float curve = finAngle * pow(span, 0.7);
		p.y += sin(curve) * abs(p.z);
		p.z *= cos(curve);
		p.y += sin(stroke - rear * 2.2 - span * 1.1) * rear * rear * span * (0.12 + effort * 0.3);
		p.x += sin(stroke - rear * 1.5) * span * span * effort * 0.16;
		return p;
	#endif
	return p;
}
`;
