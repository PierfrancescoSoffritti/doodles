import * as THREE from 'three';
import { plantLineData } from '../../js/world/PlantLineData.js?v=stable-30-26';
import { preparePlantReveal, revealPlants } from '../../js/world/PlantReveal.js?v=stable-30-7';

export function checkPlantLineData() {
 const check = (value, message) => { if (!value) throw Error(message); };
 const source = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: 'attribute vec3 aBase; attribute vec4 aInfo; attribute float aBorn; void main() { gl_Position=vec4(position,1.); }'
 });
 const born = new Float32Array(33).fill(-999), metadata = new Float64Array(33 * 8);
 for (let i = 0; i < 33; i++) for (let k = 0; k < 6; k++) metadata[i * 8 + k] = i + k / 7;
 const table = plantLineData(source, metadata, born), other = plantLineData(source, metadata, born.slice());
 const data = table.texture.image.data;
 check(table.texture.image.height === 2, 'The table must cross texture rows without losing a plant');
 for (let i = 0; i < 33; i++) for (let k = 0; k < 6; k++) check(Object.is(data[i * 8 + k], Math.fround(metadata[i * 8 + k])), 'Metadata must retain original Float32 values');
 check(table.material.uniforms.uTime === source.uniforms.uTime, 'Live uniform objects must remain shared');
 check(table.material.uniforms.uPlantData !== other.material.uniforms.uPlantData, 'Each chunk must own its plant table');
 source.uniforms.uTime.value = 42;
 check(table.material.uniforms.uTime.value === 42, 'Source updates must reach chunk materials');
 const group = preparePlantReveal({ attr: table.attr, count: 2, pending: 1, kind: { reveal: 10 }, pos: new Float64Array([0, 0, 0, 0]), rangeData: new Uint32Array([0, 0, 32, 33]) }, -999);
 let randomCalls = 0;
 const version = table.texture.version;
 revealPlants(group, 42, 0, 0, () => { randomCalls++; return .3; });
 check(group.pending === 0 && randomCalls === 1, 'An empty plant must not consume a reveal or random delay');
 check(data[32 * 8 + 6] === born[32] && born[32] === Math.fround(42.12), 'Birth updates must reach the second texture row');
 check(data[6] === -999 && table.texture.version === version + 1, 'Reveal must update once and preserve untouched plants');
 table.attr.needsUpdate = false;
 check(table.texture.version === version + 1, 'False needsUpdate must not upload');
 table.material.dispose(); table.texture.dispose(); other.material.dispose(); other.texture.dispose(); source.dispose();
 return { checks: 207 };
}
