import { Random } from '../../core/Random.js';
import { RIVER_STRIDE as S, RV, sectionArea } from '../gen/Rivers.js';
import { CaveField, mix } from './CaveField.js';

// Spring caves beneath rising valley sides. Water is groundwater-fed and emerges into an
// existing river; no surface stream is silently duplicated or removed. Joint directions and
// inherited higher galleries control the paths; noise only roughens an established network.
export function generateCaves(hm, seed, limit=6) {
	const rnd=new Random(seed+':karst'), candidates=[];
	for (const river of hm.world.rivers) for (let i=12;i<river.count-12;i+=18) {
		const o=i*S,d=river.data, wl=d[o+RV.WL], width=d[o+RV.W];
		if (wl<45 || wl>620 || width<8 || width>65 || d[o+RV.KIND]!==0) continue;
		const tx=d[o+S]-d[o-S],tz=d[o+S+1]-d[o-S+1],len=Math.hypot(tx,tz)||1;
		for (const side of [-1,1]) {
			const nx=-tz/len*side,nz=tx/len*side, x=d[o],z=d[o+1];
			let cover=Infinity;
			for (const dist of [100,200,350,520]) cover=Math.min(cover,hm.height(x+nx*dist,z+nz*dist)-wl-dist*.025);
			if (cover>48) candidates.push({x,z,wl,nx,nz,cover,river:river.id,sample:i,discharge:sectionArea(width,d[o+RV.D],d[o+RV.BEND],d[o+RV.BAR])*d[o+RV.SPEED]*.1,rank:cover+rnd.range(0,45)});
		}
	}
	candidates.sort((a,b)=>b.rank-a.rank);
	const caves=[];
	const faceSlots=Math.min(2,Math.floor(limit/2));
	for (const c of candidates) {
		if (caves.some(p=>Math.hypot(p.entrance.x-c.x,p.entrance.z-c.z)<1500)) continue;
		const wet=caves.length%3!==2, length=rnd.range(520,900), points=[];
		const phase=rnd.range(0,6.28), width=rnd.range(19,26), base=c.wl+(wet?-3:9);
		for (let i=0;i<=28;i++) {
			const t=i/28,dist=t*length;
			const bend=Math.sin(t*Math.PI)*Math.sin(t*7+phase)*48;
			const chamber=1+1.05*Math.exp(-(((t-.58)/.12)**2))+.45*Math.exp(-(((t-.84)/.09)**2));
			points.push({x:c.x+c.nx*dist-c.nz*bend,z:c.z+c.nz*dist+c.nx*bend,floor:base+dist*.024,
				width:width*chamber,height:25*chamber+5*Math.sin(t*9)**2,water:c.wl-.08+dist*.024,along:dist});
		}
		// Keep all deep passages inside the mountain. Reject an unsuitable route instead of
		// creating an exposed roof or an arbitrary mound to hide it.
		let cover=Infinity,valid=true;
		for (const p of points.slice(4)) {
			const roof=p.floor+p.height+6;
			for (const side of [-.8,0,.8]) {
				const over=hm.height(p.x-c.nz*p.width*side,p.z+c.nx*p.width*side)-roof;
				if (over<8) valid=false; cover=Math.min(cover,over);
			}
		}
		if (!valid) continue;
		const covered=path=>path.every((p,i)=>{
			const next=path[Math.min(path.length-1,i+1)],previous=path[Math.max(0,i-1)],dx=next.x-previous.x,dz=next.z-previous.z,l=Math.hypot(dx,dz)||1;
			return [-.9,0,.9].every(side=>hm.height(p.x-dz/l*p.width*side,p.z+dx/l*p.width*side)>p.floor+p.height+14);
		});
		const paths=[{wet,points,surfaceStart:4}], start=points[10],end=points[23],upper=[];
		for (let i=0;i<=20;i++) {
			const t=i/20, arch=Math.sin(t*Math.PI), offset=arch*85;
			upper.push({x:mix(start.x,end.x,t)-c.nz*offset,z:mix(start.z,end.z,t)+c.nx*offset,
				floor:mix(start.floor,end.floor,t)+arch*26,width:15+Math.sin(t*Math.PI)*10,height:22+arch*10,water:-1e6,along:t*length*.55});
		}
		if (covered(upper)) paths.push({wet:false,points:upper});
		// A short blind gallery follows the second joint family from the main chamber.
		const root=points[17],side=[];
		for (let i=0;i<=9;i++) {
			const t=i/9, dist=t*150;
			side.push({x:root.x-c.nz*dist+c.nx*dist*.25,z:root.z+c.nx*dist+c.nz*dist*.25,
				floor:root.floor+t*11,width:19+Math.sin(t*Math.PI)*9,height:25+Math.sin(t*Math.PI)*12,water:-1e6,along:dist});
		}
		if (covered(side)) paths.push({wet:false,points:side});
		if(paths.length<2)continue;
		const entrance={x:c.x,z:c.z,y:base+11,type:wet?'spring':'valley',path:0,end:'start'};
		caves.push({id:caves.length,name:wet?'Spring cave':'Fossil cave',wet,paths,entrance,entrances:[entrance],
			direction:{x:c.nx,z:c.nz},length,discharge:wet?c.discharge:0,overburden:cover,river:c.river,sample:c.sample});
		if (caves.length>=limit-faceSlots) break;
	}
	addMountainCaves(hm,caves,seed,limit);
	for(const cave of caves.filter(c=>c.wet)) addHighEntrance(hm,cave);
	for(const cave of caves)cave.relief=true;
	return caves;
}


