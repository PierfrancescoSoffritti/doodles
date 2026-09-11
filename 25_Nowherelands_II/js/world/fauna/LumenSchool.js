import { flightSwirl } from './LumenFlight.js';
import { initializeFlow, updateFlow, nearestLumen, recordTrail, trailPoint } from './LumenFlow.js';
import { clamp, damp } from './Locomotion.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const horizontal = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const copy = p => ({ x: p.x, y: p.y, z: p.z });

// Boundary cells locate the bank even for concave basins and islands. Refine the
// wet/dry crossing against the same interpolated surface used by the renderer.
export function lumenLakes(world, sample) {
	const result = [];
	for (const lake of world.lakes || []) {
		if (!lake.cells?.length) continue;
		const wet = new Set(lake.cells), boundary = lake.cells.filter(k => [k-1,k+1,k-world.res,k+world.res].some(n => !wet.has(n)));
		const shore = [], stride = Math.max(1, Math.floor(boundary.length / 96));
		for (let i = 0; i < boundary.length; i += stride) {
			const k = boundary[i], x = k % world.res * world.cell - world.size / 2 - world.spawn.x;
			const z = Math.floor(k / world.res) * world.cell - world.size / 2 - world.spawn.z;
			for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
				if (wet.has(k + dx + dz * world.res)) continue;
				let a = {x: x-dx*world.cell, z: z-dz*world.cell}, b = {x: x+dx*world.cell, z: z+dz*world.cell};
				const inside = q => { const s=sample(q.x,q.z); return s.water-s.ground>0.3 && Math.abs(s.water-lake.level)<1; };
				if (!inside(a) || inside(b)) continue;
				for (let j=0;j<9;j++) { const mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2}; if (inside(mid)) a=mid; else b=mid; }
				const q={x:a.x-dx*7,z:a.z-dz*7,y:lake.level,tx:-dz,tz:dx,nx:-dx,nz:-dz};
				if (inside(q) && !shore.some(v => horizontal(v,q)<24)) shore.push(q);
				break;
			}
		}
		if (shore.length) result.push({id:lake.id,...shore[0],radius:24,shore});
	}
	return result;
}

