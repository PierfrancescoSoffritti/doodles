// Full-game route timings. Keep rendering/simulation active; route position is tied to wall time.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const output=process.env.TRAVEL_OUTPUT||'/tmp/nowherelands-travel';
const baseline=process.env.TRAVEL_BASELINE_DIRECTORY;
const variants=(process.env.TRAVEL_VARIANTS||'current').split(',');
const throttle=Number(process.env.CPU_THROTTLE||1),duration=Number(process.env.TRAVEL_SECONDS||40);
const stats=a=>{a=a.slice().sort((a,b)=>a-b);return {n:a.length,mean:a.reduce((s,v)=>s+v,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};};
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--mute-audio']});
 const report={browser:await browser.version(),throttle,duration,runs:[]};
 try{for(const variant of variants){
  const run={variant,errors:[],sources:{}};const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.75});
  page.on('pageerror',e=>run.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')run.errors.push(m.text());});
  await page.route('**/25_Nowherelands_II/js/**',async route=>{
   const rel=new URL(route.request().url()).pathname.split('/25_Nowherelands_II/')[1],file=path.join(variant==='before'?baseline:'25_Nowherelands_II',rel);
   let body=fs.readFileSync(file,'utf8');run.sources[rel]=createHash('sha256').update(body).digest('hex');
   if(rel==='js/main.js')body=body.replace('window.__debug = {','window.__debug = { caves, watersideLife, pmrem,')
    .replace('const now = performance.now();','window.__travelBegin?.(); const now = performance.now();')
    .replace('profile?.end();','profile?.end(); window.__travelEnd?.(renderFrame);');
   await route.fulfill({contentType:'text/javascript',body});
  });
  await page.addInitScript(()=>{let n=1234;Math.random=()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296;};});
  await page.goto('http://127.0.0.1:8797/25_Nowherelands_II/?seed=umbra&fps=60');await page.waitForFunction(()=>window.__debug,{timeout:120000});await page.waitForTimeout(12000);
  run.start=await page.evaluate(()=>{
   const d=__debug,gl=d.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   window.__travelRows=[];window.__travelCollect=false;let row,start,last,stage=0,currentChunk;
   window.__travelBegin=()=>{const now=performance.now();row={time:now,interval:last?now-last:0,costs:{},spikes:[]};last=now;start=now;};
   window.__travelEnd=rendered=>{row.work=performance.now()-start;row.rendered=rendered;row.position=[d.player.position.x,d.player.position.y,d.player.position.z];row.coverage=[];const v=d.terrain.vegetation,size=256;for(const radius of [1,2,3]){let missing=0;for(let x=-radius;x<=radius;x++)for(let z=-radius;z<=radius;z++)if(!v.chunks.has(v.key(v.centerX+x,v.centerZ+z)))missing++;row.coverage.push(missing);}row.queues=[d.terrain.vegQueue.length,d.shared.surfaceWork.jobs.size,d.shared.surfaceWork.completed.length];if(__travelCollect)__travelRows.push(row);};
   const wrap=(o,k,label)=>{if(!o?.[k])return;const fn=o[k];o[k]=function(...args){const t=performance.now();try{return fn.apply(this,args);}finally{if(row){const ms=performance.now()-t;row.costs[label]=(row.costs[label]||0)+ms;if(ms>2)row.spikes.push([label,ms,...(label==='vegStage'?[currentChunk,stage]:[])]);}}};};
   for(const [o,k,label] of [[d.terrain,'update','terrain'],[d.terrain,'build','terrainSyncBuild'],[d.terrain,'install','terrainInstall'],[d.terrain,'sweep','terrainSweep'],[d.terrain.vegetation,'update','vegUpdate'],[d.terrain.vegetation,'makeInstanced','vegInstances'],[d.terrain.vegetation,'addFarChunk','farBuild'],[d.terrain.vegetation,'refreshFar','farRefresh'],[d.terrain.vegetation.riverEcology,'build','riverEcology'],[d.terrain.vegetation.watersideMeshes,'build','watersideBuild'],[d.shared.surfaceWork,'drain','surfaceDrain'],[d.shoreMap,'update','shore'],[d.fauna,'update','fauna'],[d.birds,'update','birds'],[d.walkers,'update','walkers'],[d.mites,'update','mites'],[d.watersideLife,'update','watersideLife'],[d.caves,'update','caves'],[d.sky,'update','sky'],[d.environment,'update','environment'],[d.pmrem,'fromCubemap','environmentFilter'],[d.post,'render','render']])wrap(o,k,label);
   const build=d.terrain.vegetation.buildChunk;d.terrain.vegetation.buildChunk=function(...a){const gen=build.apply(this,a);let step=0;return {next(){currentChunk=a[0];stage=step++;const t=performance.now();try{return gen.next();}finally{if(row){const ms=performance.now()-t;row.costs.vegStage=(row.costs.vegStage||0)+ms;if(ms>2)row.spikes.push(['vegStage',ms,currentChunk,stage]);}}},return(){return gen.return();},[Symbol.iterator](){return this;}};};
   for(const name of ['bufferData','bufferSubData','texImage2D','texSubImage2D','compileShader','linkProgram','getProgramParameter','getUniformLocation']){const fn=gl[name];gl[name]=function(...a){const t=performance.now();try{return fn.apply(this,a);}finally{if(row){const ms=performance.now()-t;row.costs[name]=(row.costs[name]||0)+ms;row[name]=(row[name]||0)+1;}}};}
   const playerUpdate=d.player.update;let origin,yaw,began;
   window.__travelStart=()=>{__travelRows=[];origin=d.player.position.clone();yaw=d.player.yaw;began=performance.now();__travelCollect=true;};
   d.player.update=function(...a){if(began){const seconds=(performance.now()-began)/1000,distance=seconds*60,turn=.3*Math.sin(seconds/8);const x=origin.x-Math.sin(yaw)*distance+Math.cos(yaw)*Math.sin(seconds/8)*60,z=origin.z-Math.cos(yaw)*distance-Math.sin(yaw)*Math.sin(seconds/8)*60;this.position.set(x,Math.max(d.heightmap.height(x,z),d.heightmap.waterAt(x,z))+18,z);this.fly=true;this.velocity.set(0,0,0);this.yaw=yaw+turn;}return playerUpdate.apply(this,a);};
   return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'',origin:d.player.position.toArray(),yaw:d.player.yaw};
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  if(process.env.TRAVEL_PROFILE){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  await page.evaluate(()=>__travelStart());
  await page.waitForTimeout(duration*1000);
  run.rows=await page.evaluate(()=>{__travelCollect=false;return __travelRows;});
  if(process.env.TRAVEL_PROFILE){const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(output,`${report.runs.length}-${variant}.cpuprofile`),JSON.stringify(profile));}
  run.summary={coverage:[0,1,2].map(i=>stats(run.rows.map(r=>r.coverage[i]))),interval:stats(run.rows.map(r=>r.interval)),work:stats(run.rows.map(r=>r.work)),over33:run.rows.filter(r=>r.interval>33.34).length,over50:run.rows.filter(r=>r.interval>50).length};
  const presented=run.rows.filter(r=>r.rendered).map(r=>r.time+r.work),intervals=presented.slice(1).map((t,i)=>t-presented[i]);
  run.summary.presentationInterval=stats(intervals);run.summary.presentedOver33=intervals.filter(t=>t>33.34).length;run.summary.presentedOver50=intervals.filter(t=>t>50).length;
  const labels=new Set(run.rows.flatMap(r=>Object.keys(r.costs)));run.costs=Object.fromEntries([...labels].map(k=>[k,stats(run.rows.map(r=>r.costs[k]||0))]));
  run.slowest=run.rows.slice().sort((a,b)=>b.work-a.work).slice(0,12);
  run.final=await page.evaluate(()=>({position:__debug.player.position.toArray(),terrain:__debug.terrain.stats,chunks:__debug.terrain.vegetation.chunks.size,farChunks:__debug.terrain.vegetation.farChunks.size,worker:__debug.shared.surfaceWork.stats}));
  report.runs.push(run);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({variant,summary:run.summary,costs:run.costs,slowest:run.slowest.slice(0,4),errors:run.errors}));await page.close();
  if(run.errors.length)throw Error('Browser errors');
 }}catch(e){report.failure=String(e);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})();
