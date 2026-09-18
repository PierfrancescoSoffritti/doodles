import test from 'node:test';
import assert from 'node:assert/strict';
import { VegetationStudy } from '../../js/atelier/VegetationStudy.js';
import { atelierURL } from '../../js/atelier/AtelierCatalog.js';

test('identities are reproducible and mixed groups preserve the selected family forms', () => {
 for (const species of ['bell-reed','veil-willow']) {
  const options={species,form:'mixed',group:true,seed:'shore'};
  const a=new VegetationStudy(options),b=new VegetationStudy(options);
  assert.deepEqual(a.plants,b.plants);assert.equal(new Set(a.plants.map(p=>p.form)).size,3);
  assert.notDeepEqual(a.plants,new VegetationStudy({...options,serial:2}).plants);
 }
 const m=new VegetationStudy({form:'mixed',group:true});
 assert.equal(m.plants[0].stems.length,3);assert.ok(m.plants[1].stems.length>=5);assert.equal(m.plants[2].stems.length,4);
});

test('reeds restart their staggered sound and light phrase on repeated invitations without starvation', () => {
 const m=new VegetationStudy({group:true});
 assert.equal(m.offerNote(1,'fauna'),false);assert.equal(m.offerNote(1,'ambient'),false);
 assert.equal(m.offerNote(1),true);assert.equal(m.pending.length,8);
 assert.equal(new Set(m.pending.map(e=>e.plant)).size,3);
 assert.ok(m.plants.every(p=>p.stems.every(s=>s.energy===0)),'no blanket flash replaces the individual replies');
 m.update(.19);let events=m.drainEvents();assert.equal(events.filter(e=>e.kind==='reed').length,1);
 assert.ok(m.plants[0].stems[0].energy>0);assert.ok(m.plants[0].stems[1].energy<.001);
 for(let i=0;i<20;i++){
  m.offerNote(1);m.update(.2);events=m.drainEvents();
  assert.ok(events.some(e=>e.kind==='reed'),'every new blip earns a sounding reply during the old recovery window');
  assert.ok(m.pending.length<=8,'old unfinished phrases are replaced');
 }
 let replies=0;
 for(let i=0;i<40;i++){m.offerNote(1);m.update(.05);replies+=m.drainEvents().filter(e=>e.kind==='reed').length;}
 assert.ok(replies>=10,'even repeats faster than the first reply delay cannot starve the phrase');
 m.update(5);m.drainEvents();m.update(4);
 assert.ok(m.plants.every(p=>p.stems.every(s=>s.energy<.001)));assert.equal(m.pending.length,0);
 m.offerNote(0);assert.equal(m.pending.length,3);m.update(.6);
 assert.equal(m.drainEvents().filter(e=>e.kind==='reed').length,3);
});

test('pause freezes pending replies, light and visitor movement; response timing agrees across frame rates', () => {
 const a=new VegetationStudy(),b=new VegetationStudy();a.offerNote(1);b.offerNote(1);a.brush();b.brush();
 const before=JSON.stringify(a);a.update(0);assert.equal(JSON.stringify(a),before);
 for(let i=0;i<120;i++){a.update(1/30);b.update(1/60);b.update(1/60);}
 assert.equal(a.pending.length,0);assert.equal(b.pending.length,0);assert.equal(a.sequence,b.sequence);
 a.plants[0].stems.forEach((s,i)=>assert.ok(Math.abs(s.energy-b.plants[0].stems[i].energy)<1e-10));
 assert.equal(a.visitor().active,false);assert.equal(a.brushBend(a.plants[0]),0);
});

test('brushing is local, transient and never creates a musical cascade', () => {
 const m=new VegetationStudy({group:true});assert.equal(m.brush(),true);assert.equal(m.brush(),false);
 m.update(1.75);assert.ok(m.brushBend(m.plants[1])>m.brushBend(m.plants[0]));
 assert.equal(m.pending.length,0);assert.deepEqual(m.drainEvents().map(e=>e.kind),['brush']);
 m.update(3);assert.equal(m.brushBend(m.plants[1]),0);assert.equal(m.brush(),true);
});

test('pendants are optional and have independent bounded gestures', () => {
 const plain=new VegetationStudy({species:'veil-willow',pendants:false});assert.equal(plain.touchMirror(),false);
 const m=new VegetationStudy({species:'veil-willow',group:true});assert.equal(m.offerNote(),false);
 assert.equal(m.touchMirror(0,0),true);assert.equal(m.touchMirror(0,0),true);assert.equal(m.touchMirror(1,0),true);
 m.update(6);assert.ok(m.plants.every(p=>p.mirrors.every(s=>s.energy<.001)));assert.equal(m.touchMirror(0,0),true);
});

test('atelier routes preserve seeds and existing fauna links', () => {
 assert.equal(atelierURL('bell-reed','wet & quiet'),'./vegetation-atelier.html?species=bell-reed&seed=wet+%26+quiet');
 assert.equal(atelierURL('veil-willow'),'./vegetation-atelier.html?species=veil-willow');
 assert.equal(atelierURL('reed','shore'),'./reed-study.html?seed=shore');
 assert.equal(atelierURL('lumen'),'./fauna-atelier.html?species=lumen');
});


test('pendant clicks preserve pose and echo phase while adding bounded momentum across frame rates',()=>{
 const a=new VegetationStudy({species:'veil-willow'}),b=new VegetationStudy({species:'veil-willow'});
 a.touchMirror();b.touchMirror();
 for(let click=0;click<30;click++){
  for(let frame=0;frame<6;frame++){a.update(1/60);b.update(1/120);b.update(1/120);}
  const mirror=a.plants[0].mirrors[0],before=mirror.swing,echo=mirror.echoStart;
  a.touchMirror(0,0,1);b.touchMirror(0,0,1);
  assert.equal(mirror.swing,before,'a click cannot jump the pendant position');
  assert.equal(mirror.echoStart,echo,'an active contour keeps travelling');
  assert.ok(Math.abs(mirror.swing-b.plants[0].mirrors[0].swing)<1e-10);
 }
 for(let frame=0;frame<600;frame++){
  a.touchMirror(0,0,1);a.update(1/60);
  assert.ok(Math.abs(a.plants[0].mirrors[0].swing)<=.4,'even sustained spam stays within the suspension');
 }
 a.update(10);const mirror=a.plants[0].mirrors[0];
 assert.ok(Math.abs(mirror.swing)<.001&&Math.abs(mirror.swingVelocity)<.001);
 assert.ok(mirror.energy<.001);assert.equal(Math.abs(a.plants[0].mirrors[1].swing),0,'other pendants do not move from this click');
});