function bank(lake, from) {
	let best = lake, nearest = Infinity;
	for (const point of lake.shore || []) {
		const d = (point.x-from.x)**2 + (point.z-from.z)**2;
		if(d<nearest) {nearest=d;best=point;}
	}
	return best;
}
function shorePoint(g, time) {
	const q=g.bank, a=time*0.18+g.phase;
	return {x:q.x+(q.tx??1)*Math.sin(a)*12+(q.nx??0)*Math.sin(a*0.73)*2,
		y:q.y+6+Math.sin(a*1.37)*1.2,
		z:q.z+(q.tz??0)*Math.sin(a)*12+(q.nz??1)*Math.sin(a*0.73)*2};
}
export function initializeSchool(group, environment, time) {
	const nearest = [...(environment.lakes || [])].sort((a,b)=>horizontal(a,group.home)-horizontal(b,group.home))[0];
	const surface=environment.sample(group.home.x,group.home.z);
	group.lake=nearest || {id:group.id,x:group.home.x,y:surface.water,z:group.home.z,radius:20};
	group.bank=bank(group.lake,group.home);
	group.state='resting'; group.stateSince=time; group.departAt=time+group.rnd.range(35,85);
	group.center={x:0,y:0,z:0};
	for (const [i,c] of group.members.entries()) {
		c.heightOffset=c.rnd.range(-2.2,2.2); c.flightOffset=c.rnd.range(-14,14);
		c.size=i%3===0 ? c.rnd.range(0.13,0.35) : c.rnd.range(0.65,1.55);
		c.pulseRate=c.rnd.range(0.9,1.1); c.pace=1.65-c.size*0.55; c.agility=c.pace;
		c.elastic={x:0,y:0,z:0}; c.acceleration={x:0,y:0,z:0};
		c.neighbours=[]; c.neighbourTimer=0;
		c.cluster=i%5; c.orbit=c.rnd.range(0.85,1.15)*c.pace;
		const a=i*2.39996323+group.phase, r=Math.sqrt((i+0.5)/group.members.length);
		c.pos.x=group.bank.x+(group.bank.tx??1)*Math.cos(a)*(group.lake.shore?.length?180:48)*r+(group.bank.nx??0)*Math.sin(a)*10*r;
		c.pos.z=group.bank.z+(group.bank.tz??0)*Math.cos(a)*(group.lake.shore?.length?180:48)*r+(group.bank.nz??1)*Math.sin(a)*10*r;
		c.shoreHome=group.lake.shore?.length ? bank(group.lake,c.pos) : {...group.bank,x:group.bank.x+Math.cos(c.phase)*27,z:group.bank.z+Math.sin(c.phase)*7};
		if(group.lake.shore?.length) { c.pos.x=c.shoreHome.x+Math.cos(a)*8; c.pos.z=c.shoreHome.z+Math.sin(a)*8; }
		const s=environment.sample(c.pos.x,c.pos.z); c.ground=s.ground; c.water=s.water;
		c.pos.y=Math.max(s.ground,s.water)+6+c.heightOffset;
		Object.assign(c.prev,c.pos); c.speed=2; c.vel={x:Math.cos(c.yaw)*2,y:0,z:-Math.sin(c.yaw)*2}; c.startleAt=Infinity;c.yaw=c.pitch=c.bank=c.prevYaw=c.prevPitch=c.prevBank=0;
	}
	centroid(group); group.guide=copy(group.center); group.guideVelocity={x:0,y:0,z:0};
	group.route=[]; group.waypoint=0; group.visits=[group.lake.id]; group.alarmUntil=0;
	initializeFlow(group,time);
	if(environment.lakes?.length) {
		// Seed habitats across the map immediately, retaining a nearby encounter.
		// Farthest-point placement avoids several flocks starting at adjacent lakes.
		const used=[];
		for(const b of group.flow.branches) {
			let choices=environment.lakes.filter(l=>!used.some(u=>u.lake.id===l.id));
			if(!choices.length)choices=environment.lakes;
			if(b.highland) {
				const highest=Math.max(...choices.map(l=>l.y));choices=choices.filter(l=>l.y>=highest-180);
			}
			b.lake=used.length ? choices.reduce((best,l)=>
				Math.min(...used.map(u=>distance(u.lake,l)))>Math.min(...used.map(u=>distance(u.lake,best)))?l:best) : group.lake;
			const banks=used.filter(u=>u.lake.id===b.lake.id).map(u=>u.bank);
			b.bank=banks.length && b.lake.shore?.length ? b.lake.shore.reduce((best,q)=>
				Math.min(...banks.map(p=>horizontal(p,q)))>Math.min(...banks.map(p=>horizontal(p,best)))?q:best) : bank(b.lake,group.home);
			used.push(b);b.visits=[b.lake.id];
			const span=b.lake.shore?.length?45+Math.sqrt(b.members.length)*3:27;
			for(const c of b.members) {
				const q={x:b.bank.x+(b.bank.tx??1)*Math.cos(c.phase)*span,z:b.bank.z+(b.bank.tz??0)*Math.cos(c.phase)*span};
				c.shoreHome=b.lake.shore?.length?bank(b.lake,q):{...b.bank,x:q.x,z:q.z+Math.sin(c.phase)*7};
				c.pos.x=c.shoreHome.x+Math.cos(c.phase)*8;c.pos.z=c.shoreHome.z+Math.sin(c.phase)*8;
				const surface=environment.sample(c.pos.x,c.pos.z);c.ground=surface.ground;c.water=surface.water;
				c.pos.y=Math.max(surface.ground,surface.water)+6+c.heightOffset;Object.assign(c.prev,c.pos);
			}
			centroid(b);b.guide=copy(b.center);b.home=copy(b.center);
		}
		centroid(group);group.visits=[...new Set(used.map(b=>b.lake.id))];
	}
}

function centroid(group) {
	const center = group.center; center.x = center.y = center.z = 0;
	for (const c of group.members) { center.x += c.pos.x; center.y += c.pos.y; center.z += c.pos.z; }
	for (const axis of ['x', 'y', 'z']) center[axis] /= group.members.length;
}

