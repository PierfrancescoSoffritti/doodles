import test from 'node:test';
import assert from 'node:assert/strict';
import {SpriteBirds,birdCardAxes} from '../../js/world/fauna/SpriteBirds.js';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);

test('all birds remain airborne with forward speed and curved, banked trajectories',()=>{
 const m=new SpriteBirds(),turns=new Array(18).fill(0);let minY=Infinity,maxY=-Infinity;
 for(let i=0;i<7200;i++){
  const headings=m.birds.map(b=>b.heading);m.update(1/60);
  for(const b of m.birds){assert.ok(Object.values(b.p).every(Number.isFinite));assert.ok(b.speed>13&&b.speed<21);assert.ok(['flap','glide'].includes(b.state));minY=Math.min(minY,b.p.y);maxY=Math.max(maxY,b.p.y);turns[b.id]+=Math.abs(b.heading-headings[b.id]);}
 }
 assert.equal(m.birds.length,18);assert.ok(minY>25&&maxY<85,`${minY}–${maxY}`);assert.ok(turns.every(t=>t>12));
 assert.ok(m.birds.some(b=>Math.abs(b.bank)>.2));
});

test('glides hold extended wings, lose height, and smoothly resume the wingbeat clock',()=>{
 const m=new SpriteBirds();let entries=0,exits=0,held=0;
 for(let i=0;i<3600;i++){
  const before=m.birds.map(b=>({state:b.state,phase:b.phase,y:b.p.y}));m.update(1/120);
  for(const b of m.birds){const old=before[b.id];
   if(b.glide){assert.ok(b.p.y<=old.y+1e-8);assert.ok(Math.abs((b.phase%1)-.25)<1e-8);held++;}
   if(old.state==='glide'&&b.glide)assert.equal(b.phase,old.phase);
   if(old.state==='flap'&&b.glide){assert.ok(b.phase>=old.phase&&b.phase-old.phase<.06);entries++;}
   if(old.state==='glide'&&!b.glide){assert.equal(b.phase,old.phase);exits++;}
  }
 }
 assert.ok(entries>25&&exits>25&&held>1000);
});

test('silhouette cards follow velocity and bank without any camera-facing or mirroring input',()=>{
 const m=new SpriteBirds();
 for(let i=0;i<1000;i++){
  m.update(1/60);
  for(const b of m.birds){const {forward,right}=birdCardAxes(b),speed=Math.hypot(b.v.x,b.v.y,b.v.z),v=[b.v.x/speed,b.v.y/speed,b.v.z/speed];
   assert.ok(dot(forward,v)>.999999);assert.ok(Math.abs(dot(forward,right))<1e-10);assert.ok(Math.abs(dot(right,right)-1)<1e-10);
  }
 }
 const p={heading:0,pitch:0,bank:0};assert.deepEqual(birdCardAxes(p).forward,[1,0,0]);
 assert.ok(birdCardAxes({...p,heading:Math.PI}).forward[0]<-.999);
});
