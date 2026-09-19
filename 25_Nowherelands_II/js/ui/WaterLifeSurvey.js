export class WaterLifeSurvey {
 constructor(shared,species){this.shared=shared;this.species=species;this.tracking=false;this.visited=new Set();this.detail=document.createElement('p');}
 visit(current){
  if(!current)this.visited.clear();
  const s=this.shared,site=s.waterLife.visit(this.species,current,this.visited);
  if(!site){this.detail.textContent='No suitable calm water found in this world.';return;}
  this.visited.add(site.id);s.waterLife.focus=site;this.group=site;this.tracking=true;
  const p=s.player;if(p.locked)document.exitPointerLock();p.keys.clear();p.velocity.set(0,0,0);p.fly=true;
  const subject=this.species==='scarlet-fish'?{x:site.x+site.groups[0].x,z:site.z+site.groups[0].z,y:site.y-1,size:site.groups[0].radius}:site.plants.filter(p=>p.bloom).sort((a,b)=>b.size-a.size)[0];
  this.subject={x:subject.x,z:subject.z,y:site.y+(this.species==='scarlet-fish'?-1:subject.size*.2*(subject.flowerHeight??.85))};
  const reach=this.species==='scarlet-fish'?Math.max(28,subject.size*2):Math.max(24,subject.size*4);
  const views=[reach,reach*.65].flatMap(distance=>Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,x=this.subject.x+Math.sin(a)*distance,z=this.subject.z+Math.cos(a)*distance;return {x,z,y:Math.max(s.heightmap.height(x,z)+11,site.y+Math.max(16,reach*.55))};}));
  views.sort((a,b)=>a.y-b.y);const at=views[0];p.position.set(at.x,at.y,at.z);s.waterLife.stream();this.guide();this.update();return site;
 }
 guide(){
  if(!this.tracking||!this.group||this.shared.player.locked)return;
  const p=this.shared.player,g=this.subject,y=g.y;
  p.fly=true;p.velocity.set(0,0,0);p.yaw=Math.atan2(-(g.x-p.position.x),-(g.z-p.position.z));p.pitch=Math.atan2(y-p.position.y,Math.hypot(g.x-p.position.x,g.z-p.position.z));
 }
 update(){
  if(!this.group)return;const g=this.group;
  this.detail.textContent=this.species==='scarlet-fish'?`${g.groups.map(s=>s.count===1?'One solitary fish':`${s.count} fish together`).join(' · ')}. Play N to startle them; they dart away, then return to cruising.`:`${g.plants.length} lilies, ${g.plants.filter(p=>p.bloom).length} flowers. Tap a flower or play N for a light-and-chime reply. Hold for a chorus.`;
 }
}