function destination(group, environment, threat) {
	let lakes = (environment.lakes || []).filter(l => l.id !== group.lake.id && horizontal(l, group.center) > 35);
	if (!lakes.length) return null;
	const alternatives=lakes.filter(l=>l.id!==group.avoidDestination);if(alternatives.length)lakes=alternatives;
	// Prefer a lake away from the threat, but retain routes of several lengths.
	if (threat) {
		const awayX = group.center.x - threat.x, awayZ = group.center.z - threat.z;
		const safe = lakes.filter(l => (l.x - group.center.x) * awayX + (l.z - group.center.z) * awayZ > 0);
		if (safe.length) lakes = safe;
	}
	const others=(group.population?.flow.branches||[]).filter(b=>b!==group);
	const occupancy=l=>others.filter(b=>(b.destination?.id ?? b.lake.id)===l.id).reduce((n,b)=>n+b.members.length,0);
	if(group.highland) {
		const highest=Math.max(...lakes.map(l=>l.y));
		lakes=lakes.filter(l=>l.y>=highest-180);
	}
	// Balance arrivals even when every candidate already has visitors. Without
	// this second case, several streams can repeatedly choose one busy lake.
	const least=Math.min(...lakes.map(occupancy));
	lakes=lakes.filter(l=>occupancy(l)===least);
	lakes.sort((a,b)=>horizontal(a,group.center)-horizontal(b,group.center));
	const fresh = lakes.filter(l => !group.visits.slice(-2).includes(l.id));
	if (fresh.length) lakes = fresh;
	const reach = Math.min(lakes.length, group.rnd.chance(0.3) ? 6 : 3);
	return lakes[group.rnd.int(0, reach - 1)];
}

function travelSchool(group, environment, time, threat = null, chosen = null) {
	const next=chosen || destination(group,environment,threat);
	if (!next) { group.departAt=time+25; return false; }
	delete group.avoidDestination;group.destination=next; group.destinationBank=bank(next,group.center);
	group.state=threat?'startled':'travelling'; group.stateSince=time;
	group.threat=threat?copy(threat):null; group.alarmUntil=threat?time+5:0;
	group.route=[]; group.waypoint=0; group.routeDistance=0; group.origin=copy(group.center);
	const r=group.rnd, from=group.guide, to=group.destinationBank, length=horizontal(from,to);
	group.cruiseHeight=r.range(30,45); group.cruiseSpeed=r.range(62,76);group.journeys++;
	const dx=(to.x-from.x)/(length||1), dz=(to.z-from.z)/(length||1), side=r.chance(0.5)?1:-1;
	const bend=clamp(length*0.32,85,650)*side;
	let ax=dx,az=dz;
	if (threat) {const d=horizontal(from,threat)||1; ax=(from.x-threat.x)/d; az=(from.z-threat.z)/d;}
	const reach=clamp(length*0.32,80,500);
	const c1={x:from.x+ax*reach-dz*bend,z:from.z+az*reach+dx*bend};
	const c2={x:to.x-dx*reach+dz*bend,z:to.z-dz*reach-dx*bend};
	const count=Math.max(32,Math.ceil((length+Math.abs(bend)*3)/18));
	const launchSurface=environment.sample(from.x,from.z);
	for (let i=0;i<=count;i++) {
		const u=i/count,v=1-u, sweep=Math.sin(u*Math.PI*4)*Math.sin(u*Math.PI)*Math.min(120,length*0.14);
		const x=v*v*v*from.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*to.x-dz*sweep;
		const z=v*v*v*from.z+3*v*v*u*c1.z+3*v*u*u*c2.z+u*u*u*to.z+dx*sweep;
		const surface=environment.sample(x,z), arc=Math.sin(u*Math.PI);
		const localFloor=Math.max(surface.ground,surface.water);
		const launchLift=Math.max(0,from.y-Math.max(launchSurface.ground,launchSurface.water)-35)*Math.exp(-horizontal(from,{x,z})/120);
		const y=localFloor+8+arc*group.cruiseHeight+launchLift;
		group.route.push({x,y,z});
	}
	// Anticipate the climb before a ridge, then descend with the actual terrain.
	// Carrying the previous peak forward left whole flocks suspended over valleys.
	for(let i=count-1;i>=0;i--) group.route[i].y=Math.max(group.route[i].y,group.route[i+1].y-horizontal(group.route[i],group.route[i+1])*1.0);
	group.route[0]=copy(from); group.route[0].length=0;
	for(let i=1;i<=count;i++) group.route[i].length=group.route[i-1].length+distance(group.route[i],group.route[i-1]);
	for(const c of group.members) {c.startleAt=time+(threat?distance(c.pos,threat)/100+c.temperament*0.15:c.temperament*0.4); c.attentionUntil=0;}
	return true;
}

