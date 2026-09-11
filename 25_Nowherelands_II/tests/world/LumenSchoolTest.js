import test from 'node:test';
import assert from 'node:assert/strict';
import { updateFlow, buildLumenGrid, nearestLumen } from '../../js/world/fauna/LumenFlow.js';
import { lumenLakes, departSchool } from '../../js/world/fauna/LumenSchool.js?v=player-notes-13';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js?v=pebble-voice-4b';

const lakes = [{ id: 0, x: 0, y: 0, z: 0, radius: 35 }, { id: 1, x: 600, y: 25, z: 180, radius: 35 }, { id: 2, x: 1800, y: 70, z: -300, radius: 35 }];
const sample = (x, z) => {
	const lake = lakes.find(l => Math.hypot(x - l.x, z - l.z) < 65);
	return { ground: lake ? lake.y - 6 : 18 + Math.sin(x / 150) * 8, water: lake ? lake.y : 0, slope: 0.1, foam: 0, wet: 1, forest: 0.1 };
};
function setup() {
	const model = new FaunaModel('sky-fish', { lakes, sample });
	model.listener = { x: -10000, y: 0, z: -10000 };
	const population = model.addGroup('school', 'lumen', 0, 0, 4);
	return { model, population, group: population.flow.branches[0] };
}

test('relaxed lumen form a slow school at multiple low elevations near a lake', () => {
	const { model, group } = setup();
	for (let i = 0; i < 600; i++) model.step(1 / 30);
	assert.equal(group.state, 'resting');
	const heights = group.members.map(c => c.pos.y);
	assert.ok(Math.max(...heights) - Math.min(...heights) > 2);
	assert.ok(Math.max(...heights) < 14);
	assert.ok(group.members.every(c => c.speed < 14.5));
});

test('approaching a resting school triggers a fast climb and a different lake destination', () => {
	const { model, group } = setup();
	for (let i = 0; i < 100; i++) model.step(1 / 30);
	model.listener = { x: group.center.x + 12, y: 11, z: group.center.z };
	model.step(1 / 30);
	assert.equal(group.state, 'startled'); assert.equal(group.destination,null,'escape should precede choosing a lake');
	assert.ok(new Set(group.members.map(c => c.startleAt)).size > 1, 'startle propagates through individuals');
	model.listener = { x: -10000, y: 0, z: -10000 };
	let peakSpeed = 0;
	for (let i = 0; i < 180; i++) { model.step(1 / 30); peakSpeed = Math.max(peakSpeed, ...group.members.map(c => c.speed)); }
	assert.ok(group.center.y > 25); assert.ok(peakSpeed > 65);
});

test('a migrating school keeps its identities outside the spawn radius and settles at another lake', () => {
	const { model, group } = setup(), ids = model.creatures.map(c => c.id);
	for (let i = 0; i < 100; i++) model.step(1 / 30);
	model.listener = { x: group.center.x + 12, y: 11, z: group.center.z }; model.step(1 / 30);
	model.listener = { x: -10000, y: 0, z: -10000 };
	let maxRange = 0, maxHeight = 0, arrived = false;
	for (let i = 0; i < 12000; i++) {
		model.step(1 / 30);
		if (i % 30 === 0) model.removeFar({ x: 0, y: 0, z: 0 }, 100);
		maxRange = Math.max(maxRange, Math.hypot(group.center.x, group.center.z)); maxHeight = Math.max(maxHeight, group.center.y);
		for (const c of group.members) {
			assert.ok([c.pos.x, c.pos.y, c.pos.z].every(Number.isFinite));
			assert.ok(Math.hypot(c.pos.x - group.center.x, c.pos.y - group.center.y, c.pos.z - group.center.z) < 500, 'animal lost its journey');
		}
		if (group.state === 'resting' && group.visits.length>1) { arrived = true; break; }
	}
	assert.ok(arrived, `did not settle: ${group.state}, waypoint ${group.waypoint}`);
	assert.ok(maxRange > 400); assert.ok(maxHeight > 35);
	assert.deepEqual(model.creatures.map(c => c.id), ids);
	assert.ok(Math.abs(group.center.y - group.lake.y) < 15);
});

test('undisturbed schools also migrate, and observation alone does not scare them', () => {
	const { model, group } = setup(); model.observing = true; model.listener = { ...group.center };
	for (let i = 0; i < 150; i++) model.step(1 / 30);
	assert.equal(group.state, 'resting');
	group.departAt = model.time;
	model.step(1 / 30); assert.equal(group.state, 'playing'); assert.equal(group.destination,null);
});


