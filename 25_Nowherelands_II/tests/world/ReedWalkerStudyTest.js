import test from 'node:test';
import assert from 'node:assert/strict';
import { reedFamily, reedIndividual, REED_FORMS, reedVoice } from '../../js/world/fauna/ReedWalkerTraits.js';
import { reedPose, reedJoint, REED_STRIDE_SECONDS } from '../../js/world/fauna/ReedWalkerMotion.js';

test('every habitat and age can lower to the water with fixed contacts and constant bone lengths', () => {
 for (const form of Object.keys(REED_FORMS)) for (const age of ['young', 'adult', 'old']) for (const sex of ['male', 'female']) for (let seed = 1; seed <= 20; seed++) {
  const traits = reedIndividual(form, seed, age, sex), standing = reedPose(traits);
  for (let frame = 0; frame <= 100; frame++) {
   const pose = reedPose(traits, 0, 'manual', frame / 100);
   assert.deepEqual(pose.feet, standing.feet);
   for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, fore = i < 2 ? 1 : -1;
    const x = fore * traits.length * .65;
    const hip = [pose.body[0] + x * Math.cos(pose.tilt), pose.body[1] + x * Math.sin(pose.tilt), side * traits.width * .64];
    const length = traits.legs * .61, knee = reedJoint(hip, pose.feet[i], length, side, fore);
    for (const end of [hip, pose.feet[i]]) assert.ok(Math.abs(Math.hypot(...knee.map((v, j) => v - end[j])) - length) < 1e-9);
    assert.ok(knee[1] > 0, 'knees stay above riverbed');
   }
  }
  const grazing = reedPose(traits, 0, 'manual', 1);
  assert.ok(Math.abs((grazing.body[1] - .83) * traits.scale - traits.depth) < 1e-9, 'feeding opening reaches water for all ages');
 }
});
test('the grazing loop joins smoothly and never moves the planted feet', () => {
 const traits = reedIndividual(), first = reedPose(traits, 0, 'graze');
 let previous = first;
 for (let i = 1; i <= 38 * 60; i++) {
  const pose = reedPose(traits, i / 60, 'graze');
  assert.deepEqual(pose.feet, first.feet);
  assert.ok(Math.abs(pose.body[1] - previous.body[1]) < .03); previous = pose;
 }
 assert.ok(Math.abs(previous.body[1] - first.body[1]) < .03);
});
test('one slow stride keeps at least three feet planted and completes all four steps', () => {
 for (const form of Object.keys(REED_FORMS)) {
  const traits = reedIndividual(form), start = reedPose(traits, 0, 'step'), tilts = [];
  for (let i = 0; i <= REED_STRIDE_SECONDS * 60; i++) {
   const pose = reedPose(traits, i / 60, 'step'); tilts.push(pose.tilt);
   assert.ok(pose.feet.filter(f => f[1] > .065 + 1e-8).length <= 1);
   for (let leg = 0; leg < 4; leg++) {
    const side = leg % 2 ? 1 : -1, fore = leg < 2 ? 1 : -1, x = fore * traits.length * .65;
    const hip = [pose.body[0] + x * Math.cos(pose.tilt), pose.body[1] + x * Math.sin(pose.tilt), side * traits.width * .64];
    assert.ok(reedJoint(hip, pose.feet[leg], traits.legs * .61, side, fore).every(Number.isFinite));
   }
  }
  assert.ok(Math.max(...tilts) - Math.min(...tilts) > .08, 'walking tilts alternate with the planted support');
  const end = reedPose(traits, REED_STRIDE_SECONDS, 'step');
  end.feet.forEach((foot, i) => assert.ok(Math.abs(foot[0] - start.feet[i][0] - .85) < 1e-9));
  assert.equal(end.body[0], .85);
 }
});
test('individual identity is repeatable and older animals have lower voices', () => {
 for (const form of Object.keys(REED_FORMS)) {
  const adult = reedIndividual(form, 7, 'adult'); assert.deepEqual(adult, reedIndividual(form, 7, 'adult'));
  assert.notDeepEqual(adult, reedIndividual(form, 8, 'adult'));
  assert.ok(reedIndividual(form, 7, 'old').pitch < adult.pitch);
  assert.ok(reedIndividual(form, 7, 'young').pitch > adult.pitch);
  for (const event of ['rumble', 'breath', 'grazing']) for (const note of reedVoice(adult, event)) assert.ok(note.duration > note.attack && note.frequency > 20 && note.gain < .5);
 }
});

test('resting visibly breathes and settles without sliding feet or snapping between cycles', () => {
 const traits = reedIndividual('reedbed', 1, 'old'), start = reedPose(traits), positions = [], tilts = [];
 let previous = start;
 for (let i = 0; i < 60 * 50; i++) {
  const pose = reedPose(traits, i / 60, 'stand'); positions.push(pose.body); tilts.push(pose.tilt);
  assert.deepEqual(pose.feet, start.feet);
  assert.ok(Math.hypot(...pose.body.map((v, j) => v - previous.body[j])) < .005);
  for (let leg = 0; leg < 4; leg++) {
   const side = leg % 2 ? 1 : -1, fore = leg < 2 ? 1 : -1, x = fore * traits.length * .65;
   const hip = [pose.body[0] + x * Math.cos(pose.tilt), pose.body[1] + x * Math.sin(pose.tilt), pose.body[2] + side * traits.width * .64];
   assert.ok(reedJoint(hip, pose.feet[leg], traits.legs * .61, side, fore).every(Number.isFinite));
  }
  previous = pose;
 }
 for (const axis of [0, 1, 2]) assert.ok(Math.max(...positions.map(p => p[axis])) - Math.min(...positions.map(p => p[axis])) > .08);
 assert.ok(Math.max(...tilts) - Math.min(...tilts) > .22, 'resting rocks forward and back visibly');
 assert.ok(REED_STRIDE_SECONDS <= 10);
});


