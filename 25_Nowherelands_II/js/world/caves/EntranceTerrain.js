import { CaveField,smooth } from './CaveField.js';
import {floorRelief,rockNoise} from './CaveRelief.js';
const CELL=128;
export class EntranceTerrain {
	constructor(patches=[]) {
		this.cells=new Map();
		for(const p of patches)for(let z=Math.floor(p.z/CELL);z<=Math.floor((p.z+p.size)/CELL);z++)for(let x=Math.floor(p.x/CELL);x<=Math.floor((p.x+p.size)/CELL);x++) {
			const key=`${x},${z}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(p);
		}
	}
	sample(x,z,channel='delta') {
		let value=0;const list=this.cells.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`);if(!list)return value;
		for(const p of list) {
			const u=(x-p.x)/p.step,v=(z-p.z)/p.step;if(u<0||v<0||u>=p.n-1||v>=p.n-1)continue;
			const i=Math.floor(u),j=Math.floor(v),tx=u-i,tz=v-j,d=p[channel],o=j*p.n+i;
			value+=(d[o]*(1-tx)+d[o+1]*tx)*(1-tz)+(d[o+p.n]*(1-tx)+d[o+p.n+1]*tx)*tz;
		}
		return value;
	}
}

// A bounded weathering/transport model around a newly exposed rock face. Bedrock scars
// seed loose sediment; only that sediment is relaxed downslope. Intact mountain rock is
// not globally smoothed and the cave's roof is protected farther behind the entrance.
export function erodeEntrances(hm,caves) {
	const patches=[],field=new CaveField(caves);
	for(const cave of caves)for(const entrance of cave.entrances) {
		if(entrance.type==='spring'||entrance.type==='valley')continue;
		const pts=cave.paths[entrance.path].points,end=entrance.end==='end',a=pts[end?pts.length-1:0],b=pts[end?pts.length-2:1];
		const l=Math.hypot(b.x-a.x,b.z-a.z),nx=(b.x-a.x)/l,nz=(b.z-a.z)/l,n=81,step=3,size=(n-1)*step;
		const patch={x:a.x-size/2,z:a.z-size/2,size,n,step,delta:new Float32Array(n*n),mask:new Float32Array(n*n),cave:cave.id};
		const mouthSegment=field.segments.find(s=>end?s.b===a:s.a===a);
		const landingX=a.x-nx*105,landingZ=a.z-nz*105;
		const landingOffset=Math.max(-110,Math.min(110,hm.height(landingX,landingZ)-field.section(mouthSegment,landingX,landingZ).floor));
		const bed=new Float64Array(n*n),base=new Float64Array(n*n),soil=new Float64Array(n*n),weight=new Float64Array(n*n),safe=new Uint8Array(n*n);
		let removed=0,total=0;
		for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
			const k=j*n+i,x=patch.x+i*step,z=patch.z+j*step,dx=x-a.x,dz=z-a.z,along=dx*nx+dz*nz,across=-dx*nz+dz*nx,h=hm.height(x,z);
			base[k]=bed[k]=h;if(hm.waterAt(x,z)>h-12)continue;safe[k]=1;
			const fanWidth=a.width*1.7+22,foot=Math.max(0,1-((along-12)/78)**2-(across/fanWidth)**2);
			const joint=.72+.28*Math.sin(across*.19+Math.sin(along*.07)*1.5),scar=foot*foot;
			const fractured=smooth(.3,.6,rockNoise((across+along*.22)/13,along/18));
			let cut=scar*(18+12*joint+fractured*13);
			// Two off-axis runoff grooves enter the apron from the exposed face.
			const rill=Math.exp(-(((across-a.width*1.25-Math.sin(along*.035)*5)/4)**2))+.7*Math.exp(-(((across+a.width*1.5+Math.sin(along*.06)*4)/3.5)**2));
			cut+=rill*7*smooth(-50,-5,along)*(1-smooth(45,95,along));
			const protection=smooth(15,55,along)*(1-smooth(a.width+2,a.width+20,Math.abs(across)));
			cut-=protection*Math.max(0,cut-Math.max(0,h-(a.floor+a.height+16)));
			bed[k]-=cut;removed+=cut;
			const fan=smooth(-110,-70,along)*(1-smooth(-15,10,along))*Math.max(0,1-(across/(fanWidth*1.3))**2);
			weight[k]=fan;total+=fan;
			patch.mask[k]=Math.max(scar,fan*.75,rill*.3);
		}
		// Retain part of the weathered material locally; the remainder represents material
		// dissolved or carried beyond the patch. Deposition never seals the walking mouth.
		for(let k=0;k<soil.length;k++)soil[k]=total?Math.min(9,removed*.55*weight[k]/total):0;
		for(let pass=0;pass<36;pass++) {
			const change=new Float64Array(n*n);
			for(let j=2;j<n-2;j++)for(let i=2;i<n-2;i++) {
				const k=j*n+i;if(soil[k]<.001||!safe[k])continue;
				let to=k,drop=step*.65;
				for(const d of [-1,1,-n,n])if(safe[k+d]){const diff=bed[k]+soil[k]-bed[k+d]-soil[k+d];if(diff>drop){drop=diff;to=k+d;}}
				if(to!==k){const amount=Math.min(soil[k]*.24,(drop-step*.65)*.18);change[k]-=amount;change[to]+=amount;}
			}
			for(let k=0;k<soil.length;k++)soil[k]+=change[k];
		}
		for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
			const k=j*n+i,edge=smooth(0,5,Math.min(i,j,n-1-i,n-1-j));
			const x=patch.x+i*step,z=patch.z+j*step,dx=x-a.x,dz=z-a.z,along=dx*nx+dz*nz,across=-dx*nz+dz*nx;
			// A broad, crooked talus approach meets the actual cave floor. The relief
			// continues across the threshold, removing the old straight clipped shelf.
			const curve=Math.sin(Math.max(0,-along)*.025)*18;
			const width=a.width+16+Math.max(0,-along)*.22;
			const corridor=(1-smooth(width*.35,width,Math.abs(across-curve)))*(1-smooth(2,25,along))*smooth(-114,-90,along);
			const floor=field.section(mouthSegment,x,z).floor;
			const blend=Math.max(0,Math.min(1,(-along-8)/97));
			const sediment=(1-smooth(-35,-8,along))*floorRelief(x,z)*.75;
			const target=floor-sediment+landingOffset*blend+.25;
			let shaped=bed[k]+soil[k];
			if(safe[k]) {
				shaped+=(target-shaped)*corridor;
				// Sediment fills the exposed sill up to the passage bed. An erosion scar
				// below it would leave an exterior pit followed by a vertical floor step.
				const sill=(1-smooth(a.width*.5,a.width*.95,Math.abs(across)))*smooth(-5,2,along)*(1-smooth(40,65,along));
				shaped+=Math.max(0,floor+.25-shaped)*sill;
			}
			patch.delta[k]=(shaped-base[k])*edge;
			patch.mask[k]=Math.min(1,Math.max(patch.mask[k],soil[k]*.15,corridor))*edge;
		}
		patches.push(patch);
	}
	return patches;
}
