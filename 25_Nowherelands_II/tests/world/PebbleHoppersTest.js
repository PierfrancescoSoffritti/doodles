import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaModel, habitatScore } from '../../js/world/fauna/FaunaModel.js';
import { pebbleGround } from '../../js/world/fauna/PebbleHoppers.js';

const flat = () => ({ ground: 2, water: -4, slope: 0.08, forest: 0.1, wet: 0.2, hardness: 0.8, foam: 0 });
function setup(seed = 'pebbles', sample = flat) {
	const model = new FaunaModel(seed, { sample });
	const group = model.addGroup('test', 'hopper', 0, 0, 1);
	assert.ok(group); model.listener = { x: 200, y: 13, z: 200 };
	return { model, group, c: group.members[0] };
}
function tick(model, seconds) { for (let i = 0; i < Math.round(seconds * 30); i++) model.step(1 / 30); }
function approach(model, c, distance = 4) { model.listener = { x: c.pos.x + distance, y: c.ground + 11, z: c.pos.z }; }

test('stone habitat favors dry rocky foothills and gravel, rejects sand, marsh, forest and cliffs', () => {
	const score = patch => habitatScore('hopper', { ...flat(), ...patch });
	assert.ok(score({ slope: 0.18 }) > score({ slope: 0 }));
	assert.ok(score({ ground: -1 }) > score({ ground: 12, slope: 0 }));
	for (const patch of [{ hardness: 0.2 }, { wet: 0.96 }, { forest: 0.9 }, { slope: 0.6 }, { ground: -3.7 }, { roof: true }]) assert.equal(score(patch), -Infinity);
});

test('colonies have separated animals, ordinary stones, and deterministic identities', () => {
	const a = setup(), b = setup();
	assert.ok(a.group.members.length >= 3 && a.group.members.length <= 6);
	assert.ok(a.group.stones.length > a.group.members.length);
	assert.deepEqual(a.group.stones, b.group.stones);
	assert.deepEqual(a.group.members.map(c => c.pos), b.group.members.map(c => c.pos));
	for (const c of a.group.members) for (const o of a.group.members) if (c !== o) assert.ok(Math.hypot(c.pos.x - o.pos.x, c.pos.z - o.pos.z) > (c.size + o.size) * 1.7);
});

test('undisturbed animals stay in place for minutes, with sparse small weight shifts and no automatic calls', () => {
	const { model, c } = setup(); const origin = { ...c.pos }; let calls = 0, shifts = 0;
	model.onCall = () => calls++;
	for (let i = 0; i < 3600; i++) {
		model.step(1 / 30); assert.equal(c.pos.x, origin.x); assert.equal(c.pos.z, origin.z);
		assert.equal(c.pebble.stand, 0); assert.equal(c.feet, null);
		if (c.pebble.idleTime >= 0) shifts++;
		assert.ok(Math.abs(c.bank) < 0.05); assert.ok(Math.abs(c.pos.y - origin.y) < 0.05);
	}
	assert.ok(shifts > 0 && shifts < 360, 'movement should occupy less than ten percent of resting time'); assert.equal(calls, 0);
});

test('approach at normal eye height unfolds, escapes away, brakes, and completely hides again', () => {
	for (const seed of ['pebbles', 'p1', 'p2', 'p3', 'p4', 'p5']) {
		const { model, c } = setup(seed); tick(model, 2); const origin = { ...c.pos }; approach(model, c);
		const states = new Set(); let firstMove = null, peak = 0, farthest = 0, safeDistance = 0, settled = false;
		for (let i = 0; i < 900; i++) {
			model.step(1 / 30); states.add(c.pebble.state); peak = Math.max(peak, c.speed);
			farthest = Math.max(farthest, Math.hypot(c.pos.x - origin.x, c.pos.z - origin.z)); safeDistance = Math.max(safeDistance, Math.hypot(c.pos.x - model.listener.x, c.pos.z - model.listener.z));
			if (firstMove === null && Math.hypot(c.pos.x - origin.x, c.pos.z - origin.z) > 0.2) firstMove = i / 30;
			if (i > 180 && c.pebble.stand === 0) settled = true;
			assert.equal(c.compression, 0, 'stone must remain rigid');
		}
		for (const s of ['rise', 'flee', 'brake', 'settle']) assert.ok(states.has(s), `${seed}: ${s}`);
		assert.ok(firstMove < 1, `${seed}: quick first reaction`); assert.ok(peak > 20);
		assert.ok(farthest > 40, `${seed}: scatter well beyond the starting patch`);
		assert.ok(safeDistance > 42, seed);
		assert.ok(settled); assert.equal(c.feet, null); assert.equal(c.pebble.escapes, 1, `${seed}: stationary player must not cause repeated panic`);
	}
});

