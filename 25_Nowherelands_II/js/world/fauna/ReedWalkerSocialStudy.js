import { Random } from '../../core/Random.js';
import { ReedWalkerWorldModel } from './ReedWalkerWorldModel.js?v=player-notes-13';
import { reedFootprint } from './ReedWalkerHabitat.js?v=graze-1';

// Stage an encounter on the diorama, then run the production movement/controller.
// Other study gestures retain their original randomized family arrangements.
export function createReedSocialStudy(definitions, kind, seed) {
 const water=1+definitions[0].traits.depth;
 const sample=(x,z)=>({ground:1,water:Math.abs(x)<11&&Math.abs(z)<4.8?water:0,slope:0,foam:0});
 const model=new ReedWalkerWorldModel(seed,[],sample);model.socialEnabled=false;
 const side=seed%2?1:-1;
 const slots=kind==='lean'?[[-1,-1],[-5,2.5]]:[[0,-1],[-8,1.5]];
 const group={id:'atelier',seed,site:{x:0,z:0},members:[]};
 group.members=definitions.filter(m=>m.role==='mother'||m.role==='son').map((definition,i)=>{
  const traits={...definition.traits,stride:definition.traits.stride*3},origin={x:slots[i][0],y:1,z:slots[i][1]*side};
  const fit=reedFootprint(traits,origin,0,sample);
  if(!fit)throw new Error('This family needs more room for its gesture study.');
  return {...definition,...fit,group,origin,yaw:0,home:{...origin},scale:traits.scale,state:'stand',clock:0,rest:1000,nextCall:Infinity,steps:0,r:new Random(`social-study:${seed}:${i}`)};
 });
 model.groups.set(group.id,group);for(const m of group.members)model.pose(m);
 const child=group.members[1],parent=group.members[0];
 if(!model.beginSocial(group,kind,child,parent))throw new Error('No safe place for this family gesture.');
 if(kind==='catchup')parent.rest=0;
 return {kind,model,group,update(dt){
  // Two adult strides are enough to demonstrate the youngster noticing the gap.
  if(kind==='catchup'&&parent.steps>=2&&parent.state==='stand')parent.rest=parent.clock+1000;
  if(!group.moment)for(const m of group.members)if(m.state==='stand')m.rest=m.clock+1000;
  model.update(dt,{x:100,z:100});
 }};
}
