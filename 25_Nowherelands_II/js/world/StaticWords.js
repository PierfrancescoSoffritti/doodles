// Lossless XOR differences along each attribute component, with zero runs.
// This format is deliberately simple: it is only an in-memory cold copy.
export function packWords(array, stride) {
 const words = new Uint32Array(array.buffer, array.byteOffset, array.byteLength / 4);
 const previous = new Uint32Array(stride), output = new Uint8Array(words.length * 5 + 8);
 let at = 0, zeros = 0;
 const flush = () => { if (!zeros) return; output[at++] = 0; let n = zeros; do { output[at++] = (n & 127) | (n > 127 ? 128 : 0); n >>>= 7; } while (n); zeros = 0; };
 for (let i = 0; i < words.length; i++) {
  const component = i % stride, word = words[i], difference = (word ^ previous[component]) >>> 0;
  previous[component] = word;
  if (!difference) { zeros++; continue; }
  flush();
  const bytes = difference < 256 ? 1 : difference < 65536 ? 2 : difference < 16777216 ? 3 : 4;
  output[at++] = bytes;
  for (let j = 0; j < bytes; j++) output[at++] = difference >>> (j * 8);
 }
 flush(); return output.slice(0, at);
}
export function unpackWords(packed, length, stride, ArrayType) {
 const words = new Uint32Array(length), previous = new Uint32Array(stride);
 let at = 0, i = 0;
 while (at < packed.length) {
  const bytes = packed[at++];
  if (bytes === 0) {
   let count = 0, shift = 0, n;
   do { n = packed[at++]; count |= (n & 127) << shift; shift += 7; } while (n & 128);
   for (let j = 0; j < count; j++, i++) words[i] = previous[i % stride];
  } else {
   let difference = 0;
   for (let j = 0; j < bytes; j++) difference |= packed[at++] << (j * 8);
   const component = i % stride;
   words[i++] = previous[component] = (previous[component] ^ difference) >>> 0;
  }
 }
 if (i !== length) throw Error('Invalid static attribute copy');
 return new ArrayType(words.buffer);
}
