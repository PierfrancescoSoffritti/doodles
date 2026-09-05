import { CaveField } from './CaveField.js';
import { Random } from '../../core/Random.js';

const STEP=3.2, CELLS=16, BLOCK=STEP*CELLS;
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);

// Local, fixed-grid marching tetrahedra: neighboring chunks share exact sample coordinates.
// Only blocks touched by cave segments are considered. All work happens in WorldGenWorker.
export function buildCaveMeshes(hm, networks, progress=()=>{}) {
	const field=new CaveField(networks), blocks=new Map();
	for (const s of field.segments) {
		const r=Math.max(s.a.width,s.b.width)+10,grade=Math.abs(s.b.floor-s.a.floor)/(Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)||1);
		const top=Math.max(s.a.floor+s.a.height,s.b.floor+s.b.height)+12+r*(grade+Math.abs(s.roofTilt));
		for(let z=Math.floor((Math.min(s.a.z,s.b.z)-r)/BLOCK);z<=Math.floor((Math.max(s.a.z,s.b.z)+r)/BLOCK);z++)
		for(let x=Math.floor((Math.min(s.a.x,s.b.x)-r)/BLOCK);x<=Math.floor((Math.max(s.a.x,s.b.x)+r)/BLOCK);x++)
		for(let y=Math.floor((Math.min(s.a.floor,s.b.floor)-8-r*grade)/BLOCK);y<=Math.floor(top/BLOCK);y++) {
			const key=`${x},${y},${z}`;
			if(!blocks.has(key)) blocks.set(key,{x,y,z,cave:s.cave.id,segments:[]}); blocks.get(key).segments.push(s);
		}
	}
	const out=[]; let done=0;
	for(const block of blocks.values()) {
		const {x:bx,y:by,z:bz,segments}=block,n=CELLS+1, values=new Float32Array(n*n*n);
		const heights=new Float32Array(n*n);
		for(let z=0;z<n;z++) for(let x=0;x<n;x++) {
			const wx=(bx*CELLS+x)*STEP,wz=(bz*CELLS+z)*STEP;
			heights[z*n+x]=hm.height(wx,wz);
			const columns=segments.map(s=>field.section(s,wx,wz));
			for(let y=0;y<n;y++) {
				const wy=(by*CELLS+y)*STEP;let d=-1e6;
				for(const q of columns)d=Math.max(d,Math.min(q.wall,wy-q.floor,q.ceiling-wy));
				values[(z*n+y)*n+x]=d;
			}
		}
		const pos=[];
		for(let z=0;z<CELLS;z++) for(let y=0;y<CELLS;y++) for(let x=0;x<CELLS;x++) {
			const v=CORNERS.map(([i,j,k])=>values[((z+k)*n+y+j)*n+x+i]);
			if(v.every(t=>t<0)||v.every(t=>t>=0)) continue;
			const p=CORNERS.map(([i,j,k])=>[(bx*CELLS+x+i)*STEP,(by*CELLS+y+j)*STEP,(bz*CELLS+z+k)*STEP]);
			const h=CORNERS.map(([i,j,k])=>heights[(z+k)*n+x+i]);
			for(const tet of TETS) {
				const a=tet.filter(i=>v[i]>=0),b=tet.filter(i=>v[i]<0);
				if(!a.length||!b.length) continue;
				const edge=(i,j)=>{const t=v[i]/(v[i]-v[j]); return [...p[i].map((q,k)=>q+(p[j][k]-q)*t),h[i]+(h[j]-h[i])*t];};
				let poly;
				if(a.length===2) poly=[edge(a[0],b[0]),edge(a[0],b[1]),edge(a[1],b[1]),edge(a[1],b[0])];
				else {const lone=a.length===1?a[0]:b[0],others=a.length===1?b:a; poly=others.map(i=>edge(lone,i));}
				const direction=sub(p[a[0]],p[b[0]]);
				// Clip the cavity shell where it meets the original ground. Surface terrain
				// discards the complementary cave opening; no cap seals the entrance.
				const clipped=[];
				for(let i=0;i<poly.length;i++) {
					const q=poly[i],r=poly[(i+1)%poly.length],f=q[3]-q[1],g=r[3]-r[1];
					if(f>=-.1) clipped.push(q);
					if((f>=-.1)!==(g>=-.1)) {const t=(f+.1)/(f-g);clipped.push(q.map((v,k)=>v+(r[k]-v)*t));}
				}
				for(let i=1;i<clipped.length-1;i++) {
					const q=clipped[0],r=clipped[i],s=clipped[i+1],normal=cross(sub(r,q).slice(0,3),sub(s,q).slice(0,3));
					const tri=dot(normal,direction)<0?[q,s,r]:[q,r,s];
					for(const point of tri) pos.push(...point.slice(0,3));
				}
			}
		}
		if(pos.length) out.push({cave:block.cave,position:Float32Array.from(pos)});
		if(++done%20===0) progress(done/blocks.size);
	}
	return {chunks:out,decorations:networks.map(c=>({cave:c.id,position:decorate(c,field,hm)})),water:networks.filter(c=>c.wet).map(c=>water(c,field))};
}

