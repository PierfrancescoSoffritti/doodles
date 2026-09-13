import test from 'node:test';
import assert from 'node:assert/strict';
import { indexCaveMesh } from '../../js/world/caves/IndexCaveMesh.js?v=stable-30-8';
import { CaveFloorSurface } from '../../js/world/caves/CaveFloorSurface.js?v=stable-30-9';
import { buildCaveMeshes } from '../../js/world/caves/CaveMeshData.js';

function verify(original, indexed) {
 const before=new Uint32Array(original.buffer,original.byteOffset,original.length),after=new Uint32Array(indexed.position.buffer);
 for(let i=0;i<before.length;i++)assert.equal(after[indexed.index?indexed.index[Math.floor(i/3)]*3+i%3:i],before[i],`word ${i}`);
}
test('exact cave indexing preserves signed zero and every triangle in order',()=>{
 const position=Float32Array.from(Array.from({length:100},()=>[0,0,0,1,0,0,0,0,1,-0,0,0,0,0,1,1,0,0]).flat());
 const chunk=indexCaveMesh({cave:0,position});verify(position,chunk);
 assert.ok(chunk.index instanceof Uint16Array);assert.equal(chunk.position.length,12);
 assert.equal(indexCaveMesh(chunk),chunk);
 const unique={position:Float32Array.from([0,0,0,1,0,0,0,0,1])};assert.equal(indexCaveMesh(unique).index,undefined);
});
test('large cave chunks select 32-bit indices without aliasing vertices',()=>{
 const position=new Float32Array(66000*3*3);
 for(let i=0;i<198000;i++){position[i*3]=i%66000;position[i*3+1]=(i%66000)%7;}
 const chunk=indexCaveMesh({position});assert.ok(chunk.index instanceof Uint32Array);verify(position,chunk);
});
test('generated cave geometry and floor support are identical after indexing',()=>{
 const point=(x,floor)=>({x,z:0,floor,width:20,height:30,water:-1e6});
 const cave={id:0,entrance:{x:0,y:0,z:0},paths:[{wet:false,points:[point(0,0),point(55,-8),point(110,-10)]}],wet:false};
 const original=buildCaveMeshes({height:()=>70},[cave]);
 const packed={chunks:original.chunks.map(c=>indexCaveMesh({...c})),decorations:original.decorations.map(c=>indexCaveMesh({...c})),water:original.water};
 for(const key of ['chunks','decorations'])original[key].forEach((c,i)=>verify(c.position,packed[key][i]));
 const before=new CaveFloorSurface(original),after=new CaveFloorSurface(packed);
 assert.deepEqual(after.triangles,before.triangles);assert.deepEqual(after.references,before.references);assert.deepEqual(after.cells,before.cells);
 let hits=0;
 for(let x=-20;x<130;x+=.9)for(let z=-25;z<25;z+=.9){const a=before.sample(0,x,z,-7,50),b=after.sample(0,x,z,-7,50);assert.deepEqual(b,a);if(a)hits++;}
 assert.ok(hits>1000);
});
