import test from 'node:test';
import assert from 'node:assert/strict';
import { waterSites, waterClearance, PoolLifeModel } from '../../js/world/WaterHabitats.js';
const sample=(x,z)=>({ground:7,water:10,foam:0,speed:0,roof:false});
const lakes=[{id:0,shore:Array.from({length:48},(_,i)=>({x:i*60,z:0,y:10,nx:0,nz:1}))}];
const world={rivers:[]};
test('water communities are reproducible, uneven, varied and freshwater only',()=>{
 const sites=waterSites(world,lakes,sample,'water-test');
 assert.deepEqual(sites,waterSites(world,lakes,sample,'water-test'));
 assert.notDeepEqual(sites,waterSites(world,lakes,sample,'other'));
 assert.ok(sites.length>10&&sites.length<48);
 const sizes=new Set(sites.flatMap(s=>s.groups.map(g=>g.count)));assert.ok(sizes.has(1));assert.ok(sizes.size>=4);
 assert.ok(new Set(sites.map(s=>s.plants.length)).size>=4);
 assert.ok(sites.some(s=>s.plants.some(p=>!p.bloom)));assert.ok(sites.some(s=>s.plants.some(p=>p.bloom)));
 assert.equal(waterSites(world,lakes,sample,'water-test',10).length,0);
 for(const bad of [{ground:10},{foam:1},{speed:3},{roof:true}])assert.equal(waterSites(world,lakes,()=>({...sample(),...bad}),'water-test').length,0);
});
test('swimming clearance rejects banks, rocks and changes in water level across a route',()=>{
 assert.equal(waterClearance(sample,0,0,6,10),3);
 for(const changed of [{ground:9.5},{water:12},{roof:true}])assert.equal(waterClearance((x,z)=>({...sample(),...(x>2?changed:{})}),0,0,6,10),0);
});
test('fish stay submerged with bed clearance; quiet streaming preserves phase',()=>{
 const sites=waterSites(world,lakes,sample,'water-test');
 for(const site of sites){
  const quiet=new PoolLifeModel(site,'water-test');
  for(let t=0;t<90;t+=.13){
   quiet.update(t);
   for(const f of quiet.fish){assert.ok(Math.hypot(f.x-(f.group.x||0),f.z-(f.group.z||0))+f.size*f.bodyLength*1.3<f.group.radius+3.5);assert.ok(f.y+f.size*(.8+.2*f.bodyWidth)*.4<-.2);assert.ok(f.y-f.size*(.8+.2*f.bodyWidth)*.4>-3+.2);}
  }
  const reload=new PoolLifeModel(site,'water-test');reload.update(quiet.time);assert.deepEqual(reload.fish,quiet.fish);
 }
 const site=sites.find(s=>s.plants.some(p=>p.bloom)),m=new PoolLifeModel(site,'water-test');m.hear(site.x,site.z,100);m.update(.5);assert.ok(m.plants.some(p=>p.glow>.1));
});

test('mountain lakes receive fish, while small and narrow pools cannot',()=>{
 const banks=[{id:1,shore:[{x:0,z:0,y:980,nx:0,nz:0},{x:200,z:0,y:980,nx:0,nz:0}]}];
 const mountain=(x,z)=>({ground:974,water:980,foam:0,speed:0,roof:false});
 assert.ok(waterSites(world,banks,mountain,'mountain').some(s=>s.groups.length));
 for(const wet of [(x,z)=>Math.hypot(x,z)<12,(x,z)=>Math.abs(x)<10]){
  const small=(x,z)=>({...mountain(),ground:wet(x,z)?974:990});
  assert.equal(waterSites(world,banks,small,'mountain').flatMap(s=>s.groups).length,0);
 }
});

test('fish have readable variety and travel substantial distances; lilies include large colorful adults',()=>{
 const sites=waterSites(world,lakes,sample,'water-test'),models=sites.map(s=>new PoolLifeModel(s,'water-test')),fish=models.flatMap(m=>m.fish),plants=sites.flatMap(s=>s.plants);
 assert.ok(new Set(fish.map(f=>f.color)).size>=4);assert.ok(new Set(fish.map(f=>f.marking)).size>=3);
 assert.ok(Math.max(...fish.map(f=>f.size))/Math.min(...fish.map(f=>f.size))>2.5);
 assert.ok(Math.max(...plants.map(p=>p.flowerHeight))/Math.min(...plants.map(p=>p.flowerHeight))>2.5);assert.equal(new Set(plants.map(p=>p.flowerShape)).size,3);assert.ok(new Set(plants.map(p=>p.palette)).size>=4);assert.ok(Math.max(...plants.map(p=>p.size))>6);assert.ok(Math.min(...plants.map(p=>p.size))<3);
 let distance=0,count=0;
 for(const m of models){const before=m.fish.map(f=>({x:f.x,z:f.z}));m.update(4);m.fish.forEach((f,i)=>{distance+=Math.hypot(f.x-before[i].x,f.z-before[i].z);count++;});}
 assert.ok(distance/count>6,'fish cruise visibly instead of barely moving');
});

