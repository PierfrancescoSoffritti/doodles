import test from 'node:test';
import assert from 'node:assert/strict';
import { CaveFloorSurface } from '../../js/world/caves/CaveFloorSurface.js';
import { CaveField } from '../../js/world/caves/CaveField.js';
import { buildCaveMeshes } from '../../js/world/caves/CaveMeshData.js';
import { pebbleCaveSampler } from '../../js/world/fauna/PebbleHabitats.js';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js';

const triangle=(y)=>[0,y,0, 0,y,8, 8,y+2,0];
test('rendered support uses triangle height, rejects ceilings, and keeps stacked floors separate',()=>{
 const data={chunks:[{cave:0,position:[...triangle(4),...triangle(44),0,18,0,8,18,0,0,18,8]}],decorations:[]};
 const floor=new CaveFloorSurface(data);
 assert.equal(floor.sample(0,2,2,3,25).ground,4.5);
 assert.equal(floor.sample(0,2,2,43,65).ground,44.5);
 assert.equal(floor.sample(0,7,7,3,25),null);
 assert.equal(floor.sample(1,2,2,3,25),null);
});

test('pebbles stay above the actual meshed cave floor during escape and settling',()=>{
 const points=[0,40,80,120,160,200].map(x=>({x,z:0,floor:5+x*.025,width:25,height:30,water:-1e6}));
 const cave={id:0,relief:true,entrance:{x:0,y:16,z:0},paths:[{points,wet:false,surfaceStart:0}]};
 const hm={height:()=>100,caves:new CaveField([cave])};
 const mesh=buildCaveMeshes(hm,[cave]);hm.caveFloorSurface=new CaveFloorSurface(mesh);
 const surface=()=>({ground:100,water:-4,slope:.1,hardness:.8,forest:0,wet:.1,roof:false});
 const sample=pebbleCaveSampler(hm,surface,cave,8);
 const model=new FaunaModel('meshed-cave-floor',{sample:surface});
 const group=model.addGroup('cave','hopper',90,0,20,{sample});assert.ok(group);
 const c=group.members[0];model.listener={x:c.pos.x+4,y:c.ground+11,z:c.pos.z};
 let moving=0,contacts=0;
 // Independently intersect the emitted triangles (no sampler or spatial index).
 const triangles=mesh.chunks.flatMap(chunk=>Array.from({length:chunk.position.length/9},(_,i)=>chunk.position.slice(i*9,i*9+9)));
 function meshHeight(x,z,near) {
  let y=-Infinity;
  for(const p of triangles) {
   const ax=p[3]-p[0],az=p[5]-p[2],bx=p[6]-p[0],bz=p[8]-p[2],det=ax*bz-az*bx;
   if(det>=-1e-7)continue;
   const dx=x-p[0],dz=z-p[2],u=(dx*bz-dz*bx)/det,v=(ax*dz-az*dx)/det;
   if(u<0 || v<0 || u+v>1)continue;
   const hit=p[1]+u*(p[4]-p[1])+v*(p[7]-p[1]);
   if(Math.abs(hit-near)<5)y=Math.max(y,hit);
  }
  return y;
 }
 for(let i=0;i<900;i++) {
  model.step(1/30);
  for(const o of group.members) {
   if(o.speed>10)moving++;
   if(i%5)continue;
   const y=meshHeight(o.pos.x,o.pos.z,o.ground);
   assert.ok(Number.isFinite(y));assert.ok(o.pos.y>=y+.5*o.size-.03,`body sank below visible floor by ${y-o.pos.y}`);contacts++;
  }
 }
 assert.ok(moving>30 && contacts>300);
});

test('a missing tilted floor probe cannot make a supported pebble disappear',async()=>{
 const {pebbleSlope,pebbleGround}=await import('../../js/world/fauna/PebbleHoppers.js');
 const sample=(x,z)=>({ground:Math.abs(x)>.6 && Math.abs(z)>.6?NaN:2,water:-4,cave:true,clearance:20,slope:0,hardness:1,wet:0,forest:0});
 assert.ok(pebbleGround({environment:{sample}},0,0,1));
 const tilt=pebbleSlope(sample,0,0,Math.PI/4,1);
 assert.ok(Number.isFinite(tilt.pitch) && Number.isFinite(tilt.bank));
});

