import { Random } from '../../core/Random.js';
import { lanternHome } from './LanternMiteHome.js';

export function lanternHabitat(sample) {
 return Number.isFinite(sample.ground) && Number.isFinite(sample.water) && sample.ground > sample.water + 2
  && sample.slope < 0.4 && sample.forest > 0.08 && sample.wet > 0.1 && sample.coast < 0.5 && !sample.roof;
}

// Every flight is bounded to this small patch. A sampled bark surface keeps
// resting bodies outside the real tree, rather than against a generic cylinder.
export function lanternBarkSite(host, sample, barkDepth, seed, angle) {
 if (!lanternHabitat(sample(host.x, host.z))) return null;
 const scale = Math.min(4, Math.max(1.5, host.radius * 0.35));
 const normal = { x: Math.cos(angle), z: Math.sin(angle) }, tangent = { x: -normal.z, z: normal.x };
 const base = host.y + 4.5, depths = [], nx = 11, ny = 5;
 for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const x = -2.5 + i * 0.5, y = 0.1 + j * 0.4;
  const depth = barkDepth(x * scale, base + y * scale, normal, tangent);
  if (!Number.isFinite(depth)) return null;
  depths.push(depth);
 }
 function surface(x, y) {
  const u = Math.max(0, Math.min(nx - 1.000001, (x + 2.5) / 0.5));
  const v = Math.max(0, Math.min(ny - 1.000001, (y - 0.1) / 0.4));
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  return (depths[j * nx + i] * (1 - a) + depths[j * nx + i + 1] * a) * (1 - b)
   + (depths[(j + 1) * nx + i] * (1 - a) + depths[(j + 1) * nx + i + 1] * a) * b;
 }
 const site = { id: host.id, host, scale, angle, normal, tangent, base, forest: sample(host.x, host.z).forest,
  point(p, radius = 0) {
   const depth = surface(p.x, p.y) + Math.max(0, p.z) * scale + radius + 0.2;
   return { x: host.x + tangent.x * p.x * scale + normal.x * depth,
    y: base + p.y * scale, z: host.z + tangent.z * p.x * scale + normal.z * depth };
  },
 };
 // Validate the entire open flight volume's lowest layer, not just five spawn points.
 for (let i = 0; i < nx; i++) for (const z of [0, 0.6, 1.2, 1.8, 2.4]) {
  const p = site.point({ x: -2.5 + i * 0.5, y: 0.1, z }, 0.16 * scale);
  const s = sample(p.x, p.z);
  if (!lanternHabitat(s) || p.y < s.ground + 0.3 * scale) return null;
 }
 site.center = site.point({ x: 0, y: 0.75, z: 0.7 });
 const visitor = site.point({ x: 0, y: 0.8, z: 7 });
 const ground = sample(visitor.x, visitor.z);
 if (!lanternHabitat(ground)) return null;
 site.arrival = { ...visitor, y: ground.ground + 11 };
 site.seed = `${seed}:lantern:${host.id}`;
 return site;
}

export function lanternAngles(seed, host) {
 const random = new Random(`${seed}:lantern-side:${host.id}`), first = random.range(0, Math.PI * 2);
 return [first, first + Math.PI / 2, first + Math.PI, first + 1.5 * Math.PI];
}

export function lanternHollowSite(barkSite, sample) {
 const { host, scale, normal, tangent } = barkSite;
 const origin = barkSite.point({x:0,y:0.75,z:3.1});
 const horizontal = (x,z) => ({ x:origin.x+(tangent.x*x+normal.x*z)*scale,
  z:origin.z+(tangent.z*x+normal.z*z)*scale });
 const heights = [];
 for (let x=-5.5;x<=5.5;x+=0.5) for (let z=-2.6;z<=3.4;z+=0.5) {
  const p=horizontal(x,z), s=sample(p.x,p.z);
  if (!lanternHabitat(s)) return null;
  heights.push(s.ground);
 }
 const low=Math.min(...heights), high=Math.max(...heights);
 // A low, irregular earth bed can meet a gentle slope without becoming a plinth.
 if (high-low>scale*1.15) return null;
 const base=high+0.08*scale;
 const site={...barkSite, base, home:lanternHome(barkSite.seed),
  point(p) { const at=horizontal(p.x,p.z); return {...at,y:base+p.y*scale}; },
  groundLocal(x,z) { const p=horizontal(x,z); return (sample(p.x,p.z).ground-base)/scale; }
 };
 site.canGrow=(x,z)=>{const p=horizontal(x,z),s=sample(p.x,p.z);return lanternHabitat(s)&&Math.abs(s.ground-base)<scale*2;};
 site.center=site.point({x:0,y:1.15,z:0.7});
 const arrival=site.point({x:0,y:0,z:7}), s=sample(arrival.x,arrival.z);
 if (!lanternHabitat(s)) return null;
 site.arrival={...arrival,y:s.ground+11};
 return site;
}