test('shoreline extraction selects wet bank samples instead of lake centres', () => {
	const res=80,cell=4,size=res*cell,cells=[];
	for(let z=0;z<res;z++)for(let x=0;x<res;x++)if(Math.hypot(x*cell-size/2,z*cell-size/2)<100)cells.push(z*res+x);
	const sample=(x,z)=>({ground:(Math.hypot(x,z)-100)*0.2,water:0});
	const [lake]=lumenLakes({res,cell,size,spawn:{x:0,z:0},lakes:[{id:0,level:0,cells,area:31415}]},sample);
	assert.ok(lake.shore.length>8);
	for(const p of lake.shore) {assert.ok(Math.hypot(p.x,p.z)>85);assert.ok(Math.hypot(p.x,p.z)<100);}
	const model=new FaunaModel('bank',{lakes:[lake],sample:(x,z)=>({...sample(x,z),slope:0,foam:0,wet:1,forest:0})});
	model.observing=true;const g=model.addGroup('shore','lumen',lake.x,lake.z,4);g.departAt=Infinity;
	const starts=g.members.map(c=>({...c.pos}));let travel=0;
	for(let i=0;i<900;i++) {model.step(1/30);travel+=g.members[0].speed/30;}
	assert.ok(g.members.every(c=>Math.abs(Math.hypot(c.pos.x,c.pos.z)-100)<30),'school left the bank');
	assert.ok(travel>50,'idle animals stopped moving');
	assert.ok(g.members.some((c,i)=>Math.hypot(c.pos.x-starts[i].x,c.pos.z-starts[i].z)>10));
});

test('large schools vary in size, shape and timing and take curved detours', () => {
	const {model,group}=setup();assert.equal(model.creatures.length,640);
	assert.ok(Math.max(...group.members.map(c=>c.size))/Math.min(...group.members.map(c=>c.size))>2.5);
	assert.ok(new Set(group.members.map(c=>c.pulseRate)).size>40);
	group.departAt=0;model.observing=true;model.step(1/30);
	assert.equal(group.destination,null);
	for(let i=0;i<1800 && group.state!=='travelling';i++)model.step(1/30);
	assert.equal(group.state,'travelling');
	const from=group.origin,to=group.destinationBank,dx=to.x-from.x,dz=to.z-from.z,d=Math.hypot(dx,dz);
	assert.ok(group.route.at(-1).length>d*1.12,'route took a direct shortcut');
	assert.ok(Math.max(...group.route.map(p=>Math.abs((p.x-from.x)*dz-(p.z-from.z)*dx)/d))>60);
	let changed=0,previous={...group.members[0].vel};
	for(let i=0;i<150;i++) {model.step(1/30); const v=group.members[0].vel;if(Math.hypot(v.x-previous.x,v.z-previous.z)>0.03)changed++;previous={...v};}
	assert.ok(changed>80,'flight heading stayed rigid');
});

test('nearby streams interweave and exchange members without gathering distant streams', () => {
	const {model,population}=setup(), [a,b,...others]=population.flow.branches;
	const ids=population.members.map(c=>c.id);
	assert.equal(model.addGroup('another-lake','lumen',600,180,4),population);
	assert.equal(model.groups.size,1);
	for(const [i,branch] of population.flow.branches.entries()) {
		branch.state='travelling';branch.encounterAfter=0;
		branch.center={x:i<2?i*60:1000+i*500,y:90,z:0};branch.guideVelocity={x:55,y:0,z:0};
		for(const [j,c] of branch.members.entries())c.pos={x:branch.center.x+j,y:90,z:Math.sin(j)*25};
	}
	const original=new Set(a.members);
	updateFlow(population,40,1/30);
	assert.equal(a.weave,b.weave);assert.ok(a.weave);
	assert.ok(others.every(o=>!o.weave));
	updateFlow(population,41,1/30);assert.equal(a.weave.stage,'merged');
	updateFlow(population,65,1/30);
	assert.equal(population.flow.joins,1);assert.equal(a.weave,null);
	assert.ok(a.members.some(c=>!original.has(c)), 'encounter retained fixed membership');
	assert.ok(a.replan && b.replan);
	assert.equal(new Set(population.flow.branches.flatMap(b=>b.members)).size,640);
	assert.deepEqual(population.members.map(c=>c.id),ids);
	assert.ok(population.members.every(c=>c.group===population && c.navigation.members.includes(c)));
	// Neighbours span journey membership, but never attract remote streams.
	for(const c of population.members) Object.assign(c.prev,c.pos);
	buildLumenGrid(population);
	assert.ok(nearestLumen(a.members[0],population).every(c=>c.pos.x<500));
});

