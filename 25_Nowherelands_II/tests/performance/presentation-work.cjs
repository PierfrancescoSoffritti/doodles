const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const output=process.env.PRESENTATION_OUTPUT||'/tmp/nowherelands-presentation';
const url=process.env.PRESENTATION_URL||'http://127.0.0.1:8797/25_Nowherelands_II/?seed=umbra&fps=30';
const baseline=process.env.PRESENTATION_BASELINE||'4989791870f0adbe05e211bc45988921d4c567fd';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const sources=Object.fromEntries(['js/main.js','js/world/Sky.js','js/world/Clouds.js','js/fx/ReplyOutlinePass.js','tests/browser/PresentationWorkChecks.js'].map(p=>[p,createHash('sha256').update(fs.readFileSync('25_Nowherelands_II/'+p)).digest('hex')]));
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--mute-audio']}),report={baseline,sources,errors:[],browser:await browser.version()};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.75});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text().slice(0,1500));});
  await page.route('**/*presentation-baseline=1',route=>{
   const file=new URL(route.request().url()).pathname.slice(1);
   return route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',`${baseline}:${file}`])});
  });
  await page.route('**/js/main.js*',async route=>{
   const response=await route.fetch();let body=await response.text();
   if(process.env.OUTLINE_ONLY)body='';
   body=body.replace('requestAnimationFrame(frame);','requestAnimationFrame(frame); if(window.__presentationPause)return;');
   body=body.replace('const now = performance.now();','window.__presentationFrameBegin?.(); const now = performance.now();').replace('profile?.end();','profile?.end(); window.__presentationFrameEnd?.();');
   await route.fulfill({response,body});
  });
  await page.addInitScript(()=>{let state=91273;Math.random=()=>{state=Math.imul(state,1664525)+1013904223|0;return(state>>>0)/4294967296;};});
  await page.goto(url);
  if(process.env.OUTLINE_ONLY){report.outline=await page.evaluate(async()=>(await import('./tests/browser/PresentationWorkChecks.js')).outlineChecks());console.log(JSON.stringify(report.outline.costs));return;}
  await page.waitForFunction(()=>window.__debug,{timeout:120000});await page.waitForTimeout(10000);
  await page.evaluate(()=>{window.__presentationPause=true;});
  report.gpu=await page.evaluate(()=>{const gl=__debug.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  console.log('GPU',report.gpu);
  if(!process.env.SCENE_ONLY){
  report.outline=await page.evaluate(async()=>{const checks=await import('./tests/browser/PresentationWorkChecks.js');return checks.outlineChecks();});
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));console.log('outline',JSON.stringify(report.outline.costs));
  report.cloud=await page.evaluate(async()=>(await import('./tests/browser/PresentationWorkChecks.js')).cloudChecks());
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));console.log('cloud',JSON.stringify(report.cloud));
  }
  report.scenes=[];
  for(const kind of ['hopper','lumen','ray','reed','bird','mite']){
   await page.evaluate(kind=>{window.__presentationPause=false;__debug.faunaMenu.visit(kind,false,false);},kind);await page.waitForTimeout(6000);
   const result=await page.evaluate(async kind=>{
    window.__presentationPause=true;const d=__debug;
    for(const c of d.fauna.model.creatures){c.replyGlow=1;c.replyProgress=.4;c.replyCharged=true;}
    for(const g of d.walkers.model.groups.values())for(const c of g.members){c.replyGlow=1;c.replyProgress=.4;c.replyCharged=true;}
    for(const c of d.birds.encounters){c.pose.replyGlow=1;c.pose.replyProgress=.4;c.pose.replyCharged=true;c.replyGlow=1;c.replyProgress=.4;c.replyCharged=true;}
    for(const g of d.mites.colonies.values())for(const c of g.model.mites){c.replyGlow=1;c.replyProgress=.4;c.replyCharged=true;}
    d.fauna.meshes.update(d.fauna.model,d.fauna.accumulator*30,0,d.fauna.sample);d.walkers.update(0);d.birds.update(0);d.mites.update(0);
    d.camera.updateMatrixWorld(true);
    return {kind,...await (await import('./tests/browser/PresentationWorkChecks.js')).sceneOutlineChecks()};
   },kind);
   fs.writeFileSync(path.join(output,`${kind}.png`),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;report.scenes.push(result);console.log('scene',JSON.stringify(result));
   fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));
  }
  if(process.env.LIVE_AUDIT){
   await page.evaluate(()=>{window.__presentationPause=false;__debug.faunaMenu.stop();__debug.shared.hud.start({capture:false});});
   await page.waitForFunction(()=>__debug.shared.conductor);await page.waitForTimeout(2000);
   await page.evaluate(async()=>{window.__liveAudit=(await import('./tests/browser/PresentationWorkChecks.js')).installLiveAudit();});
   const cdp=await page.context().newCDPSession(page);report.live=[];
   for(const throttle of [1,4])for(const fps of [0,60,30]){
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
    for(const variant of ['before','after','after','before']){
     await page.evaluate(({variant,fps})=>{window.__cloudBaseline=variant==='before';__debug.hud.frameRate=fps;},{variant,fps});await page.waitForTimeout(1000);
     await page.evaluate(({variant,fps})=>window.__liveAudit.begin(variant==='before',fps),{variant,fps});await page.waitForTimeout(4000);
     const result={throttle,fps,variant,...await page.evaluate(()=>window.__liveAudit.end())};report.live.push(result);console.log('live',JSON.stringify(result));
    }
   }
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  }
  if(report.errors.length)throw new Error('Browser/WebGL errors');
 }catch(e){report.failure=String(e);console.error(e);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));await browser.close();}
})();