test('running feet keep fixed ground contacts between swings and take alternating steps', () => {
	const sample = (x, z) => ({ ...flat(), ground: 2 + x * 0.08 + Math.sin(z * 0.12) * 0.3 });
	const { model, c } = setup('p1', sample); approach(model, c);
	let planted = 0, swings = 0;
	for (let i = 0; i < 800; i++) {
		const before = c.feet?.map(f => ({ pos: { ...f.pos }, swing: f.swing })); model.step(1 / 120);
		if (!before || !c.feet) continue;
		assert.ok(c.feet.filter(f => f.swing >= 0).length <= 1);
		for (let j = 0; j < 2; j++) {
			const f = c.feet[j];
			if (before[j].swing < 0 && f.swing < 0) { assert.deepEqual(f.pos, before[j].pos); planted++; }
			if (f.swing >= 0) { assert.ok(f.pos.y >= sample(f.pos.x, f.pos.z).ground - 0.03); swings++; }
		}
	}
	assert.ok(planted > 10 && swings > 10); assert.ok(c.pebble.steps >= 6);
});

test('running approaches trigger earlier than slow approaches, and flying or observation cameras do not scare stones', () => {
	function alarmAt(speed) {
		const { model, c, group } = setup('p1'); group.members = [c]; model.creatures = [c]; approach(model, c, 22); tick(model, 0.1);
		for (let i = 0; i < 900; i++) {
			model.listener.x -= speed / 30; model.step(1 / 30);
			if (c.pebble.alarmAt < Infinity || c.pebble.escapes) return Math.hypot(c.pos.x - model.listener.x, c.pos.z - model.listener.z);
		}
		throw new Error('never reacted');
	}
	assert.ok(alarmAt(18) > alarmAt(2) + 2);
	const { model, c } = setup(); approach(model, c); model.observing = true; tick(model, 5); assert.equal(c.pebble.escapes, 0);
	model.observing = false; model.listener.y = c.ground + 40; tick(model, 5); assert.equal(c.pebble.escapes, 0);
});

test('panic spreads with a delay to neighbors without repeatedly restarting their escapes', () => {
	const { model, group, c } = setup('p1');
	// A controlled patch, with a neighbor outside the player's own trigger radius.
	group.stones = []; const neighbor = group.members[1]; group.members = [c, neighbor]; model.creatures = group.members;
	c.pos = { x: 0, y: 2.55, z: 0 }; neighbor.pos = { x: -18, y: 2.55, z: 0 }; neighbor.temperament = 0.7;
	for (const animal of group.members) animal.prev = { ...animal.pos };
	approach(model, c); let first = Infinity, second = Infinity;
	for (let i = 0; i < 120; i++) { model.step(1 / 30); if (c.pebble.escapes && first === Infinity) first = i; if (neighbor.pebble.escapes && second === Infinity) second = i; }
	assert.ok(first < second && second - first < 25); assert.equal(neighbor.pebble.escapes, 1);
});

test('body footprints and entire escape paths respect water, steep terrain and physical obstacles', () => {
	const coast = (x, z) => ({ ...flat(), ground: z > 6 && z < 8 ? -6 : 2 });
	const { model, c, group } = setup('p1', coast); group.stones = [];
	model.environment.blocked = (x, z, radius) => Math.hypot(x + 4, z + 4) < 1.5 + radius;
	assert.equal(pebbleGround(model, 0, 5.4, 1), null, 'footprint overlaps water');
	approach(model, c);
	for (let i = 0; i < 450; i++) {
		model.step(1 / 30);
		assert.ok(c.pos.z < 4.8 || c.pos.z > 9.2);
		assert.ok(c.pos.y > coast(c.pos.x, c.pos.z).ground);
		assert.ok(Math.hypot(c.pos.x + 4, c.pos.z + 4) >= 1.5 + c.size * 1.35);
	}
});

