export class ReedSurvey {
 constructor(shared, walkers) {
  this.shared=shared;this.walkers=walkers;this.tracking=false;
  const panel=this.panel=document.createElement('aside');panel.className='fauna-guide';
  panel.innerHTML='<div class="fauna-guide-kicker">NOWHERELANDS · FIELD NOTES</div><h2>Reed walker families</h2><p>Old river grazers, in their own time.</p>';
  const actions=document.createElement('div');actions.className='fauna-guide-list';
  const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;actions.append(b);};
  button('Find a family',()=>this.visit());button('Visit another family',()=>this.visit(this.group));
  button('Hear the father',()=>{this.audio();this.walkers.call(this.group?.members[0]);});
  button('Explore here ↗',()=>{this.tracking=false;shared.player.fly=false;try{shared.renderer.domElement.requestPointerLock?.()?.catch(()=>{});}catch{}});
  panel.append(actions);this.detail=document.createElement('p');panel.append(this.detail);
  this.link=document.createElement('a');this.link.href='./reed-study.html?seed='+encodeURIComponent(walkers.model.seed);this.link.textContent='Reed walker study ↗';this.link.style.cssText='display:block;margin-top:12px;color:#afcdcf';panel.append(this.link);
  document.body.append(panel);
  document.addEventListener('pointerlockchange',()=>{panel.classList.toggle('playing',shared.player.locked);if(shared.player.locked)this.tracking=false;});
 }
 audio(){if(!this.shared.audio)this.shared.hud.enterBtn.click();this.shared.audio?.resume();}
 visit(current){
  const g=this.walkers.visit(current);if(!g){this.detail.textContent='No suitable shallow habitat found in this area.';return;}
  this.group=g;this.tracking=true;const p=this.shared.player;if(p.locked)document.exitPointerLock();p.keys.clear();p.velocity.set(0,0,0);p.fly=true;
  const c=g.members.reduce((a,m)=>({x:a.x+m.position.x/g.members.length,y:a.y+m.position.y/g.members.length,z:a.z+m.position.z/g.members.length}),{x:0,y:0,z:0});
  const x=c.x+24,z=c.z+28,ground=this.shared.heightmap.height(x,z);
  p.position.set(x,Math.max(ground+11,c.y+8),z);this.guide();
 }
 guide(){
  if(!this.tracking||!this.group||this.shared.player.locked)return;
  const p=this.shared.player,c=this.group.members.reduce((a,m)=>({x:a.x+m.position.x/this.group.members.length,y:a.y+m.position.y/this.group.members.length,z:a.z+m.position.z/this.group.members.length}),{x:0,y:0,z:0});
  p.fly=true;p.velocity.set(0,0,0);p.yaw=Math.atan2(-(c.x-p.position.x),-(c.z-p.position.z));p.pitch=Math.atan2(c.y-p.position.y,Math.hypot(c.x-p.position.x,c.z-p.position.z));
 }
 update(){
  const groups=[...this.walkers.model.groups.values()];
  if(this.group&&!groups.includes(this.group)){this.group=null;this.tracking=false;}
  this.detail.textContent=this.group?`${this.group.members.length-2} youngster${this.group.members.length===4?'s':''} · ${this.group.site.form} · grazing, resting and wandering together`:'Choose a family to visit its real habitat.';
  this.panel.dataset.reeds=JSON.stringify({sites:this.walkers.model.sites.length,groups:groups.length,subject:this.group?.id,members:this.group?.members.map(m=>({role:m.role,height:m.scale*m.traits.legs,giant:m.traits.giant,position:m.position,state:m.state,steps:m.steps,feet:m.draw.feet}))});
 }
}