test('families fit their feeding patch across habitats and retain distinct, stable identities', () => {
 assert.deepEqual(new Set(Array.from({ length: 20 }, (_, i) => reedFamily('reedbed', i + 1).length)), new Set([3, 4]));
 for (const form of Object.keys(REED_FORMS)) for (let seed = 1; seed <= 20; seed++) for (const children of [1, 2]) {
  const family = reedFamily(form, seed, children);
  assert.deepEqual(family, reedFamily(form, seed, children));
  assert.equal(new Set(family.map(m => m.traits.seed)).size, children + 2);
  assert.equal(family.filter(m => m.age === 'young').length, children);
  for (let i = 0; i < family.length; i++) for (let j = i + 1; j < family.length; j++) assert.ok(Math.hypot(family[i].offset[0] - family[j].offset[0], family[i].offset[2] - family[j].offset[2]) >= 5.5, 'family members have their own grazing space');
  const son = family.find(m => m.role === 'son');
  for (const member of family) {
   const { traits, offset } = member;
   if (member.age !== 'young') assert.ok(traits.scale > son.traits.scale);
   for (const mode of ['stand', 'graze', 'step']) for (let time = 0; time <= 38; time += .5) {
    const pose = reedPose(traits, time, mode);
    for (const foot of pose.feet) assert.ok(Math.hypot(offset[0] + foot[0] * traits.scale, offset[2] + foot[2] * traits.scale) < 12.3, 'contacts stay on the riverbed');
    if (pose.feeding) {
     const x = offset[0] + (pose.body[0] + .2) * traits.scale;
     const halfWidth = Math.sqrt(1 - (x / 12.7) ** 2) * 5.1;
     assert.ok(Math.abs(offset[2] - Math.sin(x * .25) * .5) + .45 * traits.scale < halfWidth, 'feeding pad remains inside the river');
    }
   }
  }
 }
});


test('sex and age affect silhouette, color, tusks and voice consistently across habitats', () => {
 for (const form of Object.keys(REED_FORMS)) for (let seed = 1; seed <= 20; seed++) {
  const male = reedIndividual(form, seed, 'adult', 'male');
  const female = reedIndividual(form, seed, 'adult', 'female');
  const son = reedIndividual(form, seed, 'young', 'male');
  const daughter = reedIndividual(form, seed, 'young', 'female');
  assert.ok(male.width > female.width && male.crown < female.crown);
  assert.notEqual(male.color, female.color);
  assert.ok(male.tuskLength > son.tuskLength && son.tuskLength > 0);
  assert.equal(female.tuskLength, 0); assert.equal(daughter.tuskLength, 0);
  assert.ok(male.pitch < female.pitch && son.pitch > male.pitch);
  assert.ok(son.stride < male.stride && son.crown > male.crown);
  assert.ok(reedVoice(son)[0].duration < reedVoice(male)[0].duration);
 }
});

test('family placements vary by seed without reserving a side for any role', () => {
 for (const children of [1, 2]) {
  const quadrants = new Map(), layouts = new Set();
  for (let seed = 1; seed <= 100; seed++) {
   const family = reedFamily('reedbed', seed, children);
   layouts.add(JSON.stringify(family.map(m => m.offset)));
   assert.deepEqual(family.map(m => m.offset), reedFamily('peat', seed, children).map(m => m.offset), 'habitat comparisons preserve the family arrangement');
   for (const member of family) {
    if (!quadrants.has(member.role)) quadrants.set(member.role, new Set());
    quadrants.get(member.role).add(`${Math.sign(member.offset[0])},${Math.sign(member.offset[2])}`);
   }
  }
  assert.ok(layouts.size > 95, 'families have distinct arrangements');
  for (const sides of quadrants.values()) assert.equal(sides.size, 4, 'every role appears on both sides and both banks');
 }
});


test('tusk shapes vary repeatably while young pairs stay smaller and curves stay bounded', () => {
 const styles = new Set(), pairs = new Set();
 for (const form of Object.keys(REED_FORMS)) for (let seed = 1; seed <= 100; seed++) {
  const old = reedIndividual(form, seed, 'old', 'male'), young = reedIndividual(form, seed, 'young', 'male');
  assert.deepEqual(old.tusks, reedIndividual(form, seed, 'old', 'male').tusks);
  assert.deepEqual(reedIndividual(form, seed, 'adult', 'female').tusks, []);
  assert.equal(old.tusks.length, 2);
  styles.add(old.tusks[0].style); pairs.add(JSON.stringify(old.tusks));
  assert.notEqual(old.tusks[0].length, old.tusks[1].length);
  old.tusks.forEach((tusk, i) => {
   assert.ok(young.tusks[i].length < tusk.length * .5);
   assert.ok(young.tusks[i].radius < tusk.radius * .6);
   assert.ok(tusk.length > .4 && tusk.length < 2.2);
   assert.ok(tusk.rise > 0 && tusk.rise < 1 && tusk.spread > 0 && tusk.spread < 1);
   assert.ok(tusk.tip > 0 && tusk.tip < tusk.radius);
  });
 }
 assert.equal(styles.size, 4);
 assert.equal(pairs.size, 300);
});
