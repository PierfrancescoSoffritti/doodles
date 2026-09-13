import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
 if (s === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
 return next(s, c);
} });
const THREE = await import('three');
const { plantLineData, attachPlantLineDisposal } = await import('../../js/world/PlantLineData.js?v=stable-30-26');

test('retiring a line chunk releases its private table and material, preserving other chunks and live uniforms', () => {
 const source = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 42 } }, vertexShader: 'void main() {}' });
 const metadata = [1, 2, 3, 4, 5, 6, 0, 0];
 const a = plantLineData(source, metadata, new Float32Array([42]));
 const b = plantLineData(source, metadata, new Float32Array([43]));
 const ga = new THREE.BufferGeometry(), gb = new THREE.BufferGeometry();
 attachPlantLineDisposal(ga, a); attachPlantLineDisposal(gb, b);
 const disposed = [];
 for (const [name, resource] of [['source', source], ['aTexture', a.texture], ['aMaterial', a.material], ['bTexture', b.texture], ['bMaterial', b.material]]) resource.addEventListener('dispose', () => disposed.push(name));
 source.uniforms.uTime.value = 99;
 assert.equal(a.material.uniforms.uTime.value, 99); assert.equal(b.material.uniforms.uTime.value, 99);
 ga.dispose(); assert.deepEqual(disposed, ['aTexture', 'aMaterial']);
 b.attr.array[0] = 55; b.attr.needsUpdate = true;
 assert.equal(b.texture.image.data[6], 55);
 gb.dispose(); assert.deepEqual(disposed, ['aTexture', 'aMaterial', 'bTexture', 'bMaterial']);
});
