export class PlantSurvey {
 constructor(shared,species){this.shared=shared;this.species=species;this.tracking=false;this.visited=new Set();this.detail=document.createElement('p');}
 visit(current){
  if(!current)this.visited.clear();
  const s=this.shared,site=s.plants.visit(this.species,current,this.visited);if(!site){this.detail.textContent='No suitable bank found in this world.';return;}
  this.visited.add(site.id);s.plants.focus=site;
  this.group=site;this.tracking=true;const p=s.player;if(p.locked)document.exitPointerLock();p.keys.clear();p.velocity.set(0,0,0);p.fly=true;
  const distance=this.species==='bell-reed'?24:66;
  // Pick the clearest low bank around the specimen rather than landing inside the crown.
  const views=Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,x=site.x+Math.sin(a)*distance,z=site.z+Math.cos(a)*distance;return {x,z,y:Math.max(s.heightmap.height(x,z),s.heightmap.waterAt(x,z))+11};});
  views.sort((a,b)=>Math.abs(a.y-site.y-11)-Math.abs(b.y-site.y-11));
  const at=views[0];p.position.set(at.x,at.y,at.z);s.plants.stream();this.guide();this.update();return site;
 }
 guide(){
  if(!this.tracking||!this.group||this.shared.player.locked)return;
  const p=this.shared.player,s=this.group,y=s.y+(this.species==='bell-reed'?6:18);
  p.fly=true;p.velocity.set(0,0,0);p.yaw=Math.atan2(-(s.x-p.position.x),-(s.z-p.position.z));p.pitch=Math.atan2(y-p.position.y,Math.hypot(s.x-p.position.x,s.z-p.position.z));
 }
 update(){
  const g=this.group;if(!g)return;
  this.detail.textContent=this.species==='bell-reed'?`${g.form} reeds with ${g.companions?.length||0} smaller companions · Tap N to trade notes. Hold N to wake the whole patch.`:`${g.form} willow${g.pendants?' · Aim at a pendant: the cursor grows. Click for its mirror chime.':' · Explore here to walk around its crown.'}`;
 }
}
