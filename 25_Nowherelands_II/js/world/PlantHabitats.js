import { Random } from '../core/Random.js';
import { RIVER_STRIDE, RV, surfaceHalfWidth } from './gen/Rivers.js';

export function plantFooting(species, sample, water) {
 // Sea-level coastal banks exclude reeds, including small companion plants.
 // Both species thin out below the ragged tree line; reeds give up first.
 const above=sample.ground-water;
 return Number.isFinite(sample.ground) && !sample.roof && sample.slope<.28 && sample.foam<.3 &&
  sample.alt>(species==='bell-reed'?.6:.35) &&
  sample.ground>=sample.water-.2 && (species==='bell-reed'
   ? above>=-.2 && above<7 && !(water<=2 && sample.coast>.35)
   : above>1 && above<24 && sample.wet>.3 && sample.coast<.8);
}

// Candidate banks come from the actual river margins and lake shorelines.
// All final roots are checked against the detailed terrain, including cave openings.
export function plantSites(world,lakes,sample,seed) {
 const banks=[];
 for(const [ri,river] of (world.rivers||[]).entries())for(let i=2;i<river.count-2;i+=16){
  const d=river.data,o=i*RIVER_STRIDE;
  if(d[o+RV.FOAM]>.3)continue;
  const dx=d[o+RIVER_STRIDE+RV.X]-d[o-RIVER_STRIDE+RV.X],dz=d[o+RIVER_STRIDE+RV.Z]-d[o-RIVER_STRIDE+RV.Z],len=Math.hypot(dx,dz)||1;
  for(const side of [-1,1]){
   const nx=-dz/len*side,nz=dx/len*side,w=surfaceHalfWidth(d[o+RV.W],d[o+RV.D],d[o+RV.BANK],side,d[o+RV.BEND]);
   banks.push({id:`river:${ri}:${i}:${side}`,x:d[o+RV.X]+nx*w,z:d[o+RV.Z]+nz*w,nx,nz,water:d[o+RV.WL]});
  }
 }
 for(const lake of lakes)for(const [i,s] of lake.shore.entries())banks.push({id:`lake:${lake.id}:${i}`,x:s.x,z:s.z,nx:s.nx,nz:s.nz,water:s.y});
 const sites=[];
 for(const bank of banks){
  const rnd=new Random(`${seed}:plants:${bank.id}`);
  for(const species of ['bell-reed','veil-willow']){
   if(species==='veil-willow'&&!rnd.chance(.42))continue;
   const forms=species==='bell-reed'?['young','mature','weathered']:['ribbons','sprays','veils'];
   const count=species==='bell-reed'?3:1;
   for(let n=0;n<count;n++)for(let attempt=0;attempt<10;attempt++){
    const outward=rnd.range(species==='bell-reed'?0:8,species==='bell-reed'?14:42),along=rnd.range(-24,24);
    const x=bank.x+bank.nx*outward+bank.nz*along,z=bank.z+bank.nz*outward-bank.nx*along,s=sample(x,z);
    if(!plantFooting(species,s,bank.water))continue;
    const separation=species==='bell-reed'?7:60;
    if(sites.some(p=>p.species===species&&Math.hypot(p.x-x,p.z-z)<separation))continue;
    sites.push({id:`${bank.id}:${species}:${n}`,species,x,y:s.ground,z,water:bank.water,form:rnd.pick(forms),scale:species==='bell-reed'?rnd.range(2.5,3.3):rnd.range(6,8),pendants:species==='veil-willow'&&rnd.chance(.2)});
    break;
   }
  }
 }
 const patches=[];
 for(const site of sites){
  if(site.species!=='bell-reed'){patches.push(site);continue;}
  if(patches.some(p=>p.species==='bell-reed'&&Math.hypot(p.x-site.x,p.z-site.z)<20))continue;
  const rnd=new Random(`${seed}:reed-family:${site.id}`),companions=[],turn=rnd.range(0,Math.PI*2),count=rnd.int(2,3);
  for(let i=0;i<count;i++)for(let attempt=0;attempt<14;attempt++){
   const angle=turn+i*2.4+rnd.range(-.5,.5),radius=rnd.range(3.5,7.5),x=site.x+Math.sin(angle)*radius,z=site.z+Math.cos(angle)*radius,s=sample(x,z);
   if(!plantFooting('bell-reed',s,site.water)||Math.abs(s.ground-site.y)>2||companions.some(p=>Math.hypot(p.x-x,p.z-z)<2.6))continue;
   companions.push({x,y:s.ground,z,form:i<2?'young':'weathered',scale:site.scale*rnd.range(i<2?.43:.65,i<2?.68:.82)});break;
  }
  if(companions.length<2)continue;
  patches.push({...site,form:site.form==='young'?'mature':site.form,companions});
 }
 return patches;
}
