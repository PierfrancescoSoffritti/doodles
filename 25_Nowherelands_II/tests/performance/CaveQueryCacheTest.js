import test from 'node:test';
import assert from 'node:assert/strict';
import {CaveFloorSurface} from '../../js/world/caves/CaveFloorSurface.js';
import {CaveField} from '../../js/world/caves/CaveField.js';
import {pebbleCaveSampler} from '../../js/world/fauna/PebbleHabitats.js';

// Scan emitted triangles without the query cache or fine-cell index. Preserve
// the original eight-unit cell coverage and triangle acceptance tolerance.
function reference(data,cave,x,z,floor,ceiling) {
 let ground=-Infinity,slope=0;
 for(const chunk of [...data.chunks,...data.decorations]) {
  if(String(chunk.cave)!==String(cave))continue;
  const p=chunk.position,index=chunk.index,n=index?index.length:p.length/3;
  for(let i=0;i<n;i+=3){
   const a=index?index[i]*3:i*3,b=index?index[i+1]*3:a+3,c=index?index[i+2]*3:a+6;
   const ax=p[b]-p[a],az=p[b+2]-p[a+2],bx=p[c]-p[a],bz=p[c+2]-p[a+2],up=az*bx-ax*bz;
   if(up<1e-7)continue;
   const cx=Math.floor(x/8),cz=Math.floor(z/8);
   if(!(cx>=Math.floor(Math.min(p[a],p[b],p[c])/8)&&cx<=Math.floor(Math.max(p[a],p[b],p[c])/8)&&cz>=Math.floor(Math.min(p[a+2],p[b+2],p[c+2])/8)&&cz<=Math.floor(Math.max(p[a+2],p[b+2],p[c+2])/8)))continue;
   const dx=x-p[a],dz=z-p[a+2],u=(dx*bz-dz*bx)/-up,v=(ax*dz-az*dx)/-up;
   if(u<-.00001||v<-.00001||u+v>1.00001)continue;
   const ay=p[b+1]-p[a+1],by=p[c+1]-p[a+1],sx=(az*by-ay*bz)/up,sz=(ay*bx-ax*by)/up,y=p[a+1]+sx*dx+sz*dz;
   if(y<floor-5||y>floor+8||y>ceiling-3.5||y<=ground)continue;
   ground=y;slope=Math.hypot(sx,sz);
  }
 }
 return Number.isFinite(ground)?{ground,slope}:null;
}

test('fine cave bins preserve cell edges, barycentric tolerance and indexed triangle results',()=>{
 for(const offset of [-16,-8,-4,-2,0,2,4,8,16])for(const width of [1.999997,2,2.000003,3.999997,4,4.000003,7.999997,8,8.000003]){
  const p=new Float32Array([offset,1,offset,offset,2,offset+width,offset+width,3,offset]);
  const data={chunks:[{cave:'a:b',position:p,index:new Uint16Array([0,1,2])}],decorations:[]},sample=new CaveFloorSurface(data);
  for(const u of [-1.0001e-5,-1e-5,-.9999e-5,0,.5,1,1.000009,1.00001])for(const v of [-1.0001e-5,-1e-5,-.9999e-5,0,.5,1,1.000009,1.00001]){
   const q=['a:b',p[0]+v*(p[6]-p[0]),p[2]+u*(p[5]-p[2]),0,30],expected=reference(data,...q);
   assert.deepEqual(sample.sample(...q),expected);assert.deepEqual(sample.sample(...q),expected);
  }
 }
});

test('bounded exact queries survive collisions, stacked floors and changed height limits',()=>{
 const position=[];
 for(const y of [0,12,40])for(let x=-16;x<16;x+=4)for(let z=-16;z<16;z+=4){
  position.push(x,y+x*.03,z,x,y+x*.03,z+4,x+4,y+(x+4)*.03,z);
  position.push(x+4,y+(x+4)*.03,z,x,y+x*.03,z+4,x+4,y+(x+4)*.03,z+4);
 }
 const data={chunks:[{cave:0,position:new Float32Array(position)}],decorations:[{cave:'upper',position:new Float32Array(position.map((v,i)=>i%3===1?v+3:v))}]},sample=new CaveFloorSurface(data);
 let seed=17;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<10000;i++){
  const q=[[0,'upper',1][i%3],Math.round((random()*38-19)*8)/8,Math.round((random()*38-19)*8)/8,[-1,11,39,NaN,-Infinity][i%5],[Infinity,22,48,9][i%4]],expected=reference(data,...q);
  assert.deepEqual(sample.sample(...q),expected);assert.deepEqual(sample.sample(...q),expected);
 }
 for(const x of [-0,0,Infinity,-Infinity,NaN])for(const z of [-0,0,Infinity,NaN])assert.deepEqual(sample.sample(0,x,z,0,30),reference(data,0,x,z,0,30));
 const q=[0,.5,.5,0,30],value=sample.sample(...q);value.ground=900;
 assert.deepEqual(sample.sample(...q),reference(data,...q));
 assert.equal(sample.sampleCache.length,2048*7);assert.equal(sample.sampleCaves.length,2048);
 assert.ok(sample.cacheHits>=10000);
});

