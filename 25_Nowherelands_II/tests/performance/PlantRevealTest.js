import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePlantReveal,revealPlants} from '../../js/world/PlantReveal.js?v=stable-30-6';

const UNBORN=-1e6;
// Original full scan, retained as the growth-timing oracle.
function reference(g,t,px,pz,random) {
 if(g.pending<=0)return;
 const a=g.attr.array;let changed=false;
 for(let i=0;i<g.count;i++) {
  const s=g.ranges?g.ranges[i][0]:i;
  if(a[s]!==UNBORN||(g.ranges&&g.ranges[i][1]===s))continue;
  const kind=g.kind||g.kinds[i],dx=g.pos[i*2]-px,dz=g.pos[i*2+1]-pz;
  if(dx*dx+dz*dz<kind.reveal*kind.reveal) {
   const born=t+random()*.4;
   if(g.ranges){const[s0,e]=g.ranges[i];for(let k=s0;k<e;k++)a[k]=born;}else a[i]=born;
   g.pending--;changed=true;
  }
 }
 if(changed)g.attr.needsUpdate=true;
}
const attribute=array=>({array,version:0,set needsUpdate(value){if(value)this.version++;}});
test('pending growth preserves every birth time, upload version and random draw for mixed plants',()=>{
 let seed=31,calls=0;
 const random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 for(const format of ['instances','nested','packed']) {
  const ranged=format!=='instances';
  const count=2000,pos=[],ranges=[],kinds=[],values=[];
  for(let i=0;i<count;i++) {
   pos.push((i*139%1009)-500,(i*379%1013)-500);kinds.push({reveal:[0,140,260,420][i%4]});
   const start=values.length,n=ranged?i%7:1,born=i%3?UNBORN:2.75;
   for(let j=0;j<n;j++)values.push(born);ranges.push([start,values.length]);
  }
  const g={count,pos,ranges:ranged?ranges:null,kind:ranged?null:{reveal:180},kinds,attr:attribute(Float32Array.from(values)),pending:0};
  for(let i=0;i<count;i++){const[s,e]=ranges[i];if(e>s&&values[s]===UNBORN)g.pending++;}
  const actual={...g,attr:attribute(g.attr.array.slice())};
  if(format==='packed'){actual.pos=new Float64Array(pos);actual.rangeData=new Uint32Array(ranges.flat());delete actual.ranges;}
  preparePlantReveal(actual,UNBORN);
  for(let frame=0;frame<600;frame++) {
   const x=Math.cos(frame*.014)*650,z=Math.sin(frame*.017)*650,t=frame/30;
   const beforeSeed=seed,beforeCalls=calls;reference(g,t,x,z,random);const afterSeed=seed,afterCalls=calls;
   seed=beforeSeed;calls=beforeCalls;revealPlants(actual,t,x,z,random);
   assert.equal(seed,afterSeed);assert.equal(calls,afterCalls);
   assert.equal(actual.pending,g.pending);assert.equal(actual.attr.version,g.attr.version);
   assert.deepEqual(actual.attr.array,g.attr.array);
  }
 }
});
