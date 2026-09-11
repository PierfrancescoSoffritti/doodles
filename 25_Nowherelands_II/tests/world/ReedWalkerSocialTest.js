import test from 'node:test';
import assert from 'node:assert/strict';
import { reedFamily } from '../../js/world/fauna/ReedWalkerTraits.js';
import { reedPoseFits } from '../../js/world/fauna/ReedWalkerMotion.js';
import { createReedSocialStudy } from '../../js/world/fauna/ReedWalkerSocialStudy.js?v=pebble-voice-4b';
import { ReedWalkerWorldModel } from '../../js/world/fauna/ReedWalkerWorldModel.js?v=pebble-voice-4b';
import { socialDistance } from '../../js/world/fauna/ReedWalkerSocial.js';

for(const kind of ['catchup','lean'])test(`${kind}: families complete the interaction with planted contacts and reachable legs`,()=>{
 for(const form of ['reedbed','peat','tarn'])for(let seed=1;seed<=12;seed++){
  const study=createReedSocialStudy(reedFamily(form,seed),kind,seed),g=study.group,parent=g.members[0],child=g.members[1];
  const phases=new Set(),previous=new Map();let contactFrames=0,maxDistance=0,childTravel=0;
  for(let frame=0;frame<65*30;frame++){
   study.update(1/30);phases.add(g.moment?.phase||'complete');
   maxDistance=Math.max(maxDistance,socialDistance(child.draw.origin,parent.draw.origin));
   for(const m of g.members){
    const old=previous.get(m);
    assert.ok(reedPoseFits(m.traits,m.draw.pose, m.draw.pose.feet,0),'constant-length legs remain reachable');
    if(old){
     assert.ok(Math.hypot(m.position.x-old.position.x,m.position.y-old.position.y,m.position.z-old.position.z)<.4,'no snap between social phases');
     if(m.state==='stand'&&old.state==='stand')assert.deepEqual(m.draw.feet,old.feet,'planted pads do not slide');
     if(m===child)childTravel+=socialDistance(m.draw.origin,old.origin);
    }
    previous.set(m,{state:m.state,feet:m.draw.feet.map(f=>({...f})),origin:{...m.draw.origin},position:{...m.position}});
   }
   if(g.moment?.phase==='lean'){
    contactFrames++;assert.equal(parent.state,'stand');assert.equal(child.state,'stand');
    assert.ok(socialDistance(parent.origin,child.origin)<3.6,'youngster settles alongside the parent');
   }
  }
  assert.ok(phases.has('complete'));
  assert.ok(phases.has(kind==='lean'?'lean':'catchup'));
  assert.ok(childTravel>2,'the youngster actually approaches rather than pivoting in place');
  if(kind==='lean')assert.ok(contactFrames>300,'a sustained lean, not a passing collision');
  else assert.ok(socialDistance(parent.origin,child.origin)<maxDistance-2,'catching up closes the gap');
 }
});

test('an unsafe approach gives up without crossing deep water or interrupting a grazing parent',()=>{
 const s=createReedSocialStudy(reedFamily('reedbed',1),'lean',1),g=s.group,child=g.members[1],parent=g.members[0];
 const origin={...child.origin};s.model.blocked=()=>true;
 for(let i=0;i<60*30;i++)s.update(1/30);
 assert.equal(g.moment,null);assert.deepEqual(child.origin,origin);
 parent.state='graze';
 assert.equal(s.model.beginSocial(g,'lean',child,parent),false);
});

test('world families discover both moments without atelier triggers',()=>{
 const sample=()=>({ground:1,water:1.4,slope:0,foam:0}),site={id:'social',x:0,z:0,yaw:0,radius:26,form:'reedbed',water:1.4};
 const model=new ReedWalkerWorldModel('social-auto',[site],sample),group=model.add(site),phases=new Set();
 for(let frame=0;frame<900*30;frame++){
  model.update(1/30,{x:100,z:100});
  if(group.moment){phases.add(group.moment.phase);assert.equal(group.moment.child.traits.age,'young');assert.notEqual(group.moment.parent.traits.age,'young');}
 }
 for(const phase of ['distracted','catchup','approach','lean'])assert.ok(phases.has(phase));
 assert.ok(group.socialCount>=4);
});