test('continuous music neither exposes resting stones nor prevents a real escape', () => {
	const { model, c } = setup();
	for (let i = 0; i < 300; i++) { model.hear({ position: c.pos, strength: 1, layer: 'music' }); model.step(1 / 30); }
	assert.equal(c.pebble.state, 'rest'); assert.equal(c.calls, 0);
	approach(model, c); const origin = { ...c.pos };
	for (let i = 0; i < 150; i++) { model.hear({ position: c.pos, strength: 1, layer: 'music' }); model.step(1 / 30); }
	assert.ok(Math.hypot(c.pos.x - origin.x, c.pos.z - origin.z) > 5);
});

test('a second physical approach wakes a hidden animal without waiting for its idle timer', () => {
	const { model, c } = setup('p1'); approach(model, c); tick(model, 30);
	assert.equal(c.pebble.stand, 0); assert.equal(c.pebble.escapes, 1);
	const origin = { ...c.pos }; approach(model, c); tick(model, 2);
	assert.equal(c.pebble.escapes, 2);
	assert.ok(Math.hypot(c.pos.x - origin.x, c.pos.z - origin.z) > 3);
});

test('crowded colonies scatter without crossing their camouflage stones', () => {
	const { model, c, group } = setup('p4'); approach(model, c);
	for (let i = 0; i < 900; i++) {
		model.step(1 / 30);
		for (const rock of group.stones) assert.ok(Math.hypot(c.pos.x - rock.pos.x, c.pos.z - rock.pos.z) >= (c.size + rock.size) * 1.35 - 0.001);
	}
	assert.equal(c.pebble.escapes, 1); assert.equal(c.pebble.stand, 0);
});


test('every colony member rapidly scatters a long distance, regardless of temperament or initial proximity', () => {
	for (const seed of ['pebbles', 'p1', 'p2', 'p3', 'p4', 'p5']) {
		const { model, c, group } = setup(seed), origins = group.members.map(o => ({ ...o.pos }));
		let spread = 0; const travel = group.members.map(() => 0);
		const peak = group.members.map(() => 0), reaction = group.members.map(() => Infinity);
		approach(model, c);
		for (let i = 0; i < 900; i++) {
			model.step(1 / 30);
			group.members.forEach((o, j) => { peak[j] = Math.max(peak[j], o.speed); travel[j] = Math.max(travel[j], Math.hypot(o.pos.x - origins[j].x, o.pos.z - origins[j].z)); if (o.speed > 10) reaction[j] = Math.min(reaction[j], i / 30); });
			spread = Math.max(spread, Math.max(...group.members.map(o => o.pos.z)) - Math.min(...group.members.map(o => o.pos.z)));
		}
		group.members.forEach((o, j) => {
			assert.ok(reaction[j] <= 0.4, `${seed}/${j}: entire colony must react promptly`);
			assert.ok(peak[j] > 35, `${seed}/${j}: sprint must be much faster than the old scamper`);
			assert.ok(travel[j] > 40, `${seed}/${j}: retreat is too short`);
			assert.equal(o.pebble.stand, 0); assert.equal(o.pebble.escapes, 1);
		});
		assert.ok(spread > 25, 'scatter into separate directions');
	}
});

test('resting eyes take independent peeks without moving the stone or advancing locomotion randomness', () => {
	const { model, c } = setup(), origin = { ...c.pos }, rng = c.rnd.state;
	const extents = [[], []]; let different = 0;
	for (let i = 0; i < 210; i++) {
		model.step(1 / 30);
		c.pebble.eyes.forEach((e, j) => extents[j].push(e.extension));
		if (Math.abs(c.pebble.eyes[0].lift - c.pebble.eyes[1].lift) > 0.3) different++;
	}
	for (const values of extents) assert.ok(Math.max(...values) - Math.min(...values) > 0.3);
	assert.ok(different > 60); assert.equal(c.pos.x, origin.x); assert.equal(c.pos.z, origin.z);
	assert.equal(c.rnd.state, rng, 'eye glances must not consume movement randomness');
});

