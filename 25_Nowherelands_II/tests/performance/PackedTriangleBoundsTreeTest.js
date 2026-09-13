import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const THREE=await import('three');
const {TriangleBoundsTree}=await import('../../js/world/fauna/TriangleBoundsTree.js');
const {PackedTriangleBoundsTree}=await import('../../js/world/fauna/PackedTriangleBoundsTree.js?v=stable-30-22');

test('packed tree preserves original candidate order, empty bounds and degenerate leaves',()=>{
 for(const count of [0,1,31,4096]){
  const records=[],data=new Float64Array(count*15);
  for(let i=0;i<count;i++){
   const x=count===31?0:Math.sin(i*1.7)*20,y=count===31?0:Math.cos(i*.53)*8,z=count===31?0:Math.sin(i*.17)*30;
   const box=new THREE.Box3(new THREE.Vector3(x,y,z),new THREE.Vector3(x+i%5,y+i%3,z+i%7));
   records.push({box,id:i});data.set([...box.min.toArray(),...box.max.toArray()],i*15+9);
  }
  const original=new TriangleBoundsTree(records),packed=new PackedTriangleBoundsTree(data,true);
  let slices=0;while(!packed.work.next().done)slices++;
  if(count===4096)assert.ok(slices>10,'construction remains cooperative');
  const result=[-100];
  for(let i=0;i<400;i++){
   const x=Math.sin(i*.12)*30,y=Math.cos(i*.73)*12,z=Math.cos(i*.24)*40,r=i%13;
   const bounds=new THREE.Box3(new THREE.Vector3(x-r,y-r,z-r),new THREE.Vector3(x+r,y+r,z+r));
   assert.equal(packed.query(bounds,result),result);
   assert.deepEqual(result,original.query(bounds).map(record=>record.id));
  }
 }
});

test('packed node storage preserves traversal at the maximum split depth',()=>{
 const count=2048,records=[],data=new Float64Array(count*15);
 for(let i=0;i<count;i++){
  const x=i<64?2**(-i):0,box=new THREE.Box3(new THREE.Vector3(x,-0,0),new THREE.Vector3(x,1,1));
  records.push({box,id:i});data.set([...box.min.toArray(),...box.max.toArray()],i*15+9);
 }
 const reference=new TriangleBoundsTree(records),tree=new PackedTriangleBoundsTree(data,true);
 while(!tree.work.next().done){}
 assert.ok(tree.nodes instanceof Float64Array);
 assert.equal(tree.nodes.length,tree.nodeCount*10);
 for(const x of [-1,0,2**-25,2**-10,1]){
  const box=new THREE.Box3(new THREE.Vector3(x,-1,-1),new THREE.Vector3(2,2,2));
  assert.deepEqual(tree.query(box),reference.query(box).map(r=>r.id));
 }
});
