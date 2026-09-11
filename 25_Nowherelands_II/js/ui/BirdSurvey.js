// Optional field notes for evaluating the actual world population (?birds=1).
export class BirdSurvey {
 constructor(shared,birds, { mount = true } = {}){
  this.shared=shared;this.birds=birds;this.mode=null;this.visitedAreas=new Set();
  const panel=this.panel=document.createElement('aside');panel.className='fauna-guide';
  panel.innerHTML='<div class="fauna-guide-kicker">NOWHERELANDS · FIELD NOTES</div><h2>Birds in the wild</h2><p>Passing silhouettes above.<br>Colorful feeding groups among the trees.</p>';
  const actions=document.createElement('div');actions.className='fauna-guide-list';
  const button=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;actions.append(b);return b;};
  button('Watch sky passages',()=>this.watch('sky'));
  button('Find a 3D bird',()=>this.watch('ground'));
  button('Visit another group',()=>{
   const choices=this.birds.encounters.filter(e=>e.habitat.id!==this.subject?.habitat.id).sort((a,b)=>Math.hypot(a.ground.x-shared.player.position.x,a.ground.z-shared.player.position.z)-Math.hypot(b.ground.x-shared.player.position.x,b.ground.z-shared.player.position.z));
   let other=choices.find(e=>!this.visitedAreas.has(e.habitat.id));
   if(!other&&choices.length){this.visitedAreas.clear();if(this.subject)this.visitedAreas.add(this.subject.habitat.id);other=choices[0];}
   if(other)this.watch('ground',other);
  });
  this.approach=button('Approach the bird',()=>{
   const e=this.subject;if(!e)return;this.mode='approach';
   const p=shared.player,g=e.ground,dx=p.position.x-g.x,dz=p.position.z-g.z,d=Math.hypot(dx,dz)||1;
   this.target={x:g.x+dx/d*18,z:g.z+dz/d*18};
  });
  button('Give it space',()=>{
   if(!this.subject)return;const p=shared.player,g=this.subject.ground;
   const angle=Math.atan2(p.position.z-g.z,p.position.x-g.x);
   this.target={x:g.x+Math.cos(angle)*82,z:g.z+Math.sin(angle)*82};this.mode='retreat';
  });
  button('Explore here ↗',()=>{
   this.mode=null;shared.player.fly=false;shared.player.keys.clear();
   try{shared.renderer.domElement.requestPointerLock?.()?.catch(()=>{});}catch{}
  });
  panel.append(actions);this.detail=document.createElement('p');panel.append(this.detail);
  this.readout=document.createElement('output');panel.append(this.readout);
  const help=document.createElement('small');help.textContent='WASD to walk · mouse to look · Esc releases the mouse · F to fly';panel.append(help);
  const study=document.createElement('a');study.href='./bird-study.html';study.textContent='Motion studies ↗';study.style.cssText='display:block;margin-top:12px;color:#afcdcf';panel.append(study);
  if (mount) document.body.append(panel);
  document.addEventListener('pointerlockchange',()=>{panel.classList.toggle('playing',shared.player.locked);if(document.pointerLockElement)this.mode=null;});
 }
 watch(mode,subject){
  const p=this.shared.player;
  if(p.locked)document.exitPointerLock();p.keys.clear();p.velocity.set(0,0,0);
  if(mode==='ground'){
   this.subject=subject||this.birds.nearest();if(!this.subject){this.detail.textContent='Searching the nearby tree line…';this.mode='search';return;}
   this.visitedAreas.add(this.subject.habitat.id);
   const g=this.subject.ground,q=this.subject.perch,dx=g.x-q.x,dz=g.z-q.z,d=Math.hypot(dx,dz);
   const angle=Math.atan2(dz,dx)+.95,x=g.x+Math.cos(angle)*34,z=g.z+Math.sin(angle)*34;
   p.position.set(x,this.shared.heightmap.height(x,z)+11,z);
   p.fly=true;
  }else{p.pitch=.55;p.fly=false;}
  this.mode=mode;this.guide(0);
 }
 guide(dt){
  const p=this.shared.player;if(p.locked)return;
  if(this.mode==='search'){if(this.birds.nearest())this.watch('ground');return;}
  if(this.mode==='sky'){
   // Keep the observer stationary; looking at a passing flock doesn't chase it.
   const b=this.birds.sky.birds.filter(b=>b.opacity>.8).sort((a,b)=>Math.hypot(a.p.x*4-p.position.x,a.p.z*4-p.position.z)-Math.hypot(b.p.x*4-p.position.x,b.p.z*4-p.position.z))[0];
   if(b)this.look({x:b.p.x*4,y:b.p.y*4,z:b.p.z*4});return;
  }
  if(['ground','approach','retreat'].includes(this.mode)&&this.subject){
   if(this.mode==='approach'||this.mode==='retreat'){
    const dx=this.target.x-p.position.x,dz=this.target.z-p.position.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*16);
    if(d>.01){p.position.x+=dx/d*step;p.position.z+=dz/d*step;}
    p.position.y=this.shared.heightmap.height(p.position.x,p.position.z)+11;
   }
   p.fly=true;p.velocity.set(0,0,0);this.look(this.subject.pose.position);
  }
 }
 look(target){const p=this.shared.player,dx=target.x-p.position.x,dz=target.z-p.position.z;p.yaw=Math.atan2(-dx,-dz);p.pitch=Math.atan2(target.y-p.position.y,Math.hypot(dx,dz));}
 update(){
  const b=this.birds;
  if(this.subject&&!b.encounters.includes(this.subject)){this.subject=null;if(this.mode!=='sky')this.mode='search';}
  const e=this.subject;
  this.approach.disabled=!e||e.journey.active||e.pose.state==='perched';
  if(this.mode!=='search')this.detail.textContent=this.mode==='sky'?'Flocks cross the landscape, then continue out of view.':e?({ground:'Feeding and watching',perched:'Watching from a branch',takeoff:'Startled · taking off',glide:'Gliding toward the branch',landing:'Braking to land'}[e.pose.state]||'Flying to a new resting place'):'Choose a bird to watch, or explore.';
  const trees=new Map();for(const bird of b.encounters)if(bird.pose.state==='perched')trees.set(bird.site.treeId,(trees.get(bird.site.treeId)||0)+1);
  const sharedTrees=[...trees.values()].filter(n=>n>1).length;
  this.readout.textContent=`${b.sky.birds.length} sky birds · ${b.encounters.length} birds in ${new Set(b.encounters.map(e=>e.habitat.id)).size} areas${sharedTrees?` · ${sharedTrees} shared tree${sharedTrees===1?'':'s'}`:''}`;
  this.panel.dataset.birds=JSON.stringify({habitat:b.habitatStats,observer:{x:this.shared.player.position.x,z:this.shared.player.position.z},time:b.time,arrivals:b.sky.arrivals,departures:b.sky.departures,sky:b.sky.birds.map(s=>({id:s.id,p:s.p,glide:s.glide,pattern:s.pattern,variant:s.variant,flapRate:s.flapRate,opacity:s.opacity})),encounters:b.encounters.length,nearby:b.encounters.map(e=>({habitat:e.habitat.id,species:e.species,initialPerched:e.initialPerched,home:e.forage.home,tree:e.site.treeId,slot:e.site.local,treeMoves:e.treeMoves,visitedTrees:[...e.visitedTrees],activity:e.pose.activity,state:e.pose.state,variant:e.variant,hops:e.forage?.hops,flights:e.flights,position:e.pose.position})),mode:this.mode,subject:e?{species:e.profile.name,habitat:e.habitat.id,state:e.pose.state,activity:e.pose.activity,position:e.pose.position,ground:e.ground,perch:e.perch,flights:e.flights,contact:e.pose.contact}:null});
 }
}