test('both eyes track the player across body headings, at long distances, during observation and high flight', () => {
	for (const yaw of [-3, -1, 0, 2.7]) {
		const { model, group, c } = setup(); model.creatures = group.members = [c]; c.yaw = c.prevYaw = yaw;
		model.listener = { x: c.pos.x + 19, y: c.ground + 11, z: c.pos.z + 3 }; tick(model, 2);
		for (const e of c.pebble.eyes) {
			const difference = Math.atan2(Math.sin(e.yaw - yaw - Math.atan2(3, 19)), Math.cos(e.yaw - yaw - Math.atan2(3, 19)));
			assert.ok(Math.abs(difference) < 0.04); assert.ok(e.pitch > 0.4); assert.ok(e.extension > 0.94);
		}
		assert.equal(c.pebble.escapes, 0);
		model.observing = true; model.listener = { x: c.pos.x - 400, y: c.ground + 200, z: c.pos.z + 300 }; tick(model, 3);
		for (const e of c.pebble.eyes) {
			const error = e.yaw - c.yaw - Math.atan2(300, -400);
			assert.ok(Math.abs(Math.atan2(Math.sin(error), Math.cos(error))) < 0.04);
			assert.ok(e.attention > 0.99); assert.ok(e.pitch > 0.3);
		}
		assert.equal(c.pebble.escapes, 0);
	}
});

test('eye stalks fully extend during escape with continuous snapshots', () => {
	const { model, c } = setup(); tick(model, 2); approach(model, c); let extended = false;
	for (let i = 0; i < 900; i++) {
		const before = c.pebble.eyes.map(e => ({ ...e })); model.step(1 / 30);
		c.pebble.eyes.forEach((e, j) => {
			assert.equal(e.prevExtension, before[j].extension); assert.equal(e.prevYaw, before[j].yaw);
			assert.ok(Math.abs(e.extension - e.prevExtension) < 0.42);
			assert.ok([e.yaw, e.pitch, e.extension].every(Number.isFinite));
		});
		if (c.speed > 20 && c.pebble.eyes.every(e => e.extension > 0.98 && e.escape > .95)) extended = true;
	}
	assert.ok(extended); assert.equal(c.pebble.stand, 0); assert.ok(c.pebble.eyes.every(e => e.extension > 0.35));
});

test('a panicked colony regroups quickly and no animal folds its legs until everyone has arrived', () => {
	for (const seed of ['pebbles', 'p1', 'p2', 'p3', 'p4', 'p5']) {
		const { model, group, c } = setup(seed); approach(model, c);
		let widest = 0, regrouped = 0, returnSpeed = 0, waiting = 0; const stood = new Set();
		for (let frame = 0; frame < 900; frame++) {
			model.step(1 / 30);
			if (frame < 600) widest = Math.max(widest, ...group.members.flatMap(o => group.members.map(p => Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z))));
			for (const o of group.members) {
				if (o.pebble.stand >= 0.999) stood.add(o);
				if (stood.has(o) && !group.members.every(p => p.pebble.reunited)) assert.ok(o.pebble.stand >= 0.999, `${seed}: folded before the colony reunited`);
				if (o.pebble.state === 'wait' && o.pebble.reunited) waiting++;
			}
			for (const o of group.members) if (o.pebble.state === 'regroup') {
				assert.ok(model.time >= 2.2); regrouped++; returnSpeed = Math.max(returnSpeed, o.speed / Math.sqrt(o.size));
				assert.ok(Math.hypot(o.pos.x - model.listener.x, o.pos.z - model.listener.z) > 18);
			}
		}
		assert.ok(widest > 95, `${seed}: scatter should span a wide range of directions`);
		assert.ok(regrouped > 60); assert.ok(waiting > 0); assert.ok(returnSpeed > 18 && returnSpeed < 26.1);
		for (const o of group.members) {
			assert.equal(o.pebble.escapes, 1); assert.equal(o.pebble.reunited, true, `${seed}: missing reunion`);
			assert.equal(o.pebble.stand, 0); assert.equal(o.feet, null);
			assert.ok(Math.hypot(o.pos.x - group.reunion.x, o.pos.z - group.reunion.z) < 20);
		}
	}
});

test('an intercepted reunion is abandoned and the colony scatters again', () => {
	const { model, group, c } = setup('p2'); approach(model, c); tick(model, 5);
	const returning = group.members.find(o => o.pebble.state === 'regroup'); assert.ok(returning);
	approach(model, returning, 2); tick(model, 1);
	assert.ok(returning.pebble.escapes >= 2); assert.equal(returning.pebble.returning, false);
	assert.ok(group.reunionAt > model.time + 1); assert.equal(group.reunion, null);
});

