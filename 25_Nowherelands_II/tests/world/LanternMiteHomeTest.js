import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { lanternHome } from '../../js/world/fauna/LanternMiteHome.js';
import { lanternBarkSite, lanternHollowSite } from '../../js/world/fauna/LanternMiteHabitat.js';
import { LanternMiteColony } from '../../js/world/fauna/LanternMiteWorldModel.js';

registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return{url:new URL('../../../common/libs/three-0.185/examples/jsm/'+specifier.slice(13),import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const THREE=await import('three');
const {LanternMiteHomeMeshes}=await import('../../js/world/fauna/LanternMiteHomeMeshes.js');
const {LanternMitePaths}=await import('../../js/world/fauna/LanternMitePaths.js');
const sample=(x,z)=>({ground:0.012*x+0.006*z,water:-5,slope:0.015,forest:0.7,wet:0.5,coast:0,roof:false});
const host={id:'old-tree',x:0,y:0,z:0,radius:8};
const site=seed=>lanternHollowSite(lanternBarkSite(host,sample,x=>Math.sqrt(10**2-x**2),seed,0.7),sample);

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

test('clearing grass inside a home preserves outside plants and restores the original vertices on removal',()=>{
 const s=site('grass'),c=new LanternMiteColony(s),home=new LanternMiteHomeMeshes(new THREE.Group(),s,c.model.mites);
 const at=s.center,positions=new Float32Array([at.x,at.y,at.z,at.x+1,at.y+5,at.z,1000,2,1000,1001,7,1000]);
 const original=positions.slice(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 g.setAttribute('aBase',new THREE.Float32BufferAttribute([at.x,at.y,at.z,at.x,at.y,at.z,1000,2,1000,1000,2,1000],3));
 const born=new THREE.BufferAttribute(new Float32Array(4),1);g.setAttribute('aBorn',born);
 const chunk={meshes:[{geometry:g}],groups:[{ranges:[[0,2],[2,4]],names:['tuft','tuft'],attr:born,pos:[at.x,at.z,1000,1000],count:2}]};
 home.clearGrass({chunks:new Map([['test',chunk]])});
 assert.equal(positions[4],positions[1]);assert.deepEqual(positions.slice(6),original.slice(6));
 home.dispose();assert.deepEqual(positions,original);g.dispose();
});
