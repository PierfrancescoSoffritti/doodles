// Float64 retains simulation precision. Buffers shuttle back to the worker for
// reuse; the render thread never traverses the cyclic simulation graph.
// Explicit fields keep the hot transfer loop monomorphic on mobile engines.
const vectors=['pos','prev','vel','elastic'];
const scalars=['oldVX','oldVY','oldVZ','speed','energy','noteGlow','notePhase','noteAlarm','yaw','pitch','bank','bend','turnRate','effort','stroke','breath','resting','ground','water','prevStroke','prevYaw','prevPitch','prevBank','calls','landed'];
export const LUMEN_STRIDE=vectors.length*3+scalars.length+1;
export function packLumenFrame(model,buffer) {
 const count=model.creatures.length,size=count*LUMEN_STRIDE;
 const values=buffer?.byteLength===size*8?new Float64Array(buffer):new Float64Array(size);
 let i=0;
 for(const c of model.creatures){
  values[i++]=c.pos?.x??0;values[i++]=c.pos?.y??0;values[i++]=c.pos?.z??0;
  values[i++]=c.prev?.x??0;values[i++]=c.prev?.y??0;values[i++]=c.prev?.z??0;
  values[i++]=c.vel?.x??0;values[i++]=c.vel?.y??0;values[i++]=c.vel?.z??0;
  values[i++]=c.elastic?.x??0;values[i++]=c.elastic?.y??0;values[i++]=c.elastic?.z??0;
  values[i++]=c.oldVX??0;
  values[i++]=c.oldVY??0;
  values[i++]=c.oldVZ??0;
  values[i++]=c.speed??0;
  values[i++]=c.energy??0;
  values[i++]=c.noteGlow??0;
  values[i++]=c.notePhase??0;
  values[i++]=Number(!!c.noteAlarm);
  values[i++]=c.yaw??0;
  values[i++]=c.pitch??0;
  values[i++]=c.bank??0;
  values[i++]=c.bend??0;
  values[i++]=c.turnRate??0;
  values[i++]=c.effort??0;
  values[i++]=c.stroke??0;
  values[i++]=c.breath??0;
  values[i++]=Number(!!c.resting);
  values[i++]=c.ground??0;
  values[i++]=c.water??0;
  values[i++]=c.prevStroke??0;
  values[i++]=c.prevYaw??0;
  values[i++]=c.prevPitch??0;
  values[i++]=c.prevBank??0;
  values[i++]=c.calls??0;
  values[i++]=Number(!!c.landed);
  values[i++]=c.navigation.index;
 }
 const groups=[...model.groups.values()].map(g=>({id:g.id,center:g.center,state:g.state,visits:g.visits,flow:{phase:g.flow.phase,cycles:g.flow.cycles,joins:g.flow.joins},branches:g.flow.branches.map(b=>({index:b.index,coarse:!!b.coarse,state:b.state,center:b.center,guide:b.guide,guideVelocity:b.guideVelocity,bank:b.bank,lakeId:b.lake.id,destinationId:b.destination?.id,visits:b.visits,highland:b.highland,weave:b.weave?{stage:b.weave.stage,indices:b.weave.branches.map(branch=>branch.index)}:null}))}));
 return {time:model.time,values,groups};
}
export function applyLumenFrame(model,frame,creatures,lakes) {
 for(const incoming of frame.groups){const group=model.groups.get(incoming.id);if(!group)continue;group.center=incoming.center;group.state=incoming.state;group.visits=incoming.visits;Object.assign(group.flow,incoming.flow);
  for(const b of incoming.branches){const target=group.flow.branches[b.index];Object.assign(target,b);target.lake=lakes.get(b.lakeId);target.destination=lakes.get(b.destinationId);target.members.length=0;}
  for(const b of group.flow.branches)if(b.weave)b.weave.branches=b.weave.indices.map(i=>group.flow.branches[i]);
 }
 let i=0;const values=frame.values;
 for(const c of creatures){
  c.pos.x=values[i++];c.pos.y=values[i++];c.pos.z=values[i++];
  c.prev.x=values[i++];c.prev.y=values[i++];c.prev.z=values[i++];
  c.vel.x=values[i++];c.vel.y=values[i++];c.vel.z=values[i++];
  c.elastic.x=values[i++];c.elastic.y=values[i++];c.elastic.z=values[i++];
  c.oldVX=values[i++];
  c.oldVY=values[i++];
  c.oldVZ=values[i++];
  c.speed=values[i++];
  c.energy=values[i++];
  c.noteGlow=values[i++];
  c.notePhase=values[i++];
  c.noteAlarm=!!values[i++];
  c.yaw=values[i++];
  c.pitch=values[i++];
  c.bank=values[i++];
  c.bend=values[i++];
  c.turnRate=values[i++];
  c.effort=values[i++];
  c.stroke=values[i++];
  c.breath=values[i++];
  c.resting=!!values[i++];
  c.ground=values[i++];
  c.water=values[i++];
  c.prevStroke=values[i++];
  c.prevYaw=values[i++];
  c.prevPitch=values[i++];
  c.prevBank=values[i++];
  c.calls=values[i++];
  c.landed=!!values[i++];
  c.navigation=c.group.flow.branches[values[i++]];c.branch=c.navigation.index;c.navigation.members.push(c);
 }
 model.lumenTime=frame.time;
}

export {encodeCheckpoint,decodeCheckpoint} from './LumenCheckpoint.js?v=stable-30-20';