test('tiny lumen travel faster at the shore and no animal rotates its mesh',()=>{
	const {model,group}=setup();model.observing=true;for(const b of group.population.flow.branches)b.departAt=Infinity;
	const small=group.members.filter(c=>c.size<0.36),large=group.members.filter(c=>c.size>1.1);
	assert.ok(small.length>=16 && large.length>=5);
	let smallDistance=0,largeDistance=0;
	for(let i=0;i<1200;i++) {
		model.step(1/30);
		if(i>150) {smallDistance+=small.reduce((n,c)=>n+c.speed,0)/small.length;largeDistance+=large.reduce((n,c)=>n+c.speed,0)/large.length;}
		assert.ok(group.members.every(c=>c.yaw===0 && c.pitch===0 && c.bank===0));
	}
	assert.ok(smallDistance>largeDistance*1.3,`tiny/big travel ratio ${smallDistance/largeDistance}`);
	const xs=group.members.map(c=>c.pos.x);
	assert.ok(Math.max(...xs)-Math.min(...xs)>55,'shore school remained bundled');
});

test('schools spend time playing with seven local neighbours before selecting a lake',()=>{
	const {model,group}=setup();model.observing=true;group.departAt=0;
	for(let i=0;i<600;i++)model.step(1/30);
	assert.equal(group.state,'playing');assert.equal(group.destination,null);
	assert.ok(group.members.every(c=>c.neighbours.length===7));
	assert.ok(group.center.y>30);
	for(let i=0;i<1000 && !group.destination;i++)model.step(1/30);
	assert.ok(group.destination);assert.notEqual(group.destination.id,group.lake.id);
});


test('fast loose flight clears terrain even between cached habitat samples',()=>{
	const ridge=(x,z)=>({ground:Math.max(0,42-Math.abs(x-110)*0.8)+Math.sin(z*0.015)*4,water:0,slope:0,foam:0,wet:1,forest:0});
	const model=new FaunaModel('ridge',{lakes,sample:ridge});model.observing=true;
	const g=model.addGroup('ridge-school','lumen',0,0,3);for(const b of g.flow.branches)b.departAt=0;
	for(let i=0;i<3000;i++) {
		model.step(1/30);
		for(const c of g.members)assert.ok(c.pos.y>=ridge(c.pos.x,c.pos.z).ground+2.19,'lumen clipped the ridge');
	}
});


test('shared population disperses into long flight streams bound for distinct lakes including mountains',()=>{
	const destinations=[...lakes,{id:3,x:-1800,z:1000,y:640},{id:4,x:2400,z:1500,y:1050},{id:5,x:-600,z:-2200,y:250},{id:6,x:3500,z:-1000,y:45}];
	const surface=(x,z)=>{
		const l=destinations.find(l=>Math.hypot(x-l.x,z-l.z)<100);
		return {ground:l?l.y-8:0,water:l?.y||0,slope:0,foam:0,wet:1,forest:0};
	};
	const model=new FaunaModel('distributed',{lakes:destinations,sample:surface});model.observing=true;
	const population=model.addGroup('all','lumen',0,0,4),branches=population.flow.branches;
	for(const b of branches)b.departAt=0;
	const chosen=new Set();let mountain=false,elongatedFrames=0,flightFrames=0;
	for(let i=0;i<6000;i++) {
		model.step(1/30);
		for(const b of branches) {
			if(b.destination) {chosen.add(b.destination.id);mountain ||= b.highland && b.destination.y>=640 && b.center.y>600;}
			if(b.state==='travelling' && !b.weave && i%30===0) {
				const xs=b.members.map(c=>c.pos.x),zs=b.members.map(c=>c.pos.z);
				const extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));
				flightFrames++;if(extent>100)elongatedFrames++;
			}
		}
	}
	assert.ok(chosen.size>=4,`only ${chosen.size} lake destinations`);
	assert.ok(mountain,'highland streams never reached mountain elevations');
	assert.ok(elongatedFrames/flightFrames>0.65,`flight remained compact: ${elongatedFrames}/${flightFrames}`);
	assert.ok(new Set(branches.flatMap(b=>b.visits)).size>=4,'streams failed to settle at different lakes');
	assert.equal(model.creatures.length,640);
});

