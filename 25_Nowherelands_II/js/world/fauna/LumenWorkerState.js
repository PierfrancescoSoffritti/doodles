import { Random } from '../../core/Random.js';
import { FaunaModel } from './FaunaModel.js?v=stable-30-25';

export const LUMEN_STEP = 1 / 30;
export const PRESENTATION_OWNED = new Set(['renderLod','renderPosition','radiance','replyGlow','replyProgress','replyCharged','replyStart','replyEnd']);

// A checkpoint contains the complete cyclic simulation graph, including RNGs.
// Renderer and audio objects never enter it. Structured clone retains aliases.
export function lumenCheckpoint(model) {
 const state = Object.fromEntries(Object.entries(model).filter(([key,value]) => key !== 'environment' && key !== 'externalLumen' && typeof value !== 'function'));
 state.groups = new Map([...model.groups].filter(([,group]) => group.kind === 'lumen'));
 state.creatures = model.creatures.filter(c => c.kind === 'lumen');
 return state;
}

export function restoreLumenModel(state, environment) {
 const seen = new Set();
 const visit = value => {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map) { for (const item of value.values()) visit(item); return; }
  for (const [key,item] of Object.entries(value)) {
   if (key === 'rnd' && item) Object.setPrototypeOf(item, Random.prototype);
   visit(item);
  }
 };
 visit(state);
 return Object.assign(new FaunaModel(state.seed, environment), state);
}

export function lumenAvoid(obstacles, p) {
 let x=0,z=0;
 for (const o of obstacles) {
  const dx=p.x-o.position.x,dz=p.z-o.position.z,d=Math.hypot(dx,dz),r=o.radius+7;
  if(d<r && Math.abs(p.y-o.position.y)<Math.max(30,o.radius*12)) {
   x+=dx/Math.max(d,.1)*(1-d/r)*6;z+=dz/Math.max(d,.1)*(1-d/r)*6;
  }
 }
 return {x,z};
}

export function advanceLumen(model, input) {
 model.listener=input.listener;model.observing=input.observing;model.activity=input.activity;
 for (const command of input.commands) {
  if(command.type==='hear')model.hear(command.note);
  else if(command.type==='call')model.call(model.creatures.find(c=>c.id===command.id));
 }
 for(let i=0;i<input.steps;i++)model.step(LUMEN_STEP);
}

// Preserve creature and branch identity for active audio panners, light owners
// and the flock guide. Keep the complete checkpoint separately for recovery.
export function applyLumenPresentation(model, state) {
 const creatures = new Map(model.creatures.filter(c=>c.kind==='lumen').map(c=>[c.id,c]));
 for(const [id,incoming] of state.groups) {
  const group=model.groups.get(id);if(!group)continue;
  const branches=new Map(group.flow.branches.map(b=>[b.id,b]));
  for(const branch of incoming.flow.branches) {
   const target=branches.get(branch.id);
   for(const key of ['coarse','state','center','guide','bank','lake','destination','destinationBank','visits','highland','weave','guideVelocity'])target[key]=branch[key];
   target.members=branch.members.map(c=>creatures.get(c.id));
  }
  for(const key of ['phase','cycles','joins','nextEncounter'])group.flow[key]=incoming.flow[key];
  group.center=incoming.center;group.state=incoming.state;group.visits=incoming.visits;
  for(const c of incoming.members) {
   const target=creatures.get(c.id);if(!target)continue;
   for(const [key,value]of Object.entries(c))if(!PRESENTATION_OWNED.has(key)&&(value===null||typeof value!=='object'))target[key]=value;
   for(const key of ['pos','prev','vel','elastic','acceleration'])if(c[key])Object.assign(target[key],c[key]);
   target.navigation=branches.get(c.navigation.id);
   target.noteResponse=c.noteResponse;
  }
 }
 model.lumenTime=state.time;
}
