import { landscapeContext } from './LandscapeSite.js?v=structures-place-4';
import { summitSite } from './SummitSite.js?v=structures-place-4';
import { Random } from '../../core/Random.js';
import { gateExcludesPlant } from './GateGround.js?v=structures-place-4';
export const STRUCTURE_KINDS=['resonant-gate','listening-fold','horizon-frame'];

export function inStructureClearing(sites,x,z,padding=0){
 for(const s of sites||[]){
  const extent=s.groundMask?91:s.extent;
  if(Math.abs(x-s.x)>extent+padding||Math.abs(z-s.z)>extent+padding)continue;
  const dx=x-s.x,dz=z-s.z,lx=s.cos*dx-s.sin*dz,lz=s.sin*dx+s.cos*dz;
  if(s.kind==='resonant-gate'&&s.groundMask){if(gateExcludesPlant(s,lx,lz,padding))return true;continue;}
  // Keep tall plants and rock spires out of the frame's near sightline.
  // Low ground cover remains; the mountain and distant valley are untouched.
  if(s.view&&padding>3&&lz<0&&lz> -160&&Math.abs(lx)<16-lz*.15+padding)return true;
  if(s.stones&&s.stones.some(t=>lx>t.minX-padding&&lx<t.maxX+padding&&lz>t.minZ-padding&&lz<t.maxZ+padding))return true;
  if(Math.abs(lx)<s.clearX+padding&&Math.abs(lz)<s.clearZ+padding)return true;
 }
 return false;
}
export function localPoint(site,x,z,out){const dx=x-site.x,dz=z-site.z;out.x=site.cos*dx-site.sin*dz;out.z=site.sin*dx+site.cos*dz;return out;}
export function worldPoint(site,x,z,out){out.x=site.x+site.cos*x+site.sin*z;out.z=site.z-site.sin*x+site.cos*z;return out;}

// Bounded load-time search, with no terrain edits or unchecked fallback sites.
export function structureSites(hm,seed,colliders=[]){
 const random=new Random(seed+':structures'),sites=[];
 for(const [index,kind] of STRUCTURE_KINDS.entries()){
  if(kind==='horizon-frame'){const summit=summitSite(hm,sites,colliders);if(summit)sites.push(summit);continue;}
  let best=null;
  for(let i=0;i<560;i++){
   const a=random.range(0,Math.PI*2),r=random.range(260,3600),x=Math.sin(a)*r,z=Math.cos(a)*r;
   const y=hm.sample(x,z);
   if(y<hm._water+5||hm._slope>.17||hm.caves?.hasOpening(x,z))continue;
   if(colliders.some(c=>Math.hypot(c.position.x-x,c.position.z-z)<160+(c.radius||0))||sites.some(s=>Math.hypot(s.x-x,s.z-z)<300))continue;
   const orientations=[];
   for(let k=0;k<8;k++){const yaw=k*Math.PI/4,context=landscapeContext(hm,kind,x,z,y,yaw);if(context)orientations.push({yaw,context});}
   orientations.sort((a,b)=>b.context.interest-a.context.interest);
   for(const {yaw,context} of orientations.slice(0,2)){
    const cos=Math.cos(yaw),sin=Math.sin(yaw),clearX=kind==='listening-fold'?58:43,clearZ=kind==='listening-fold'?46:35;
    let min=Infinity,max=-Infinity,valid=true;
    for(const lx of [-clearX,-clearX/2,0,clearX/2,clearX])for(const lz of [-clearZ,-clearZ/2,0,clearZ/2,clearZ]){
     const px=x+cos*lx+sin*lz,pz=z-sin*lx+cos*lz,h=hm.sample(px,pz);
     if(h<hm._water+3||hm._slope>.32||hm.caves?.hasOpening(px,pz)){valid=false;break;}
     min=Math.min(min,h);max=Math.max(max,h);
    }
    if(!valid||max-min>(kind==='listening-fold'?5:3.5))continue;
    const arrivalZ=kind==='listening-fold'?120:85;
    for(const distance of [40,65,arrivalZ]){
     const px=x+sin*distance,pz=z+cos*distance,h=hm.sample(px,pz);
     if(h<hm._water+3||hm._slope>.35||Math.abs(h-y)>12||hm.caves?.hasOpening(px,pz))valid=false;
    }
    if(!valid)continue;
    const score=context.interest-(max-min)*2-r*.001;
    if(!best||score>best.score)best={id:kind,kind,x,y:min-.4,z,yaw,cos,sin,clearX,clearZ,extent:Math.hypot(clearX,clearZ),arrivalZ,score,relief:max-min,...context};
   }
  }
  if(best)sites.push(best);
 }
 return sites;
}

export function sweepStructure(bounds,x,z,dx,dz,out){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)));dx/=steps;dz/=steps;
 for(let i=0;i<steps;i++){
  let blocked=false;for(const b of bounds)if(x+dx>b.minX&&x+dx<b.maxX&&z>b.minZ&&z<b.maxZ){blocked=true;break;}if(!blocked)x+=dx;
  blocked=false;for(const b of bounds)if(x>b.minX&&x<b.maxX&&z+dz>b.minZ&&z+dz<b.maxZ){blocked=true;break;}if(!blocked)z+=dz;
 }
 out.x=x;out.z=z;return out;
}

export function roofHeight(parts,x,z){
 let roof=-1e6;
 for(const part of parts){
  if(Math.abs(z)>part.depth/2)continue;
  for(let i=0;i<part.points.length;i++){
   const a=part.points[i],b=part.points[(i+1)%part.points.length];
   if(x<Math.min(a[0],b[0])||x>Math.max(a[0],b[0])||a[0]===b[0])continue;
   roof=Math.max(roof,a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
  }
 }
 return roof;
}