test('pupils dilate smoothly with proximity and contract when the player leaves', () => {
 const {model,c}=setup(); model.observing=true;
 model.listener={x:c.pos.x+80,y:c.ground+11,z:c.pos.z}; tick(model,2);
 assert.ok(c.pebble.eyes.every(e=>e.dilation<0.01));
 model.listener.x=c.pos.x+10; model.step(1/30);
 assert.ok(c.pebble.eyes.every(e=>e.dilation>0 && e.dilation<0.2 && e.prevDilation<0.01));
 tick(model,2); assert.ok(c.pebble.eyes.every(e=>e.dilation>0.9));
 model.listener.x=c.pos.x+80; tick(model,2); assert.ok(c.pebble.eyes.every(e=>e.dilation<0.01));
});

test('a late arrival can skirt waiting companions and finish the reunion on uneven ground', () => {
 const height=(x,z)=>Math.sin(x*.085)*.55+Math.sin(z*.11)*.4+x*.035;
 const sample=(x,z)=>({...flat(),ground:height(x,z),water:-8,slope:.12,forest:.08,hardness:.83});
 const model=new FaunaModel('pebble-study-4',{sample}),group=model.addGroup('stones','hopper',0,0,1),c=group.members[0];
 model.time=3; for(const o of group.members)o.born=-10;
 model.listener={x:c.pos.x+34,y:height(c.pos.x+34,c.pos.z)+11,z:c.pos.z}; tick(model,45);
 const destination=c.pos.x+3;
 for(let i=0;i<30*30;i++) {
  model.listener.x-=Math.min(Math.max(0,model.listener.x-destination),18/30);
  model.listener.y=height(model.listener.x,model.listener.z)+11; model.step(1/30);
 }
 assert.ok(group.members.every(o=>o.pebble.reunited && o.pebble.stand===0));
});

test('a confined colony does not repeat thousands of failed route probes on every foot substep', () => {
 let samples=0;
 const sample=(x,z)=>{samples++;return {...flat(),water:Math.hypot(x,z)<28?-4:10};};
 const {model,group,c}=setup('bounded-pebbles',sample);approach(model,c);
 let peak=0;
 for(let frame=0;frame<600;frame++) {
  samples=0;model.step(1/30);peak=Math.max(peak,samples);
  for(const o of group.members)assert.ok(o.ground>sample(o.pos.x,o.pos.z).water+.4);
 }
 assert.ok(peak<2200,`A single update performed ${peak} terrain queries`);
 assert.ok(group.members.every(o=>o.pebble.escapes>0));
});


test('a cautious stationary approach starts an escape before the player reaches ten units', () => {
 const {model,group,c}=setup('p1'); model.creatures=group.members=[c]; c.temperament=0;
 approach(model,c,11); tick(model,.4);
 assert.equal(c.pebble.escapes,1); assert.ok(c.speed>10);
});

test('a sustained chase keeps extending the escape until the current player is safely distant', () => {
 for(const seed of ['p1','p2','p3']) {
  const {model,group,c}=setup(seed); model.creatures=group.members=[c]; group.stones=[];
  approach(model,c,11); tick(model,.3);
  const origin={...c.pos};
  for(let frame=0;frame<300;frame++) {
   // Follow from beyond the initial startle radius, including past old refuges.
   const dx=model.listener.x-c.pos.x,dz=model.listener.z-c.pos.z,d=Math.hypot(dx,dz);
   model.listener={x:c.pos.x+dx/d*24,y:c.ground+11,z:c.pos.z+dz/d*24};
   model.step(1/30);
   assert.ok(['rise','flee'].includes(c.pebble.state),`${seed}: stopped during pursuit: ${c.pebble.state}`);
  }
  assert.ok(Math.hypot(c.pos.x-origin.x,c.pos.z-origin.z)>150);
  assert.equal(c.pebble.escapes,1,'continuation must not restart the unfolding animation');
  tick(model,30);
  assert.equal(c.pebble.stand,0,'settles after leaving the player behind');
  assert.ok(Math.hypot(c.pos.x-model.listener.x,c.pos.z-model.listener.z)>=42);
 }
});


test('a chase that catches a braking pebble resumes escape outside the initial startle radius', () => {
 const {model,group,c}=setup('p2');model.creatures=group.members=[c];group.stones=[];
 approach(model,c,11);
 for(let i=0;i<300 && c.pebble.state!=='brake';i++)model.step(1/30);
 assert.equal(c.pebble.state,'brake');
 model.listener={x:c.pos.x+30,y:c.ground+11,z:c.pos.z};
 model.previousListener={x:model.listener.x+0.6,z:model.listener.z};
 model.step(1/30);
 assert.ok(['rise','flee'].includes(c.pebble.state));
});