test('cave foot placement accepts a small ledge but still rejects a cliff',async()=>{
 const {pebbleGround}=await import('../../js/world/fauna/PebbleHoppers.js');
 const model=height=>({environment:{sample:(x,z)=>({ground:x>=0?height:0,water:-4,cave:true,clearance:20,slope:0,hardness:1,wet:0,forest:0})}});
 assert.ok(pebbleGround(model(1.2),-.5,0,1,0),'approach the ledge with the body footprint');
 assert.ok(pebbleGround(model(1.2),.2,0,1,0),'step onto the ledge');
 assert.equal(pebbleGround(model(4),.2,0,1,0),null,'a tall cliff remains impassable');
});

test('a running pebble climbs and descends a cave step without losing its pose or support',()=>{
 for(const direction of [1,-1]) {
  const sample=(x,z)=>({ground:2+(x>=0?1.2:0),water:-4,cave:true,clearance:20,slope:0,hardness:1,wet:0,forest:0});
  const model=new FaunaModel('cave-step',{sample}),group=model.addGroup('step','hopper',-10,0,1),c=group.members[0];
  model.creatures=group.members=[c];group.stones=[];group.sample=sample;
  c.pos={x:-direction*6,y:sample(-direction*6,0).ground+1.4*c.size,z:0};c.prev={...c.pos};c.ground=sample(c.pos.x,0).ground;
  c.yaw=c.prevYaw=direction===1?0:Math.PI;
  Object.assign(c.pebble,{state:'flee',stand:1,prevStand:1,origin:{...c.pos},refuge:{x:direction*100,z:0},alarmSource:{x:-direction*14,z:0},heading:undefined,steerAt:0});
  let crossed=false;
  for(let frame=0;frame<60;frame++) {
   model.listener={x:c.pos.x-direction*10,y:c.ground+11,z:0};model.step(1/30);
   assert.ok([c.pos.x,c.pos.y,c.pos.z,c.pitch,c.bank].every(Number.isFinite));
   assert.ok(c.pos.y>=sample(c.pos.x,c.pos.z).ground+.5*c.size);
   if(c.pos.x*direction>6)crossed=true;
  }
  assert.ok(crossed,direction===1?'failed to climb the step':'failed to descend the step');
 }
});

test('a pebble escapes a narrow bank across a cave stream with its shell submerged',()=>{
 for(const direction of [1,-1]) {
  const dry=()=>({ground:2,water:0,cave:true,clearance:25,slope:0,hardness:1,wet:0,forest:0});
  // A three-unit-deep channel blocks the only route along this narrow passage.
  const sample=(x,z)=>({...dry(),ground:Math.abs(z)>5?NaN:2-5*Math.max(0,Math.min(1,(x+4)/5,(24-x)/5))});
  const model=new FaunaModel('cave-stream',{sample:dry}),group=model.addGroup('stream','hopper',-10,0,1),c=group.members[0];
  model.creatures=group.members=[c];group.stones=[];group.sample=sample;
  c.pos={x:direction===1?-8:28,y:2+1.4*c.size,z:0};c.prev={...c.pos};c.ground=2;
  c.yaw=c.prevYaw=direction===1?0:Math.PI;
  Object.assign(c.pebble,{state:'flee',stand:1,prevStand:1,origin:{...c.pos},refuge:{x:direction*100,z:0},alarmSource:{x:c.pos.x-direction*12,z:0},heading:undefined,steerAt:0});
  let wetFrames=0,submergedFrames=0,crossed=false;
  for(let frame=0;frame<150;frame++) {
   model.listener={x:c.pos.x-direction*12,y:11,z:0};model.step(1/30);
   const s=sample(c.pos.x,c.pos.z);
   assert.ok([c.pos.x,c.pos.y,c.pos.z,c.pitch,c.bank].every(Number.isFinite));
   assert.equal(c.ground,s.ground,'retain the actual bed for terrain support');
   if(s.ground<s.water) {
    wetFrames++;
    assert.ok(c.pos.y>=s.water-.8*c.size-.001,'keep a stable swimming depth');
    if(s.water-s.ground>2.1*c.size){submergedFrames++;assert.ok(c.pos.y<s.water-.5*c.size,'shell must sit below the waterline');}
    assert.ok(!['rest','settle','wait'].includes(c.pebble.state),'keep crossing until a dry bank');
    for(const f of c.feet||[])assert.ok(f.pos.y>=sample(f.pos.x,f.pos.z).ground-.03,'paddling feet stay above the bed');
   }
   if(direction===1?c.pos.x>28:c.pos.x< -8)crossed=true;
  }
  assert.ok(wetFrames>3,'must actually cross the wet channel');
  assert.ok(submergedFrames>0,'exercise shell submersion in deeper water');
  assert.ok(crossed,'must reach the opposite bank');
 }
});