test('fright cue fires once per affected resting stream and never for ordinary departure',()=>{
	const {model,group}=setup();model.observing=true;
	let cues=0;model.onEscape=c=>{assert.ok(c.navigation.members.includes(c));cues++;};
	for(let i=0;i<100;i++)model.step(1/30);
	assert.equal(cues,0);model.observing=false;model.listener={...group.members[0].pos};
	model.step(1/30);assert.equal(group.state,'startled');const first=cues;assert.ok(first>0);
	for(let i=0;i<30;i++)model.step(1/30);
	assert.equal(cues,first,'alarm retriggered each frame');
});


test('unequal flocks start across the map with one persistent mixed-size population',()=>{
	const {model,population}=setup(),branches=population.flow.branches;
	const counts=branches.map(b=>b.members.length);
	assert.equal(new Set(counts).size,6);assert.ok(Math.max(...counts)>Math.min(...counts)*5);
	assert.equal(counts.reduce((a,b)=>a+b,0),640);
	assert.equal(new Set(branches.map(b=>b.lake.id)).size,lakes.length);
	assert.ok(Math.max(...branches.map(b=>Math.hypot(b.center.x,b.center.z)))>1700);
	for(const b of branches) {
		assert.ok(b.members.some(c=>c.size<0.36) && b.members.some(c=>c.size>1),'sizes segregated by flock');
		assert.ok(b.members.every(c=>Math.hypot(c.pos.x-b.bank.x,c.pos.z-b.bank.z)<60),'initial flock missed its habitat');
	}
	assert.equal(model.groups.size,1);
});

test('a live encounter physically mixes flocks before splitting unequally toward different lakes',()=>{
	const {model,population}=setup(),[a,b]=population.flow.branches;model.observing=true;
	for(const branch of population.flow.branches)branch.departAt=Infinity;
	for(const [i,branch] of [a,b].entries()) {
		branch.lake=lakes[0];branch.center={x:i*180,y:100,z:0};branch.guide={...branch.center};
		for(const c of branch.members) {
			Object.assign(c.pos,{x:i*180+Math.cos(c.phase)*25,y:100+Math.sin(c.phase)*5,z:Math.sin(c.phase)*25});
			Object.assign(c.prev,c.pos);
		}
		departSchool(branch,model.environment,0,null,lakes[1]);branch.playUntil=0;branch.encounterAfter=0;
	}
	population.flow.nextEncounter=0;
	const originalA=new Set(a.members),originalB=new Set(b.members),ids=population.members.map(c=>c.id);
	let mixed=false,mergedSeconds=0,splitTime=null,separation=0;
	for(let i=0;i<2100;i++) {
		model.step(1/30);
		if(a.weave?.stage==='merged') {
			mergedSeconds+=1/30;
			mixed ||= a.members.filter(c=>c.neighbours.some(n=>originalB.has(n) && Math.hypot(c.pos.x-n.pos.x,c.pos.y-n.pos.y,c.pos.z-n.pos.z)<15)).length>12;
		}
		if(population.flow.joins && splitTime===null)splitTime=model.time;
		if(splitTime && model.time-splitTime>8)separation=Math.max(separation,Math.hypot(a.center.x-b.center.x,a.center.z-b.center.z));
	}
	assert.ok(mergedSeconds>=11,`merged only ${mergedSeconds}s`);assert.ok(mixed,'animals never physically mixed');
	assert.ok(a.members.some(c=>originalB.has(c)) && b.members.some(c=>originalA.has(c)),'no membership exchange');
	assert.ok(Math.max(a.members.length,b.members.length)>Math.min(a.members.length,b.members.length)*1.3);
	assert.ok(separation>120,'merged flock failed to separate');
	assert.deepEqual(population.members.map(c=>c.id),ids);
	assert.equal(new Set(population.flow.branches.flatMap(b=>b.members)).size,640);
});

