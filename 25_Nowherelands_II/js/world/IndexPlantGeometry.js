import { BufferAttribute } from 'three';

// Weld only bit-identical vertices. Keep every triangle, UV seam, normal and
// colour unchanged while allowing the GPU to reuse repeated vertex work.
export function indexPlantGeometry(geometry) {
	if (geometry.index) return geometry;
	const attributes = Object.entries(geometry.attributes);
	const words = attributes.map(([, a]) => new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
	const unique = [], indices = [], seen = new Map();
	for (let i = 0; i < geometry.attributes.position.count; i++) {
		let key = '';
		for (let k = 0; k < attributes.length; k++) {
			const a = attributes[k][1], stride = a.itemSize * a.array.BYTES_PER_ELEMENT;
			for (let j = i * stride; j < (i + 1) * stride; j++) key += String.fromCharCode(words[k][j]);
		}
		let index = seen.get(key);
		if (index === undefined) { index = unique.length; unique.push(i); seen.set(key, index); }
		indices.push(index);
	}
	for (const [name, a] of attributes) {
		const data = new a.array.constructor(unique.length * a.itemSize);
		for (let i = 0; i < unique.length; i++) data.set(a.array.subarray(unique[i] * a.itemSize, (unique[i] + 1) * a.itemSize), i * a.itemSize);
		geometry.setAttribute(name, new BufferAttribute(data, a.itemSize, a.normalized));
	}
	geometry.setIndex(indices);
	return geometry;
}
