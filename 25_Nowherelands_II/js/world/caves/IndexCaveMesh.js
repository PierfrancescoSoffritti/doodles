// Cave rock has only a position attribute; its flat normals are computed from
// fragment derivatives. Sharing bit-identical positions preserves those normals
// and the original triangle order. Run during world generation, off the UI thread.
export function indexCaveMesh(chunk) {
 if (chunk.index) return chunk;
 const words = new Uint32Array(chunk.position.buffer, chunk.position.byteOffset, chunk.position.length);
 const seen = new Map(), unique = [], indices = new Uint32Array(words.length / 3);
 for (let i = 0; i < words.length; i += 3) {
  const key = `${words[i]},${words[i + 1]},${words[i + 2]}`;
  let index = seen.get(key);
  if (index === undefined) { index = unique.length; seen.set(key, index); unique.push(i); }
  indices[i / 3] = index;
 }
 const Index = unique.length <= 65535 ? Uint16Array : Uint32Array;
 if (unique.length * 12 + indices.length * Index.BYTES_PER_ELEMENT >= words.byteLength) return chunk;
 const packed = new Uint32Array(unique.length * 3);
 for (let i = 0; i < unique.length; i++) {
  const source = unique[i];
  packed[i * 3] = words[source]; packed[i * 3 + 1] = words[source + 1]; packed[i * 3 + 2] = words[source + 2];
 }
 chunk.position = new Float32Array(packed.buffer);
 chunk.index = Index === Uint32Array ? indices : new Uint16Array(indices);
 return chunk;
}
