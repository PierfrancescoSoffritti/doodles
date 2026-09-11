import test from 'node:test';
import assert from 'node:assert/strict';
import { lanternHabitat, lanternBarkSite } from '../../js/world/fauna/LanternMiteHabitat.js';
import { LanternMiteColony } from '../../js/world/fauna/LanternMiteWorldModel.js?v=pebble-voice-4b';

const sample = () => ({ ground: 0, water: -5, slope: 0.1, forest: 0.7, wet: 0.5, coast: 0, roof: false });
const host = { id: 'tree-a', x: 0, y: 0, z: 0, radius: 10 };
const bark = x => Math.sqrt(11.5 ** 2 - x ** 2);
const site = () => lanternBarkSite(host, sample, bark, 'umbra', 0);
const step = (colony, seconds, player, options = {}) => {
 for (let frame = 0; frame < seconds * 60; frame++) colony.update(1 / 60, player, options);
};

test('habitats reject wet feet, steep or exposed terrain, cave openings and missing bark', () => {
 assert.ok(lanternHabitat(sample()));
 for (const change of [{ water: 0 }, { slope: 0.5 }, { forest: 0 }, { wet: 0 }, { coast: 0.8 }, { roof: true }, { ground: NaN }]) {
  assert.equal(lanternHabitat({ ...sample(), ...change }), false);
 }
 assert.equal(lanternBarkSite(host, sample, () => NaN, 'umbra', 0), null);
 assert.equal(lanternBarkSite(host, (x, z) => ({ ...sample(), water: x > 15 ? 2 : -5 }), bark, 'umbra', 0), null, 'a dry tree with flooded flight space is rejected');
});

test('curved bark mapping keeps bodies outside the trunk and above terrain through repeated encounters', () => {
 const colony = new LanternMiteColony(site());
 for (let frame = 0; frame < 120 * 60; frame++) {
  const z = frame % 1800 < 1200 ? 3.6 : 7;
  const player = { ...colony.site.point({ x: 0, y: 1, z }), y: 11 };
  colony.update(1 / 60, player);
  for (const m of colony.model.mites) {
   const p = colony.position(m), radius = m.size * colony.site.scale;
   assert.ok(Object.values(p).every(Number.isFinite));
   assert.ok(Math.hypot(p.x, p.z) - radius >= 11.5 - 0.05, 'body outside curved bark');
   assert.ok(p.y - radius > 3, 'body clears ground and the lowest vegetation');
  }
 }
});

test('a real quiet visitor earns a call; an observer or high flyer does not', () => {
 for (const mode of ['player', 'observer', 'high']) {
  const colony = new LanternMiteColony(site()), player = { ...colony.site.point({ x: 0, y: 1, z: 3.6 }), y: mode === 'high' ? 90 : 11 };
  step(colony, 18, player, { active: mode !== 'observer' });
  assert.equal(colony.model.mites[2].visitorContacts > 0, mode === 'player', mode);
 }
});

test('sprinting nearby triggers retreat while a teleport does not', () => {
 const colony = new LanternMiteColony(site());
 let p = { ...colony.site.point({ x: 0, y: 1, z: 4 }), y: 11 }; step(colony, 2, p);
 p = { ...p, x: p.x - 70 / 60 }; colony.update(1 / 60, p);
 assert.ok(colony.model.mites.every(m => m.state === 'retreat'));
 const other = new LanternMiteColony(site()); step(other, 2, { ...p, x: 1000 });
 other.update(1 / 60, p);
 assert.ok(other.model.mites.every(m => m.state !== 'retreat'));
});

test('weather shelter suppresses all calls and later releases the colony', () => {
 const colony = new LanternMiteColony(site()), p = colony.site.arrival, sounds = [];
 colony.onSound = (m, reply) => sounds.push({ id: m.id, reply });
 step(colony, 8, p, { sheltered: true });
 assert.ok(colony.model.mites.every(m => m.state === 'hidden'));
 assert.equal(sounds.length, 0);
 step(colony, 20, p, { sheltered: false });
 assert.ok(colony.model.mites.every(m => !['hidden', 'retreat', 'emerge'].includes(m.state)));
 assert.ok(sounds.length > 0);
});

test('world audio forwards each social event once with world coordinates and colony identity', () => {
 const colony = new LanternMiteColony(site()), events = [];
 colony.onSound = (m, reply) => events.push({ time: colony.model.time, id: m.id, pos: m.pos, colonyId: m.colonyId, reply });
 step(colony, 40, colony.site.arrival);
 assert.ok(events.length > 2 && events.length < 15);
 assert.equal(new Set(events.map(e => `${e.time}:${e.id}`)).size, events.length);
 assert.ok(events.every(e => e.pos.x > 10 && e.colonyId === host.id));
});

test('a player note earns one delayed answer after travel, while background music and distant notes do not',()=>{
 const colony=new LanternMiteColony(site()),p={...colony.site.point({x:0,y:1,z:3.6}),y:11};step(colony,2,p);
 for(const layer of ['bells','sequencer','footstep','meteor'])assert.equal(colony.hearNote({position:p,velocity:0.4,layer}),false);
 assert.equal(colony.hearNote({position:{...p,x:999},velocity:0.4,layer:'lantern-player'}),false);
 assert.equal(colony.hearNote({position:p,velocity:0.35,layer:'lantern-player'}),true);
 const subject=colony.model.mites.find(m=>m.state==='orient'),start={...subject.pos},when=colony.model.time,answers=new Map();
 assert.ok(subject);assert.equal(colony.hearNote({position:p,velocity:0.2,layer:'lantern-player'}),false,'same-instant layered tones do not count twice');
 for(let i=0;i<12*60;i++){
  colony.update(1/60,p);
  for(const e of colony.model.events)if(e.kind==='player-note')answers.set(`${e.id}:${e.time}`,e);
 }
 assert.equal(answers.size,1);const answer=[...answers.values()][0];assert.equal(answer.id,subject.id);assert.equal(answer.reply,true);assert.ok(answer.time-when>1);
 assert.ok(Math.hypot(subject.noteTarget.x-start.x,subject.noteTarget.y-start.y,subject.noteTarget.z-start.z)>0.5);
});

test('rapid notes cancel a pending answer and shelter suppresses new conversations',()=>{
 const colony=new LanternMiteColony(site()),p={...colony.site.point({x:0,y:1,z:3.6}),y:11},note={position:p,velocity:0.35,layer:'lantern-player'};
 step(colony,2,p);colony.hearNote(note);step(colony,0.3,p);colony.hearNote(note);step(colony,0.3,p);colony.hearNote(note);
 assert.ok(colony.model.mites.every(m=>m.state==='retreat'));
 step(colony,4,p);assert.equal(colony.model.events.filter(e=>e.kind==='player-note').length,0);
 step(colony,15,p);assert.equal(colony.hearNote({...note,velocity:0.95}),true);assert.ok(colony.model.mites.every(m=>m.state==='retreat'));
 step(colony,10,p,{sheltered:true});assert.equal(colony.hearNote(note),false);
});
