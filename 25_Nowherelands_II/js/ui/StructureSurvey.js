import { worldPoint } from '../world/structures/StructureSites.js?v=structures-place-4';
export class StructureSurvey {
 constructor(shared,kind){this.shared=shared;this.kind=kind;this.tracking=false;this.detail=document.createElement('p');}
 visit(){
  const s=this.shared,site=s.structures.sites.find(s=>s.kind===this.kind);
  if(!site){this.detail.textContent='No safe site in this seed. Try another world.';return;}
  this.group=site;this.tracking=false;const at=worldPoint(site,site.arrivalX||0,site.arrivalZ||(this.kind==='listening-fold'?120:85),{}),p=s.player;
  if(p.locked)document.exitPointerLock();p.keys.clear();p.velocity.set(0,0,0);p.fly=false;
  const y=s.heightmap.height(at.x,at.z);p.position.set(at.x,y+11,at.z);p.groundY=y;p.yaw=site.arrivalYaw??site.yaw;p.pitch=this.kind==='horizon-frame'?.23:.08;
  this.detail.textContent=this.kind==='resonant-gate'?'Tap N or click to hear an answer. Repeated notes build resonance; walking through also wakes the gate.':this.kind==='listening-fold'?'Walk into the pavilion: the drone deepens and bright layers fall away. Offer notes for a two-tone echo. Step outside to compare.':'Follow the old stone path up the mountain to the frame. Each note sends a pulse through the frame and an answer across the view.';
  return site;
 }
 guide(){}
 update(){}
}
