import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { lanternHome } from '../../js/world/fauna/LanternMiteHome.js';
import { lanternBarkSite, lanternHollowSite } from '../../js/world/fauna/LanternMiteHabitat.js?v=stable-30-3';
import { LanternMiteColony } from '../../js/world/fauna/LanternMiteWorldModel.js?v=pebble-voice-4b';

registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return{url:new URL('../../../common/libs/three-0.185/examples/jsm/'+specifier.slice(13),import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const THREE=await import('three');
const {LanternMiteHomeMeshes}=await import('../../js/world/fauna/LanternMiteHomeMeshes.js?v=stable-30-6');
const {LanternMitePaths}=await import('../../js/world/fauna/LanternMitePaths.js?v=stable-30-22');
const sample=(x,z)=>({ground:0.012*x+0.006*z,water:-5,slope:0.015,forest:0.7,wet:0.5,coast:0,roof:false});
const host={id:'old-tree',x:0,y:0,z:0,radius:8};
const site=seed=>lanternHollowSite(lanternBarkSite(host,sample,x=>Math.sqrt(10**2-x**2),seed,0.7),sample);

test('staged homes and flight preparation produce the same complete geometry and routes',()=>{
 const s=site('staged-home'),colony=new LanternMiteColony(s);
 const full=new LanternMiteHomeMeshes(new THREE.Group(),s,colony.model.mites);
 const staged=new LanternMiteHomeMeshes(new THREE.Group(),s,colony.model.mites,{},true);
 assert.equal(staged.root.children.length,0);
 let pieces=0;while(!staged.work.next().done)pieces++;
 assert.ok(pieces>50,'work must have fine-grained yield points');
 assert.equal(staged.root.children.length,full.root.children.length);
 for(let i=0;i<full.root.children.length;i++){
  const a=full.root.children[i].geometry,b=staged.root.children[i].geometry;
  for(const key of Object.keys(a.attributes))assert.deepEqual(b.attributes[key].array,a.attributes[key].array);
 }
 assert.deepEqual(staged.colliders,full.colliders);
 const a=new LanternMitePaths(full,s),b=new LanternMitePaths(staged,s,true);let chunks=0;
 while(!b.work.next().done)chunks++;
 assert.ok(chunks>80);assert.deepEqual(b.blocked,a.blocked);assert.deepEqual(b.destinations,a.destinations);
 for(const m of colony.model.mites)for(const d of a.destinations)assert.deepEqual(b.route(m.pos,d),a.route(m.pos,d));
 full.dispose();staged.dispose();
});

test('cancelling a partial home disposes its private pieces without installing a root',()=>{
 const s=site('cancelled-home'),colony=new LanternMiteColony(s),parent=new THREE.Group();
 const home=new LanternMiteHomeMeshes(parent,s,colony.model.mites,{},true);
 for(let i=0;i<8;i++)home.work.next();
 home.dispose();assert.equal(parent.children.length,0);assert.equal(home.work.next().done,true);
});

test('indexed flight clearance matches the full triangle scan across home shapes',()=>{
 for(let seed=0;seed<5;seed++){
  const s=site(`index-${seed}`),colony=new LanternMiteColony(s),home=new LanternMiteHomeMeshes(new THREE.Group(),s,colony.model.mites);
  const paths=new LanternMitePaths(home,s),tree=paths.boundsTree;
  for(let i=0;i<120;i++){
   const a={x:Math.sin(i*1.71)*6,y:(i%13)*.31-.2,z:Math.cos(i*.79)*4};
   const b={x:a.x+Math.sin(i*.21)*2,y:a.y+Math.cos(i*.53),z:a.z+Math.cos(i*.11)*2};
   paths.boundsTree=null;const expected=paths.clear(a,b,.17,i%2===0);
   paths.boundsTree=tree;assert.equal(paths.clear(a,b,.17,i%2===0),expected,`seed ${seed}, query ${i}`);
  }
  home.dispose();
 }
});

test('packed home collision preserves original local triangles and full-scan clearance',()=>{
 for(let seed=0;seed<5;seed++){
  const s=site(`packed-${seed}`),colony=new LanternMiteColony(s),home=new LanternMiteHomeMeshes(new THREE.Group(),s,colony.model.mites);
  const paths=new LanternMitePaths(home,s),triangles=[],origin=s.point({x:0,y:0,z:0});
  const local=p=>{const dx=(p.x-origin.x)/s.scale,dz=(p.z-origin.z)/s.scale;return new THREE.Vector3(dx*s.tangent.x+dz*s.tangent.z,(p.y-origin.y)/s.scale,dx*s.normal.x+dz*s.normal.z);};
  home.root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i+=3){const t=new THREE.Triangle(...[i,i+1,i+2].map(k=>local(new THREE.Vector3().fromBufferAttribute(p,k))));triangles.push({t,box:new THREE.Box3().setFromPoints([t.a,t.b,t.c])});}
  });
  assert.equal(paths.triangles.length,triangles.length*15);
  for(let i=0;i<triangles.length;i++){const {t,box}=triangles[i];assert.deepEqual(Array.from(paths.triangles.subarray(i*15,(i+1)*15)),[...t.a.toArray(),...t.b.toArray(),...t.c.toArray(),...box.min.toArray(),...box.max.toArray()]);}
  // Original full scan remains independent of the packed buffers/tree.
  const reference=(a,b,radius,ends)=>{
   const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.max(1,Math.ceil(d/.09)),v=new THREE.Vector3(),near=new THREE.Vector3();
   const bounds=new THREE.Box3(new THREE.Vector3(Math.min(a.x,b.x)-radius,Math.min(a.y,b.y)-radius,Math.min(a.z,b.z)-radius),new THREE.Vector3(Math.max(a.x,b.x)+radius,Math.max(a.y,b.y)+radius,Math.max(a.z,b.z)+radius));
   const candidates=triangles.filter(q=>q.box.intersectsBox(bounds));
   for(let i=0;i<=steps;i++){
    if(ends&&(i/steps*d<.2||(1-i/steps)*d<.2))continue;
    const t=i/steps;v.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
    for(const q of candidates){if(q.box.distanceToPoint(v)>radius)continue;q.t.closestPointToPoint(v,near);if(near.distanceToSquared(v)<radius*radius-1e-6)return false;}
   }
   return true;
  };
  for(let i=0;i<1000;i++){
   const a={x:Math.sin(i*1.71)*6,y:(i%13)*.31-.2,z:Math.cos(i*.79)*4};
   const b={x:a.x+Math.sin(i*.21)*2,y:a.y+Math.cos(i*.53),z:a.z+Math.cos(i*.11)*2},radius=[.155,.17,.19][i%3],ends=i%2===0;
   assert.equal(paths.clear(a,b,radius,ends),reference(a,b,radius,ends),`home ${seed}, path ${i}`);
  }
  home.dispose();
 }
});

