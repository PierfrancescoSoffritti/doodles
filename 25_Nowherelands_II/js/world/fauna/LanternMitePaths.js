import * as THREE from 'three';
import { PackedTriangleBoundsTree } from './PackedTriangleBoundsTree.js?v=stable-30-22';

// A small, static flight grid around one home. Conservative triangle bounds
// leave room for a whole seed body, including its hover motion.
export class LanternMitePaths {
 constructor(home,site,defer=false) {
  this.work=this.build(home,site);
  if(!defer)while(!this.work.next().done){}
 }
 *build(home,site) {
  this.step=0.32;this.origin=[-5.2,0.2,-3];this.count=[34,17,26];
  this.blocked=new Uint8Array(34*17*26);this.triangles=null;this.cache=new Map();
  const origin=site.point({x:0,y:0,z:0});
  const meshes=[];home.root.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh)});
  const count=meshes.reduce((n,mesh)=>n+mesh.geometry.attributes.position.count/3,0);
  this.triangles=new Float64Array(count*15);
  const triangle=new THREE.Triangle(),box=new THREE.Box3(),source=new THREE.Vector3();
  let offset=0;
  for(const mesh of meshes){const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i+=3){
    for(let j=0;j<3;j++){
     source.fromBufferAttribute(p,i+j);
     const dx=(source.x-origin.x)/site.scale,dz=(source.z-origin.z)/site.scale;
     const v=j===0?triangle.a:j===1?triangle.b:triangle.c;
     v.set(dx*site.tangent.x+dz*site.tangent.z,(source.y-origin.y)/site.scale,dx*site.normal.x+dz*site.normal.z);
     this.triangles[offset+j*3]=v.x;this.triangles[offset+j*3+1]=v.y;this.triangles[offset+j*3+2]=v.z;
    }
    box.makeEmpty().expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
    this.triangles[offset+9]=box.min.x;this.triangles[offset+10]=box.min.y;this.triangles[offset+11]=box.min.z;
    this.triangles[offset+12]=box.max.x;this.triangles[offset+13]=box.max.y;this.triangles[offset+14]=box.max.z;offset+=15;
    const a=[box.min.x-.19,box.min.y-.19,box.min.z-.19].map((v,k)=>Math.max(0,Math.ceil((v-this.origin[k])/this.step)));
    const b=[box.max.x+.19,box.max.y+.19,box.max.z+.19].map((v,k)=>Math.min(this.count[k]-1,Math.floor((v-this.origin[k])/this.step)));
    for(let z=a[2];z<=b[2];z++)for(let y=a[1];y<=b[1];y++)for(let x=a[0];x<=b[0];x++)this.blocked[this.id(x,y,z)]=1;
    if(i%384===0)yield;
   }
  }
  this.boundsTree=new PackedTriangleBoundsTree(this.triangles,true);
  yield* this.boundsTree.work;
  this.destinations=[];
  for(const root of site.home.roots.slice(0,2)){
   const curve=new THREE.CatmullRomCurve3(root.points.map(p=>new THREE.Vector3(...p)));
   for(const t of [0.2,0.4,0.6,0.8]){
    const p=curve.getPointAt(t);p.z+=root.radius*(1-0.67*t)+0.4;
    const i=this.nearest(p);if(i!==null)this.destinations.push({...this.point(i),kind:'root'}); yield;
   }
  }
  for(const s of site.home.stones){
   const p={x:s.x,y:site.groundLocal(s.x,s.z)+s.ry*1.52+0.35,z:s.z};
   const i=this.nearest(p);if(i!==null)this.destinations.push({...this.point(i),kind:'stone'}); yield;
  }
 }
 id(x,y,z){return x+this.count[0]*(y+this.count[1]*z);}
 coords(id){const x=id%34,y=Math.floor(id/34)%17,z=Math.floor(id/(34*17));return[x,y,z];}
 point(id){const a=this.coords(id);return{x:this.origin[0]+a[0]*this.step,y:this.origin[1]+a[1]*this.step,z:this.origin[2]+a[2]*this.step};}
 clear(a,b,radius=0.155,ends=false){
  const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.max(1,Math.ceil(d/0.09)),v=new THREE.Vector3(),near=new THREE.Vector3();
  const bounds=new THREE.Box3(new THREE.Vector3(Math.min(a.x,b.x)-radius,Math.min(a.y,b.y)-radius,Math.min(a.z,b.z)-radius),new THREE.Vector3(Math.max(a.x,b.x)+radius,Math.max(a.y,b.y)+radius,Math.max(a.z,b.z)+radius));
  const data=this.triangles,candidates=[],box=new THREE.Box3(),triangle=new THREE.Triangle();
  const loadBox=id=>{const k=id*15+9;box.min.set(data[k],data[k+1],data[k+2]);box.max.set(data[k+3],data[k+4],data[k+5]);};
  if(this.boundsTree)this.boundsTree.query(bounds,candidates);
  else for(let id=0;id<data.length/15;id++){loadBox(id);if(box.intersectsBox(bounds))candidates.push(id);}
  for(let i=0;i<=steps;i++){
   if(ends&&(i/steps*d<0.2||(1-i/steps)*d<0.2))continue;
   const t=i/steps;v.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
   for(const id of candidates){
    loadBox(id);if(box.distanceToPoint(v)>radius)continue;
    const k=id*15;triangle.a.set(data[k],data[k+1],data[k+2]);triangle.b.set(data[k+3],data[k+4],data[k+5]);triangle.c.set(data[k+6],data[k+7],data[k+8]);
    triangle.closestPointToPoint(v,near);if(near.distanceToSquared(v)<radius*radius-1e-6)return false;
   }
  }
  return true;
 }
 nearest(p){
  const c=[p.x,p.y,p.z].map((v,k)=>Math.max(0,Math.min(this.count[k]-1,Math.round((v-this.origin[k])/this.step))));
  const choices=[];
  for(let dz=-3;dz<=3;dz++)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
   const a=[c[0]+dx,c[1]+dy,c[2]+dz];if(a.some((v,k)=>v<0||v>=this.count[k]))continue;
   const id=this.id(...a);if(this.blocked[id])continue;const q=this.point(id);
   choices.push({id,d:(q.x-p.x)**2+(q.y-p.y)**2+(q.z-p.z)**2});
  }
  choices.sort((a,b)=>a.d-b.d);
  for(const q of choices.slice(0,16))if(this.clear(p,this.point(q.id),0.155,true))return q.id;
  return null;
 }
 route(from,to){
  if(this.clear(from,to,0.17,true))return[{...to}];
  const start=this.nearest(from),end=this.nearest(to);if(start===null||end===null)return[];
  const key=`${start}:${end}`;let nodes=this.cache.get(key);
  if(!nodes){
   const scores=new Float32Array(this.blocked.length).fill(Infinity),parent=new Int32Array(this.blocked.length).fill(-1),closed=new Uint8Array(this.blocked.length),heap=[];
   const target=this.coords(end),h=id=>this.coords(id).reduce((n,v,k)=>n+Math.abs(v-target[k]),0);
   const push=(id,f)=>{let i=heap.length;heap.push({id,f});while(i>0){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};};
   const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top.id;};
   scores[start]=0;push(start,h(start));
   while(heap.length){const id=pop();if(closed[id])continue;if(id===end)break;closed[id]=1;const a=this.coords(id);
    for(let k=0;k<3;k++)for(const sign of [-1,1]){const b=[...a];b[k]+=sign;if(b[k]<0||b[k]>=this.count[k])continue;const n=this.id(...b);
     if(this.blocked[n]||closed[n]||scores[id]+1>=scores[n])continue;scores[n]=scores[id]+1;parent[n]=id;push(n,scores[n]+h(n));
    }
   }
   if(start!==end&&parent[end]<0)return[];
   nodes=[end];while(nodes[0]!==start)nodes.unshift(parent[nodes[0]]);
   if(this.cache.size>96)this.cache.clear();this.cache.set(key,nodes);
  }
  const points=[...nodes.map(i=>this.point(i)),{...to}],path=[];let at=from;
  for(let i=0;i<points.length;){let next=i;
   while(next+1<points.length&&this.clear(at,points[next+1],0.17,true))next++;
   path.push(points[next]);at=points[next];i=next+1;
  }
  return path;
 }
 excursion(m){
  const list=this.destinations.filter(p=>(m.excursions%3===1?p.kind==='stone':p.kind==='root'));
  if(!list.length)return null;
  const first=(m.id*2+m.excursions)%list.length;
  return [{...list[first],hold:0.55},{...list[(first+1)%list.length],hold:0.35},
   {x:m.perch.x*0.5,y:1.3,z:2.1,hold:0.15}];
 }
}
