import { Random } from '../../core/Random.js';

// A conservative open-water pocket within one generated freshwater basin.
// Reject the whole pocket if its interior contains an island, rapids or an obstacle.
export function rayWater(s, lake) {
 return Number.isFinite(s.ground) && Number.isFinite(s.water) && !s.roof
  && s.water - s.ground > 0.8 && s.foam < 0.2 && Math.abs(s.water - lake.y) < 0.5
  && (s.lake === undefined || s.lake === lake.id);
}
export function rayHabitatSite(lake, seed, sample, blocked = () => false) {
 const rnd = new Random(`${seed}:ray-habitat:${lake.id}`);
 if (!rnd.chance(0.6)) return null;
 const shores = [...lake.shore].map(q => ({ q, order: rnd.next() })).sort((a,b) => a.order-b.order);
 for (const { q } of shores.slice(0, 18)) {
  const radius = 44, x = q.x + q.nx * (radius - 3), z = q.z + q.nz * (radius - 3);
  const inside = (px,pz) => rayWater(sample(px,pz),lake) && !blocked(px,pz,5,lake.y+10);
  if (!inside(x,z)) continue;
  let valid = true;
  for (let dx=-radius; dx<=radius && valid; dx+=5) for (let dz=-radius; dz<=radius; dz+=5) {
   if (dx*dx+dz*dz > radius*radius) continue;
   if (!inside(x+dx,z+dz)) { valid=false; break; }
  }
  for (let i=0;i<64 && valid;i++) valid=inside(x+Math.cos(i*Math.PI/32)*radius,z+Math.sin(i*Math.PI/32)*radius);
  if (!valid) continue;
  const view = { x:q.x-q.nx*14, z:q.z-q.nz*14 };
  const bank=sample(view.x,view.z);
  if (!Number.isFinite(bank.ground) || bank.roof || bank.ground < bank.water || bank.ground > lake.y+12 || bank.slope>0.5 || blocked(view.x,view.z,3,bank.ground+5)) continue;
  view.y=bank.ground+11;
  return { id:`ray-lake:${lake.id}`, lake:lake.id, x,z,y:lake.y,radius,nx:q.nx,nz:q.nz,tx:q.tx,tz:q.tz,view,count:rnd.chance(0.3)?2:1 };
 }
 return null;
}
