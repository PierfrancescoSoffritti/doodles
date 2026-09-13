// Fauna only reads these surface records. The completed terrain, habitats and
// cave openings are immutable; a sea-level change invalidates the records.
// Retained records are immutable and never overwritten when their slot collides.
const SIDE = ['_water', '_bank', '_foam', '_riverDist', '_riverWidth',
 '_riverAlong', '_riverAcross', '_riverSeg', '_slope', '_hardness'];
const HABITAT = ['forest', 'wet', 'coast', 'alt'];
const STRIDE = 18;

export class FaunaSurfaceCache {
 constructor(heightmap, sample, capacity = 2048) {
  if (capacity < 1 || (capacity & (capacity - 1))) throw Error('Cache capacity must be a power of two');
  this.hm = heightmap; this.original = sample; this.mask = capacity - 1;
  this.data = new Float64Array(capacity * STRIDE);
  this.records = new Array(capacity); this.waterLevel = heightmap.waterLevel;
  this.hits = 0; this.misses = 0;
  this.sample = (x, z, clearanceOnly = false) => this.read(x, z, clearanceOnly);
 }
 read(x, z, clearanceOnly) {
  // Clearance-only callers deliberately do not update habitat scratch values.
  if (clearanceOnly) return this.original(x, z, true);
  const h = this.hm, a = this.data;
  if (h.waterLevel !== this.waterLevel) {
   this.records.fill(undefined); this.waterLevel = h.waterLevel;
  }
  const slot = (Math.imul((x * 1024) | 0, 73856093) ^ Math.imul((z * 1024) | 0, 19349663)) & this.mask;
  const k = slot * STRIDE, record = this.records[slot];
  if (record && Object.is(a[k], x) && Object.is(a[k + 1], z)) {
   this.hits++;
   h._water = a[k + 2]; h._bank = a[k + 3]; h._foam = a[k + 4]; h._riverDist = a[k + 5]; h._riverWidth = a[k + 6]; h._riverAlong = a[k + 7]; h._riverAcross = a[k + 8]; h._riverSeg = a[k + 9]; h._slope = a[k + 10]; h._hardness = a[k + 11];
   h.lakes.shoreId = a[k + 12]; h.lakes.shoreDistance = a[k + 13];
   h._hab.forest = a[k + 14]; h._hab.wet = a[k + 15]; h._hab.coast = a[k + 16]; h._hab.alt = a[k + 17];
   return record;
  }
  this.misses++;
  const result = Object.freeze(this.original(x, z));
  a[k] = x; a[k + 1] = z;
  for (let j = 0; j < SIDE.length; j++) a[k + 2 + j] = h[SIDE[j]];
  a[k + 12] = h.lakes.shoreId; a[k + 13] = h.lakes.shoreDistance;
  for (let j = 0; j < HABITAT.length; j++) a[k + 14 + j] = h._hab[HABITAT[j]];
  this.records[slot] = result;
  return result;
 }
}
