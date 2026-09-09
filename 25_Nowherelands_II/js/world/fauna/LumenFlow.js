import { Random } from '../../core/Random.js';

const copy = p => ({ x:p.x, y:p.y, z:p.z });
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

// One population and one neighbour field. Branches only hold journey state;
// individuals are never copied into separate models or recreated on arrival.
export function initializeFlow(group, time) {
	const count = Math.min(6, Math.max(1, Math.floor(group.members.length / 80)));
	const shuffled=group.members.map(c=>({c,order:group.rnd.next()})).sort((a,b)=>a.order-b.order).map(v=>v.c);
	const weights=[150,36,200,58,112,84].slice(0,count),weight=weights.reduce((a,b)=>a+b,0);
	let cursor=0;
	group.flow = { phase:'dispersing', branches:[], cycles:1, joins:0, nextEncounter:time+35 };
	for(let i=0;i<count;i++) {
		const size=i===count-1?shuffled.length-cursor:Math.round(shuffled.length*weights[i]/weight);
		const members=shuffled.slice(cursor,cursor+size);cursor+=size;
		const b={id:`${group.id}:stream:${i}`,index:i,population:group,members,kind:'lumen',
			rnd:new Random(`${group.id}:journey:${i}:${group.phase}`),phase:group.phase+i*1.618,
			lake:group.lake,bank:group.bank,home:copy(group.home),center:copy(group.center),
			guide:copy(group.center),guideVelocity:{x:0,y:0,z:0},state:'resting',stateSince:time,
			departAt:time+45+i*7,visits:[group.lake.id],route:[],waypoint:0,alarmUntil:0,
			sizeWeight:weights[i],highland:i%3===2,trail:[],trailAt:0,encounterAfter:time+30,journeys:0};
		group.flow.branches.push(b);
		for(const c of members) {c.navigation=b;c.branch=i;c.lag=c.rnd.range(0.15,4.2);c.lateral=c.rnd.range(-18,18);}
	}
}

export function recordTrail(b, time) {
	if(time<b.trailAt)return;
	const previous=b.trail.at(-1);
	// Preserve the velocity of the recorded guide, rather than the current
	// guide's velocity, when following a delayed bend in the stream.
	b.trail.push({...copy(b.guide),time,vx:b.guideVelocity.x,vy:b.guideVelocity.y,vz:b.guideVelocity.z});
	b.trailAt=time+0.1;
	while(b.trail.length>72)b.trail.shift();
	if(!previous) b.trail[0].time=time-8;
}

export function trailPoint(b, time) {
	const points=b.trail;
	if(!points.length)return {...copy(b.guide),vx:b.guideVelocity.x,vy:b.guideVelocity.y,vz:b.guideVelocity.z};
	let i=points.length-1;
	while(i>0 && points[i].time>time)i--;
	const a=points[i],next=points[Math.min(i+1,points.length-1)],u=Math.max(0,Math.min(1,(time-a.time)/(next.time-a.time||1)));
	const p={};for(const key of ['x','y','z','vx','vy','vz'])p[key]=a[key]+(next[key]-a[key])*u;
	return p;
}

function finishEncounter(e,time) {
	// Divide the physically mixed ribbon into unequal new flocks. Preserve every
	// animal and bound both sizes so repeated mergers cannot swallow a flock.
	const [a,b]=e.branches,all=[...a.members,...b.members];
	all.sort((u,v)=>-(u.pos.x-v.pos.x)*e.direction.z+(u.pos.z-v.pos.z)*e.direction.x);
	const ratio=Math.max(0.22,Math.min(0.78,a.sizeWeight/(a.sizeWeight+b.sizeWeight)+a.rnd.range(-0.12,0.12)));
	const limit=Math.floor(a.population.members.length*0.42),minimum=Math.min(24,Math.floor(all.length*0.2));
	const cut=Math.max(minimum,all.length-limit,Math.min(limit,all.length-minimum,Math.round(all.length*ratio)));
	a.members=all.slice(0,cut);b.members=all.slice(cut);
	if(a.destination?.id===b.destination?.id){b.avoidDestination=a.destination?.id;b.destination=null;}
	for(const branch of [a,b]) {
		for(const c of branch.members){c.navigation=branch;c.branch=branch.index;}
		branch.weave=null;branch.replan=true;branch.encounterAfter=time+85;
	}
}

