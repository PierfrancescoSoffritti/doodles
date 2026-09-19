import { valleyView } from './LandscapeSite.js?v=structures-place-4';
import { mountainApproach, approachFloor } from './MountainSteps.js?v=structures-place-4';
// Read the existing elevation grid once; refine at most 32 summit candidates.
// No terrain deformation, per-frame terrain search or streamed construction.
export function summitSite(hm,occupied=[],colliders=[]){
 const {grid,N,cell,size,ox=0,oz=0}=hm;if(!grid||!N)return null;
 const candidates=[],stride=8;let highest=0;
 for(let z=stride;z<N-stride;z+=stride)for(let x=stride;x<N-stride;x+=stride){
  const h=grid[z*N+x];highest=Math.max(highest,h);if(h<220)continue;
  let peak=true;for(const dz of [-stride,0,stride])for(const dx of [-stride,0,stride])if(grid[(z+dz)*N+x+dx]>h)peak=false;
  if(peak)candidates.push({x:x*cell-size/2-ox,z:z*cell-size/2-oz,h});
 }
 candidates.sort((a,b)=>(b.h-Math.hypot(b.x,b.z)*.012)-(a.h-Math.hypot(a.x,a.z)*.012));
 let best=null;
 for(const candidate of candidates.slice(0,32)){
  let {x,z}=candidate,h=hm.height(x,z);
  for(const step of [64,32,16,8,4]){
   let bx=x,bz=z,bh=h;
   for(let k=0;k<8;k++){const a=k*Math.PI/4,px=x+Math.sin(a)*step,pz=z+Math.cos(a)*step,y=hm.height(px,pz);if(y>bh){bx=px;bz=pz;bh=y;}}
   x=bx;z=bz;h=bh;
  }
  if(h<Math.max(220,highest*.45)||occupied.some(s=>Math.hypot(x-s.x,z-s.z)<240)||colliders.some(c=>Math.hypot(x-c.position.x,z-c.position.z)<160+(c.radius||0)))continue;
  let surrounding=0;for(let k=0;k<8;k++)surrounding+=hm.height(x+Math.sin(k*Math.PI/4)*160,z+Math.cos(k*Math.PI/4)*160)/8;
  const prominence=h-surrounding;if(prominence<35)continue;
  for(let k=0;k<16;k++){
   const yaw=k*Math.PI/8,cos=Math.cos(yaw),sin=Math.sin(yaw),at=(lx,lz)=>hm.sample(x+cos*lx+sin*lz,z-sin*lx+cos*lz);
   let min=Infinity,max=-Infinity,valid=true;
   for(const lx of [-43,-21,0,21,43])for(const lz of [-21,0,21]){
    const y=at(lx,lz);if(y<hm._water+4||hm.caves?.hasOpening(x+cos*lx+sin*lz,z-sin*lx+cos*lz))valid=false;
    min=Math.min(min,y);max=Math.max(max,y);
   }
   if(!valid||max-min>20)continue;
   const view=valleyView(hm,x,z,h,yaw);if(!view)continue;
   let trail=null,arrivalYaw=yaw,drop=0;
   trailSearch: for(const offset of [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8])for(const length of [148,112,88])for(let variant=0;variant<4;variant++){
    const angle=offset*Math.PI/8;
    const candidate=mountainApproach(at,`${Math.round(x*100)}:${Math.round(z*100)}:${k}:${offset}:${variant}`,angle,length);
    if(!candidate)continue;
    const arrival=at(candidate.arrivalX,candidate.arrivalZ);
    if(arrival<hm._water+4||hm.caves?.hasOpening(x+cos*candidate.arrivalX+sin*candidate.arrivalZ,z-sin*candidate.arrivalX+cos*candidate.arrivalZ))continue;
    if(candidate.stones.some(stone=>stone.points.some(([lx,lz])=>hm.caves?.hasOpening(x+cos*lx+sin*lz,z-sin*lx+cos*lz))))continue;
    drop=h-candidate.route.at(-1).y;if(drop<9||drop>90)continue;
    trail=candidate;arrivalYaw=yaw+angle;break trailSearch;
   }
   if(!trail)continue;
   // The frame grows directly out of the summit; no rectangular podium.
   const y=Math.min(at(-19,0),at(19,0))-.15;
   if(Math.abs(at(-19,0)-at(19,0))>5)continue;
   const score=h*.1+prominence*.25+drop*.25+view.score-(max-min)*2-Math.hypot(x,z)*.002;
   if(!best||score>best.score)best={id:'horizon-frame',kind:'horizon-frame',x,y,z,yaw,cos,sin,clearX:43,clearZ:12,extent:170,relief:max-min,steps:trail.route.length,...trail,arrivalYaw,prominence,view,setting:'valley overlook',score};
  }
 }
 return best;
}

export function altarFloor(site,x,z){return approachFloor(site,x,z);}