test('reused cave sections preserve unions without modifying the supplied geometry',()=>{
 const networks=[0,1,2].map(id=>({id,relief:true,entrance:{x:0,z:0,y:16},paths:[{surfaceStart:0,wet:id===1,points:[0,60,120,180,240,300].map(x=>({x,z:id===1?x*.2:0,floor:5+id*16+x*.01,width:30,height:20,water:id===1?24:-1e6}))}]}));
 const field=new CaveField(networks),refField=new CaveField(networks),surface=()=>({ground:100,water:-4,slope:.1,hardness:.8,forest:.9,wet:.95,roof:false});
 let calls=0,refCalls=0;
 for(const [f,count]of [[field,()=>calls++],[refField,()=>refCalls++]]){const section=f.section;f.section=function(...args){count();return section.apply(this,args);};}
 // Force the reference to recompute columns, as before section reuse.
 refField.column=function(x,z,y,height){return CaveField.prototype.column.call(this,x,z,y,height);};
 const sample=pebbleCaveSampler({caves:field},surface,networks[0],8),ref=pebbleCaveSampler({caves:refField},surface,networks[0],8);
 // More than three cache capacities, including revisiting evicted queries.
 for(let repeat=0;repeat<2;repeat++)for(let z=-35;z<40;z++)for(let x=-20;x<330;x++)assert.deepEqual(sample(x+.125,z+.325),ref(x+.125,z+.325));
 for(const x of [-32769,-32768,32767,32768])for(const z of [-32769,-32768,32767,32768])assert.deepEqual(sample(x+.25,z+.25),ref(x+.25,z+.25));
 assert.ok(calls<refCalls*.9,'section reuse must remove actual calculations');
 const sections=field.candidates(90,3).map(s=>field.section(s,90,3)),copy=structuredClone(sections);
 for(const eye of [0,8,24,40,70]){assert.deepEqual(field.column(90,3,eye,2,sections),refField.column(90,3,eye,2));assert.deepEqual(sections,copy);}
});

test('packed cave grid keys keep signs, integer boundaries and string fallback distinct',()=>{
 const cave={id:0,entrance:{x:0,y:0,z:0}},segment={cave},ground=(x,z)=>x*.001+z*.002;
 const hm={caves:{candidates:()=>[segment],section:(s,x,z)=>({cave,floor:ground(x,z),wall:20}),column:(x,z)=>({floor:ground(x,z),ceiling:ground(x,z)+40,water:-1000}),rockClearance:()=>100}};
 const sample=pebbleCaveSampler(hm,()=>({ground:1000000,water:-1000,roof:false}),cave,0);
 const coordinates=[-32769,-32768,-16385,-16384,-1,0,1,16383,16384,32767,32768];
 for(let repeat=0;repeat<3;repeat++)for(const x of coordinates)for(const z of coordinates){
  const result=sample(x+.25,z+.375);assert.ok(Math.abs(result.ground-ground(x+.25,z+.375))<1e-12);
  assert.equal(result.cave,true);assert.ok(Math.abs(result.clearance-40)<1e-12);
  result.ground=-999; // A caller cannot overwrite any retained support record.
 }
});

test('complete cave support queries reuse exact coordinates without changing results or exposing cached records',()=>{
 const cave={id:0,entrance:{x:0,y:0,z:0}},segment={cave};let queries=0;
 const floor=(x,z)=>Math.sin(x*.03)+Math.cos(z*.02);
 const hm={caves:{candidates:()=>[segment],section:(s,x,z)=>({cave,floor:floor(x,z),wall:20}),column:(x,z)=>({floor:floor(x,z),ceiling:40,water:-1000}),rockClearance:()=>100},caveFloorSurface:{sample:(id,x,z)=>{queries++;return {ground:floor(x,z),slope:.03};}}};
 const surface=()=>({ground:100,water:-1000,roof:false});
 const sample=pebbleCaveSampler(hm,surface,cave,0),reference=pebbleCaveSampler(hm,surface,cave,0,{cacheQueries:false});
 for(let i=0;i<2048;i++){
  const x=i*.013-15,z=i*.027-30,expected=reference(x,z),first=sample(x,z),before=queries;
  assert.deepEqual(first,expected);first.ground=999;
  for(let repeat=0;repeat<4;repeat++)assert.deepEqual(sample(x,z),expected);
  assert.equal(queries,before,'repeated exact support must not re-query mesh triangles');
 }
 const old=sample(1.25,2.75);hm.caveFloorSurface={sample:()=>({ground:old.ground+1,slope:.2})};
 assert.equal(sample(1.25,2.75).ground,old.ground+1);
 assert.deepEqual(sample(-0,0),reference(-0,0));assert.deepEqual(sample(0,-0),reference(0,-0));
});
