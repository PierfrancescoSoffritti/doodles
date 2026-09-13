// Only unrevealed plants need proximity checks. Keep their original order so
// the random growth delay and every written birth time stay unchanged.
export function preparePlantReveal(group, unborn) {
 const a = group.attr.array, rows = new Float64Array(group.pending * 5);
 let count = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, radius = 0;
 for (let i = 0; i < group.count; i++) {
  const start = group.rangeData ? group.rangeData[i * 2] : group.ranges ? group.ranges[i][0] : i;
  const end = group.rangeData ? group.rangeData[i * 2 + 1] : group.ranges ? group.ranges[i][1] : i + 1;
  if (a[start] !== unborn || start === end) continue;
  const x = group.pos[i * 2], z = group.pos[i * 2 + 1], reach = (group.kind || group.kinds[i]).reveal;
  const k = count++ * 5;
  rows[k] = x; rows[k + 1] = z; rows[k + 2] = start; rows[k + 3] = end; rows[k + 4] = reach * reach;
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); radius = Math.max(radius, reach);
 }
 group.revealRows = rows; group.revealCount = count;
 group.revealBounds = [minX, maxX, minZ, maxZ, radius * radius];
 return group;
}

export function revealPlants(group, time, px, pz, random = Math.random) {
 if (group.pending <= 0) return;
 const b = group.revealBounds;
 const bx = Math.max(0, b[0] - px, px - b[1]), bz = Math.max(0, b[2] - pz, pz - b[3]);
 if (bx * bx + bz * bz >= b[4]) return;
 const rows = group.revealRows, a = group.attr.array;
 let remaining = 0, changed = false;
 for (let i = 0; i < group.revealCount; i++) {
  const k = i * 5, dx = rows[k] - px, dz = rows[k + 1] - pz;
  if (dx * dx + dz * dz < rows[k + 4]) {
   const born = time + random() * .4;
   for (let j = rows[k + 2]; j < rows[k + 3]; j++) a[j] = born;
   group.pending--; changed = true;
  } else {
   if (remaining !== i) for (let j = 0; j < 5; j++) rows[remaining * 5 + j] = rows[k + j];
   remaining++;
  }
 }
 group.revealCount = remaining;
 if (changed) group.attr.needsUpdate = true;
}
