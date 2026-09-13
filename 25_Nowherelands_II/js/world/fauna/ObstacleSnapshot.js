// A journal entry owns the obstacle values at that step. Reuse an immutable
// snapshot while those values are unchanged; later collider mutations must not
// alter inputs retained for worker recovery.
export class ObstacleSnapshot {
 constructor() { this.value = []; }
 capture(obstacles) {
  const old = this.value;
  let next = old.length === obstacles.length ? null : new Array(obstacles.length);
  for (let i = 0; i < obstacles.length; i++) {
   const source = obstacles[i], previous = old[i], p = source.position;
   const same = previous && Object.is(previous.radius, source.radius)
    && Object.is(previous.position.x, p.x) && Object.is(previous.position.y, p.y) && Object.is(previous.position.z, p.z);
   if (!same && !next) { next = new Array(obstacles.length); for (let j = 0; j < i; j++) next[j] = old[j]; }
   if (next) next[i] = same ? previous : { position: { x: p.x, y: p.y, z: p.z }, radius: source.radius };
  }
  return this.value = next || old;
 }
}
