// Yield only between complete candidates: predicates may read terrain scratch fields
// and consume the same RNG as placement. Batching must preserve their exact order.
const BATCH = 64;

export function* spotCandidates(rnd, ox, oz, size, count, test, capture) {
	const out = [];
	for (let i = 0; i < count * 3 && out.length < count; i++) {
		if (i && i % BATCH === 0) yield;
		const x = ox + rnd.range(-size / 2, size / 2), z = oz + rnd.range(-size / 2, size / 2);
		if (Math.hypot(x, z) < 14) continue;
		if (test(x, z)) out.push(capture ? capture(x, z) : { x, z });
	}
	return out;
}

export function* gridCandidates(rnd, ox, oz, size, spacing, fn) {
	const n = Math.max(1, Math.round(size / spacing)), sp = size / n;
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		if ((j * n + i) && (j * n + i) % BATCH === 0) yield;
		const x = ox - size / 2 + (i + rnd.next()) * sp, z = oz - size / 2 + (j + rnd.next()) * sp;
		if (Math.hypot(x, z) < 14) continue;
		fn(x, z);
	}
}

// Synchronous callers (including loading/prewarming) use the same algorithm.
export function finishPlacement(iterator) {
	let result;
	do { result = iterator.next(); } while (!result.done);
	return result.value;
}