test('homes have reproducible but distinct structural families, resting places and stones',()=>{
 const families=new Set(),signatures=new Set();
 for(let seed=0;seed<40;seed++){
  const home=lanternHome(seed);assert.deepEqual(home,lanternHome(seed));families.add(home.family);signatures.add(JSON.stringify(home));
  assert.equal(home.perches.length,5);assert.ok(home.stones.length>=2&&home.stones.length<=8);
 }
 assert.equal(families.size,3);assert.equal(signatures.size,40);
});

test('homes fit a gentle slope and reject a flooded rim or a tall terrain step',()=>{
 const bark=lanternBarkSite(host,sample,x=>Math.sqrt(10**2-x**2),'terrain',0);
 assert.ok(lanternHollowSite(bark,sample));
 const edge=bark.point({x:0,y:0.75,z:3.1});
 assert.equal(lanternHollowSite(bark,(x,z)=>({...sample(x,z),water:z>8?20:-5})),null);
 assert.equal(lanternHollowSite(bark,(x,z)=>({...sample(x,z),ground:x>edge.x?12:0})),null);
});

test('moving and retreating mites clear the actual root, rock and earth triangles across home variations',()=>{
 const families=new Set(),v=new THREE.Vector3(),near=new THREE.Vector3();
 for(let seed=0;seed<10;seed++){
  const s=site(`home-${seed}`);assert.ok(s);families.add(s.home.family);
  const colony=new LanternMiteColony(s),home=new LanternMiteHomeMeshes(new THREE.Group(),s,colony.model.mites),triangles=[];
  const paths=new LanternMitePaths(home,s);colony.model.navigate=(a,b)=>paths.route(a,b);colony.model.homeExcursion=m=>paths.excursion(m);
  let maxHeight=0;const heard=[];colony.onSound=(m,reply)=>heard.push({id:m.id,reply});
  home.root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const p=mesh.geometry.attributes.position;
   assert.ok([...p.array].every(Number.isFinite));
   for(let i=0;i<p.count;i+=3){
    const tri=new THREE.Triangle(...[i,i+1,i+2].map(i=>new THREE.Vector3().fromBufferAttribute(p,i)));
    triangles.push({tri,box:new THREE.Box3().setFromPoints([tri.a,tri.b,tri.c])});
   }
  });
  assert.equal(home.root.children.filter(m=>m.isMesh).length,5,'merged into five solid material batches');
  assert.equal(home.root.children.filter(m=>m.isLineSegments).length,1,'one batch of bramble stems');
  for(let frame=0;frame<40*60;frame++){
   if(frame===8*60)colony.hearNote({position:s.point({x:0,y:3,z:3.6}),layer:'lantern-player',velocity:0.35});
   colony.update(1/60,s.point({x:0,y:3,z:3.6}),{sheltered:frame>20*60&&frame<28*60});
   maxHeight=Math.max(maxHeight,...colony.model.mites.map(m=>m.pos.y));
   if(frame%15)continue;
   for(const m of colony.model.mites){
    const p=colony.position(m);v.set(p.x,p.y,p.z);
    const airborne=['forage','visit','listen','exchange','investigate','contact','return','emerge','answering','note-rest'].includes(m.state);
    if(airborne)v.y+=Math.sin((colony.model.time-m.since)*1.7)*0.03*s.scale*Math.min(1,(colony.model.time-m.since)*2);
    v.y=Math.max(p.minY,v.y);
    // A circumscribed sphere covers all three axes of the rendered seed.
    const radius=m.size*s.scale,r2=(radius-0.00002*s.scale)**2;
    for(const {tri,box}of triangles){
     if(box.distanceToPoint(v)>radius)continue;
     tri.closestPointToPoint(v,near);
     assert.ok(near.distanceToSquared(v)>r2,`${s.home.family}, seed ${seed}, ${m.state}, mite ${m.id}, time ${colony.model.time.toFixed(2)} intersects home`);
    }
   }
  }
  assert.ok(maxHeight>2.2,'journeys reach beyond the original low flight band');
  assert.ok(heard.length,'the colony still exchanges calls during its journeys');
  home.dispose();assert.equal(home.root.parent,null);
 }
 assert.equal(families.size,3);
});

