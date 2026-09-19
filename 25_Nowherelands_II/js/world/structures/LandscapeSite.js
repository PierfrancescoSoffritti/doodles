// Evaluate the landscape beyond the opening, once during loading. Local -Z is
// the view through the structure; +Z is the walking approach.
export function landscapeContext(hm,kind,x,z,y,yaw){
 const c=Math.cos(yaw),s=Math.sin(yaw),at=(lx,lz)=>hm.height(x+c*lx+s*lz,z-s*lx+c*lz);
 const front=at(0,-180),far=at(0,-360),back=at(0,150),left=at(-130,0),right=at(130,0);
 if(at(0,-75)>y+7||front>y+12)return null;
 const forest=(lx,lz)=>hm.habitat?.(x+c*lx+s*lz,z-s*lx+c*lz).forest||0;
 const ahead=forest(0,-150),behind=forest(0,150),edge=Math.max(behind,forest(-120,0),forest(120,0))-ahead;
 let waterView=false;
 for(const distance of [180,360]){const h=hm.sample(x-s*distance,z-c*distance);if(h<hm._water+1&&hm._water<y-3)waterView=true;}
 const reveal=Math.max(0,y-far),saddle=Math.max(0,Math.min(left,right)-y),backing=Math.max(0,back-y,(left+right)/2-y);
 if(kind==='resonant-gate'){
  const transition=Math.abs(behind-ahead);
  if(!(saddle>=6&&reveal>5)&&reveal<20&&!waterView&&transition<.18)return null;
  return {setting:saddle>=6?'ridge passage':waterView?'shore threshold':transition>=.18?'woodland threshold':'valley threshold',interest:Math.min(saddle,50)*.9+Math.min(reveal,100)*.35+(waterView?18:0)+transition*35,reveal,backing,forestEdge:edge,waterView};
 }
 if(backing<8&&edge<.12)return null;
 if(reveal<6&&!waterView&&edge<.18)return null;
 return {setting:waterView?'sheltered waterside':edge>=.12?'woodland edge':'hillside recess',interest:Math.max(0,edge)*50+Math.min(backing,65)*.6+(waterView?25:0)+Math.min(reveal,70)*.2,reveal,backing,forestEdge:edge,waterView};
}

export function valleyView(hm,x,z,h,yaw){
 const c=Math.cos(yaw),s=Math.sin(yaw),at=(lx,d)=>hm.height(x+c*lx-s*d,z-s*lx-c*d);
 const nearDrop=h-at(0,160);
 if(nearDrop<55||h-at(0,80)<20)return null;
 let best=null;
 for(const distance of [400,700,1100,1600,2200,3000,4000]){
  const tx=x-s*distance,tz=z-c*distance,y=hm.sample(tx,tz),drop=h-y,width=distance*.35;
  if(drop<220||y<hm._water+5)continue;
  const left=at(-width,distance)-y,right=at(width,distance)-y;
  if(Math.min(left,right)<20||Math.max(left,right)<50)continue;
  // The valley floor must actually be visible from player height at the frame.
  let clear=true;
  for(let d=20;d<distance;d+=d<320?20:50){const line=h+11+(y+8-h-11)*d/distance;if(at(0,d)>line-2){clear=false;break;}}
  if(!clear)continue;
  let open=0;for(const offset of [-.22,0,.22])if(h-hm.height(x-Math.sin(yaw+offset)*320,z-Math.cos(yaw+offset)*320)>100)open++;
  if(open<3)continue;
  const score=Math.min(drop,650)*.15+Math.min(nearDrop,150)*.3+Math.min(left,right)*.08;
  if(!best||score>best.score)best={x:tx,y,z:tz,distance,drop,nearDrop,leftRise:left,rightRise:right,score};
 }
 return best;
}
