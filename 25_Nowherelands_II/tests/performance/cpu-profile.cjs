// Sample the running game's CPU and inclusive subsystem costs. The live world
// evolves; use this to locate work, not as a deterministic before/after test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const output=process.env.CPU_PROFILE_OUTPUT||'/tmp/nowherelands-cpu-profile';
const summary=a=>{const s=a.slice().sort((a,b)=>a-b);return {n:s.length,mean:s.reduce((a,b)=>a+b,0)/s.length,p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--mute-audio']}),report={errors:[],views:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.75});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.route('**/js/main.js*',async route=>{const r=await route.fetch();let body=await r.text();body=body.replace('window.__debug = {','window.__debug = { caves, watersideLife, ripples, landmarks, pmrem, post,');body=body.replace('const now = performance.now();','window.__cpuBegin?.(); const now = performance.now();').replace('profile?.end();','profile?.end(); window.__cpuEnd?.();');await route.fulfill({response:r,body});});
  await page.goto('http://127.0.0.1:8797/25_Nowherelands_II/?seed=umbra&fps=60');await page.waitForFunction(()=>window.__debug,{timeout:120000});await page.waitForTimeout(10000);
  await page.evaluate(()=>{
   const d=__debug;window.__cpuRows=null;let row,start;
   window.__cpuBegin=()=>{row={};start=performance.now();};window.__cpuEnd=()=>{if(window.__cpuRows)window.__cpuRows.push({...row,total:performance.now()-start});};
   const wrap=(o,k,label)=>{const old=o[k];o[k]=function(...a){const t=performance.now();try{return old.apply(this,a);}finally{row[label]=(row[label]||0)+performance.now()-t;}};};
   for(const [o,k,label] of [[d.player,'update','player'],[d.terrain,'update','terrain'],[d.terrain.vegetation,'update','vegetation'],[d.fauna,'update','fauna'],[d.fauna.model,'step','faunaSimulation'],[d.fauna.meshes,'update','faunaMeshes'],[d.walkers,'update','walkers'],[d.walkers.model,'update','walkerSimulation'],[d.mites,'update','mites'],[d.birds,'update','birds'],[d.shoreMap,'update','shore'],[d.inland,'update','inland'],[d.caves,'update','caves'],[d.watersideLife,'update','watersideLife'],[d.sky,'update','sky'],[d.environment,'update','environment'],[d.post,'render','render']])wrap(o,k,label);
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.CPU_THROTTLE||4)});await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});
  for(const kind of ['hopper','lumen','ray','reed','bird','mite','travel']){
   await page.evaluate(kind=>{
    if(kind!=='travel')__debug.faunaMenu.visit(kind,false,false);
    else {const d=__debug;d.faunaMenu.stop();d.player.fly=true;const origin=d.player.position.clone(),yaw=d.player.yaw,start=performance.now(),old=d.player.update;d.player.update=function(...args){const distance=(performance.now()-start)/1000*60,x=origin.x-Math.sin(yaw)*distance,z=origin.z-Math.cos(yaw)*distance;this.position.set(x,Math.max(d.heightmap.height(x,z),d.heightmap.waterAt(x,z))+18,z);this.velocity.set(0,0,0);return old.apply(this,args);};}
   },kind);await page.waitForTimeout(kind==='travel'?2000:6000);
   await page.evaluate(()=>window.__cpuRows=[]);await cdp.send('Profiler.start');await page.waitForTimeout(kind==='travel'?10000:5000);const {profile}=await cdp.send('Profiler.stop');const rows=await page.evaluate(()=>{const r=window.__cpuRows;window.__cpuRows=null;return r;});
   const labels=new Set(rows.flatMap(r=>Object.keys(r))),costs=Object.fromEntries([...labels].map(k=>[k,summary(rows.map(r=>r[k]||0))]));
   const nodes=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();
   for(let i=0;i<profile.samples.length;i++){const n=nodes.get(profile.samples[i]),f=n.callFrame,key=[f.functionName||'(anonymous)',f.url.replace('http://127.0.0.1:8797/',''),f.lineNumber+1].join(':');self.set(key,(self.get(key)||0)+(profile.timeDeltas[i]||0)/1000);}
   const hottest=[...self].sort((a,b)=>b[1]-a[1]).slice(0,25);
   const view={kind,costs,hottest};report.views.push(view);fs.writeFileSync(path.join(output,`${kind}.cpuprofile`),JSON.stringify(profile));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(view));
  }
  if(report.errors.length)throw Error(report.errors.join('\n'));
 }catch(e){report.failure=String(e);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})();
