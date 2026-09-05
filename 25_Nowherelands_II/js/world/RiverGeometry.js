import { RIVER_STRIDE as S, RV, RIVER_KIND } from './gen/Rivers.js';

// The same curved crest displaces water rows and the bed beneath a riffle.
export function crestShape(river, index) {
	const d = river.data, kind = d[index * S + RV.KIND];
	if (kind === RIVER_KIND.LIP || kind === RIVER_KIND.POOL) {
		const f = river.falls?.find(f => f.i === index || f.j === index);
		if (!f) return [0, 0];
		const scale = d[index * S + RV.W] / f.w;
		return [(f.skew || 0) * scale, (f.bow || 0) * scale * scale];
	}
	if (kind !== RIVER_KIND.STEP_TOP && kind !== RIVER_KIND.STEP_BOTTOM) return [0, 0];
	const top = kind === RIVER_KIND.STEP_BOTTOM ? index - 1 : index;
	const along = d[top * S + RV.ALONG], width = d[top * S + RV.W];
	const skew = Math.sin(along * 0.173 + 1.7) * width * 0.22, bow = Math.sin(along * 0.071 + 4.1) * width * 0.18;
	const gap = (a, b) => Math.hypot(d[a * S] - d[b * S], d[a * S + 1] - d[b * S + 1]);
	const before = top > 0 ? gap(top - 1, top) : width;
	const after = top + 2 < river.count ? gap(top + 1, top + 2) : width;
	// Keep each crest inside its neighbouring sections so the ribbon cannot fold over itself.
	const scale = Math.min(1, 0.65 * Math.min(before, after) / (Math.abs(skew) * 1.5 + Math.abs(bow) * 2.25 || 1));
	return [skew * scale, bow * scale];
}
export function crestOffset(u, skew, bow) {
	u = Math.max(-1.5, Math.min(1.5, u));
	return skew * u + bow * u * u;
}
