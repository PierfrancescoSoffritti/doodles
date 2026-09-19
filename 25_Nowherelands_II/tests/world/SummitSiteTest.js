import test from 'node:test';
import assert from 'node:assert/strict';
import { summitSite,altarFloor } from '../../js/world/structures/SummitSite.js';
import { mountainApproach } from '../../js/world/structures/MountainSteps.js';
function mountain(){
 const N=129,cell=16,size=(N-1)*cell,grid=new Float32Array(N*N);
 const height=(x,z)=>Math.max(30,600-.4*Math.hypot(x,z)+140*(1-Math.exp(-x*x/(180*180)))*Math.exp(-(((z+650)/400)**2)));
 for(let z=0;z<N;z++)for(let x=0;x<N;x++)grid[z*N+x]=height(x*cell-size/2,z*cell-size/2);
 return {N,cell,size,grid,height,sample:height,_water:0,caves:{hasOpening:()=>false}};
}
test('frame chooses a repeatable summit and a grounded, gently winding stone trail',()=>{
 const hm=mountain(),s=summitSite(hm);assert.ok(s);assert.deepEqual(s,summitSite(hm));assert.ok(s.y>590&&s.prominence>35&&s.view.drop>=220&&s.view.nearDrop>=55);
 assert.ok(s.steps<=64&&s.route.some(p=>Math.abs(p.x)>10));
 for(let i=0;i<s.route.length;i++){
  const p=s.route[i],top=altarFloor(s,p.x,p.z),ground=hm.height(s.x+s.cos*p.x+s.sin*p.z,s.z-s.sin*p.x+s.cos*p.z);
  assert.ok(top>=ground&&top-ground<3.2);if(i)assert.ok(Math.abs(top-s.route[i-1].y)<=1.7);
 }
 for(const stone of s.stones)for(const [x,z] of stone.points){const h=hm.height(s.x+s.cos*x+s.sin*z,s.z-s.sin*x+s.cos*z);assert.ok(stone.top>h);assert.ok(stone.base<h);}
 assert.equal(altarFloor(s,0,0),-1e6,'natural summit, no invisible podium');assert.equal(altarFloor(s,50,70),-1e6);
});
test('summit trail rejects cliffs, flat clearings and cave sites',()=>{
 const hm=mountain();assert.equal(summitSite({...hm,grid:new Float32Array(hm.grid.length).fill(600),height:()=>600,sample:()=>600}),null);
 assert.equal(summitSite({...hm,caves:{hasOpening:()=>true}}),null);assert.equal(summitSite(hm,[{x:0,z:0}]),null);
 assert.equal(mountainApproach((x,z)=>z>70?0:30),null);
});

test('foot contact bridges chipped joints without supporting empty terrain',()=>{
 const hm=mountain(),s=summitSite(hm);
 for(let i=1;i<s.route.length;i++){
  const a=s.route[i-1],b=s.route[i];
  for(let t=0;t<1;t+=.1){const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;assert.ok(altarFloor(s,x,z)>500,'narrow joints remain walkable');}
 }
 assert.equal(altarFloor(s,45,75),-1e6);
});

test('the summit approach can stop safely before a cave-pierced lower slope',()=>{
 const hm=mountain();hm.caves.hasOpening=(x,z)=>Math.hypot(x,z)>100;
 const s=summitSite(hm);assert.ok(s,'a clear upper approach remains usable');
 assert.ok(s.end<100);
 for(const stone of s.stones)for(const [x,z] of stone.points)assert.equal(hm.caves.hasOpening(s.x+s.cos*x+s.sin*z,s.z-s.sin*x+s.cos*z),false);
 assert.equal(hm.caves.hasOpening(s.x+s.cos*s.arrivalX+s.sin*s.arrivalZ,s.z-s.sin*s.arrivalX+s.cos*s.arrivalZ),false);
});