test('lily taps retrigger promptly, aimed flowers lead, and a charge answers in chorus',()=>{
 const site=waterSites(world,lakes,sample,'water-test').find(s=>s.plants.filter(p=>p.bloom).length>=3),m=new PoolLifeModel(site,'water-test'),p=m.plants.find(p=>p.bloom);
 m.hear(site.x,site.z,200,0,p.index);assert.equal(m.pending[0].plant,p.index);assert.ok(m.pending[0].at<=.05);
 m.update(.12);assert.ok(p.glow>.7);assert.ok(Math.abs(p.nod)>.05);assert.ok(m.drainEvents().length);
 m.hear(site.x,site.z,200,0,p.index);m.update(.24);assert.ok(p.glow>.7);assert.ok(m.pending.length<=8);
 m.hear(site.x,site.z,200,1);assert.equal(new Set(m.pending.map(e=>e.at)).size,1);
 m.update(.36);assert.ok(m.plants.filter(p=>p.bloom).every(p=>p.glow>.7));
 assert.ok(m.drainEvents().some(e=>e.chorus));
});


test('blips startle fish away even without lilies, then smoothly restore cruising',()=>{
 const site=waterSites(world,lakes,sample,'water-test').find(s=>s.groups.some(g=>g.count===1));
 const m=new PoolLifeModel({...site,groups:[{...site.groups.find(g=>g.count===1),count:1}],plants:[]},'water-test',{canSwim:()=>true});
 m.update(2);const f=m.fish[0],start={x:f.x,z:f.z},g=f.group;
 // Blip at the group centre leaves ample water for an outward escape.
 const px=site.x+g.x,pz=site.z+g.z,before=Math.hypot(f.x-g.x,f.z-g.z);
 assert.equal(m.hear(px+1000,pz,20),false);assert.equal(f.escape,undefined);
 assert.equal(m.hear(px,pz,100),true);m.update(2);assert.ok(Math.hypot(f.x-start.x,f.z-start.z)<1e-8,'no teleport at blip');
 let farthest=before,peakSpeed=0;
 const firstYaw=f.yaw;
 for(let t=2.02;t<3;t+=.02){const yaw=f.yaw;m.update(t);const turn=Math.atan2(Math.sin(f.yaw-yaw),Math.cos(f.yaw-yaw));assert.ok(Math.abs(turn)<=.113,'heading turns gradually');peakSpeed=Math.max(peakSpeed,f.speed);}
 assert.ok(Math.abs(Math.atan2(Math.sin(f.yaw-firstYaw),Math.cos(f.yaw-firstYaw)))>.1);assert.ok(peakSpeed>5);
 const retrigger={x:f.x,z:f.z},at=m.time;m.hear(px,pz,100,1);m.update(at);assert.ok(Math.hypot(f.x-retrigger.x,f.z-retrigger.z)<1e-8);
 for(let t=at+.02;t<24;t+=.02){const prev={x:f.x,z:f.z};m.update(t);assert.ok(Math.hypot(f.x-prev.x,f.z-prev.z)<.65,'no abrupt return to route');farthest=Math.max(farthest,Math.hypot(f.x-g.x,f.z-g.z));assert.ok(f.y+f.size*.4<0);}
 assert.ok(farthest>g.radius+15,'escape travels far beyond original school boundary');
 assert.equal(f.escape,undefined);assert.equal(f.burst,0);assert.deepEqual({x:f.x,z:f.z},m.pose(f,m.time));
});

test('repeated blips keep whole schools inside validated water and below its surface',()=>{
 const sites=waterSites(world,lakes,sample,'water-test');
 for(const site of sites){const m=new PoolLifeModel(site,'water-test');for(let i=0;i<300;i++){
  m.update(i/30);if(i%23===0)m.hear(site.x+Math.sin(i)*30,site.z+Math.cos(i)*30,100,i%2);
  for(const f of m.fish){assert.ok(Math.hypot(f.x-f.group.x,f.z-f.group.z)<=f.group.radius*.95+1e-8);assert.ok(f.y+f.size*(.8+.2*f.bodyWidth)*.4<-.2);assert.ok(f.y-f.size*(.8+.2*f.bodyWidth)*.4>-2.8);}
 }}
});


test('a blip produces a visible escape within 200ms without an orientation snap',()=>{
 const site=waterSites(world,lakes,sample,'water-test').find(s=>s.groups.length);
 const m=new PoolLifeModel({...site,groups:[{...site.groups[0],count:1}],plants:[]},'water-test',{canSwim:()=>true});
 m.update(2);const f=m.fish[0],x=f.x,z=f.z,yaw=f.yaw;
 m.hear(site.x+x-Math.cos(yaw)*5,site.z+z+Math.sin(yaw)*5,100);
 m.update(2);assert.equal(f.yaw,yaw);assert.equal(f.x,x);assert.equal(f.z,z);
 for(let i=1;i<=12;i++){const previous=f.yaw;m.update(2+i/60);assert.ok(Math.abs(Math.atan2(Math.sin(f.yaw-previous),Math.cos(f.yaw-previous)))<.095);}
 assert.ok(Math.hypot(f.x-x,f.z-z)>2,'fish visibly darts within the first 200ms');assert.ok(f.speed>10);
 assert.ok(f.escape.returnDuration>7,'regrouping remains relaxed');
});