test('migration follows a descending mountain and keeps active swarm motion until the shore',()=>{
	const terrain=(x,z)=>900*Math.exp(-(x*x+z*z)/(2*320*320));
	const basins=[{id:0,x:0,z:0,y:900},{id:1,x:3200,z:0,y:0},{id:2,x:2400,z:1600,y:0}];
	const surface=(x,z)=>{
		const lake=basins.find(l=>Math.hypot(x-l.x,z-l.z)<70);
		return {ground:lake?lake.y-6:terrain(x,z),water:lake?.y||0,slope:0,foam:0,wet:1,forest:0};
	};
	const model=new FaunaModel('downhill',{lakes:basins,sample:surface});model.observing=true;
	const population=model.addGroup('downhill','lumen',0,0,3),g=population.flow.branches[0];
	for(const b of population.flow.branches)b.departAt=Infinity;
	departSchool(g,model.environment,0,null,basins[1]);g.playUntil=0;
	const heights=[],speeds=[],activity=[];let arrived=false,farArrivalSpeed=Infinity,longestSlow=0;
	const slow=new Map();
	for(let i=0;i<5400;i++) {
		model.step(1/30);
		if(g.state==='resting') {arrived=true;break;}
		if(g.state==='travelling' && model.time-g.stateSince>8) {
			for(const c of g.members) {
				const duration=c.speed<24?(slow.get(c.id)||0)+1/30:0;slow.set(c.id,duration);longestSlow=Math.max(longestSlow,duration);
			}
			if(i%30===0) {
				const v={x:0,y:0,z:0};for(const c of g.members)for(const k of ['x','y','z'])v[k]+=c.vel[k]/g.members.length;
				const s=g.members.map(c=>c.speed).sort((a,b)=>a-b);speeds.push(s[Math.floor(s.length/2)]);
				activity.push(g.members.reduce((n,c)=>n+Math.hypot(c.vel.x-v.x,c.vel.y-v.y,c.vel.z-v.z),0)/g.members.length);
				heights.push(g.members.reduce((n,c)=>{const f=surface(c.pos.x,c.pos.z);return n+c.pos.y-Math.max(f.ground,f.water);},0)/g.members.length);
			}
		}
		if(g.state==='settling' && i%30===0) {
			const inbound=g.members.filter(c=>!c.landed && Math.hypot(c.pos.x-c.shoreHome.x,c.pos.y-c.shoreHome.y,c.pos.z-c.shoreHome.z)>80);
			if(inbound.length>8)farArrivalSpeed=Math.min(farArrivalSpeed,inbound.reduce((n,c)=>n+c.speed,0)/inbound.length);
		}
	}
	const percentile=(v,p)=>v.sort((a,b)=>a-b)[Math.floor((v.length-1)*p)];
	assert.ok(arrived,'descent never reached its shore');assert.ok(speeds.length>20);
	assert.ok(percentile(speeds,.1)>45,`migration crawled: ${percentile(speeds,.1)}`);
	assert.ok(percentile(activity,.5)>22,`flock translated rigidly: ${percentile(activity,.5)}`);
	assert.ok(percentile(heights,.9)<150,`flock stayed above the valley: ${percentile(heights,.9)}`);
	assert.ok(longestSlow<1.5,`an airborne animal stayed slow for ${longestSlow}s`);
	assert.ok(farArrivalSpeed>30,`arrival slowed far from shore: ${farArrivalSpeed}`);
});


test('nearby lumen flee within a few frames, including animals with long trail delays', () => {
	const {model,group}=setup();
	for(let i=0;i<100;i++)model.step(1/30);
	const nearest=group.members.reduce((a,c)=>c.lag>a.lag?c:a);
	model.listener={x:nearest.pos.x-12,y:nearest.pos.y,z:nearest.pos.z};
	const origin={...nearest.pos},threat={...model.listener};
	let alarms=0;model.onEscape=c=>{if(c.navigation===group)alarms++;};
	model.step(1/30);
	assert.equal(group.state,'startled');
	assert.ok(Math.max(...group.members.map(c=>c.startleAt-model.time))<0.18);
	for(let i=1;i<8;i++)model.step(1/30);
	assert.ok(nearest.speed>35,`delayed escape: ${nearest.speed}`);
	assert.ok(nearest.pos.x-origin.x>4,'did not immediately move away from the player');
	for(let i=8;i<15;i++)model.step(1/30);
	assert.ok(nearest.speed>65,`weak initial burst: ${nearest.speed}`);
	assert.ok(Math.hypot(nearest.pos.x-threat.x,nearest.pos.z-threat.z)>30);
	assert.equal(alarms,1,'one alarm per departure, not per frame or animal');
	assert.ok(nearest.pos.y-origin.y<20,'startle must not launch animals vertically into the sky');
});