// Depart into a genuine play phase first. No destination is selected until it
// ends, so aerial exploration is not just noise over a lake-to-lake shortcut.
export function departSchool(group, environment, time, threat = null, chosen = null) {
	if(group.flow) {let departed=false;for(const b of group.flow.branches)departed=departSchool(b,environment,time,threat,chosen)||departed;return departed;}
	if (!(environment.lakes || []).some(l=>l.id!==group.lake.id)) {group.departAt=time+25;return false;}
	group.state=threat?'startled':'playing';group.stateSince=time;
	group.threat=threat?copy(threat):null;group.alarmUntil=time+5;
	group.playStart=time;group.playUntil=time+group.rnd.range(24,40);group.playOrigin=copy(group.guide);
	group.pendingDestination=chosen;group.destination=null;group.cruiseSpeed=group.rnd.range(48,68);
	const a=group.rnd.range(0,Math.PI*2),dx=threat?group.center.x-threat.x:Math.cos(a),dz=threat?group.center.z-threat.z:Math.sin(a),d=Math.hypot(dx,dz)||1;
	group.playDirection={x:dx/d,z:dz/d};group.playRadius=group.rnd.range(95,175);
	for(const c of group.members) {
		c.landed=false;
		// Nearby animals respond within two simulation steps; the alarm crosses
		// even a wide shore flock in under 180 ms, with individual timing.
		c.startleAt=time+(threat?clamp((distance(c.pos,threat)-25)/900,0,0.15)+c.temperament*0.025:0);
		if(threat) {
			const dx=c.pos.x-threat.x,dz=c.pos.z-threat.z,d=Math.hypot(dx,dz)||1;
			c.escapeDirection={x:dx/d,z:dz/d};
		}
	}
	return true;
}

