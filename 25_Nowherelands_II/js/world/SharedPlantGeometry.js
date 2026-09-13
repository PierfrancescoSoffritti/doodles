import * as THREE from 'three';

const users = new WeakMap();

// Plants keep immutable vertex data for each silhouette and private instance
// birth times. Three normally deletes every attribute when a geometry is
// disposed, so release a shared buffer only when its last geometry is removed.
export function sharedPlantGeometry(source) {
 const geometry = new THREE.BufferGeometry();
 geometry.index = source.index;
 Object.assign(geometry.attributes, source.attributes);
 geometry.groups = source.groups.map(group => ({ ...group }));
 geometry.drawRange = { ...source.drawRange };
 geometry.userData = { ...source.userData };
 const buffers = new Set([source.index, ...Object.values(source.attributes)].filter(Boolean));
 for (const buffer of buffers) users.set(buffer, (users.get(buffer) || 0) + 1);
 const dispose = geometry.dispose;
 let disposed = false;
 geometry.dispose = function () {
  if (disposed) return;
  disposed = true;
  const retained = new Set();
  for (const buffer of buffers) {
   const remaining = users.get(buffer) - 1;
   if (remaining) { users.set(buffer, remaining); retained.add(buffer); }
   else users.delete(buffer);
  }
  const index = this.index, attributes = this.attributes;
  // Disposal events are synchronous. Hide only buffers still owned by another
  // live geometry; private attributes and Three's per-geometry bindings retire now.
  this.index = retained.has(index) ? null : index;
  this.attributes = Object.fromEntries(Object.entries(attributes).filter(([, a]) => !retained.has(a)));
  try { dispose.call(this); }
  finally { this.index = index; this.attributes = attributes; }
 };
 return geometry;
}
