import test from 'node:test';
import assert from 'node:assert/strict';
import { StructureStudy, structureParts, foldMusic } from '../../js/atelier/StructureStudy.js';
import { atelierURL } from '../../js/atelier/AtelierCatalog.js';

test('all three structures leave a walkable central passage from either side',()=>{
 for(const kind of ['resonant-gate','listening-fold','horizon-frame']){
  const s=new StructureStudy({kind});s.visitor={x:0,z:60};s.move(0,-120);
  assert.ok(s.visitor.z<-59,kind+' must not have an invisible barrier across its opening');
  s.move(0,120);assert.ok(s.visitor.z>59);
  for(const b of s.bounds){s.visitor={x:(b.minX+b.maxX)/2,z:60};s.move(0,-120);assert.ok(s.visitor.z>=b.maxZ,'large movement cannot tunnel through '+kind);}
 }
});
test('fold music is spatial, eases across its threshold and restores outside',()=>{
 const s=new StructureStudy({kind:'listening-fold'});
 assert.equal(s.shelterAt({x:0,z:40}),0);assert.equal(s.shelterAt({x:0,z:0}),1);
 assert.ok(s.shelterAt({x:0,z:32})>0&&s.shelterAt({x:0,z:32})<1);
 s.visitor={x:0,z:0};for(let i=0;i<180;i++)s.update(1/60);assert.ok(s.shelter>.99);
 const inside=foldMusic(s.shelter);assert.ok(inside.arpeggio<.31&&inside.drone>1&&inside.density<.41);
 s.visitor={x:0,z:40};for(let i=0;i<240;i++)s.update(1/60);assert.ok(s.shelter<.001);
 assert.equal(foldMusic(0).arpeggio,1);assert.equal(foldMusic(0).drone,1);
 const gate=new StructureStudy();assert.equal(gate.shelterAt({x:0,z:0}),0);
});
test('every structure acknowledges repeated player notes and resonance stays bounded',()=>{
 for(const kind of ['resonant-gate','listening-fold','horizon-frame']){
  const s=new StructureStudy({kind});s.visitor={x:0,z:200};assert.equal(s.offerNote(),false);
  s.visitor={x:0,z:80};assert.equal(s.offerNote('reply'),false);
  for(let i=0;i<30;i++){assert.equal(s.offerNote(),true);assert.equal(s.offerNote(),false,'duplicate input in one frame is suppressed');s.update(.18);}
  assert.equal(s.responses,30);assert.ok(s.energy>.75&&s.energy<=1);assert.ok(s.flash>.5);
  s.update(30);assert.ok(s.energy<.001&&s.flash<.001);
 }
});
test('proportions are seeded and every atelier route preserves its seed',()=>{
 assert.deepEqual(structureParts('resonant-gate','a',1),structureParts('resonant-gate','a',1));
 assert.notDeepEqual(structureParts('resonant-gate','a',1),structureParts('resonant-gate','a',2));
 for(const kind of ['resonant-gate','listening-fold','horizon-frame'])assert.equal(atelierURL(kind,'quiet shore'),'./structure-atelier.html?species='+kind+'&seed=quiet+shore');
 assert.equal(atelierURL('reed','umbra'),'./reed-study.html?seed=umbra');
 assert.equal(atelierURL('lumen','umbra'),'./fauna-atelier.html?species=lumen&seed=umbra');
});

test('rapid blips overlap independent light journeys without restarting old pulses',()=>{
 const s=new StructureStudy(),ages=s.pulseAges;
 for(let i=0;i<100;i++){
  const before=Array.from(ages);assert.equal(s.offerNote(),true);
  for(let j=0;j<ages.length;j++)if(before[j]>=0)assert.equal(ages[j],before[j],'a new note cannot reset an active pulse');
  assert.ok(ages.some(a=>a===0),'each accepted note has its own pulse');s.update(.125);
 }
 assert.equal(s.pulseAges,ages,'fixed storage is reused');assert.ok(ages.filter(a=>a>=0).length>1);
 s.update(1);assert.ok(ages.every(a=>a<0),'all pulses finish and retire');
});
