import { Random } from '../../core/Random.js';

// Local XZ flagstones follow the existing hillside; they never form a raised ramp.
export function mountainApproach(ground,seed='umbra',heading=0,length=148){
 const turn=([x,z])=>{let t=Math.max(0,Math.min(1,(z-12)/52));t=t*t*(3-2*t);const a=heading*t,c=Math.cos(a),s=Math.sin(a);return [c*x+s*z,-s*x+c*z];};
 const sample=(x,z)=>ground(...turn([x,z]));
 const rnd=new Random(seed+':mountain-path'),stones=[],route=[],bend=rnd.range(12,19)*(rnd.chance(.5)?1:-1);
 const center=z=>{const t=Math.max(0,Math.min(1,(z-12)/(length-12)));return bend*Math.sin(t*Math.PI)+3*Math.sin(t*Math.PI*2);};
 let z=12,previous=Infinity;
 while(z<length&&route.length<64){
  const x=center(z),slope=Math.abs(sample(center(z+5),z+5)-sample(x,z))/5;
  const depth=Math.min(length-z,Math.max(2,Math.min(rnd.range(3.5,5.5),1.1/Math.max(.1,slope)))),end=z+depth;
  const half=rnd.range(5.2,7.2),a=center(z),b=center(end),cut=rnd.range(.65,1.5);
  const outline=[[a-half+cut,z+rnd.range(-.25,.25)],[a+half-cut,z+rnd.range(-.25,.25)],[a+half+rnd.range(-.55,.55),z+Math.min(cut,depth*.35)],[b+half+rnd.range(-.55,.55),end-Math.min(cut,depth*.35)],[b+half-cut,end+rnd.range(-.25,.25)],[b-half+cut,end+rnd.range(-.25,.25)],[b-half+rnd.range(-.55,.55),end-Math.min(cut,depth*.35)],[a-half+rnd.range(-.55,.55),z+Math.min(cut,depth*.35)]];
  const heights=outline.map(p=>sample(...p)),top=Math.max(...heights,sample(a,z-.3),sample(b,end-.3),sample(center((z+end)/2),(z+end)/2))+.16;
  if(!Number.isFinite(top)||(Number.isFinite(previous)&&(previous-top>1.7||top-previous>.8))||top-sample(center((z+end)/2),(z+end)/2)>3.2)return null;
  const add=points=>stones.push({points,top,base:Math.min(...points.map(p=>sample(...p)))-rnd.range(.4,.8),minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))});
  // Occasional joined stones interrupt the repeated full-width tread.
  if(rnd.chance(.35)){
   const split=rnd.range(-1.5,1.5);add([outline[0],[a+split,z],[b+split,end],...outline.slice(5)]);add([[a+split+.09,z],...outline.slice(1,5),[b+split+.09,end]]);
  }else add(outline);
  route.push({x:center((z+end)/2),z:(z+end)/2,y:top});previous=top;z=end;
 }
 if(z<length)return null;
 return mapApproach({stones,route,arrivalX:0,arrivalZ:length+7,end:length},turn);
}
export function stoneContains(stone,x,z,padding=.55){
 if(x<stone.minX-padding||x>stone.maxX+padding||z<stone.minZ-padding||z>stone.maxZ+padding)return false;
 let inside=false;const p=stone.points;
 for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;
 if(inside||padding<=0)return inside;
 // A small foot contact patch bridges chipped joints instead of falling into
 // a sub-unit seam. The player's body radius is considerably wider (2.2).
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const a=p[j],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  if((x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2<=padding*padding)return true;
 }
 return false;
}
export function approachFloor(site,x,z){
 if(!site?.stones)return -1e6;let y=-1e6;
 for(const stone of site.stones)if(stoneContains(stone,x,z))y=Math.max(y,stone.top);
 return y;
}

// A mountain trail may reach the summit from a gentler flank while the frame
// itself faces the valley. Keep all walking polygons in the frame's local space.
export function rotateApproach(trail,angle){
 const c=Math.cos(angle),s=Math.sin(angle);return mapApproach(trail,([x,z])=>[c*x+s*z,-s*x+c*z]);
}
function mapApproach(trail,point){
 const stones=trail.stones.map(stone=>{const points=stone.points.map(point);return {...stone,points,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};});
 const route=trail.route.map(p=>{const [x,z]=point([p.x,p.z]);return {...p,x,z};});
 const [arrivalX,arrivalZ]=point([trail.arrivalX,trail.arrivalZ]);
 return {...trail,stones,route,arrivalX,arrivalZ};
}
