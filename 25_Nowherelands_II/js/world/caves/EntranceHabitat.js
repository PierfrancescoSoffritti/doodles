import {Random} from '../../core/Random.js';
import {CaveField} from './CaveField.js';

// Seeded communities follow sheltered soil and daylight. Bare collapse scars remain patchy;
// the dark galleries never receive plants from this entrance-only recruitment pass.
export function entranceHabitat(hm,caves) {
	const field=new CaveField(caves),out=[];
	for(const cave of caves)for(const e of cave.entrances) {
		const points=cave.paths[e.path].points,end=e.end==='end',a=points[end?points.length-1:0],b=points[end?points.length-2:1];
		const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),nx=dx/l,nz=dz/l,rnd=new Random(`entrance:${e.x}:${e.z}`),rocks=[],plants=[];
		const at=(along,across)=>({x:a.x+nx*along-nz*across,z:a.z+nz*along+nx*across});
		const ground=(x,z)=>{
			let y=hm.height(x,z);
			// Debris falls to physical support, independently of the eye-height interval
			// used for player navigation. That interval can miss a lower exposed gallery.
			for(const s of field.candidates(x,z)) {
				const q=field.section(s,x,z);
				if(q.wall>1.8 && q.ceiling>q.floor+13)y=Math.min(y,q.floor);
			}
			return y;
		};
		for(let i=0;i<340;i++) {
			const large=i<22,side=rnd.next()<.65?-1:1;
			const along=large?rnd.range(-75,46):rnd.range(-100,130),across=side*(large?rnd.range(a.width*.9,a.width*1.8+10):rnd.range(0,a.width*2.2+18));
			const p=at(along,across),radius=large?rnd.range(5,13):rnd.range(.5,2.7),y=ground(p.x,p.z);
			if(hm.waterAt(p.x,p.z)>y-1 || large && Math.abs(across)<radius+7)continue;
			// Bury the base into the local slope; mass sits below the fracture scar, never
			// in evenly spaced rings and never on the clear approach through the mouth.
			const sx=radius,sy=radius*rnd.range(.45,.8),sz=radius*rnd.range(.65,1.25);
			const support=Math.min(y,ground(p.x+sx*.65,p.z),ground(p.x-sx*.65,p.z),ground(p.x,p.z+sz*.65),ground(p.x,p.z-sz*.65));
			if(large && field.density(p.x,support+sy*.5,p.z)>-radius)continue;
			rocks.push({...p,cover:hm.height(p.x,p.z)-y,y:support-sy*.22,sx,sy,sz,yaw:rnd.range(0,6.28),tilt:rnd.range(-.25,.25),large});
		}
		// In-place jointed bedrock shoulders belong to the cliff. Their buried volume
		// anchors each mass in the slope; downhill fragments are generated separately.
		if(!['spring','valley'].includes(e.type))for(let j=0;j<7;j++) {
			const side=rnd.next()<.6?-1:1,along=rnd.range(-10,60),across=side*(a.width+rnd.range(7,32)),p=at(along,across);
			const sx=rnd.range(12,21),sy=rnd.range(5,10),sz=rnd.range(10,19),surface=hm.height(p.x,p.z);
			const support=Math.min(surface,ground(p.x,p.z),ground(p.x-nx*sz*.5,p.z-nz*sz*.5));
			// Avoid a block projecting unsupported across an exposed cave void.
			if(field.density(p.x,support,p.z)>-Math.max(sx,sz))continue;
			rocks.push({...p,y:support-sy*.65,sx,sy,sz,yaw:Math.atan2(nx,nz)+rnd.range(-.3,.3),tilt:rnd.range(-.15,.15),large:true,cover:0});
		}

		for(let i=0;i<560;i++) {
			const along=rnd.range(-95,28),across=rnd.range(-a.width*2.4-25,a.width*2.4+25),p=at(along,across);
			if(Math.abs(across)<8 && along>-65)continue;
			const surface=hm.height(p.x,p.z),y=ground(p.x,p.z),cover=surface-y;
			if(cover>4 && along>12 || cover>24 || hm.waterAt(p.x,p.z)>y-.4)continue;
			const slope=Math.hypot(ground(p.x+2,p.z)-ground(p.x-2,p.z),ground(p.x,p.z+2)-ground(p.x,p.z-2))/4;
			if(slope>1.25 || rocks.some(r=>Math.hypot(r.x-p.x,r.z-p.z)<Math.max(r.sx,r.sz)*.85))continue;
			const pocket=.5+.5*Math.sin(p.x*.17+Math.sin(p.z*.08)*2)*Math.cos(p.z*.13);if(rnd.next()>pocket*.95)continue;
			const type=y>850?'sedge':cover>2?'fern':along>0?'fern':rnd.pick(['fern','bramble','sedge','moss']);
			plants.push({...p,y:y+.08,type,scale:rnd.range(2.3,type==='bramble'?6:4.5),yaw:rnd.range(0,6.28),cover});
		}
		out.push({cave:cave.id,rocks,plants});
	}
	return out;
}
