import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lanternHomeMaterial, lanternBrambleMaterial } from './LanternMiteHomeMaterials.js';

export class LanternMiteHomeMeshes {
 constructor(parent,site,mites,materials={}) {
  this.site=site; this.root=new THREE.Group(); this.root.name=`Lantern home · ${site.home.family}`; parent.add(this.root);
  this.masks=new Map(); this.colliders=[];
  const origin=site.point({x:0,y:0,z:0});
  this.lightUniforms={uHomeOrigin:{value:new THREE.Vector3(origin.x,origin.y,origin.z)},
   uHomeNormal:{value:new THREE.Vector2(site.normal.x,site.normal.z)},uHomeTangent:{value:new THREE.Vector2(site.tangent.x,site.tangent.z)},
   uHomeScale:{value:site.scale},uHomeGlow:{value:1}};
  const h=site.home, parts=Array.from({length:5},()=>[]);
  const add=(source,kind)=>{ const g=source.index?source.toNonIndexed():source;
   if(g!==source)source.dispose();const p=g.attributes.position;
   for(let i=0;i<p.count;i++){const at=site.point({x:p.getX(i),y:p.getY(i),z:p.getZ(i)});p.setXYZ(i,at.x,at.y,at.z);}
   // The habitat's tangent/normal basis is mirrored; restore outward winding.
   for(let i=0;i<p.count;i+=3){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,x,y,z);}
   g.computeVertexNormals(); parts[kind].push(g);
  };
  for(const root of [...h.roots,...h.fringeRoots]) {
   if(root.ground&&root.points.some(([x,,z])=>!site.canGrow(x,z)))continue;
   const points=root.points.map(([x,y,z])=>new THREE.Vector3(x,y+site.groundLocal(x,z)*(root.ground?1:Math.max(0,1-y/0.65)),z));
   const curve=new THREE.CatmullRomCurve3(points), segments=28, sides=7;
   const g=new THREE.TubeGeometry(curve,segments,root.radius,sides,false), p=g.attributes.position;
   for(let ring=0;ring<=segments;ring++) {
    const t=ring/segments,c=curve.getPointAt(t),taper=(1-0.67*t)*(1+0.06*Math.sin(t*22));
    for(let side=0;side<=sides;side++){const i=ring*(sides+1)+side;
     p.setXYZ(i,c.x+(p.getX(i)-c.x)*taper,c.y+(p.getY(i)-c.y)*taper,c.z+(p.getZ(i)-c.z)*taper);
    }
   }
   add(g,root.dark?1:0);
   for(const p of points.filter(p=>!root.ground&&p.y<0.5)) {
    const at=site.point({x:p.x,y:p.y,z:p.z});
    this.colliders.push({position:new THREE.Vector3(at.x,at.y,at.z),radius:root.radius*site.scale*0.8});
   }
  }
  const stone=(x,y,z,rx,ry,rz,turn,kind)=>{
   const g=new THREE.IcosahedronGeometry(1,1);
   // The unit sphere bounds match the conservative resting-floor ellipsoids.
   g.scale(rx,ry,rz);g.rotateY(turn);g.translate(x,y,z);add(g,kind);
  };
  for(const s of h.stones){
   const ground=site.groundLocal(s.x,s.z),cy=ground+s.ry*0.52;
   stone(s.x,cy,s.z,s.rx,s.ry,s.rz,s.turn,2);
   stone(s.x+s.rx*0.16,cy+s.ry*0.72,s.z-s.rz*0.12,s.rx*0.52,s.ry*0.24,s.rz*0.57,s.turn,3);
   const at=site.point({x:s.x,y:cy,z:s.z});
   this.colliders.push({position:new THREE.Vector3(at.x,at.y,at.z),radius:Math.max(s.rx,s.rz)*site.scale});
  }
  for(const m of mites){const p=m.perch,top=p.y-m.size;
   stone(p.x,-0.025,p.z,0.34,top+0.025,0.3,0,3);
  }
  for(const p of h.moss) if(site.canGrow(p.x,p.z))stone(p.x,site.groundLocal(p.x,p.z)+0.025,p.z,p.size*1.5,p.size*0.2,p.size,0,3);
  // An irregular, low earth apron meets the terrain at its rim; no display base.
  const vertices=[],n=28;
  for(let i=0;i<n;i++){
   const ring=k=>{
    const a=k/n*Math.PI*2;let r=1+0.18*Math.sin(a*5+h.tint*50)+0.08*Math.cos(a*9);
    while(r>0.6&&!site.canGrow(Math.cos(a)*6.4*r,0.2+Math.sin(a)*4.3*r))r*=0.85;
    return{x:Math.cos(a)*6.4*r,z:0.2+Math.sin(a)*4.3*r};
   };
   const a=ring(i),b=ring(i+1),ai={x:Math.cos(i/n*Math.PI*2)*2.8,z:Math.sin(i/n*Math.PI*2)*1.8},bi={x:Math.cos((i+1)/n*Math.PI*2)*2.8,z:Math.sin((i+1)/n*Math.PI*2)*1.8};
   const v=p=>[p.x,site.groundLocal(p.x,p.z)-0.025,p.z], inner=p=>[p.x,-0.04,p.z];
   vertices.push(0,-0.04,0,...inner(ai),...inner(bi),...inner(ai),...v(a),...v(b),...inner(ai),...v(b),...inner(bi));
  }
  const earth=new THREE.BufferGeometry();earth.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));earth.computeVertexNormals();
  // All pieces share a position/normal/uv schema before merging.
  earth.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));
  earth.setIndex(Array.from({length:vertices.length/3},(_,i)=>i));add(earth,4);
  for(let kind=0;kind<parts.length;kind++)if(parts[kind].length){
   // Icosahedra do not have the tube's optional attributes beyond these three.
   const geometry=mergeGeometries(parts[kind]);parts[kind].forEach(g=>g.dispose());
   if(kind>=3){const count=geometry.attributes.position.count;
    geometry.setAttribute('aCave',new THREE.Float32BufferAttribute(new Float32Array(count).fill(-100),1));
    geometry.setAttribute('aApron',new THREE.Float32BufferAttribute(new Float32Array(count),1));
   }
   const material=lanternHomeMaterial(kind,materials,this.lightUniforms);
   this.root.add(new THREE.Mesh(geometry,material));
  }
  // Open, angular thorn stems echo the world's wire grasses and move in its wind.
  const lines=[],bases=[],info=[];
  for(const b of h.brambles){
   if(!site.canGrow(b.x,b.z))continue;
   const floor=site.groundLocal(b.x,b.z),base=site.point({x:b.x,y:floor,z:b.z});
   const point=(x,y,z)=>[b.x+x,floor+y,b.z+z];
   const segment=(a,c)=>{for(const p of [a,c]){
    const at=site.point({x:p[0],y:p[1],z:p[2]});lines.push(at.x,at.y,at.z);bases.push(base.x,base.y,base.z);
    info.push(Math.max(0,Math.min(1,(p[1]-floor)/b.height)),b.phase,0,1);
   }};
   for(let stem=0;stem<4;stem++){
    const angle=b.phase+stem*1.8,dx=Math.cos(angle)*b.spread,dz=Math.sin(angle)*b.spread;
    const p=[point(0,0,0),point(dx*0.25,b.height*0.5,dz*0.25),point(dx*0.65,b.height*(0.8+stem*0.065),dz*0.65),point(dx,b.height*0.57,dz)];
    for(let k=0;k<3;k++)segment(p[k],p[k+1]);
    for(let k=1;k<3;k++){
     const q=p[k],sign=k%2?1:-1;
     segment(q,[q[0]+dz*sign*0.3,q[1]+b.height*0.21,q[2]-dx*sign*0.3]);
     segment(q,[q[0]-dz*sign*0.18,q[1]+b.height*0.11,q[2]+dx*sign*0.18]);
    }
   }
  }
  if(lines.length){const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.setAttribute('aBase',new THREE.Float32BufferAttribute(bases,3));
   g.setAttribute('aInfo',new THREE.Float32BufferAttribute(info,4));g.setAttribute('aBorn',new THREE.Float32BufferAttribute(new Float32Array(lines.length/3).fill(-1e6),1));
   g.computeBoundingSphere();g.boundingSphere.radius+=4;
   this.root.add(new THREE.LineSegments(g,lanternBrambleMaterial(materials.bramble)));
  }
 }
 update(dt,model) {
  const brightness=Math.max(...model.mites.map(m=>m.brightness));
  const retreating=model.mites.every(m=>['hidden','retreat'].includes(m.state));
  const target=model.sheltered||retreating?0.12:1+Math.max(0,brightness-0.35)*0.32;
  this.lightUniforms.uHomeGlow.value+=(target-this.lightUniforms.uHomeGlow.value)*(1-Math.exp(-dt*3.5));
 }
 clearGrass(vegetation) {
  for(const chunk of vegetation.chunks.values()){
   if(this.masks.has(chunk))continue;
   const saves=[];this.masks.set(chunk,saves);
   for(const group of chunk.groups){
    if(!group.ranges||!group.names)continue;
    const mesh=chunk.meshes.find(m=>m.geometry?.getAttribute('aBorn')===group.attr),p=mesh?.geometry.attributes.position,base=mesh?.geometry.attributes.aBase;
    if(!p||!base)continue;
    for(let i=0;i<group.count;i++){
     if(!['tuft','sprout'].includes(group.names[i]))continue;
     const dx=group.pos[i*2]-this.site.center.x,dz=group.pos[i*2+1]-this.site.center.z;
     const x=(dx*this.site.tangent.x+dz*this.site.tangent.z)/this.site.scale,z=(dx*this.site.normal.x+dz*this.site.normal.z)/this.site.scale;
     if((x/3.3)**2+(z/2.5)**2>1)continue;
     const [start,end]=group.ranges[i],saved=p.array.slice(start*3,end*3);saves.push({p,start,saved});
     for(let k=start;k<end;k++)p.setXYZ(k,base.getX(start),base.getY(start),base.getZ(start));
     p.needsUpdate=true;
    }
   }
  }
  for(const chunk of this.masks.keys())if(![...vegetation.chunks.values()].includes(chunk))this.masks.delete(chunk);
 }
 dispose() {
  for(const saves of this.masks.values())for(const {p,start,saved}of saves){p.array.set(saved,start*3);p.needsUpdate=true;}
  this.masks.clear();this.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.root.removeFromParent();
 }
}
