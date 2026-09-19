import { Random, Simplex2D } from '../../core/Random.js';

export const GATE_GROUND_SIZE=128, GATE_GROUND_EXTENT=64;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// A small, immutable site map. Rendering and low vegetation read this same data.
// R: exposed foundation; G: unused; B: accumulated earth; A: total influence.
export function bakeGateGround(seed){
 const noise=new Simplex2D(new Random(seed+':gate-ground')),data=new Uint8Array(GATE_GROUND_SIZE**2*4);
 for(let iz=0;iz<GATE_GROUND_SIZE;iz++)for(let ix=0;ix<GATE_GROUND_SIZE;ix++){
  const x=(ix+.5)-GATE_GROUND_EXTENT,z=(iz+.5)-GATE_GROUND_EXTENT;
  const broad=noise.noise(x*.075,z*.075),fine=noise.noise(x*.3+17,z*.3-11);
  const feet=Math.min(Math.hypot((x+23)/1.05,z*.9),Math.hypot((x-23)/1.15,(z+1)*.9));
  const foundation=1-smooth(5,14,feet+broad*3);
  const threshold=(1-smooth(13,19,Math.abs(x)))*(1-smooth(4,10,Math.abs(z+broad*1.5)));
  const apron=1-smooth(13,27,feet+broad*5);
  const stone=Math.max(foundation,threshold*.9)*( .7+.3*smooth(-.6,.6,fine));
  const earth=apron*(1-stone)*(.55+.25*broad);
  const i=(iz*GATE_GROUND_SIZE+ix)*4;
  data[i]=Math.round(stone*255);data[i+1]=0;data[i+2]=Math.round(earth*255);data[i+3]=Math.round(Math.max(stone,apron)*255);
 }
 return data;
}

// Bilinear sampling matches the GPU mask, including rotated sites. Generation only.
export function gateGroundChannel(data,x,z,channel=0){
 if(!data||Math.abs(x)>=GATE_GROUND_EXTENT||Math.abs(z)>=GATE_GROUND_EXTENT)return 0;
 const u=Math.max(0,Math.min(127,x+63.5)),v=Math.max(0,Math.min(127,z+63.5));
 const ix=Math.floor(u),iz=Math.floor(v),jx=Math.min(127,ix+1),jz=Math.min(127,iz+1),fx=u-ix,fz=v-iz;
 const at=(a,b)=>data[(b*128+a)*4+channel]/255;
 return (at(ix,iz)*(1-fx)+at(jx,iz)*fx)*(1-fz)+(at(ix,jz)*(1-fx)+at(jx,jz)*fx)*fz;
}

export function gateExcludesPlant(site,x,z,padding){
 // Keep large plants out of the approach and supports. Low growth reclaims pockets.
 if(padding>=10)return Math.abs(x)<site.clearX+padding&&Math.abs(z)<site.clearZ+padding;
 if(Math.abs(x)<15&&Math.abs(z)<15)return true;
 if(Math.abs(Math.abs(x)-23)<8+padding&&Math.abs(z)<7+padding)return true;
 return gateGroundChannel(site.groundMask,x,z,0)>.32;
}
