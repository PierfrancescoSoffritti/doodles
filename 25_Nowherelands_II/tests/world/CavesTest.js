import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from '../../js/world/gen/WorldGen.js';
import { generateCaves } from '../../js/world/caves/CaveGen.js';
import {sweepWalk} from '../../js/world/caves/CaveCollision.js';
import { CaveField } from '../../js/world/caves/CaveField.js';
import { erodeEntrances,EntranceTerrain } from '../../js/world/caves/EntranceTerrain.js';
import { entranceHabitat } from '../../js/world/caves/EntranceHabitat.js';
import { buildCaveMeshes } from '../../js/world/caves/CaveMeshData.js';

globalThis.location={search:'?seed=umbra'};
const {Heightmap}=await import('../../js/world/Heightmap.js');
for(const seed of ['umbra','halcyon']) test(`${seed}: connected deep caves have dry levels and downhill spring drainage`,()=>{
	const world=generateWorld(seed,null,{res:512}),hm=new Heightmap(seed,world),caves=generateCaves(hm,seed);
	assert.ok(caves.length>=3);assert.ok(caves.some(c=>!c.wet));assert.ok(caves.some(c=>c.wet));
	assert.ok(caves.some(c=>c.entrance.type==='mountain'));
	assert.ok(caves.some(c=>c.entrance.type==='fissure'));
	assert.ok(caves.some(c=>c.wet && c.entrances.length>1));
	assert.deepEqual(generateCaves(hm,seed),caves,'world generation must be seeded');
	const field=new CaveField(caves);
	for(const cave of caves) {
		assert.ok(cave.length>500);assert.ok(cave.paths.length>=2);assert.ok(cave.overburden>8);
		const main=cave.paths[0].points;
		for(const path of cave.paths) {
			if(path!==cave.paths[0]) assert.ok(main.some(p=>Math.hypot(p.x-path.points[0].x,p.z-path.points[0].z)<.001),'branches must connect to the main passage');
			for(const p of path.points) {
				assert.ok(Object.values(p).every(Number.isFinite));
				const y=Math.max(p.floor,path.wet?p.water-1.5:-1e6)+11;
				assert.ok(Math.max(field.density(p.x,y,p.z),y-hm.height(p.x,p.z))>2,'the centerline needs cave or exterior body clearance');
				assert.ok(field.column(p.x,p.z,y)||y>hm.height(p.x,p.z)+2,'3D collision must find a cave floor or exterior air');
			}
		}
		if(cave.wet) {
			for(let i=1;i<main.length;i++) assert.ok(main[i].water>=main[i-1].water,'flow is toward the outlet at point zero');
			const river=world.rivers.find(r=>r.id===cave.river);
			assert.ok(river);assert.ok(main[0].water>main[0].floor);
		}
		let opening=false;
		for(let j=0;j<4;j++) for(let i=0;i<16;i++) {
			const a=main[j],b=main[j+1],t=i/16,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=hm.height(x,z);
			if(field.surfaceDensity(x,y,z)>0) opening=true;
		}
		assert.ok(opening,'there must be a real opening through the height field');
		for(const entrance of cave.entrances) {
			const path=cave.paths[entrance.path],end=entrance.end==='end';
			if(entrance.type==='high')assert.ok(entrance.y>cave.entrance.y+65,'the second mouth must be higher than the spring');
			if(entrance.type==='mountain'||entrance.type==='fissure') {
				assert.equal(cave.river,-1,'mountain placement must be independent of river sites');
				assert.ok(path.points.at(-1).floor<path.points[0].floor-50,'the dry passage descends into the mountain');
			}
			const ends=end?path.points.slice(-5):path.points.slice(0,5);
			assert.ok(ends.slice(0,-1).some((a,j)=>Array.from({length:17},(_,i)=>{const t=i/16,b=ends[j+1],x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;return field.surfaceDensity(x,hm.height(x,z),z)>0;}).some(Boolean)),'every entrance needs a terrain opening');
			if(end) for(const p of path.points.slice(0,-5))assert.ok(hm.height(p.x,p.z)>p.floor+p.height+8,'a high entrance must remain enclosed through the interior');
		}

	}
	if(seed==='umbra') {
		const patches=erodeEntrances(hm,caves);
		assert.ok(patches.length>=3);
		for(const p of patches) {
			assert.ok(p.delta.every(Number.isFinite));
			assert.ok(p.delta.some(v=>v< -5),'the face needs real erosion');
			assert.ok(p.delta.some(v=>v> .1),'the apron needs deposited sediment');
			for(let i=0;i<p.n;i++)assert.equal(p.delta[i],0,'patch edges must join unchanged terrain');
		}
		hm.entranceTerrain=new EntranceTerrain(patches);hm.caves=field;
		for(const cave of caves.filter(c=>c.entrance.type==='mountain'||c.entrance.type==='fissure')) {
			const [a,b,inside]=cave.paths[0].points,dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),x=a.x-dx/l*60,z=a.z-dz/l*60;
			const outside={x,z,y:hm.height(x,z)+11},q=field.column(inside.x,inside.z,inside.floor+11),target={x:inside.x,z:inside.z,y:q.floor+11};
			const entered=sweepWalk(hm,outside,target);
			assert.ok(Math.hypot(entered.x-target.x,entered.z-target.z)<2,'the generated approach must lead into the cave without a threshold wall');
			const exited=sweepWalk(hm,target,outside);
			assert.ok(Math.hypot(exited.x-outside.x,exited.z-outside.z)<2,'the same eroded approach must allow exit');
		}
		const habitat=entranceHabitat(hm,caves);
		assert.deepEqual(entranceHabitat(hm,caves),habitat);
		hm.caves=new CaveField(caves,habitat.flatMap(h=>h.rocks));
		for(const cave of caves.filter(c=>['mountain','fissure'].includes(c.entrance.type))) {
			const [a,b,c]=cave.paths[0].points,l=Math.hypot(b.x-a.x,b.z-a.z),x=a.x-(b.x-a.x)/l*60,z=a.z-(b.z-a.z)/l*60;
			const start={x,z,y:hm.height(x,z)+11},target={x:c.x,z:c.z,y:field.column(c.x,c.z,c.floor+11).floor+11};
			const walked=sweepWalk(hm,start,target);
			assert.ok(Math.hypot(walked.x-target.x,walked.z-target.z)<2,'collapse rocks must preserve an accessible route through the mouth');
		}

		assert.ok(habitat.some(h=>h.rocks.filter(r=>r.large).length>=3));
		assert.ok(habitat.some(h=>h.plants.some(p=>p.type==='fern')));
		assert.ok(habitat.some(h=>h.plants.some(p=>p.type==='bramble')));
		for(const h of habitat)for(const p of h.plants) {
			assert.ok(p.cover<=24,'plant recruitment stops beyond the entrance light zone');
			assert.ok(p.y>hm.waterAt(p.x,p.z),'terrestrial plants stay above the water');
		}
		const meshes=buildCaveMeshes(hm,[caves[0]]);
		assert.ok(meshes.chunks.length>10);assert.ok(meshes.water.length===1);
		for(const mesh of [...meshes.chunks,...meshes.water,...meshes.decorations]) {
			assert.ok(mesh.position.every(Number.isFinite));assert.equal(mesh.position.length%9,0);
			if(mesh.depth){assert.equal(mesh.depth.length,mesh.position.length/3);assert.ok(mesh.depth.every(Number.isFinite));}
		}
	}
});

