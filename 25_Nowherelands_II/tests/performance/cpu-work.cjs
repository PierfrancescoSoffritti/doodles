// Deterministic CPU comparison against a git revision. Serve the repository on 8797.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const output=process.env.CPU_WORK_OUTPUT||'/tmp/nowherelands-cpu-work';
const baselineDir=process.env.CPU_BASELINE_DIR;
const seed=process.env.CPU_SEED||'umbra';
const baseline=process.env.CPU_BASELINE||'4989791870f0adbe05e211bc45988921d4c567fd';
const files=['js/world/Heightmap.js','js/world/LakeSurface.js','js/world/fauna/Fauna.js','js/world/fauna/FaunaModel.js','js/world/fauna/LumenSchool.js','js/world/fauna/LumenFlow.js'];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const report={baseline:baselineDir||baseline,seed,sources:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync('25_Nowherelands_II/'+p)).digest('hex')])),errors:[]};
 const remote=process.env.CPU_CDP;
 const browser=remote?await chromium.connectOverCDP(remote):await chromium.launch({headless:true,args:['--use-angle=metal','--mute-audio']});report.browser=await browser.version();
 let page;
 try{
  page=remote?await browser.contexts()[0].newPage():await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  for(const variant of ['baseline','current'])await page.route(`**/*cpu-${variant}=1`,route=>{
   const file=new URL(route.request().url()).pathname.slice(1);
   let body=variant==='baseline'?(baselineDir?fs.readFileSync(path.join(baselineDir,file.replace(/^25_Nowherelands_II\//,'')),'utf8'):execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'})):fs.readFileSync(file,'utf8');
   body=body.replace(/(from\s+['"])([^'"]+)(['"])/g,(all,a,p,b)=>files.some(f=>path.posix.basename(f)===p.split('/').at(-1).split('?')[0])?a+p.split('?')[0]+`?cpu-${variant}=1`+b:all);
   return route.fulfill({contentType:'text/javascript',body});
  });
  await page.route('**/js/main.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('requestAnimationFrame(frame);','requestAnimationFrame(frame); if(window.__cpuPause)return;')});});
  await page.goto(`http://127.0.0.1:8797/25_Nowherelands_II/?seed=${encodeURIComponent(seed)}&fps=60`);await page.waitForFunction(()=>window.__debug,null,{timeout:180000});
  await page.evaluate(()=>window.__cpuPause=true);
  report.setup=await page.evaluate(async seed=>{
   const [{Heightmap:OldHM},{Fauna:OldFauna},{Fauna},{Heightmap},THREE]=await Promise.all([import('./js/world/Heightmap.js?cpu-baseline=1'),import('./js/world/fauna/Fauna.js?cpu-baseline=1'),import('./js/world/fauna/Fauna.js?cpu-current=1'),import('./js/world/Heightmap.js?cpu-current=1'),import('three')]);
   const d=__debug,w=d.world;
   const make=(oldTerrain,oldFauna)=>{const hm=new (oldTerrain?OldHM:Heightmap)(w.seed||seed,w),scene=new THREE.Scene(),shared={...d.shared,lumenLightUniforms:undefined};const fauna=new (oldFauna?OldFauna:Fauna)(scene,hm,shared);return {hm,fauna,scene,shared,events:[]};};
   const cases={before:make(true,true),control:make(true,true),after:make(false,false)};
   const points=[],random=(function(){let n=1234567;return()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296;};})();
   for(let i=0;i<15000;i++)points.push([(random()-.5)*w.size-w.spawn.x,(random()-.5)*w.size-w.spawn.z]);
   for(const lake of cases.before.fauna.lakes)for(const p of lake.shore||[])for(const o of [-.01,0,.01,2])points.push([p.x+o,p.z-o]);
   for(const r of w.rivers)for(const f of r.falls)for(let i=-8;i<=8;i++)for(let j=-3;j<=3;j++)points.push([f.x+i,f.z+j]);
   for(let i=-1;i<=w.res;i+=7)for(const epsilon of [-1e-8,0,1e-8])points.push([i*w.cell-w.size/2-w.spawn.x+epsilon,-w.spawn.z],[-w.spawn.x,i*w.cell-w.size/2-w.spawn.z+epsilon]);
   const fields=['_water','_bank','_foam','_riverDist','_riverWidth','_riverAlong','_riverAcross','_riverSeg','_slope','_hardness'];
   for(const [x,z]of points){const a=cases.before.hm,b=cases.after.hm,ha=a.sample(x,z),hb=b.sample(x,z);if(!Object.is(ha,hb))throw Error(`terrain height differs at ${x},${z}`);for(const k of fields)if(!Object.is(a[k],b[k]))throw Error(`terrain ${k} differs`);for(const k of ['shoreId','shoreDistance'])if(!Object.is(a.lakes[k],b.lakes[k]))throw Error(`lake ${k} differs`);const full=cases.after.fauna.sample(x,z),clearance=cases.after.fauna.sample(x,z,true);if(!Object.is(full.ground,clearance.ground)||!Object.is(full.water,clearance.water))throw Error('clearance differs');}
   window.__cpuCases=cases;
   // Preserve all enumerable simulation state, including RNGs and cyclic group references.
   window.__cpuState=o=>{const seen=new Map();const walk=v=>{if(typeof v==='function')return undefined;if(typeof v==='number'&&!Number.isFinite(v))return String(v);if(!v||typeof v!=='object')return v;if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,seen.size);if(v instanceof Map)return [...v].map(([k,v])=>[walk(k),walk(v)]);if(v instanceof Set)return [...v].map(walk);if(ArrayBuffer.isView(v))return [...v];if(Array.isArray(v))return v.map(walk);return Object.fromEntries(Object.keys(v).filter(k=>k!=='environment').map(k=>[k,walk(v[k])]));};return JSON.stringify(walk(o));};
   window.__cpuStart=()=>{for(const c of Object.values(cases)){const m=c.fauna.model;m.listener={x:-10000,y:0,z:-10000};c.fauna.prime(d.player.position,w.seed||seed);m.listener={x:-10000,y:0,z:-10000};for(const name of ['onCall','onEscape','onNoteReply','onPebbleSound'])m[name]=(...a)=>{c.events.push([m.time,name,...a.map(v=>v?.id??v)]);return true;};}};
   __cpuStart();return {terrainPoints:points.length,terrainExact:true,creatures:cases.before.fauna.model.creatures.length,lakes:cases.before.fauna.lakes.length};
  },seed);console.log('setup',JSON.stringify(report.setup));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.CPU_THROTTLE||4)});report.throttle=Number(process.env.CPU_THROTTLE||4);
  report.blocks=[];
  for(let block=0;block<120;block++){
   const result=await page.evaluate(block=>{
    const cases=__cpuCases,names=['before','control','after'];if(block%2)names.reverse();const timings={};
    for(const name of names){const c=cases[name],m=c.fauna.model;
     if(block===20){const c=m.creatures.find(c=>c.kind==='lumen');m.listener={x:c.pos.x+12,y:c.pos.y,z:c.pos.z};}
     if(block===21)m.listener={x:-10000,y:0,z:-10000};
     if(block===65){m.observing=true;m.listener={...m.creatures.find(c=>c.kind==='lumen').pos};m.hear({position:{...m.listener},strength:.35,layer:'player-note',freq:440,radius:82.5});}
     const t=performance.now();for(let i=0;i<15;i++)m.step(1/30);timings[name]=performance.now()-t;
    }
    let checked=false;
    if(block%8===7||block===119){const baseline=__cpuState(cases.before.fauna.model),events=JSON.stringify(cases.before.events);for(const name of names){if(__cpuState(cases[name].fauna.model)!==baseline)throw Error(`simulation mismatch ${name} block ${block}`);if(JSON.stringify(cases[name].events)!==events)throw Error(`event mismatch ${name}`);}checked=true;}
    return {block,timings,checked,state:[...new Set(cases.before.fauna.model.creatures.filter(c=>c.kind==='lumen').map(c=>c.navigation.state))]};
   },block);report.blocks.push(result);if(block%20===19)console.log('replay',block+1,result.state);
  }
  report.presentation=await page.evaluate(()=>{
   const snapshots=[];
   for(const c of Object.values(__cpuCases)){const f=c.fauna;f.meshes.update(f.model,.35,1/120,f.sample);f.light.update(f.model,1/120);
    const arrays=[];c.scene.traverse(o=>{if(o.geometry){const attrs=Object.entries(o.geometry.attributes).map(([k,v])=>[k,[...v.array]]);arrays.push([o.type,o.count,attrs,o.instanceMatrix?[...o.instanceMatrix.array]:null]);}});
    snapshots.push(JSON.stringify([arrays,c.shared.lumenLightUniforms,__cpuState(f.model)]));
   }
   if(snapshots.some(s=>s!==snapshots[0]))throw Error('mesh/light/interpolated state differs');
   return {meshAttributesExact:true,lightUniformsExact:true,interpolatedStateExact:true,events:__cpuCases.before.events.length};
  });
  const stats=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],mean:a.reduce((x,y)=>x+y,0)/a.length};};
  report.costs=Object.fromEntries(['before','control','after'].map(k=>[k,stats(report.blocks.slice(20).map(r=>r.timings[k]/15))]));
  report.pairedReduction=Object.fromEntries(['control','after'].map(k=>[k,stats(report.blocks.slice(20).map(r=>1-r.timings[k]/r.timings.before))]));console.log(JSON.stringify({costs:report.costs,pairedReduction:report.pairedReduction,presentation:report.presentation},null,2));
  if(report.errors.length)throw Error(report.errors.join('\n'));
 }catch(e){report.failure=String(e);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));if(remote)await page?.close().catch(()=>{});await browser.close();}
})();
