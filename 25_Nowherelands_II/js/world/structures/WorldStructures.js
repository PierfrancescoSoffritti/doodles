import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StructureStudy } from '../../atelier/StructureStudy.js?v=structures-place-4';
import { wornPart, gateFooting, altarPieces } from './StructureGeometry.js?v=structures-place-4';
import { agedStoneMaterial } from './AgedStone.js?v=structures-place-4';
import { bakeGateGround, GATE_GROUND_SIZE } from './GateGround.js?v=structures-place-4';
import { structureSites,localPoint,worldPoint,sweepStructure,roofHeight } from './StructureSites.js?v=structures-place-4';
import { altarFloor } from './SummitSite.js?v=structures-place-4';
import { bus,Events } from '../../core/EventBus.js';

export class WorldStructures {
 constructor(scene,hm,shared,seed,{enabled=true}={}){
  this.shared=shared;this.hm=hm;this.time=0;this.targets=[];this.solids=[];this.entries=[];
  this.sites=enabled?structureSites(hm,seed,shared.colliders):[];hm.structureSites=this.sites;
  this.root=new THREE.Group();this.root.name='Structures';scene.add(this.root);
  this._a={x:0,z:0};this._b={x:0,z:0};this._c={x:0,z:0};
  this.stats={sites:this.sites.length,draws:0,triangles:0,responses:0};
  for(const site of this.sites){
   const gate=site.kind==='resonant-gate',model=new StructureStudy({kind:site.kind,seed}),material=agedStoneMaterial();
   material.userData.pulses.value=model.pulseAges;
   const pieces=model.parts.map((p,i)=>wornPart(p,seed+':'+site.kind+':wear:'+i));
   if(gate){
    pieces.push(gateFooting(site,hm,seed));
    Object.defineProperty(site,'groundMask',{value:bakeGateGround(seed)});
    this.groundTexture=new THREE.DataTexture(site.groundMask,GATE_GROUND_SIZE,GATE_GROUND_SIZE,THREE.RGBAFormat);
    this.groundTexture.minFilter=this.groundTexture.magFilter=THREE.LinearFilter;this.groundTexture.needsUpdate=true;
    const ground=shared.gateGround;if(ground){ground.uGateGround.value.dispose();ground.uGateGround.value=this.groundTexture;ground.uGatePose.value.set(site.x,site.z,site.cos,site.sin);ground.uGateActive.value=1;}
   }
   if(site.steps)pieces.push(...altarPieces(site));
   const geometry=mergeGeometries(pieces,false);for(const piece of pieces)piece.dispose();
   const mesh=new THREE.Mesh(geometry,material);mesh.position.set(site.x,site.y,site.z);mesh.rotation.y=site.yaw;mesh.updateMatrix();mesh.matrixAutoUpdate=false;this.root.add(mesh);this.solids.push(mesh);
   this.stats.draws++;this.stats.triangles+=geometry.attributes.position.count/3;
   const entry={site,model,mesh,material,voices:[],contact:new THREE.Vector3(site.x,site.y+12,site.z)};this.entries.push(entry);
   if(gate){
    const seamMaterial=new THREE.MeshStandardMaterial({color:'#79c3ca',emissive:'#68e0ef',emissiveIntensity:.14,roughness:.6});
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.48,5.4,.12),seamMaterial);seam.position.set(-20,11,5.2);mesh.add(seam);seam.updateMatrix();seam.matrixAutoUpdate=false;entry.seam=seam;
    mesh.updateMatrixWorld(true);seam.getWorldPosition(entry.contact);
    entry.target={mesh:seam,onHover:on=>{entry.hover=on;},onPress:charge=>this.touch(entry,charge)};this.targets.push(entry.target);this.stats.draws++;this.stats.triangles+=12;
   }
   if(site.kind==='listening-fold'){
    this.fold=entry;shared.structureRoof.uStructureRoofPose.value.set(site.x,site.y,site.z,site.yaw);
    const peak=model.parts[0].points[4];shared.structureRoof.uStructureRoofProfile.value.set(43,peak[0],peak[1],48);
   }
   if(site.steps)this.altar=entry;
  }
  this.root.updateMatrixWorld(true);this.root.updateMatrix();this.root.matrixAutoUpdate=false;
 }
 touch(entry,charge=0,freq=0){
  const p=this.shared.player.position;if(Math.abs(p.y-entry.site.y-11)>(entry.site.steps?100:45))return false;
  localPoint(entry.site,p.x,p.z,this._a);entry.model.time=this.time;
  if(!entry.model.offerNote('player',this._a,charge))return false;
  this.stats.responses++;
  const s=this.shared,e=s.audio,kind=entry.site.kind;
  if(e&&e.ctx.state==='running'&&!document.hidden){
   const root=freq||s.conductor.scale.freq([0,2,4,2][(entry.model.responses-1)%4],2);
   const tones=kind==='listening-fold'?[root*.5,root*.75]:[kind==='horizon-frame'?root:root*.5];
   for(const f of tones){
    while(entry.voices.length>=(kind==='listening-fold'?4:2))entry.voices.shift()?.stop?.();
    entry.voices.push(e.playTone({freq:f,time:e.now+.065,position:entry.contact,velocity:kind==='listening-fold'?.21:.36,duration:.12,release:.6+charge*.3,attack:.012,voices:1,type:kind==='horizon-frame'?'sine':'triangle',cutoff:kind==='horizon-frame'?2400:1250,reverb:kind==='listening-fold'?.8:.38,delay:0,dest:e.playerBus,layer:'structure-reply'}));
   }
  }
  return true;
 }
 hearNote(note){
  if(note.layer!=='player-note'||!note.position||(this.shared.caveAmount||0)>.1)return;
  for(const entry of this.entries)if(entry.contact.distanceToSquared(note.position)<200*200)this.touch(entry,Math.max(0,Math.min(1,((note.velocity||.35)-.35)/.6)),note.freq);
 }
 occludes(raycaster,distance){for(const mesh of this.solids){const hits=raycaster.intersectObject(mesh,false);if(hits.length&&hits[0].distance<distance-.2)return true;}return false;}
 floorAt(x,z){
  if(!this.altar)return -1e6;const s=this.altar.site;
  if(Math.abs(x-s.x)>s.extent||Math.abs(z-s.z)>s.extent)return -1e6;
  localPoint(s,x,z,this._a);return altarFloor(s,this._a.x,this._a.z);
 }
 resolveMovement(previous,next){
  // Stairs are climbable; the tall sides of the altar cannot be walked through.
  const floor=this.floorAt(next.x,next.z);
  const support=Math.max(previous.y-11,this.floorAt(previous.x,previous.z));
  if(floor>support+2.2){next.x=previous.x;next.z=previous.z;}
  for(const {site,model} of this.entries){
   if(previous.y<site.y-2||previous.y>site.y+85||Math.abs(previous.x-site.x)>160||Math.abs(previous.z-site.z)>160)continue;
   localPoint(site,previous.x,previous.z,this._a);localPoint(site,next.x,next.z,this._b);
   sweepStructure(model.bounds,this._a.x,this._a.z,this._b.x-this._a.x,this._b.z-this._a.z,this._c);
   worldPoint(site,this._c.x,this._c.z,this._b);next.x=this._b.x;next.z=this._b.z;
  }
 }
 roofAt(x,z){if(!this.fold)return -1e6;const s=this.fold.site;if(Math.abs(x-s.x)>86||Math.abs(z-s.z)>86)return -1e6;localPoint(s,x,z,this._a);return s.y+roofHeight(this.fold.model.parts,this._a.x,this._a.z);}
 update(dt){
  this.time+=dt;const s=this.shared,p=s.player.position;let shelter=0;
  for(const entry of this.entries){
   const {model,site}=entry;localPoint(site,p.x,p.z,model.visitor);model.update(dt);
   const x=model.visitor.x,z=model.visitor.z,near=Math.abs(p.y-site.y-11)<25;
   if(entry.seam){
    if(near&&Math.abs(x)<14&&entry.lastZ!==undefined&&z*entry.lastZ<=0&&Math.abs(z-entry.lastZ)<12)this.touch(entry,.25);
    entry.seam.material.emissiveIntensity=.14+model.flash*2.4+model.energy*.45+(entry.hover?.16:0);
   }
   if(entry===this.fold&&p.y>site.y+5&&p.y<this.roofAt(p.x,p.z)-1){shelter=model.shelterAt(model.visitor);}
   if(entry===this.fold){
    const inside=shelter>.7;
    if(inside&&!entry.inside){this.touch(entry,.4);bus.emit(Events.TOAST,{text:'Listening fold',sub:'The music opens into a deeper chord · offer a note'});}
    entry.inside=inside;
   }
   if(entry===this.altar){
    const on=near&&Math.abs(x)<38&&Math.abs(z)<17;
    if(on&&!entry.inside){this.touch(entry,.4);bus.emit(Events.TOAST,{text:'Horizon altar',sub:'Offer a note to set the stone ringing'});}entry.inside=on;
   }
   entry.lastZ=z;
   entry.material.userData.response.value.set(model.flash,model.energy,model.pulseCount);
  }
  s.structureShelter+=(shelter-s.structureShelter)*(1-Math.exp(-dt*3));if(s.structureShelter<.0001)s.structureShelter=0;
 }
 dispose(){for(const e of this.entries){for(const voice of e.voices)voice?.stop?.();e.mesh.geometry.dispose();e.material.dispose();if(e.seam){e.seam.geometry.dispose();e.seam.material.dispose();}}this.groundTexture?.dispose();if(this.shared.gateGround)this.shared.gateGround.uGateActive.value=0;this.root.removeFromParent();this.hm.structureSites=[];this.shared.structureShelter=0;this.shared.structureRoof.uStructureRoofPose.value.y=-1e6;}
}