test('overlapping levels remain distinct and solid rock separates their floors',()=>{
	const point=(x,floor)=>({x,z:0,floor,width:20,height:20,water:-1e6});
	const cave={id:0,paths:[{wet:false,points:[point(0,0),point(100,0)]},{wet:false,points:[point(0,45),point(100,45)]}]};
	const field=new CaveField([cave]);
	assert.ok(field.density(50,11,0)>0);assert.ok(field.density(50,56,0)>0);assert.ok(field.density(50,34,0)<0);
	assert.ok(field.column(50,0,11).floor<2);assert.ok(field.column(50,0,56).floor>40);
	assert.equal(field.column(50,50,11),null);
});

test('walking and fast flight stop at walls and ceilings without snapping to the surface', async()=>{
	const {sweepFlight,sweepWalk}=await import('../../js/world/caves/CaveCollision.js');
	const p=(x)=>({x,z:0,floor:0,width:18,height:24,water:-1e6});
	const field=new CaveField([{id:0,paths:[{wet:false,points:[p(0),p(100)]}]}]);
	const hm={caves:field,height:()=>200,waterAt:()=>-1e6};
	const from={x:50,y:11,z:0};
	const walk=sweepWalk(hm,from,{x:70,y:11,z:0});assert.ok(walk.x>69);assert.ok(walk.y<13);
	const wall=sweepWalk(hm,from,{x:50,y:11,z:90});assert.ok(wall.z<20);assert.ok(wall.y<13);
	const flight=sweepFlight(hm,from,{x:50,y:11,z:150});assert.ok(flight.z<20);
	const ceiling=sweepFlight(hm,from,{x:50,y:90,z:0});assert.ok(ceiling.y<32);assert.ok(ceiling.y>11);
});