test('running pebbles accelerate as the player closes in and exceed player sprint speed',()=>{
 const {model,group,c}=setup('p1');model.creatures=group.members=[c];group.stones=[];
 approach(model,c,11);tick(model,.4);
 c.yaw=0;c.pos={x:0,y:3.5,z:0};c.pebble.refuge={x:10000,z:0};c.pebble.state='flee';c.pebble.heading=0;
 const follow=(gap)=>{for(let i=0;i<30;i++){model.listener={x:c.pos.x-gap,y:c.ground+11,z:0};model.step(1/30);}return c.speed;};
 const distant=follow(36),near=follow(10);
 assert.ok(near>distant+40,`${distant} -> ${near}`);
 assert.ok(near>100,'close pursuit must outrun the player’s 80-unit sprint');
 const away=follow(40);assert.ok(away<near-35,'calms back to cruising speed as the gap grows');
});

test('fast escape sweeps across thin walls instead of tunnelling between frame endpoints',()=>{
 const {model,group,c}=setup('p1');model.creatures=group.members=[c];group.stones=[];
 c.pos={x:0,y:3.5,z:0};c.prev={...c.pos};c.yaw=0;c.pebble.state='flee';c.pebble.stand=1;
 c.pebble.refuge={x:100,z:0};c.pebble.origin={...c.pos};c.pebble.alarmSource={x:-8,z:0};c.speed=138;
 model.environment.blocked=(x,z,r)=>Math.abs(x-3)<r+.2;
 for(let i=0;i<60;i++) {model.listener={x:c.pos.x-8,y:13,z:c.pos.z};model.step(1/30);assert.ok(c.pos.x<3-c.size*1.35);}
});

test('a long outdoor chase survives streaming far beyond the original colony',()=>{
 const {model,group,c}=setup('long-streamed-chase');group.stones=[];group.members=model.creatures=[c];
 const home={...group.home};approach(model,c);
 for(let i=0;i<1500;i++) {
  const dx=model.listener.x-c.pos.x,dz=model.listener.z-c.pos.z,d=Math.hypot(dx,dz)||1;
  model.listener={x:c.pos.x+dx/d*14,y:c.ground+11,z:c.pos.z+dz/d*14};
  model.step(1/30);if(i%15===0)model.removeFar(model.listener);
  assert.ok(model.creatures.includes(c),'nearby chased animal was unloaded');
 }
 assert.ok(Math.hypot(c.pos.x-home.x,c.pos.z-home.z)>1000,'exercise a chase beyond the home unload radius');
 model.removeFar({x:c.pos.x+5000,z:c.pos.z+5000});
 assert.equal(model.groups.has(group.id),false,'distant abandoned colonies still unload');
});

test('making room for cave colonies preserves nearby animals whose homes are distant',()=>{
 const {model,group,c}=setup('stream-cap');
 c.pos.x=3000;model.listener={x:3010,y:13,z:c.pos.z};
 // Fill the population cap with other groups, leaving a truly distant candidate.
 for(let i=0;model.creatures.length<24;i++)model.addGroup('extra-'+i,'hopper',i*200,500,1);
 const distant=[...model.groups.values()].filter(g=>g!==group);
 assert.equal(model.reservePebbleSpace(model.listener),true);
 assert.ok(model.groups.has(group.id));assert.ok(model.creatures.includes(c));
 assert.ok(distant.some(g=>!model.groups.has(g.id)),'evict a genuinely distant colony');
 for(const o of model.creatures)o.pos={...model.listener};
 const before=model.creatures.slice();
 assert.equal(model.reservePebbleSpace(model.listener,24),false,'defer new spawns while existing animals remain visible');
 assert.deepEqual(model.creatures,before);
});

