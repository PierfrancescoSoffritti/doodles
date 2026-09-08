// Sky-only flock. Navigation, lift and the wingbeat clock are independent:
// ending a powered bout cannot change the animation clock or switch silhouettes.
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const damp=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export class SpriteBirds {
 constructor(){this.reset();}
 reset(){
  this.time=0;this.seed=7831;this.birds=[];
  for(let i=0;i<18;i++){
   const group=Math.floor(i/6),theta=(i%6)*.19+group*1.9,radius=43+group*16+(i%3)*3;
   const cx=(group-1)*35,cz=-105-group*42,heading=theta+Math.PI/2;
   const glide=i%3===0;
   this.birds.push({id:i,group,radius,base:36+group*13,p:{x:cx+Math.cos(theta)*radius,y:36+group*13+(i%4)*1.7,z:cz+Math.sin(theta)*radius},
    v:{x:Math.cos(heading)*16,y:glide?-1.3:1.2,z:Math.sin(heading)*16},heading,turn:0,bank:0,pitch:0,speed:16,
    state:glide?'glide':'flap',age:0,duration:glide?3+i*.09:1.7+i*.075,phase:glide?.25:(i*.173)%1,
    wander:0,wanderTarget:0,wanderTimer:i*.17,glide});
  }
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 update(dt){while(dt>1e-8){const h=Math.min(dt,1/120);this.step(h);dt-=h;}return this.birds;}
 direction(b,snapshot){
   const cx=(b.group-1)*35+Math.sin(this.time*.047+b.group)*17;
   const cz=-105-b.group*42+Math.sin(this.time*.033+b.group*2)*13;
   const dx=cx-b.p.x,dz=cz-b.p.z,r=Math.hypot(dx,dz)||1;
   const wantedRadius=b.radius+Math.sin(this.time*.14+b.id)*9;
   const inward=clamp((r-wantedRadius)/wantedRadius*2,-.8,1.4);
   let tx=-dz/r+dx/r*inward,tz=dx/r+dz/r*inward;
   // Weak local agreement and separation keep loose groups without translating
   // an entire formation or giving every bird the same target/phase.
   for(let i=0;i<snapshot.length;i++){
    if(snapshot[i].id===b.id)continue;const o=snapshot[i],x=b.p.x-o.x,z=b.p.z-o.z,d=Math.hypot(x,z);
    if(d<28){tx+=Math.cos(o.h)*.05;tz+=Math.sin(o.h)*.05;}
    if(d<9&&d>.001){tx+=x/d*(1-d/9)*.7;tz+=z/d*(1-d/9)*.7;}
   }
   return Math.atan2(tz,tx)+b.wander;
 }

 step(dt){
  this.time+=dt;
  const snapshot=this.birds.map(b=>({id:b.id,x:b.p.x,z:b.p.z,h:b.heading}));
  for(const b of this.birds){
   b.age+=dt;b.wanderTimer-=dt;
   if(b.wanderTimer<=0){b.wanderTarget=(this.random()-.5)*.5;b.wanderTimer=1.4+this.random()*2.4;}
   b.wander=damp(b.wander,b.wanderTarget,.9,dt);
   const desired=angle(this.direction(b,snapshot),b.heading);
   b.turn=damp(b.turn,clamp(desired*1.3,-.5,.5),2.2,dt);b.heading+=b.turn*dt;
   b.bank=damp(b.bank,-Math.atan2(b.turn*b.speed,9.81),4,dt);
   if(b.state==='glide'){
    // Extended wings provide lift, but the bird loses height and gains a little
    // airspeed. This is a visual flight model, not a full aerodynamic solver.
    b.v.y=damp(b.v.y,b.glideSink ?? -2.25,.85,dt);
    b.speed=damp(b.speed,(18.2+Math.sin(b.id)*.6)*(b.speedScale ?? 1),.35,dt);
    if(b.age>b.duration||b.p.y<b.base-5){b.state='flap';b.age=0;b.duration=b.powerDuration ? b.powerDuration*(.85+this.random()*.3) : 2.2+this.random()*1.8;}
   }else{
    const ready=b.age>b.duration&&b.p.y>b.base;
    const climb=ready?-.6:clamp((b.base+7-b.p.y)*1.2,-1.5,3.1);
    b.v.y=damp(b.v.y,climb,3,dt);b.speed=damp(b.speed,(15.4+Math.sin(b.id)*1.1)*(b.speedScale ?? 1),1,dt);
    const previous=b.phase;b.phase+=dt*(b.flapRate ?? (1.8+(b.id%4)*.18));
    // Finish at the extended-wing pose. Both sides of the transition use
    // frame 4; no snapping to a different texture and no restarting the clock.
    const extended=Math.floor(previous-.25)+1.25;
    if(ready&&b.v.y<=0&&b.phase>=extended){b.phase=extended;b.state='glide';b.age=0;b.duration=b.glideDuration ? b.glideDuration*(.85+this.random()*.3) : 3.3+this.random()*2.2;}
   }
   b.glide=b.state==='glide';
   b.v.x=Math.cos(b.heading)*b.speed;b.v.z=Math.sin(b.heading)*b.speed;
   b.p.x+=b.v.x*dt;b.p.y+=b.v.y*dt;b.p.z+=b.v.z*dt;
   b.pitch=Math.atan2(b.v.y,b.speed);
  }
 }
}

// World-space card axes. +UV.y is the bird's beak/flight direction. The camera
// is intentionally absent: moving the viewer never rotates or mirrors a bird.
export function birdCardAxes(b){
 const h=b.heading,p=b.pitch,k=b.bank,cp=Math.cos(p),sp=Math.sin(p),ch=Math.cos(h),sh=Math.sin(h);
 const forward=[ch*cp,sp,sh*cp],right=[-sh,0,ch],up=[-ch*sp,cp,-sh*sp];
 return {forward,right:right.map((v,i)=>v*Math.cos(k)+up[i]*Math.sin(k))};
}
