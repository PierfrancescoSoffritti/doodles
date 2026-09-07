// Directionless lumen volume, shared by live rendering and the motion study.
export const faunaDeformation = /* glsl */`
vec3 deformFauna(vec3 p) {
	float stroke = aMotion.x, effort = aMotion.y;
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

}
`;
