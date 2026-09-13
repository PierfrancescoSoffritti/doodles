import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
 if (specifier === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
 return next(specifier, context);
} });
const THREE = await import('three');
const { sharedPlantGeometry } = await import('../../js/world/SharedPlantGeometry.js?v=stable-30-3');

test('retiring a chunk releases its birth buffer but preserves shared vertices until the last owner', () => {
 const source = new THREE.BoxGeometry(), a = sharedPlantGeometry(source), b = sharedPlantGeometry(source);
 const birth = new THREE.InstancedBufferAttribute(new Float32Array([42]), 1);
 a.setAttribute('aBorn', birth);
 assert.equal(a.attributes.position, b.attributes.position);
 assert.equal(a.index, source.index);
 assert.deepEqual(a.groups, source.groups);
 let first = 0, last = 0;
 a.addEventListener('dispose', () => {
  first++; assert.equal(a.index, null); assert.deepEqual(a.attributes, { aBorn: birth });
 });
 b.addEventListener('dispose', () => {
  last++; assert.equal(b.index, source.index); assert.equal(b.attributes.position, source.attributes.position);
 });
 a.dispose(); a.dispose();
 assert.equal(first, 1);
 assert.equal(a.attributes.position, source.attributes.position);
 b.dispose(); assert.equal(last, 1);
 // A later streamed chunk can acquire the same source after all GPU owners retire.
 const c = sharedPlantGeometry(source);
 c.addEventListener('dispose', () => assert.equal(c.attributes.position, source.attributes.position));
 c.dispose();
});

test('partial source sharing and either disposal order preserve the remaining buffers', () => {
 const source = new THREE.BoxGeometry(), other = new THREE.BufferGeometry();
 other.setAttribute('position', source.attributes.position);
 const a = sharedPlantGeometry(source), b = sharedPlantGeometry(other);
 a.addEventListener('dispose', () => {
  assert.equal(a.attributes.position, undefined);
  assert.equal(a.attributes.normal, source.attributes.normal);
  assert.equal(a.index, source.index);
 });
 b.addEventListener('dispose', () => assert.equal(b.attributes.position, source.attributes.position));
 a.dispose(); b.dispose();
});