function updateJourney(group, model, dt) {
	const t=model.time, env=model.environment;
	centroid(group);
	if(group.replan) {group.replan=false;travelSchool(group,env,t,null,group.destination);}
	const threat=!model.observing && group.members.some(c=>distance(c.pos,model.listener)<25);
	if(threat && ['resting','settling'].includes(group.state) && t-group.stateSince>2) {
		if(departSchool(group,env,t,model.listener)) {
			const closest=group.members.reduce((a,c)=>distance(c.pos,model.listener)<distance(a.pos,model.listener)?c:a);
			model.onEscape(closest);closest.energy=Math.max(closest.energy,0.7);
		}
	} else if(group.state==='resting' && t>group.departAt) departSchool(group,env,t);
	if(group.state==='startled' && t>group.alarmUntil) group.state='playing';
	if(group.state==='playing' && t>group.playUntil) travelSchool(group,env,t,null,group.pendingDestination);
	let target, speed=group.cruiseSpeed||55;
	if(group.weave) {
		const e=group.weave,age=t-e.start;
		const side=group.weaveSide*(e.stage==='merged'?Math.sin((t-e.mergedAt)*0.7)*9:18*Math.exp(-age*0.18));
		target={x:e.center.x-e.direction.z*side,y:e.center.y+Math.sin(age*0.5+group.phase)*10,z:e.center.z+e.direction.x*side};speed=e.stage==='merged'?72:95;
		const surface=env.sample(target.x,target.z);target.y=Math.max(surface.ground,surface.water)+45+Math.sin(age*0.5+group.phase)*8;
	} else if(group.state==='resting') {target=shorePoint(group,t);speed=5;}
	else if(group.state==='playing' || group.state==='startled') {
		const age=t-group.playStart,a=age*0.37,fade=1-Math.exp(-age*0.65),r=group.playRadius;
		const o=group.playOrigin,d=group.playDirection;
		const launchHeight=(group.highland?180:95)-(group.highland?85:0)*clamp((age-6)/10,0,1);
		const forward=fade*120+Math.sin(a)*r,side=(1-Math.cos(a*0.79))*r*0.8+Math.sin(a*1.63)*r*0.35;
		target={x:o.x+d.x*forward-d.z*side,z:o.z+d.z*forward+d.x*side,y:o.y+fade*launchHeight+Math.sin(a*0.91)*35};
		const surface=env.sample(target.x,target.z);target.y=Math.max(target.y,Math.max(surface.ground,surface.water)+35);
		speed=group.state==='startled'?95:70;
	} else if(group.state==='settling') {
		target={...group.destinationBank,y:group.destinationBank.y+6};speed=60;
		if(group.members.every(c=>c.landed)) {
			group.lake=group.destination;group.bank=group.destinationBank;group.home=copy(target);group.state='resting';group.stateSince=t;
			group.departAt=t+group.rnd.range(35,70);group.visits.push(group.lake.id);if(group.visits.length>12)group.visits.shift();
		}
	} else {
		speed=group.state==='startled'?90:group.cruiseSpeed*(1+0.12*Math.sin(t*0.63+group.phase));
		const end=group.route.at(-1).length;
		// Intentional trail delays must never act as a brake on the whole flock.
		group.routeDistance=Math.min(end,group.routeDistance+speed*dt);
		while(group.waypoint<group.route.length-2 && group.route[group.waypoint+1].length<group.routeDistance) group.waypoint++;
		const a=group.route[group.waypoint],b=group.route[group.waypoint+1],u=clamp((group.routeDistance-a.length)/(b.length-a.length||1),0,1);
		target={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};
		const blend=clamp((end-group.routeDistance)/180,0,1);
		const tangentLength=horizontal(a,b)||1,side=Math.sin(t*0.55+group.phase)*28+Math.sin(t*0.23+group.phase*2)*18;
		target.x-=(b.z-a.z)/tangentLength*side*blend;target.z+=(b.x-a.x)/tangentLength*side*blend;
		const terrain=env.sample(target.x,target.z);target.y=Math.max(target.y,Math.max(terrain.ground,terrain.water)+20*blend);
		if(end-group.routeDistance<100 && horizontal(group.guide,group.destinationBank)<150 && Math.abs(group.guide.y-group.destinationBank.y)<85) {
			group.state='settling';group.stateSince=t;
			for(const c of group.members) {
				const bankTarget=group.destinationBank,span=45+Math.sqrt(group.members.length)*3;
				const q={x:bankTarget.x+(bankTarget.tx??1)*Math.cos(c.phase)*span,z:bankTarget.z+(bankTarget.tz??0)*Math.cos(c.phase)*span};
				c.shoreHome=group.destination.shore?.length?bank(group.destination,q):{...bankTarget,x:q.x,z:q.z+Math.sin(c.phase)*7};c.landed=false;
			}
		}
	}
	const d=distance(group.guide,target)||1;
	for(const axis of ['x','y','z']) {
		group.guideVelocity[axis]=damp(group.guideVelocity[axis],(target[axis]-group.guide[axis])/d*Math.min(speed*1.2,d*3),3,dt);
		group.guide[axis]+=group.guideVelocity[axis]*dt;
	}
	recordTrail(group,t);
}

export function updateSchool(group,model,dt) {
	for(const b of group.flow.branches)updateJourney(b,model,dt);
	updateFlow(group,model.time,dt);
	centroid(group);group.state='distributed';
	group.visits=[...new Set(group.flow.branches.flatMap(b=>b.visits))];
}