// Test the complete cross-section between control points, not only the skeleton.
// Open end ranges are explicit so a second entrance uses the same terrain mask as the first.
function roofCover(hm,path) {
	let minimum=Infinity;
	const points=path.points;
	for(let i=path.surfaceStart||0;i<points.length-1-(path.surfaceEnd||0);i++) {
		const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
		const steps=Math.ceil(length/8);
		for(let j=0;j<=steps;j++) {
			const t=j/steps,x=mix(a.x,b.x,t),z=mix(a.z,b.z,t),width=mix(a.width,b.width,t);
			const roof=mix(a.floor+a.height,b.floor+b.height,t)+8;
			for(const side of [-1,0,1]) minimum=Math.min(minimum,hm.height(x-dz/length*(width+4)*side,z+dx/length*(width+4)*side)-roof);
		}
	}
	return minimum;
}

function addMountainCaves(hm,caves,seed,limit) {
	const rnd=new Random(seed+':mountain-mouths'),sites=[];
	// An independent terrain survey: these sites do not require a river candidate.
	for(let gz=1100;gz<hm.size-1100;gz+=180) for(let gx=1100;gx<hm.size-1100;gx+=180) {
		const x=gx-hm.size/2-hm.ox,z=gz-hm.size/2-hm.oz,h=hm.height(x,z);
		if(h<200 || h>1500 || hm.waterAt(x,z)>h-12)continue;
		const dx=(hm.height(x+24,z)-hm.height(x-24,z))/48,dz=(hm.height(x,z+24)-hm.height(x,z-24))/48;
		const slope=Math.hypot(dx,dz);if(slope<.4 || slope>1.8)continue;
		const nx=dx/slope,nz=dz/slope;
		if(hm.height(x+nx*180,z+nz*180)<h+65 || hm.height(x-nx*80,z-nz*80)>h-20)continue;
		sites.push({x,z,h,nx,nz,rank:rnd.next()+Math.min(slope,1)*.5});
	}
	sites.sort((a,b)=>b.rank-a.rank);
	let added=0;
	for(const site of sites) {
		if(caves.length>=limit)break;
		const {x,z,h,nx,nz}=site;
		if(caves.some(c=>c.paths.some(path=>path.points.some(p=>Math.hypot(p.x-x,p.z-z)<1100))))continue;
		const fissure=added%2===1,length=rnd.range(540,740),points=[];
		for(let i=0;i<=28;i++) {
			const t=i/28,dist=t*length,bend=Math.sin(t*Math.PI)*Math.sin(t*5)*32;
			const throat=Math.min(1,t*5),chamber=Math.exp(-(((t-.64)/.16)**2));
			points.push({x:x+nx*dist-nz*bend,z:z+nz*dist+nx*bend,floor:h-1-dist*.13,
				width:mix(fissure?8:19,20,throat)+chamber*13,height:mix(fissure?38:23,28,throat)+chamber*18,water:-1e6,along:dist});
		}
		const main={wet:false,points,surfaceStart:4,roofTilt:fissure?-.18:.22,roofPower:fissure?.65:.35},cover=roofCover(hm,main);if(cover<10)continue;
		const root=points[17],branch=[];
		for(let i=0;i<=10;i++) {
			const t=i/10,dist=t*135;
			branch.push({x:root.x-nz*dist+nx*dist*.2,z:root.z+nx*dist+nz*dist*.2,
				floor:root.floor+t*12,width:17+Math.sin(t*Math.PI)*6,height:24,water:-1e6,along:dist});
		}
		const side={wet:false,points:branch};if(roofCover(hm,side)<10)continue;
		const entrance={x,z,y:h+10,type:fissure?'fissure':'mountain',path:0,end:'start'};
		caves.push({id:caves.length,name:fissure?'Mountain fissure':'Mountain gallery',wet:false,paths:[main,side],entrance,entrances:[entrance],
			direction:{x:nx,z:nz},length,discharge:0,overburden:cover,river:-1,sample:-1});
		added++;
	}
}

function addHighEntrance(hm,cave) {
	const main=cave.paths[0].points;
	// Trace from the existing interior toward nearby slopes. A traversable rising gallery
	// connects the older high opening to the active lower conduit; never punch a skylight.
	for(const rootIndex of [13,18,22,8]) for(let turn=0;turn<12;turn++) {
		const root=main[rootIndex],angle=Math.atan2(cave.direction.z,cave.direction.x)+Math.PI+turn*Math.PI/6;
		const nx=Math.cos(angle),nz=Math.sin(angle);
		for(const length of [240,360,480,600]) {
			const x=root.x+nx*length,z=root.z+nz*length,floor=hm.height(x,z)-1,rise=floor-root.floor;
			if(floor<cave.entrance.y+65 || rise<35 || rise>length*.36)continue;
			if(hm.waterAt(x,z)>floor-10 || hm.height(x+nx*50,z+nz*50)>floor-12)continue;
			const points=[],steps=Math.ceil(length/20);
			for(let i=0;i<=steps;i++) {
				const t=i/steps;
				points.push({x:mix(root.x,x,t),z:mix(root.z,z,t),floor:mix(root.floor,floor,t),
					width:mix(16,10,t),height:mix(25,32,t),water:-1e6,along:t*length});
			}
			const path={wet:false,points,surfaceEnd:4,roofTilt:-.18,roofPower:.4};if(roofCover(hm,path)<10)continue;
			// The mouth must actually intersect the surface, including on steep terrain.
			const field=new CaveField([{id:0,paths:[path]}]);
			if(field.surfaceDensity(x-nx*4,hm.height(x-nx*4,z-nz*4),z-nz*4)<=0)continue;
			const entrance={x,z,y:floor+11,type:'high',path:cave.paths.length,end:'end'};
			cave.paths.push(path);cave.entrances.push(entrance);return;
		}
	}
}
