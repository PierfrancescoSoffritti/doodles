import { Random } from '../../core/Random.js';

// Three structural families, then seeded proportions, handedness and stones.
// The central flight lane stays open across every variation.
export function lanternHome(seed) {
 const r = new Random(`${seed}:home`), family = r.int(0, 2), hand = r.chance(0.5) ? -1 : 1;
 const height = r.range(0.92, 1.14), width = r.range(0.96, 1.1);
 const shape = p => [p[0] * hand * width, p[1] * height, p[2]];
 const roots = [], root = (points, radius, dark = false) => roots.push({ points: points.map(shape), radius, dark });
 if (family === 0) {
  root([[-3.8,0.1,0],[-3,1.3,-0.8],[-1.6,2.8,-1.6],[0.2,3.4,-1.9],[2.4,2.6,-1.4],[3.4,0.1,0.2]],0.72);
  root([[-1.6,2.8,-1.6],[-3,1.6,-1.1],[-3.8,0.3,0.8],[-4.6,0.04,2.3]],0.4,true);
 } else if (family === 1) {
  root([[-4,0.08,0.9],[-3.3,1.4,-0.5],[-2,2.9,-1.5],[-0.7,3.8,-2.3],[0.2,4,-3.4]],0.82);
  root([[-1.9,2.9,-1.6],[0.1,3.1,-1.8],[2.5,2.5,-1],[3.7,0.08,0.7]],0.62);
  root([[0,3.3,-2.1],[1.6,3.7,-2.6],[2.5,3.4,-3.5]],0.35,true);
 } else {
  root([[-4,0.08,0.3],[-3.2,1.7,-0.9],[-1.4,2.6,-1.9],[0.7,2.8,-2.1],[2.8,2.1,-1.3],[3.6,0.1,0.1]],0.64,true);
  root([[-2.5,2.1,-1.4],[-1.4,3,-2.2],[0.4,3.5,-3.5]],0.65);
 }
 const fork = family===2 ? [2.8,2.1,-1.3] : family===1 ? [2.5,2.5,-1] : [2.4,2.6,-1.4];
 root([fork,[3.2,1,-0.2],[3.7,0.2,1.1],[4.7,0.05,2.7]],0.4);
 root([[-3.5,0.35,0],[-3.3,0.18,1.4],[-2.8,0.04,2.3]],0.26,true);
 root([[3.4,0.3,0.1],[3.1,0.16,1.5],[3.6,0.04,2.2]],0.24);
 // A rear root joins the hollow to its host tree.
 const crown=family===2?[0.7,2.8,-2.1]:family===1?[-0.7,3.8,-2.3]:[0.2,3.4,-1.9];
 root([crown,[-0.1,3.6,-2.8],[0.3,3.9,-4.3]],0.7);
 const stones = [];
 for (const side of [-1, 1]) {
  const count = family === 2 ? r.int(3, 4) : r.int(1, 3);
  for (let i = 0; i < count; i++) {
   const size = r.range(0.48, family === 2 ? 1.02 : 0.82);
   stones.push({ x: side * r.range(3.3, 4.3), z: -1.1 + i * 1.15 + r.range(-0.25,0.25),
    rx: size * r.range(0.9,1.3), ry: size * r.range(0.65,1.2), rz: size * r.range(0.8,1.2), turn: r.range(0,6.28) });
  }
 }
 const perches = [-1.85,-0.8,0.15,1.12,2].map((x,i) => ({ x: x + r.range(-0.12,0.12),
  y: [0.62,0.36,0.45,0.55,0.35][i] + r.range(-0.03,0.12), z: r.range(0.1,0.72) }));
 const refuges = perches.map((p,i) => ({ x: p.x * 0.8, y: 0.22, z: -0.85 - i * 0.09 }));
 // Broken moss pockets replace the continuous rim of a display-like clearing.
 const moss = Array.from({length: 18}, () => {
  const side=r.chance(0.5)?-1:1;
  return { x:side*r.range(3.1,6.5),z:r.range(-2.8,3.8),size:r.range(0.1,0.3) };
 });
 const fringeRoots=[];
 for(const side of [-1,1]) for(let i=0;i<4;i++) {
  const start=[side*r.range(3.2,3.8),r.range(0.08,0.18),r.range(-0.5,1.5)];
  const end=[side*r.range(6.2,9),-0.035,r.range(-3.6,4.4)];
  const points=[start,[side*r.range(4.1,4.7),r.range(0.12,0.24),start[2]+r.range(-0.8,0.8)],
   [end[0]*0.84,r.range(0.03,0.12),end[2]*0.7],end];
  fringeRoots.push({points,radius:r.range(0.12,0.28),dark:i%2===0,ground:true});
  if(i%2===0)fringeRoots.push({points:[points[1],[side*r.range(5,6.2),0.1,points[1][2]+1],[side*r.range(6.4,8.5),-0.025,points[1][2]+2]],radius:0.1,dark:true,ground:true});
 }
 const brambles=Array.from({length:r.int(7,10)},(_,i)=>({x:(i%2?-1:1)*r.range(4.1,7.7),z:r.range(-3,3.2),height:r.range(0.65,1.8),spread:r.range(0.5,1.05),phase:r.range(0,6.28)}));
 return { family: ['arched root','forked root','stone cradle'][family], roots, fringeRoots, brambles, stones, perches, refuges, moss, tint:r.range(-0.025,0.025) };
}

// Conservative ellipsoid supports also keep retreat paths above the resting stones.
export function lanternRestingFloor(home, x, z, sizes, padding=0) {
 let floor = 0;
 for (let i = 0; i < home.perches.length; i++) {
  const p = home.perches[i], d = (Math.max(0,Math.abs(x-p.x)-padding)/0.34)**2 + (Math.max(0,Math.abs(z-p.z)-padding)/0.3)**2;
  if (d < 1) floor = Math.max(floor, (p.y-sizes[i]) * Math.sqrt(1-d));
 }
 return floor;
}
