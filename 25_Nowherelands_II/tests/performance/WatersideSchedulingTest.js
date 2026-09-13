import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return {url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
globalThis.location={search:'?seed=shore-scheduling'};
globalThis.matchMedia=()=>({matches:false});
const {RiverEcology}=await import('../../js/world/RiverEcology.js?v=stable-30-3');
const {WatersideMeshes}=await import('../../js/world/WatersideMeshes.js?v=stable-30-3');
const {RV,RIVER_STRIDE}=await import('../../js/world/gen/Rivers.js');
export function fixture(){
 const shores=Array.from({length:36},(_,i)=>({x:(i%6-2.5)*32,z:(Math.floor(i/6)-2.5)*32,level:3,fetch:(i%3)*.4,hard:(i%2)*.8}));
 const features=['roots','fallen','jam','snag'].flatMap((type,i)=>Array.from({length:4},(_,j)=>({type,seed:`${type}:${j}`,a:[i*30-60,5,j*30-50],b:[i*30-45,4,j*30-44],radius:2+j*.5})));
 const waterside={cells:features,shoreCells:shores,query:items=>items};
 const data=new Float32Array(40*RIVER_STRIDE);for(let i=0;i<40;i++)data[i*RIVER_STRIDE+RV.SPEED]=.5+(i%4)*.5;
 const hm={world:{rivers:[{id:0,data}]},sample(x,z){this._water=3;this._slope=.2;this._riverSeg=-1;return 3+Math.sin(x*.1)*2+Math.cos(z*.1)*2},waterAt:()=>3,forestDensity:()=>.7,
 rivers:{segmentsIn:()=>Array.from({length:40},(_,i)=>i),segRiver:new Uint32Array(40),segIndex:Uint32Array.from({length:40},(_,i)=>i),at:i=>({kind:0,wl:3,w:12,d:3,bank:2,bend:.1,dx:4,dz:2,x:i%8*24-84,z:Math.floor(i/8)*32-64,foam:.2,along:i*6})}};
 return {hm,shared:{waterside,terrainUniforms:{uTime:{value:0}}}};
}
export function digest(chunk){const hash=createHash('sha256');for(const m of chunk.meshes){hash.update(m.name);for(const [key,a]of Object.entries(m.geometry.attributes)){hash.update(key);hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(m.instanceMatrix)hash.update(new Uint8Array(m.instanceMatrix.array.buffer));}return hash.digest('hex');}
for(const [Class,expected]of [[RiverEcology,'3c279564b10a28ce2b83dd83efbaf5eb67abbd0ef7a4ef892fb9779bfbefc994'],[WatersideMeshes,'744b1ab1b59164dea1b0c551eed8ae8e15656e4226163e72dd37522816841098']])test(`${Class.name} yields without changing seeded geometry or placement`,()=>{
 const {hm,shared}=fixture(),builder=new Class(shared),chunk={meshes:[]};let slices=0;
 for(const _ of builder.buildSteps(hm,chunk,0,0,256,'fixed-shores')){slices++;hm.sample(999,999);}
 assert.ok(slices>40);assert.ok(chunk.meshes.length);
 assert.equal(digest(chunk),expected,'byte-for-byte baseline from the original synchronous builder');
});