export function swimLumen(c, model, dt) {
	const population=c.group,g=c.navigation,p=c.pos;
	let settling=g.state==='settling'&&!c.landed,resting=g.state==='resting'||(g.state==='settling'&&c.landed);
	const startled = g.state === 'startled' && model.time >= c.startleAt;
	const t=model.time, phase=c.phase, orbit=t*0.42*c.orbit+phase;
	const q=c.shoreHome || g.bank;
	const shoreDistance=distance(p,{x:q.x,y:q.y+7,z:q.z});
	if(settling && shoreDistance<24 && Math.abs(p.y-q.y)<17 && c.speed<22) {c.landed=true;settling=false;resting=true;}
	// Do not chase the old resting trail during a frightened launch. Restore
	// each animal's normal delay gradually as the initial burst subsides.
	const escapeAge=g.threat?t-c.startleAt:Infinity;
	const launch=startled?1-clamp((escapeAge-0.4)/1.0,0,1):0;
	const lag=c.lag*(g.threat?clamp((escapeAge-1.2)/6,0,1):1);
	const trail=trailPoint(g,t-lag);
	let tx=trail.x,ty=trail.y,tz=trail.z,feedX=trail.vx,feedY=trail.vy,feedZ=trail.vz;
	const active=clamp((t-(g.playStart??g.stateSince)-6)/8,0,1);
	if(resting) {
		const span=g.lake.shore?.length?20:24;
		tx=q.x+(q.tx??1)*Math.sin(orbit)*span+(q.nx??0)*Math.cos(orbit*0.71)*7;
		tz=q.z+(q.tz??0)*Math.sin(orbit)*span+(q.nz??1)*Math.cos(orbit*0.71)*7;
		ty=q.y+7+c.heightOffset+Math.sin(orbit*0.93)*2;
	} else {
		// Follow the take-off arc, then keep individual overtaking
		// and cross-flight active through play, migration and shared encounters.
		const speed=Math.hypot(trail.vx,trail.vz),dx=trail.vx/Math.max(speed,1),dz=trail.vz/Math.max(speed,1);
		const oldWidth=c.lateral+Math.sin(t*0.65*c.pace+phase)*12+Math.sin(t*0.21+phase*2)*7;
		const swirl=flightSwirl(c,trail,t,active);
		tx+=swirl.x-dz*oldWidth*(1-active);tz+=swirl.z+dx*oldWidth*(1-active);
		ty+=swirl.y+(c.flightOffset+Math.sin(orbit*0.7)*11)*(1-active);
		feedX+=swirl.vx;feedY+=swirl.vy;feedZ+=swirl.vz;
		if(settling) {
			// Each animal peels toward its own shore patch; no slow hovering at
			// one arrival point while the entire flock tries to assemble there.
			const approach=clamp((shoreDistance-22)/130,0,1);
			tx=q.x+swirl.x*approach;ty=q.y+7+swirl.y*approach;tz=q.z+swirl.z*approach;
			feedX=swirl.vx*approach;feedY=swirl.vy*approach;feedZ=swirl.vz*approach;
		}
	}

	if(c.noteGlow>0 && c.noteResponse){
  const n=c.noteResponse,source=n.source,dx=p.x-source.x,dz=p.z-source.z,d=Math.hypot(dx,dz)||1,age=t-n.start;
  const theta=Math.atan2(dz,dx)+age*(n.alarm?-.75:.8)+c.phase*.12;
  const radius=n.alarm?Math.min(90,d+40):20+8*Math.sin(c.phase);
  const weight=c.noteGlow;tx+=(source.x+Math.cos(theta)*radius-tx)*weight;tz+=(source.z+Math.sin(theta)*radius-tz)*weight;ty+=(source.y+8+Math.sin(theta)*8-ty)*weight;
  feedX*=1-weight;feedZ*=1-weight;
 }
	let sx=0,sy=0,sz=0,vx=0,vy=0,vz=0,cx=0,cy=0,cz=0,n=0;
	// Topological interaction: select seven nearest neighbours, not everybody in
	// a fixed-radius ball. Re-evaluate at 5 Hz, using the common motion snapshot.
	c.neighbourTimer-=dt;
	if(c.neighbourTimer<=0) {
		c.neighbours=nearestLumen(c,population);
		c.neighbourTimer=0.18+c.temperament*0.04;
	}
	for(const other of c.neighbours) {
		const x=c.prev.x-other.prev.x,y=c.prev.y-other.prev.y,z=c.prev.z-other.prev.z,d=Math.hypot(x,y,z)||0.01;
		const separation=resting?5:5+c.size+other.size;
		if(d<separation) {const f=(1-d/separation)*18;sx+=x/d*f;sy+=y/d*f*(resting?0.3:1);sz+=z/d*f;}
		if(d>90)continue;
		vx+=other.oldVX;vy+=other.oldVY;vz+=other.oldVZ;
		cx+=other.prev.x;cy+=other.prev.y;cz+=other.prev.z;n++;
	}

	if (startled && g.threat) {
		const d = distance(p, g.threat) || 1, fear = clamp(1 - d / 70, 0, 1);
		sx += (p.x - g.threat.x) / d * fear * 35; sz += (p.z - g.threat.z) / d * fear * 35; sy += fear * 30;
	}
	const lookAhead = { x: p.x + c.vel.x * 2, y: p.y, z: p.z + c.vel.z * 2 };
	const avoid = model.environment.avoid?.(lookAhead, 'lumen');
	if (avoid) { sx += avoid.x; sz += avoid.z; }
	const floor = Math.max(c.ground, c.water);
	const ahead=model.environment.sample(p.x+c.vel.x*0.8,p.z+c.vel.z*0.8);
	ty = Math.max(ty, floor + 3, Math.max(ahead.ground,ahead.water)+(resting?4:12));
	const dx = tx - p.x, dy = ty - p.y, dz = tz - p.z;
	const distanceToGuide = Math.hypot(dx, dy, dz);
	const follow = resting ? 0.9*c.pace : settling ? 1.0 : 1.1*c.pace;
	let wanted = { x: dx * follow + (resting?g.guideVelocity.x:feedX) + sx, y: dy * follow + (resting?g.guideVelocity.y:feedY) + sy, z: dz * follow + (resting?g.guideVelocity.z:feedZ) + sz };
	const alignment=0.18-active*0.1,cohesion=0.018-active*0.009;
	if(n && !resting) for(const [axis,sum,center] of [['x',vx,cx],['y',vy,cy],['z',vz,cz]]) wanted[axis]=wanted[axis]*(1-alignment)+sum/n*alignment+(center/n-p[axis])*cohesion;
	if(launch>0 && c.escapeDirection) {
		const d=c.escapeDirection,turn=Math.sin(escapeAge*4+phase)*0.24;
		// A quick, curved outward fan, not a shared impulse or a vertical jump.
		const burst={x:(d.x-d.z*turn)*90*c.pace,y:(28+8*Math.sin(phase+escapeAge*3))*c.pace,z:(d.z+d.x*turn)*90*c.pace};
		for(const axis of ['x','y','z'])wanted[axis]=wanted[axis]*(1-launch)+burst[axis]*launch;
	}
	const maxSpeed = (resting ? 8 : settling ? clamp(shoreDistance*0.85,8,95) : startled ? 100 : (g.cruiseSpeed + 30 + active*15))*c.pace;
	const length = Math.hypot(wanted.x, wanted.y, wanted.z) || 1;
	const minimum=resting?0:34*active*(settling?clamp((shoreDistance-25)/55,0,1):1);
	const velocityScale=clamp(length,minimum,maxSpeed)/length;
	for (const axis of ['x', 'y', 'z']) {
		wanted[axis] *= velocityScale;
		const old=c.vel[axis];
		const limit=(resting?18:85+launch*215)*c.pace;
		const acceleration=clamp((wanted[axis]-old)*(resting?1.6:1.9+launch*8)*c.agility,-limit,limit);
		c.acceleration[axis]=damp(c.acceleration[axis],acceleration,5+launch*15,dt);
		c.vel[axis]+=c.acceleration[axis]*dt;
		c.elastic[axis]=damp(c.elastic[axis],clamp(c.acceleration[axis]/65,-1,1),7,dt);
		p[axis] += c.vel[axis] * dt;
	}
	// The wide flock can cross a ridge beside the guide's cleared path. Check
	// the actual new position every step, not the slower ambient habitat cache.
	const surface=model.environment.sample(p.x,p.z);
	c.ground=surface.ground;c.water=surface.water;
	const clearance=Math.max(surface.ground,surface.water)+2.2;
	if(p.y<clearance) {p.y=clearance;c.vel.y=Math.max(0,c.vel.y);}

	c.speed = Math.hypot(c.vel.x, c.vel.y, c.vel.z);
	// A lumen has no heading, roll or pitch. Motion changes the volume itself.
	c.yaw=c.pitch=c.bank=c.bend=c.turnRate=0;
	c.effort = damp(c.effort, clamp(c.speed / 26 + c.energy * 0.12, 0.04, 1), 3, dt);
	c.stroke += dt * Math.PI * 2 * (0.2 + c.effort * 1.3); c.breath += dt * (0.8 + c.temperament * 0.3) * c.pulseRate;
	c.resting = resting && distanceToGuide < 10;
}
