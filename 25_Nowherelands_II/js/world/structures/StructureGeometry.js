import * as THREE from 'three';
import { Random } from '../../core/Random.js';

// Clip corners inward and bevel the front/back edges. The original conservative
// walking footprint still contains every support; the opening never narrows.
export function wornPart(part,seed){
 const rnd=new Random(seed),outline=[];
 for(let i=0;i<part.points.length;i++){
  const a=part.points[(i+part.points.length-1)%part.points.length],b=part.points[i],c=part.points[(i+1)%part.points.length];
  const cut=rnd.range(.55,1.5);
  for(const n of [a,c]){const t=Math.min(.16,cut/Math.hypot(n[0]-b[0],n[1]-b[1]));outline.push([b[0]+(n[0]-b[0])*t,b[1]+(n[1]-b[1])*t]);}
 }
 let area=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];area+=a[0]*b[1]-b[0]*a[1];}if(area<0)outline.reverse();
 const vertices=[],d=part.depth/2;
 // Offset along the edge normals, then ear-clip the caps. A centre fan would
 // incorrectly fill the hollow of a concave folded wing.
 const inner=outline.map((p,i)=>{
  const a=outline[(i+outline.length-1)%outline.length],b=outline[(i+1)%outline.length];
  const al=Math.hypot(p[0]-a[0],p[1]-a[1]),bl=Math.hypot(b[0]-p[0],b[1]-p[1]);
  const n=[-(p[1]-a[1])/al,(p[0]-a[0])/al],m=[-(b[1]-p[1])/bl,(b[0]-p[0])/bl];
  const scale=.55/Math.max(.5,1+n[0]*m[0]+n[1]*m[1]);return [p[0]+(n[0]+m[0])*scale,p[1]+(n[1]+m[1])*scale];
 });
 const tri=(a,b,c)=>vertices.push(...a,...b,...c);
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length,a=outline[i],b=outline[j],u=inner[i],v=inner[j];
  tri([...a,-d+.65],[...b,-d+.65],[...b,d-.65]);tri([...a,-d+.65],[...b,d-.65],[...a,d-.65]);
  for(const side of [-1,1]){
   const A=[...a,side*(d-.65)],B=[...b,side*(d-.65)],U=[...u,side*d],V=[...v,side*d];
   if(side>0){tri(A,B,V);tri(A,V,U);}else{tri(B,A,U);tri(B,U,V);}
  }
 }
 for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(inner.map(p=>new THREE.Vector2(...p)),[])){
  tri([...inner[a],d],[...inner[b],d],[...inner[c],d]);tri([...inner[c],-d],[...inner[b],-d],[...inner[a],-d]);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}

// A broken threshold and a few fallen chips hug the actual terrain. All are
// merged into the gate mesh; their shallow relief does not need new colliders.
export function gateFooting(site,hm,seed){
 const rnd=new Random(seed+':gate-fragments'),vertices=[];
 const tri=(a,b,c)=>vertices.push(...a,...b,...c);
 const ground=(x,z)=>hm.height(site.x+site.cos*x+site.sin*z,site.z-site.sin*x+site.cos*z)-site.y;
 const slab=(x,z,rx,rz,height,angle)=>{
  const points=[];
  for(let i=0;i<6;i++){const a=i*Math.PI/3,px=Math.cos(a)*rx*rnd.range(.8,1),pz=Math.sin(a)*rz*rnd.range(.8,1),X=x+Math.cos(angle)*px-Math.sin(angle)*pz,Z=z+Math.sin(angle)*px+Math.cos(angle)*pz;points.push([X,ground(X,Z)+.035,Z]);}
  const c=[x,ground(x,z)+height,z];
  for(let i=0;i<6;i++)tri(points[i],c,points[(i+1)%6]);
 };
 for(let i=-2;i<=2;i++)slab(i*5.5,rnd.range(-.7,.7),3.5,rnd.range(3.6,5),rnd.range(.08,.19),rnd.range(-.12,.12));
 for(let i=0;i<12;i++){
  const side=i%2?-1:1,x=side*rnd.range(29,39),z=rnd.range(-13,15);
  slab(x,z,rnd.range(.8,2.2),rnd.range(.6,1.8),rnd.range(.15,.55),rnd.range(0,6.28));
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}

export function facetedPart(part){
 const points=part.points.map(p=>[...p]);let area=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}
 if(area<0)points.reverse();
 const center=[points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length],d=part.depth/2,vertices=[];
 const triangle=(a,b,c)=>vertices.push(...a,...b,...c);
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],af=[...a,d],bf=[...b,d],ab=[...a,-d],bb=[...b,-d];
  triangle(af,bf,[...center,d+.9]);triangle(bb,ab,[...center,-d]);triangle(ab,bb,bf);triangle(ab,bf,af);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}

export function altarPieces(site){
 const vertices=[],rnd=new Random(`${Math.round((site.x||0)*100)}:${Math.round((site.z||0)*100)}:stone-chips`),tri=(a,b,c)=>vertices.push(...a,...b,...c);
 for(const stone of site.stones){
  const {points,top,base}=stone,c=points.reduce((s,p)=>[s[0]+p[0]/points.length,s[1]+p[1]/points.length],[0,0]);
  const vertex=(p,y)=>[p[0],y-site.y,p[1]];
  // A narrow chipped rim gives each flagstone a distinct upper face.
  const inset=points.map(p=>{const dx=c[0]-p[0],dz=c[1]-p[1],t=rnd.range(.15,.55)/Math.hypot(dx,dz);return [p[0]+dx*t,p[1]+dz*t];});
  for(let i=0;i<points.length;i++){
   const j=(i+1)%points.length,a=points[i],b=points[j],u=inset[i],v=inset[j];
   tri(vertex(c,top+.14),vertex(v,top),vertex(u,top));
   tri(vertex(a,top-.22),vertex(u,top),vertex(v,top));tri(vertex(a,top-.22),vertex(v,top),vertex(b,top-.22));
   tri(vertex(a,base),vertex(a,top-.22),vertex(b,top-.22));tri(vertex(a,base),vertex(b,top-.22),vertex(b,base));
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return [g];
}
