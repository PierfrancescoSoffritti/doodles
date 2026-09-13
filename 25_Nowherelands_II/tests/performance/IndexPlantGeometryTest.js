import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
 if (specifier === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
 return next(specifier, context);
} });
const THREE = await import('three');
const { indexPlantGeometry } = await import('../../js/world/IndexPlantGeometry.js?v=stable-30-3');
test('plant indexing preserves every triangle attribute bit for bit, including seams', () => {
 const g = new THREE.BoxGeometry().toNonIndexed();
 g.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:g.attributes.position.count*3},(_,i)=>i%9<3?.2:.7),3));
 const original=g.clone();indexPlantGeometry(g);
 assert.ok(g.attributes.position.count<original.attributes.position.count);
 const expanded=g.toNonIndexed();
 for(const [name,a]of Object.entries(original.attributes))assert.deepEqual(new Uint8Array(expanded.attributes[name].array.buffer),new Uint8Array(a.array.buffer),name);
 assert.equal(indexPlantGeometry(g),g);
});
