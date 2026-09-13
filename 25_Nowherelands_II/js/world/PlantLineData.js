import * as THREE from 'three';

const WIDTH = 64;

// Base, phase and growth clock are shared by every endpoint in a plant.
// Preserve their original Float32 values and fetch them without interpolation.
export function plantLineData(source, metadata, born) {
 const height = Math.max(1, Math.ceil(born.length * 2 / WIDTH));
 const data = new Float32Array(WIDTH * height * 4);
 for (let i = 0; i < born.length; i++) {
  for (let j = 0; j < 6; j++) data[i * 8 + j] = metadata[i * 8 + j] ?? 0;
  data[i * 8 + 6] = born[i];
 }
 const texture = new THREE.DataTexture(data, WIDTH, height, THREE.RGBAFormat, THREE.FloatType);
 texture.minFilter = texture.magFilter = THREE.NearestFilter;
 texture.needsUpdate = true;

 // PlantReveal writes one birth time per plant through its existing attribute API.
 // The small CPU attribute is never bound as vertex data.
 const attr = new THREE.BufferAttribute(born, 1);
 Object.defineProperty(attr, 'needsUpdate', { set(value) {
  if (!value) return;
  attr.version++;
  for (let i = 0; i < born.length; i++) data[i * 8 + 6] = born[i];
  texture.needsUpdate = true;
 } });
 const material = source.clone();
 // Keep the live time, weather and lighting uniform objects shared with the source.
 material.uniforms = { ...source.uniforms, uPlantData: { value: texture } };
 material.vertexShader = source.vertexShader
  .replace('attribute vec3 aBase;', 'uniform highp sampler2D uPlantData;')
  .replace('attribute vec4 aInfo;', 'attribute float aHeight;')
  .replace('attribute float aBorn;', 'attribute float aPlant;')
  .replace('void main() {', `void main() {
   int cell = int(aPlant) * 2;
   vec4 base = texelFetch(uPlantData, ivec2(cell % ${WIDTH}, cell / ${WIDTH}), 0);
   vec4 extra = texelFetch(uPlantData, ivec2((cell + 1) % ${WIDTH}, (cell + 1) / ${WIDTH}), 0);
   vec3 aBase = base.xyz;
   vec4 aInfo = vec4(aHeight, base.w, extra.x, extra.y);
   float aBorn = extra.z;`);
 return { attr, material, texture };
}

// Keep the disposal listener outside the terrain builder's lexical scope. That
// scope contains temporary placement arrays and unfinished buffer builders.
export function attachPlantLineDisposal(geometry, table) {
 geometry.addEventListener('dispose', () => {
  table.texture.dispose();
  table.material.dispose();
 });
}
