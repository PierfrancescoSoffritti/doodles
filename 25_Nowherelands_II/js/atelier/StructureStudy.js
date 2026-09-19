import { Random } from '../core/Random.js';

export const EYE_HEIGHT=11, BODY_RADIUS=2.2;
export const STONE_PULSE_COUNT=8, STONE_PULSE_LIFETIME=.9;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function foldMusic(amount,out={}){
 const a=clamp(amount);
 out.drone=1+.65*a;out.arpeggio=1-.88*a;out.bells=1-.8*a;out.shimmer=1-.72*a;out.bass=1-.12*a;out.pulse=1-.65*a;out.wind=1-.65*a;out.rain=1-.7*a;out.cutoff=1-.88*a;out.density=1-.7*a;out.send=.55+.4*a;return out;
}

// XY silhouettes extruded along Z. The same outlines supply mesh and walking bounds.
export function structureParts(kind,seed='umbra',serial=1){
 const rnd=new Random(seed+':structure:'+serial), lean=rnd.range(-1.4,1.4);
 const part=(points,depth=9)=>({points,depth});
 if(kind==='listening-fold')return [
  part([[-50,0],[-41,0],[-37,37],[-8+lean,55],[-6+lean,63],[-46,43]],72),
  part([[-8+lean,55],[-6+lean,63],[46,48],[50,0],[41,0],[37,42]],72)
 ];
 if(kind==='horizon-frame')return [
  part([[-22,0],[-36,25],[-29,28],[-15,0]],9),
  part([[-36,25],[-25,51],[-19,47],[-29,28]],9),
  part([[-25,51],[-11,59],[-9,51],[-19,47]],9),
  part([[22,0],[15,0],[29,28],[36,25]],9),
  part([[36,25],[29,28],[19,47],[25,51]],9),
  part([[25,51],[19,47],[9,51],[11,59]],9)
 ];
 return [
  part([[-28,0],[-18,0],[-15+lean,44],[-23+lean,48]],10),
  part([[18,0],[28,0],[22+lean,41],[15+lean,44]],10),
  part([[-23+lean,48],[-15+lean,40],[22+lean,35],[22+lean,43]],10)
 ];
}

// Conservative footprint of only the material within the player's body height.
export function walkingBounds(parts){
 const bounds=[];
 for(const {points,depth} of parts){
  const xs=[];
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   if(a[1]>=0&&a[1]<=EYE_HEIGHT+2)xs.push(a[0]);
   for(const h of [0,EYE_HEIGHT+2])if((a[1]<h&&b[1]>h)||(a[1]>h&&b[1]<h))xs.push(a[0]+(b[0]-a[0])*(h-a[1])/(b[1]-a[1]));
  }
  if(xs.length)bounds.push({minX:Math.min(...xs)-BODY_RADIUS,maxX:Math.max(...xs)+BODY_RADIUS,minZ:-depth/2-BODY_RADIUS,maxZ:depth/2+.9+BODY_RADIUS});
 }
 return bounds;
}

export class StructureStudy {
 constructor({kind='resonant-gate',seed='umbra',serial=1}={}){
  this.kind=kind;this.parts=structureParts(kind,seed,serial);this.bounds=walkingBounds(this.parts);
  this.pulseAges=new Float32Array(STONE_PULSE_COUNT).fill(-1);this.pulseCount=0;
  this.time=0;this.lastNote=-100;this.flash=0;this.energy=0;this.responses=0;this.shelter=0;
  this.visitor={x:0,z:68};this.contact={x:-17.8,y:11,z:5.05};
 }
 blocked(x,z){return this.bounds.some(b=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ);}
 move(dx,dz){
  // Bounded substeps prevent a sprint or delayed frame crossing a narrow footing.
  const length=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(length/(BODY_RADIUS*.45)));
  for(let i=0;i<steps;i++){
   const x=this.visitor.x+dx/steps,z=this.visitor.z+dz/steps;
   if(!this.blocked(x,this.visitor.z))this.visitor.x=x;
   if(!this.blocked(this.visitor.x,z))this.visitor.z=z;
  }
  this.visitor.x=Math.max(-110,Math.min(110,this.visitor.x));this.visitor.z=Math.max(-95,Math.min(170,this.visitor.z));
 }
 shelterAt({x,z}){
  if(this.kind!=='listening-fold')return 0;
  return smooth((36-Math.abs(z))/10)*smooth((39-Math.abs(x))/10);
 }
 offerNote(source='player',position=this.visitor,charge=0){
  if(source!=='player'||this.time-this.lastNote<.12)return false;
  if(Math.hypot(position.x,position.z)>(this.kind==='horizon-frame'?190:this.kind==='listening-fold'?130:120))return false;
  // Eight slots cover the entire .9 s journey at the .12 s input limit.
  // Never replace a travelling pulse when another note arrives.
  const slot=this.pulseAges.findIndex(age=>age<0);if(slot>=0){this.pulseAges[slot]=0;this.pulseCount++;}
  this.lastNote=this.time;this.flash=1;this.energy=Math.min(1,this.energy+.24+clamp(charge)*.3);this.responses++;this.charge=clamp(charge);return true;
 }
 update(dt){
  for(let i=0;i<this.pulseAges.length;i++)if(this.pulseAges[i]>=0){const age=this.pulseAges[i]+dt;this.pulseAges[i]=age>=STONE_PULSE_LIFETIME?-1:age;if(age>=STONE_PULSE_LIFETIME)this.pulseCount--;}
  this.time+=dt;this.flash*=Math.exp(-dt*2.2);this.energy*=Math.exp(-dt*.65);
  this.shelter+=(this.shelterAt(this.visitor)-this.shelter)*(1-Math.exp(-dt*3));
 }
}
