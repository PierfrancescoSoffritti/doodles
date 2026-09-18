import test from 'node:test';
import assert from 'node:assert/strict';
import { VegetationStudy, reedVoice } from '../../js/atelier/VegetationStudy.js';
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

test('reeds answer promptly with synchronized sound and light and keep rapid invitations bounded', () => {
 const m=new VegetationStudy({group:true});
 assert.equal(m.offerNote(1,'fauna'),false);assert.equal(m.offerNote(1,'ambient'),false);
 assert.equal(m.offerNote(.6),true);assert.equal(m.pending.length,6);
 assert.equal(new Set(m.pending.map(e=>e.plant)).size,3);
 assert.ok(m.plants.every(p=>p.stems.every(s=>s.energy===0)),'no blanket flash replaces the individual replies');
 m.update(.19);let events=m.drainEvents();assert.equal(events.filter(e=>e.kind==='reed').length,1);
 const first=events.find(e=>e.kind==='reed');assert.ok(m.plants[first.plant].stems[first.part].energy>.01);
 assert.equal(m.plants.flatMap(p=>p.stems).filter(s=>s.energy>.01).length,1,'only the answering flower lights up');
 for(let i=0;i<20;i++){
  m.offerNote(.6);m.update(.2);events=m.drainEvents();
  assert.ok(events.some(e=>e.kind==='reed'),'every new blip earns a sounding reply during the old recovery window');
  assert.ok(m.pending.length<=8,'future answers stay bounded');
 }
 let replies=0;
 for(let i=0;i<40;i++){m.offerNote(.6);m.update(.05);replies+=m.drainEvents().filter(e=>e.kind==='reed').length;}
 assert.ok(replies>=10,'even repeats faster than the first reply delay cannot starve the phrase');
 m.update(5);m.drainEvents();m.update(4);
 assert.ok(m.plants.every(p=>p.stems.every(s=>s.energy<.001)));assert.equal(m.pending.length,0);
 m.offerNote(0);const count=m.pending.length;assert.ok(count>=2&&count<=3);m.update(1);
 assert.equal(m.drainEvents().filter(e=>e.kind==='reed').length,count);
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


test('aimed flowers lead while varied replies eventually include every flower regardless of distance',()=>{
 const m=new VegetationStudy({form:'mixed',group:true}),target={plant:2,part:3};
 m.plants[2].x=1000; // Being far from the implied listener must not exclude a reply.
 const heard=new Set(),orders=[];
 for(let i=0;i<35;i++){
  m.offerNote(0,'player',target);
  const invitation=m.drainEvents().find(e=>e.kind==='invitation');
  assert.equal(invitation.plant,target.plant);assert.equal(invitation.part,target.part);
  assert.ok(m.pending[0].at-m.time<.08);
  m.update(.06);
  const first=m.drainEvents().find(e=>e.kind==='reed');
  assert.equal(first.plant,target.plant);assert.equal(first.part,target.part);
  m.update(2);
  const replies=m.drainEvents().filter(e=>e.kind==='reed');
  orders.push(replies.map(e=>`${e.plant}:${e.part}`).join(','));
  for(const e of [first,...replies])heard.add(`${e.plant}:${e.part}`);
 }
 assert.equal(heard.size,m.plants.flatMap(p=>p.stems).length,'no flower is starved');
 assert.ok(new Set(orders).size>10,'replies vary rather than repeating a fixed phrase');
});

test('untargeted taps vary their lead and preserve already travelling replies',()=>{
 const m=new VegetationStudy();m.offerNote();const first=m.pending[0],tail={...m.pending[1]};
 m.update(.1);m.drainEvents();m.offerNote();
 assert.notEqual(m.pending[0].part,first.part);
 assert.ok(m.pending.some(e=>e.part===tail.part&&e.at===tail.at));
 const heard=new Set();
 for(let i=0;i<50;i++){m.update(.2);for(const e of m.drainEvents())if(e.kind==='reed')heard.add(e.part);m.offerNote();}
 assert.equal(heard.size,m.plants[0].stems.length);
});

test('answering flowers nod visibly, keep their pose on repeated clicks and settle across frame rates',()=>{
 const a=new VegetationStudy(),b=new VegetationStudy(),target={plant:0,part:0};
 for(let click=0;click<20;click++){
  a.offerNote(0,'player',target);b.offerNote(0,'player',target);
  for(let frame=0;frame<12;frame++){
   a.update(1/60);b.update(1/120);b.update(1/120);
   assert.ok(Math.abs(a.plants[0].stems[0].nod-b.plants[0].stems[0].nod)<1e-9);
   assert.ok(Math.abs(a.plants[0].stems[0].nod)<=.48);
  }
  const stem=a.plants[0].stems[0],pose=stem.nod;a.offerNote(0,'player',target);b.offerNote(0,'player',target);assert.equal(stem.nod,pose);
  if(click===0)assert.ok(Math.abs(pose)>.18,'the first answer makes a visible nod');
 }
 a.update(10);assert.equal(a.plants[0].stems[0].nod,0);
});

test('charged blips synchronize every flower; small flowers retain higher, quicker voices',()=>{
 const soft=new VegetationStudy({form:'mixed',group:true}),held=new VegetationStudy({form:'mixed',group:true});
 soft.offerNote(0);held.offerNote(1);
 assert.equal(held.pending.length,held.plants.flatMap(p=>p.stems).length);
 assert.equal(new Set(held.pending.map(e=>e.at)).size,1);
 held.update(.02);assert.ok(held.plants.every(p=>p.stems.every(s=>s.energy<1e-6)));
 held.update(.04);assert.ok(held.plants.every(p=>p.stems.every(s=>s.energy>0&&s.nod>0)));
 const replies=held.drainEvents().filter(e=>e.kind==='reed');assert.equal(replies.length,held.plants.flatMap(p=>p.stems).length);
 assert.equal(new Set(replies.map(e=>e.time)).size,1);
 held.offerNote(1,'player',{plant:2,part:0},.12);
 assert.equal(new Set(held.pending.map(e=>e.at)).size,1);
 assert.ok(Math.abs(held.pending[0].at-held.time-.045)<1e-9,'charged notes ignore target staggering');assert.equal(new Set(held.pending.map(e=>e.plant)).size,3);
 assert.ok(held.pending[0].strength>soft.pending[0].strength);
 const big=reedVoice({scale:1},{size:.39}),small=reedVoice({scale:.5},{size:.24});
 assert.ok(small.degree>big.degree);assert.ok(small.decay<big.decay);assert.ok(small.attack<big.attack);
});
