import { SPECIES } from './FaunaModel.js?v=stable-30-25';

// Construction owns a private membership list. Live creatures can keep stepping
// between yields; incomplete newcomers never reach rendering or audio.
export function* prepareFaunaGroup(model, ...args) {
 const [id, kind] = args;
 if (model.groups.has(id)) return model.groups.get(id);
 const draft = Object.assign(Object.create(Object.getPrototypeOf(model)), model);
 draft.groups = new Map(model.groups);
 draft.creatures = model.creatures.slice();
 const group = yield* draft.addGroupSteps(...args);
 if (!group) return null;
 // addGroup can return the existing lumen flock under a different requested ID.
 if (model.groups.get(group.id) === group) return group;
 if (model.groups.has(id)) return model.groups.get(id);
 const used = model.creatures.filter(c => c.kind === kind).length;
 if (used + group.members.length > SPECIES[kind].cap) return null;
 model.groups.set(id, group);
 model.creatures = model.creatures.concat(group.members);
 return group;
}