test('an outdoor pebble makes occasional smooth evasive turns during a sustained chase',()=>{
 const {model,group,c}=setup('evasive-chase');group.stones=[];group.members=model.creatures=[c];approach(model,c);
 const headings=[];let prev=c.yaw,maxTurn=0,awaySteps=0,movingSteps=0;
 for(let i=0;i<540;i++) {
  // Follow its current heading instead of steering from a fixed world direction.
  model.listener={x:c.pos.x-Math.cos(c.yaw)*14,y:c.ground+11,z:c.pos.z+Math.sin(c.yaw)*14};
  model.step(1/30);
  if(i>45) {
   const delta=Math.atan2(Math.sin(c.yaw-prev),Math.cos(c.yaw-prev));maxTurn=Math.max(maxTurn,Math.abs(delta));
   if(i%15===0)headings.push(c.yaw);
   if(c.speed>10){movingSteps++;if(c.vel.x*(c.pos.x-model.listener.x)+c.vel.z*(c.pos.z-model.listener.z)>0)awaySteps++;}
  }
  prev=c.yaw;
 }
 let turns=0;
 for(let i=1;i<headings.length;i++)if(Math.abs(Math.atan2(Math.sin(headings[i]-headings[i-1]),Math.cos(headings[i]-headings[i-1])))>.35)turns++;
 assert.ok(turns>=3,'change heading several times during the chase');
 assert.ok(turns<18,'leave pauses between evasive turns');
 assert.ok(maxTurn<.3,'turn smoothly without snapping');
 assert.ok(awaySteps>movingSteps*.95,'keep fleeing away from the pursuer');
});

test('each eye blinks independently while idle stalks make larger vertical movements',()=>{
 const {model,c}=setup('blinking'), origin={...c.pos};
 const blinks=[0,0],lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 for(let i=0;i<1200;i++) {
  const before=c.pebble.eyes.map(e=>e.blink);model.step(1/30);
  c.pebble.eyes.forEach((e,j)=>{
   if(e.blink>.7 && before[j]<=.7)blinks[j]++;
   assert.equal(e.prevBlink,before[j]);assert.ok(e.blink>=0 && e.blink<=1);
   lo[j]=Math.min(lo[j],e.lift);hi[j]=Math.max(hi[j],e.lift);
  });
  assert.ok(c.pebble.eyes.filter(e=>e.blink>.05).length<=1,'eyes should not blink together');
 }
 for(let j=0;j<2;j++){assert.ok(blinks[j]>=3 && blinks[j]<=12);assert.ok(hi[j]-lo[j]>2,'larger idle bob');}
 assert.equal(c.pos.x,origin.x);assert.equal(c.pos.z,origin.z);
});

test('pebbles have deterministic, independently varied bodies, eyeballs and stalk lengths',()=>{
 const bodies=[],eyes=[],stalks=[];
 for(let i=0;i<10;i++) {
  const a=setup('variation-'+i),b=setup('variation-'+i);
  const traits=c=>[c.size,...c.pebble.eyes.flatMap(e=>[e.radiusScale,e.lengthScale])];
  assert.deepEqual(a.group.members.map(traits),b.group.members.map(traits));
  for(const c of a.group.members){bodies.push(c.size);eyes.push(c.pebble.eyes[0].radiusScale);stalks.push(c.pebble.eyes[0].lengthScale);}
 }
 for(const values of [bodies,eyes,stalks])assert.ok(Math.max(...values)/Math.min(...values)>1.6);
});

test('pebbles on a rounded summit can flee down the surrounding mountain slope',()=>{
 const sample=(x,z)=>{const r=Math.hypot(x,z);return {...flat(),ground:100-Math.max(0,r-10)*.8,slope:r<10?0:.8,water:-100};};
 const {model,group,c}=setup('summit',sample);group.stones=[];
 approach(model,c);const travel=group.members.map(()=>0),origins=group.members.map(o=>({...o.pos}));
 for(let i=0;i<180;i++) {
  model.step(1/30);
  group.members.forEach((o,j)=>{travel[j]=Math.max(travel[j],Math.hypot(o.pos.x-origins[j].x,o.pos.z-origins[j].z));assert.ok(o.pos.y>=sample(o.pos.x,o.pos.z).ground+.5*o.size);});
 }
 assert.ok(travel.every(d=>d>35),'every animal needs a downhill escape');
});

test('colonies do not spawn on isolated peaks surrounded by sheer drops',()=>{
 const sample=(x,z)=>({...flat(),ground:Math.hypot(x,z)<9?30:0});
 const model=new FaunaModel('isolated-peak',{sample});
 model.addGroup('peak','hopper',0,0,1);
 assert.ok(model.creatures.every(c=>c.ground===0),'place animals on the surrounding safe ground or skip the colony');
});