export function updateFlow(group,time,dt) {
	const f=group.flow;
	// Advance each shared encounter once. A rendezvous must physically converge
	// before its mixing timer starts; distant flocks never count as a merger.
	for(const e of new Set(f.branches.map(b=>b.weave).filter(Boolean))) {
		const [a,b]=e.branches;
		const speed=e.stage==='approaching'?32:54;
		e.center.x+=e.direction.x*speed*dt;e.center.z+=e.direction.z*speed*dt;
		e.center.y=(a.center.y+b.center.y)*0.5;
		if(e.stage==='approaching' && distance(a.center,b.center)<85) {
			e.stage='merged';e.mergedAt=time;e.end=time+a.rnd.range(12,18);
		}
		if(e.stage==='merged' && time>e.end) {
			finishEncounter(e,time);f.joins++;f.cycles++;f.nextEncounter=time+35;
		} else if(e.stage==='approaching' && time-e.start>28) {
			// Cancel an unreachable meeting without exchanging remote animals.
			for(const branch of e.branches){branch.weave=null;branch.replan=true;branch.encounterAfter=time+45;}
			f.nextEncounter=time+20;
		}
	}
	if(time>=f.nextEncounter && !f.branches.some(b=>b.weave)) {
		const eligible=f.branches.filter(b=>b.state==='travelling' && time>=b.encounterAfter);
		let pair=null,nearest=750;
		for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++) {
			const d=distance(eligible[i].center,eligible[j].center);
			if(d<nearest){nearest=d;pair=[eligible[i],eligible[j]];}
		}
		if(pair) {
			const [a,b]=pair;
			let vx=a.guideVelocity.x+b.guideVelocity.x,vz=a.guideVelocity.z+b.guideVelocity.z;
			if(Math.hypot(vx,vz)<20){vx=a.guideVelocity.x;vz=a.guideVelocity.z;}
			if(Math.hypot(vx,vz)<1){vx=Math.cos(a.phase);vz=Math.sin(a.phase);}
			const speed=Math.hypot(vx,vz),direction={x:vx/speed,z:vz/speed};
			const e={branches:pair,stage:'approaching',center:{x:(a.center.x+b.center.x)/2,y:(a.center.y+b.center.y)/2,z:(a.center.z+b.center.z)/2},
				velocity:{y:(a.guideVelocity.y+b.guideVelocity.y)*0.2},direction,start:time};
			a.weave=b.weave=e;a.weaveSide=-1;b.weaveSide=1;
		}
	}
	const encounter=f.branches.find(b=>b.weave)?.weave;
	f.phase=encounter?(encounter.stage==='merged'?'merged':'interweaving'):'dispersing';
}

// The global grid prevents distant branches from attracting one another across
// the map. Nearby members can be neighbours regardless of journey membership.
export function buildLumenGrid(group) {
	const grid=new Map();
	for(const c of group.members) {
		const x=Math.floor(c.prev.x/40),y=Math.floor(c.prev.y/40),z=Math.floor(c.prev.z/40);
		let column=grid.get(x);if(!column)grid.set(x,column=new Map());
		let row=column.get(y);if(!row)column.set(y,row=new Map());
		let cell=row.get(z);if(!cell)row.set(z,cell=[]);cell.push(c);
	}
	group.spatial=grid;
}
export function nearestLumen(c,group) {
	const nearest=[],distances=[],cx=Math.floor(c.prev.x/40),cy=Math.floor(c.prev.y/40),cz=Math.floor(c.prev.z/40);
	for(let radius=1;radius<=3;radius++) {
		for(let x=-radius;x<=radius;x++) {
			const column=group.spatial?.get(cx+x);if(!column)continue;
			for(let y=-radius;y<=radius;y++) {
				const row=column.get(cy+y);if(!row)continue;
				for(let z=-radius;z<=radius;z++) {
					if(radius>1 && Math.max(Math.abs(x),Math.abs(y),Math.abs(z))!==radius)continue;
					const cell=row.get(cz+z);if(!cell)continue;
					for(const other of cell) {
						if(other===c)continue;
						const dx=c.prev.x-other.prev.x,dy=c.prev.y-other.prev.y,dz=c.prev.z-other.prev.z,d=dx*dx+dy*dy+dz*dz;
						if(d>14400)continue;
						let i=distances.length;while(i>0&&d<distances[i-1])i--;
						if(i>=7)continue;nearest.splice(i,0,other);distances.splice(i,0,d);
						if(nearest.length>7){nearest.pop();distances.pop();}
					}
				}
			}
		}
		if(nearest.length===7)break;
	}
	return nearest;
}
