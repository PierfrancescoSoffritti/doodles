import {floorRelief,rockNoise} from './CaveRelief.js';
// Positive values denote cave air. Shared by worker meshing, surface openings and collision.
const CELL = 96, EMPTY = [];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function grain(x, z) { return Math.sin(x * .091 + Math.sin(z * .043)) * Math.cos(z * .079) * .65 + Math.sin(x * .031 - z * .039) * .35; }

export class CaveField {
	constructor(networks = [],rocks=[]) {
		this.rockCells=new Map();
		for(const r of rocks.filter(r=>r.large)) {
			const radius=Math.max(r.sx,r.sy,r.sz)*1.5;
			for(let z=Math.floor((r.z-radius)/CELL);z<=Math.floor((r.z+radius)/CELL);z++)for(let x=Math.floor((r.x-radius)/CELL);x<=Math.floor((r.x+radius)/CELL);x++) {
				const key=`${x},${z}`;if(!this.rockCells.has(key))this.rockCells.set(key,[]);this.rockCells.get(key).push(r);
			}
		}
		this.networks = networks; this.cells = new Map(); this.surfaceCells = new Map(); this.segments = [];
		for (const cave of networks) for (const path of cave.paths) for (let i = 0; i < path.points.length - 1; i++) {
			const a = path.points[i], b = path.points[i + 1], r = Math.max(a.width, b.width) + 9;
			const s = { a, b, cave, openStart:path.surfaceStart?path.points.slice(0,2):null,openEnd:path.surfaceEnd?path.points.slice(-2):null,roofTilt:path.roofTilt||0, roofPower:path.roofPower||.5, wet: path.wet, surface: i < (path.surfaceStart ?? (path === cave.paths[0] && !path.surfaceEnd ? 4 : 0)) || i >= path.points.length - 1 - (path.surfaceEnd || 0), index: this.segments.length };
			this.segments.push(s);
			for (let z = Math.floor((Math.min(a.z,b.z)-r)/CELL); z <= Math.floor((Math.max(a.z,b.z)+r)/CELL); z++)
				for (let x = Math.floor((Math.min(a.x,b.x)-r)/CELL); x <= Math.floor((Math.max(a.x,b.x)+r)/CELL); x++) {
					const key = `${x},${z}`; if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(s);
					if(s.surface) {if(!this.surfaceCells.has(key)) this.surfaceCells.set(key,[]);this.surfaceCells.get(key).push(s);}
				}
		}
	}
	hasRocks(x,z){return this.rockCells.has(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`);}
	rockClearance(x,y,z) {
		let distance=Infinity;
		for(const r of this.rockCells.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)||EMPTY) {
			// Conservative ellipsoid inside the faceted block; low rubble stays walkable.
			const dx=x-r.x,dy=y-r.y,dz=z-r.z,c=Math.cos(r.yaw),s=Math.sin(r.yaw);
			const u=c*dx-s*dz,v=s*dx+c*dz;
			distance=Math.min(distance,(Math.hypot(u/(r.sx*.85),dy/(r.sy*.85),v/(r.sz*.85))-1)*Math.min(r.sx,r.sy,r.sz)*.85);
		}
		return distance;
	}
	candidates(x,z) { return this.cells.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`) || EMPTY; }
	section(s,x,z) {
		const a=s.a,b=s.b, dx=b.x-a.x,dz=b.z-a.z, length=Math.hypot(dx,dz) || 1;
		const along=((x-a.x)*dx+(z-a.z)*dz)/(length*length),t=clamp(along,0,1);
		const px=mix(a.x,b.x,t),pz=mix(a.z,b.z,t), across=((x-px)*-dz+(z-pz)*dx)/length;
		// Continue the floor gradient across rounded segment ends; clamping it would
		// create a staircase of flat end caps along a rising passage.
		const w=mix(a.width,b.width,t), floor=mix(a.floor,b.floor,along), h=mix(a.height,b.height,t);
		const natural=s.cave.relief?1:0;
		const radial=Math.hypot(x-px,z-pz), rough=grain(x+floor*.21,z)*3.4+natural*(rockNoise(x/12,z/14)-.5)*5;
		let wall=w+rough-radial;
		// Open mouths end at the surface junction. Rounded underground end caps would
		// otherwise carve an extra crescent-shaped hole beneath the raised approach.
		for(const end of [s.openStart,s.openEnd])if(end) {
			const [p,q]=end,dx=q.x-p.x,dz=q.z-p.z,l=Math.hypot(dx,dz)||1;
			const d=((x-(end===s.openStart?p.x:q.x))*dx+(z-(end===s.openStart?p.z:q.z))*dz)/l;
			wall=Math.min(wall,end===s.openStart?d:-d);
		}
		const u=clamp(radial/(w+rough),0,1);
		const water=s.wet ? mix(a.water,b.water,t) : -1e6;
		// A stream incises a narrower slot below an older, broader passage; gravel shelves
		// remain walkable. Upper fossil galleries have a gently irregular sediment floor.
		const channel=s.wet ? (water-floor+1.2)*smooth(.18,.48,radial/w) : 0;
		const relief=natural*floorRelief(x,z);
		// Keep the flowing thalweg below its hydraulic surface; dry galleries retain
		// broad undulations, tilted rock shelves and small worn ledges.
		const margins=smooth(.28,.88,Math.abs(across)/w);
		const bottom=floor+channel+grain(x*.7,z*.7)*.32+(s.wet?relief*.07:relief+natural*margins*(2+rockNoise(x/17,z/20)*3));
		const arch=Math.pow(Math.max(0,1-u*u),s.roofPower);
		const fracture=Math.max(0,Math.min(1-u*.12,(1-u)*(across<0?2.8:1.65)));
		const shape=mix(arch,fracture,natural*(s.surface?.9:.45));
		const top=floor+4+h*shape+s.roofTilt*across+grain(x*.45,z*.45)*3.1+natural*(rockNoise(x/15,z/17)-.5)*5;
		return { floor:bottom, ceiling:top, wall, water, across, width:w, t, cave:s.cave, segment:s };
	}
	hasOpening(x,z) { return this.surfaceCells.has(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`); }
	surfaceDensity(x,y,z) { return this.density(x,y,z,this.surfaceCells.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`) || EMPTY); }
	density(x,y,z,list=this.candidates(x,z)) {
		let value=-1e6;
		for (const s of list) { const q=this.section(s,x,z); value=Math.max(value,Math.min(q.wall,y-q.floor,q.ceiling-y)); }
		return value;
	}
	column(x,z,eyeY,eyeHeight=11) {
		// Merge the vertical air intervals before selecting support. At a junction an upper
		// passage's nominal floor may have been dissolved by the lower chamber.
		const intervals=[];
		for(const s of this.candidates(x,z)) {const q=this.section(s,x,z);if(q.wall>1.8 && q.ceiling>q.floor)intervals.push(q);}
		intervals.sort((a,b)=>a.floor-b.floor);
		const merged=[];
		for(const q of intervals) {
			const previous=merged[merged.length-1];
			if(previous && q.floor<=previous.ceiling) {previous.ceiling=Math.max(previous.ceiling,q.ceiling);previous.water=Math.max(previous.water,q.water);}
			else merged.push(q);
		}
		let best=null,score=Infinity;
		for(const q of merged) {
			if(q.ceiling-q.floor<eyeHeight+2 || eyeY<q.floor-3 || eyeY>q.ceiling+1)continue;
			const d=Math.abs(eyeY-(Math.max(q.floor,q.water-1.5)+eyeHeight));if(d<score){score=d;best=q;}
		}
		return best;
	}
}