for(const packed of [false,true])test('clearing '+(packed?'packed':'nested')+' grass inside a home preserves outside plants and restores the original vertices on removal',()=>{
 const s=site('grass'),c=new LanternMiteColony(s),home=new LanternMiteHomeMeshes(new THREE.Group(),s,c.model.mites);
 const at=s.center,positions=new Float32Array([at.x,at.y,at.z,at.x+1,at.y+5,at.z,1000,2,1000,1001,7,1000]);
 const original=positions.slice(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 g.setAttribute('aBase',new THREE.Float32BufferAttribute([at.x,at.y,at.z,at.x,at.y,at.z,1000,2,1000,1000,2,1000],3));
 const born=new THREE.BufferAttribute(new Float32Array(4),1);g.setAttribute('aBorn',born);
 const chunk={meshes:[{geometry:g}],groups:[{ranges:[[0,2],[2,4]],names:['tuft','tuft'],attr:born,pos:[at.x,at.z,1000,1000],count:2}]};
 if(packed){const group=chunk.groups[0];group.rangeData=new Uint32Array(group.ranges.flat());delete group.ranges;group.pos=new Float64Array(group.pos);}
 home.clearGrass({chunks:new Map([['test',chunk]])});
 assert.equal(positions[4],positions[1]);assert.deepEqual(positions.slice(6),original.slice(6));
 home.dispose();assert.deepEqual(positions,original);g.dispose();
});