test('a dissolved junction cannot retain an invisible upper floor',()=>{
	const p=(x,floor,height)=>({x,z:0,floor,width:25,height,water:-1e6});
	const field=new CaveField([{id:0,paths:[{wet:false,points:[p(0,0,40),p(100,0,40)]},{wet:false,points:[p(0,25,30),p(100,25,30)]}]}]);
	const support=field.column(50,0,40);
	assert.ok(support.floor<2,'the lower chamber removed the upper passage floor');
	assert.ok(support.ceiling>50);
});

test('a cave can be entered and exited continuously through a hillside opening',async()=>{
	const {sweepWalk,sweepFlight}=await import('../../js/world/caves/CaveCollision.js');
	const point=x=>({x,z:0,floor:0,width:22,height:28,water:-1e6});
	const field=new CaveField([{id:0,paths:[{wet:false,points:[point(0),point(120)]}]}]);
	const hm={caves:field,height:x=>Math.max(0,x*.9),waterAt:()=>-1e6};
	const outside={x:-35,y:11,z:0},inside={x:80,y:11,z:0};
	const entering=sweepWalk(hm,outside,inside);assert.ok(entering.x>79);assert.ok(entering.y<13);
	const leaving=sweepWalk(hm,inside,outside);assert.ok(leaving.x<-34);assert.ok(leaving.y<13);
	assert.ok(sweepFlight(hm,inside,outside).x<-34);
});


test('a second entrance cuts terrain and allows walking in both directions',async()=>{
	const {sweepWalk}=await import('../../js/world/caves/CaveCollision.js');
	const p=(x,floor)=>({x,z:0,floor,width:14,height:30,water:-1e6});
	const points=Array.from({length:13},(_,i)=>p(i*20,i*4));
	const field=new CaveField([{id:0,paths:[{wet:false,points:[p(-100,0),p(0,0)],surfaceStart:0},{wet:false,points,surfaceEnd:4}]}]);
	const hm={caves:field,height:x=>Math.max(0,48+(240-x)*.8),waterAt:()=>-1e6};
	assert.ok(field.surfaceDensity(230,hm.height(230),0)>0);
	assert.ok(field.surfaceDensity(50,hm.height(50),0)<0);
	const inside={x:160,y:43,z:0},outside={x:255,y:47,z:0};
	assert.ok(sweepWalk(hm,inside,outside).x>254);
	assert.ok(sweepWalk(hm,outside,inside).x<161);
});

test('large entrance boulders stop walking and flight above the surface',async()=>{
	const {sweepWalk,sweepFlight}=await import('../../js/world/caves/CaveCollision.js');
	const field=new CaveField([],[{x:0,y:5,z:0,sx:10,sy:10,sz:10,yaw:0,large:true}]);
	const hm={caves:field,height:()=>0,waterAt:()=>-1e6};
	assert.ok(field.hasRocks(0,0));
	assert.ok(sweepWalk(hm,{x:-25,y:11,z:0},{x:25,y:11,z:0}).x<0);
	assert.ok(sweepFlight(hm,{x:-25,y:8,z:0},{x:25,y:8,z:0}).x<0);
	assert.equal(sweepWalk(hm,{x:-25,y:11,z:25},{x:25,y:11,z:25}).x,25);
});


test('dry floors have continuous relief across segment joins and no exterior end-cap void',()=>{
	const p=x=>({x,z:0,floor:0,width:22,height:30,water:-1e6});
	const cave={id:0,relief:true,paths:[{wet:false,points:[p(0),p(40),p(80),p(120)],surfaceStart:4}]};
	const field=new CaveField([cave]),heights=[];
	for(let x=4;x<115;x+=2)heights.push(field.column(x,0,11).floor);
	assert.ok(Math.max(...heights)-Math.min(...heights)>2,'the floor cannot be a straight plane');
	assert.ok(Math.abs(field.column(39.99,0,11).floor-field.column(40.01,0,11).floor)<.1,'relief must not reset at polyline joins');
	assert.ok(field.density(-8,11,0)<0,'the mouth must not subtract a rounded cap from the approach outside');
});