test('a pebble crosses the rendered wet cave channel from shelf to shelf',()=>{
 const points=[0,40,80,120,160,200].map(x=>({x,z:0,floor:2,width:25,height:30,water:5}));
 const cave={id:0,wet:true,relief:true,entrance:{x:0,y:16,z:0},paths:[{points,wet:true,surfaceStart:0}]};
 const hm={height:()=>100,caves:new CaveField([cave])};
 hm.caveFloorSurface=new CaveFloorSurface(buildCaveMeshes(hm,[cave]));
 const surface=()=>({ground:100,water:-4,slope:0,hardness:.9,forest:0,wet:0,roof:false});
 const sample=pebbleCaveSampler(hm,surface,cave,5);
 for(const direction of [1,-1]) {
  const model=new FaunaModel('meshed-stream',{sample:surface}),group=model.addGroup('stream','hopper',0,0,1),c=group.members[0];
  c.size=1.2; // A known leg length makes this channel a swim rather than a wade.
  model.creatures=group.members=[c];group.stones=[];group.sample=sample;
  c.ground=sample(100,-direction*16).ground;
  c.pos={x:100,y:c.ground+1.4*c.size,z:-direction*16};c.prev={...c.pos};c.yaw=c.prevYaw=-direction*Math.PI/2;
  Object.assign(c.pebble,{state:'flee',stand:1,prevStand:1,origin:{...c.pos},refuge:{x:100,z:direction*100},alarmSource:{x:100,z:-direction*28},heading:undefined,steerAt:0});
  let wet=0,submerged=0,crossed=false;
  for(let frame=0;frame<120;frame++) {
   model.listener={x:c.pos.x,y:16,z:c.pos.z-direction*12};model.step(1/30);
   const s=sample(c.pos.x,c.pos.z);
   assert.ok(Object.values(c.pos).every(Number.isFinite));assert.ok(c.pos.y>=s.ground+.5*c.size);
   if(s.ground<s.water){wet++;assert.ok(c.pos.y>=s.water-.8*c.size-.001);}
   if(s.water-s.ground>2.1*c.size){submerged++;assert.ok(c.pos.y<s.water-.5*c.size,'submerge the shell in the rendered stream');}
   if(c.pos.z*direction>14 && s.ground>s.water+.7){crossed=true;break;}
  }
  assert.ok(wet>3,'cross the actual meshed channel');assert.ok(submerged>0,'exercise the submerged shell in the real mesh');assert.ok(crossed,'reach the other dry shelf');
 }
});

test('braking in a cave stream resumes escape to a dry resting place',()=>{
 const sample=(x,z)=>({ground:Math.abs(x)<20?-3:2,water:0,cave:true,clearance:25,slope:0,hardness:1,wet:0,forest:0});
 const model=new FaunaModel('wet-brake',{sample:()=>({...sample(30,0)})}),group=model.addGroup('wet-brake','hopper',40,0,1),c=group.members[0];
 model.creatures=group.members=[c];group.stones=[];group.sample=sample;
 c.pos={x:0,y:.8,z:0};c.prev={...c.pos};c.ground=-3;
 Object.assign(c.pebble,{state:'brake',stand:1,prevStand:1,origin:{x:-60,z:0},refuge:{x:0,z:0},alarmSource:{x:-80,z:0},heading:undefined,steerAt:0});
 model.listener={x:-80,y:11,z:0};model.step(1/30);
 assert.equal(c.pebble.state,'flee');assert.ok(sample(c.pebble.refuge.x,c.pebble.refuge.z).ground>.7);
});