function decorate(cave,field,hm) {
	const r=new Random(`cave:${cave.entrance.x}`),pos=[];
	const cone=(x,y,z,radius,height,down=false)=>{
		const sides=7, rings=down?[[0,1],[.25,.65],[.7,.24],[1,0]]:[[0,1],[.22,.81],[.7,.47],[.95,.2],[1,0]];
		for(let j=0;j<rings.length-1;j++) for(let i=0;i<sides;i++) {
			const point=(ring,k)=>{const angle=k/sides*Math.PI*2;return [x+Math.cos(angle)*radius*ring[1],y+(down?-1:1)*height*ring[0],z+Math.sin(angle)*radius*ring[1]];};
			const q=[point(rings[j],i),point(rings[j],i+1),point(rings[j+1],i+1),point(rings[j+1],i)];
			for(const id of [0,1,2,0,2,3])pos.push(...q[id]);
		}
	};
	const anchored=(x,y,z,ceiling)=>field.density(x,y+(ceiling ? .8 : -.8),z)<0;
	for(const path of cave.paths) for(let i=4;i<path.points.length-2;i++) {
		const p=path.points[i],next=path.points[i+1],dx=next.x-p.x,dz=next.z-p.z,l=Math.hypot(dx,dz)||1;
		for(const side of [-1,1]) {
			const across=p.width*r.range(.53,.8)*side,x=p.x-dz/l*across,z=p.z+dx/l*across;
			const s=field.candidates(x,z).find(s=>s.a===p); if(!s) continue;
			const q=field.section(s,x,z),h=r.range(3,11);
			if(hm.height(x,z)<q.ceiling+5)continue;
			if(anchored(x,q.ceiling,z,true)) cone(x,q.ceiling+.5,z,r.range(1.1,2.6),h,true);
			if(r.next()<.58 && anchored(x,q.floor,z,false)) cone(x,q.floor-.6,z,r.range(1.6,3.6),h*.6);
			// Low angular breakdown on the margin leaves the center and stream accessible.
			if(r.next()<.4 && anchored(x+3,q.floor,z+3,false)) cone(x+3,q.floor-.8,z+3,r.range(2,4),r.range(1.5,3.5));
		}
	}
	return Float32Array.from(pos);
}
function water(cave,field) {
	const pos=[],flow=[],depth=[],points=cave.paths[0].points;let travel=0;
	for(let i=0;i<points.length-1;i++) {
		const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,s=field.segments.find(s=>s.a===a);
		const steps=Math.max(1,Math.ceil(l/3.2));
		let area=0;const half=(a.width+b.width)*.23;
		for(let k=0;k<24;k++) {const u=((k+.5)/12-1)*half,x=(a.x+b.x)*.5-dz/l*u,z=(a.z+b.z)*.5+dx/l*u;
			area+=Math.max(0,(a.water+b.water)*.5-field.section(s,x,z).floor)*half/12;}
		const duration=l/Math.max(.05,cave.discharge/Math.max(area,.1));
		for(let j=0;j<steps;j++) for(let k=0;k<8;k++) {
			const vertex=(t,u)=>{const x=a.x+dx*t-dz/l*u*(a.width+(b.width-a.width)*t)*.46,z=a.z+dz*t+dx/l*u*(a.width+(b.width-a.width)*t)*.46;
				const y=a.water+(b.water-a.water)*t,q=field.section(s,x,z);return {p:[x,y,z],f:[travel+duration*t,u],d:y-q.floor};};
			const q=[vertex(j/steps,k/4-1),vertex((j+1)/steps,k/4-1),vertex((j+1)/steps,(k+1)/4-1),vertex(j/steps,(k+1)/4-1)];
			for(const id of [0,1,2,0,2,3]) {pos.push(...q[id].p);flow.push(...q[id].f);depth.push(q[id].d);}
		}
		travel+=duration;
	}
	// The recharge end is a rounded pool against the closed conduit, not a straight
	// cut through otherwise submerged cave floor.
	const end=points[points.length-1],before=points[points.length-2],dx=end.x-before.x,dz=end.z-before.z,l=Math.hypot(dx,dz)||1;
	const segment=field.segments.find(s=>s.b===end),radius=end.width*.46;
	for(let ring=0;ring<4;ring++)for(let k=0;k<16;k++) {
		const vertex=(r,k)=>{const angle=-Math.PI*.5+k/16*Math.PI,along=Math.cos(angle)*r,across=Math.sin(angle)*r;
			const x=end.x+dx/l*along-dz/l*across,z=end.z+dz/l*along+dx/l*across;
			return {p:[x,end.water,z],f:[travel+along,across/radius],d:end.water-field.section(segment,x,z).floor};};
		const q=[vertex(ring/4*radius,k),vertex((ring+1)/4*radius,k),vertex((ring+1)/4*radius,k+1),vertex(ring/4*radius,k+1)];
		for(const i of [0,1,2,0,2,3]){pos.push(...q[i].p);flow.push(...q[i].f);depth.push(q[i].d);}
	}
	return {cave:cave.id,position:Float32Array.from(pos),flow:Float32Array.from(flow),depth:Float32Array.from(depth)};
}
