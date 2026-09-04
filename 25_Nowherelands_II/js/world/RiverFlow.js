// The surface and drifting foam sample the same steady current in channel metres.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NO_WAKE = [0, 0, 0];
const wakeCache = new WeakMap();

export function riverWakes(river, index, stride, alongField) {
	let segments = wakeCache.get(river);
	if (!segments) { segments = new Map(); wakeCache.set(river, segments); }
	if (segments.has(index)) return segments.get(index);
	const a = river.data[index * stride + alongField], b = river.data[(index + 1) * stride + alongField];
	const picks = [];
	for (let i = 0; i < river.wakes.length; i += 3) {
		const s = river.wakes[i], r = river.wakes[i + 2];
		if (s > b + r * 3 || s < a - r * 10) continue;
		picks.push([Math.abs(s - (a + b) * 0.5), [s, river.wakes[i + 1], r]]);
	}
	picks.sort((a, b) => a[0] - b[0]);
	const result = [0, 1, 2].map(i => picks[i]?.[1] || NO_WAKE);
	segments.set(index, result);
	return result;
}

export function riverCurrent(along, across, width, speed, bend, wakes, out = [0, 0]) {
	const u = across / Math.max(width * 0.5, 1);
	const core = clamp(1 - (u - bend * 0.35) ** 2, 0, 1);
	const edge = clamp((1 - Math.abs(u)) * 5, 0, 1);
	let vx = speed * (0.12 + 1.28 * core), vy = speed * bend * 0.06 * edge;
	for (const rock of wakes) {
		if (rock[2] <= 0) continue;
		const radius = rock[2], x = (along - rock[0]) / radius, y = (across - rock[1]) / radius;
		const obstacle = Math.exp(-x * x * 0.7 - y * y * 0.9);
		vx -= speed * obstacle * 0.95;
		vy += speed * y * obstacle * 1.6;
		// Counter-rotating vortices leave a slow, sometimes reversing pocket downstream.
		for (const side of [-1, 1]) {
			const dx = (x - 2.5) / 2, dy = y - side * 0.85;
			const vortex = Math.exp(-dx * dx - dy * dy) * speed * 2.4;
			vx += side * dy * vortex;
			vy -= side * dx * vortex * 0.5;
		}
	}
	out[0] = vx; out[1] = vy * edge;
	return out;
}

export const riverFlowGlsl = /* glsl */`
	vec2 wakeCurrent(vec2 p, vec3 rock, float speed) {
		if (rock.z <= 0.0) return vec2(0.0);
		vec2 q = (p - rock.xy) / rock.z;
		float obstacle = exp(-q.x * q.x * 0.7 - q.y * q.y * 0.9);
		vec2 v = vec2(-0.95, q.y * 1.6) * speed * obstacle;
		for (int i = 0; i < 2; i++) {
			float side = float(i) * 2.0 - 1.0;
			float dx = (q.x - 2.5) / 2.0, dy = q.y - side * 0.85;
			float vortex = exp(-dx * dx - dy * dy) * speed * 2.4;
			v += vec2(side * dy, -side * dx * 0.5) * vortex;
		}
		return v;
	}
	vec2 riverCurrent(vec2 p, float width, float speed, float bend, vec3 w0, vec3 w1, vec3 w2) {
		float u = p.y / max(width * 0.5, 1.0);
		float offset = u - bend * 0.35;
		float core = clamp(1.0 - offset * offset, 0.0, 1.0);
		float edge = clamp((1.0 - abs(u)) * 5.0, 0.0, 1.0);
		vec2 v = speed * vec2(0.12 + 1.28 * core, bend * 0.06 * edge);
		v += wakeCurrent(p, w0, speed) + wakeCurrent(p, w1, speed) + wakeCurrent(p, w2, speed);
		v.y *= edge;
		return v;
	}
`;
