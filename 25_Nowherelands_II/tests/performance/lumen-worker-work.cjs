// Exact production-worker replay against the same main-thread model/environment.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs');
const out=process.env.LUMEN_WORKER_OUTPUT||'/tmp/lumen-worker-replay';
(async()=>{fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({headless:true,args:['--use-angle=metal','--mute-audio']}),p=await b.newPage(),report={errors:[],blocks:[]};p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});try{
await p.route('**/js/main.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('requestAnimationFrame(frame);','requestAnimationFrame(frame);if(window.__workerPause)return;')})});
await p.goto('http://127.0.0.1:8797/25_Nowherelands_II/?seed=fern&lumenWorker=0');await p.waitForFunction(()=>window.__debug,null,{timeout:180000});
await p.evaluate(()=>window.__workerPause=true);
report.setup=await p.evaluate(async()=>{
 const d=__debug,lib=await import('./js/world/fauna/LumenWorkerState.js?v=7');
 const initial=structuredClone(lib.lumenCheckpoint(d.fauna.model));const model=lib.restoreLumenModel(initial,d.fauna.model.environment),events=[];
 model.onCall=c=>events.push({type:'call',id:c.id,time:model.time,position:{...c.pos}});model.onEscape=c=>events.push({type:'escape',id:c.id,time:model.time,position:{...c.pos}});model.onNoteReply=(kind,c,alarm)=>events.push({type:'reply',id:c.id,alarm,time:model.time,position:{...c.pos}});
 const worker=new Worker(new URL('./js/world/fauna/LumenWorker.js?v=7',location.href),{type:'module'});
 const request=data=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('worker timeout')),60000);worker.onmessage=e=>{clearTimeout(timer);e.data.type==='error'?reject(Error(e.data.message)):resolve(e.data)};worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};worker.postMessage(data)});
 await request({type:'init',world:d.world,seed:model.seed,waterLevel:d.heightmap.waterLevel});await request({type:'start',state:lib.lumenCheckpoint(model),lakes:d.fauna.lakes});
 const canonical=o=>{const seen=new Map();const walk=v=>{if(typeof v==='function')return undefined;if(typeof v==='number'&&!Number.isFinite(v))return String(v);if(!v||typeof v!=='object')return v;if(seen.has(v))return{$ref:seen.get(v)};seen.set(v,seen.size);if(v instanceof Map)return [...v].map(([k,v])=>[k,walk(v)]);if(v instanceof Set)return [...v].map(walk);if(Array.isArray(v))return v.map(walk);return Object.fromEntries(Object.keys(v).map(k=>[k,walk(v[k])]));};return JSON.stringify(walk(o));};
 window.__workerTest={lib,model,events,worker,request,canonical,last:null};return{creatures:model.creatures.length,lakes:d.fauna.lakes.length};
});console.log('setup',report.setup);
for(let block=0;block<120;block++){
 const row=await p.evaluate(async block=>{
  const s=__workerTest,m=s.model,c=m.creatures[0],commands=[];
  if(block===65)commands.push({type:'hear',note:{position:{...c.pos},layer:'player-note',strength:.35,radius:82.5}});
  if(block===66)commands.push({type:'hear',note:{position:{...c.pos},layer:'player-note',strength:1,radius:165}});
  if(block===70)commands.push({type:'call',id:c.id});
  if(block===20||block===30)__debug.fauna.obstacles=[{position:{x:c.pos.x+1,y:c.pos.y,z:c.pos.z+1},radius:9}];if(block===50)__debug.fauna.obstacles=[];
  const input={steps:15,listener:block===20?{...c.pos}:{x:-10000,y:0,z:-10000},observing:block>=65,activity:0,commands,obstacles:__debug.fauna.obstacles.map(o=>({position:{x:o.position.x,y:o.position.y,z:o.position.z},radius:o.radius}))};
  s.events.length=0;const t=performance.now();s.lib.advanceLumen(m,input);const localMs=performance.now()-t;
  const result=await s.request({type:'step',id:block,inputs:[{...input,obstacles:block===0||block===20||block===30||block===50?input.obstacles:undefined}],validate:true});
  const a=s.canonical(s.lib.lumenCheckpoint(m)),b=s.canonical(result.state);
  if(a!==b){let i=0;while(i<a.length&&a[i]===b[i])i++;throw Error(`state mismatch block ${block}, offset ${i}: ${a.slice(i-80,i+150)} != ${b.slice(i-80,i+150)}`)}
  if(JSON.stringify(s.events)!==JSON.stringify(result.events))throw Error('event mismatch at '+block);
  s.last=result.frame;
  return{block,localMs,workerMs:result.workMs,events:result.events.length,exact:true};
 },block);report.blocks.push(row);if(block%20===19)console.log('replay',block+1);
}
report.presentation=await p.evaluate(async()=>{
 const s=__workerTest,d=__debug,m=s.model,mirror=s.lib.restoreLumenModel(structuredClone(s.lib.lumenCheckpoint(m)),m.environment);const {applyLumenFrame}=await import('./js/world/fauna/LumenTransfer.js?v=7');applyLumenFrame(mirror,s.last,mirror.creatures,new Map(d.fauna.lakes.map(l=>[l.id,l])));mirror.lumenAlpha=.35;
 const snapshot=model=>{d.fauna.meshes.update(model,.35,1/60,d.fauna.sample);const result=[];for(const mesh of[d.fauna.meshes.meshes.lumen,...d.fauna.meshes.lumenLods,d.fauna.meshes.glow])result.push([mesh.count,[...mesh.instanceMatrix.array],Object.entries(mesh.geometry.attributes).map(([k,v])=>[k,[...v.array]])]);return JSON.stringify(result)};
 if(snapshot(m)!==snapshot(mirror))throw Error('presentation differs');s.worker.terminate();return{meshAttributesExact:true,instancesExact:true};
});
if(report.errors.length)throw Error(report.errors.join('\n'));
}catch(e){report.failure=String(e);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await b.close()}})();
