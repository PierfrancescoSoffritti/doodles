// Fresh-browser, real-audio regression tour. Phone measurements include unique
// presented image IDs, so a repeated or frozen frame cannot count as success.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const phone=process.env.PHONE==='1',seconds=Number(process.env.RUN_SECONDS||60),output=process.env.OUTPUT||'/tmp/nowherelands-frame-tour';
const sceneSeconds=JSON.parse(process.env.SCENE_SECONDS||'{}');
const kinds=(process.env.SCENES||'bell-reed,veil-willow,light-lily,scarlet-fish,hopper,lumen,ray,reed,bird,mite,walk').split(',');
const validKinds=new Set(['scarlet-fish','light-lily','lumen','hopper','ray','reed','bird','mite','bell-reed','veil-willow','walk','forest','cave-dry','cave-wet']);
if(Object.values(sceneSeconds).some(n=>!Number.isFinite(n)||n<=0)||!Number.isFinite(seconds)||seconds<=0)throw Error('Scene durations must be positive seconds');
const capacitySeconds=Math.max(seconds,...kinds.map(k=>sceneSeconds[k]||seconds));
if(kinds.some(kind=>!validKinds.has(kind)))throw Error('Unknown tour scene: '+kinds.filter(kind=>!validKinds.has(kind)).join(', '));
const profileCPU=kind=>process.env.CPU_PROFILE==='1'&&(!process.env.CPU_SCENES||process.env.CPU_SCENES.split(',').includes(kind));
const adb=process.env.ADB,serial=process.env.ANDROID_SERIAL;
const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return{count:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1),over50:a.filter(v=>v>=50).length};};
function thermal(){if(!phone)return null;if(!adb||!serial)throw Error('Phone runs require ADB and ANDROID_SERIAL');const raw=execFileSync(adb,['-s',serial,'shell','dumpsys','thermalservice'],{encoding:'utf8',timeout:10000}),current=raw.split('Current temperatures from HAL:')[1]||'';return{at:new Date().toISOString(),status:Number(raw.match(/Thermal Status: (\d+)/)?.[1]),skin:Number(current.match(/mValue=([\d.]+), mType=3, mName=SKIN/)?.[1])};}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const report={date:new Date().toISOString(),phone,seconds,sceneSeconds,kinds,diagnostic:process.env.TRACE_STAGES==='1'||process.env.CPU_PROFILE==='1',errors:[],loadedSources:{},runs:[]},pending=[];
 const browser=phone?await chromium.connectOverCDP(process.env.ANDROID_CDP||'http://127.0.0.1:9223'):await chromium.launch({channel:process.env.CHANNEL||'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
 const page=phone?await browser.contexts()[0].newPage():await browser.newPage({viewport:{width:Number(process.env.WIDTH||1728),height:Number(process.env.HEIGHT||1000)},deviceScaleFactor:2});
 const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));let cdp;
 try{
  await page.bringToFront();
  if(phone)for(const old of browser.contexts()[0].pages())if(old!==page&&old.url().includes('/25_Nowherelands_II/'))await old.close();
  const deadline=Date.now()+15*60*1000;
  for(;;){const t=thermal();if(!phone||report.diagnostic&&process.env.ALLOW_HOT_DIAGNOSTIC==='1'||t.status<=Number(process.env.START_THERMAL_STATUS||1)&&t.skin<=Number(process.env.START_SKIN||37.5)){report.thermalStart=t;break;}if(!Number.isFinite(t.skin)||Date.now()>deadline)throw Error('Phone thermal gate failed');console.log('cooling',t);await page.waitForTimeout(30000);}
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);if(r.url().includes('/25_Nowherelands_II/js/')&&r.url().split('?')[0].endsWith('.js'))pending.push(r.body().then(body=>report.loadedSources[r.url()]=createHash('sha256').update(body).digest('hex')).catch(e=>report.errors.push(String(e))));});
  cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  if(process.env.TRACE_STAGES==='1'){
   await page.addInitScript(()=>{window.__glSlow=[];for(const key of ['getProgramInfoLog','bufferData','texImage2D','texSubImage2D']){const original=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-at;if(ms>3)__glSlow.push({key,at,ms,shaders:key==='getProgramInfoLog'?(this.getAttachedShaders(args[0])||[]).map(s=>this.getShaderSource(s)):undefined});}};}});
   await page.route('**/js/main.js*',async route=>{
    const response=await route.fetch();let body=await response.text();
    const measure=(call,name)=>`{const stageAt=performance.now();${call}const stageMs=performance.now()-stageAt;if(stageMs>5)(globalThis.__frameStages ||= []).push({name:'${name}',at:stageAt,ms:stageMs});}`;
    body=body.replace(/^(\s*)([a-zA-Z][\w.]*\.(?:update|advance|render|prepareReflection|advancePending))\(([^\n]*)$/gm,(line,space,name,tail)=>space+measure(`${name}(${tail}`,name));
    body=body.replace('terrain.update(player.position,dt);',measure('terrain.update(player.position,dt);','terrain.update'));
    await route.fulfill({response,body});
   });
  }
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8797/25_Nowherelands_II/?seed=fern');await page.waitForFunction(()=>window.__debug,null,{timeout:240000});
  await cdp.send('Runtime.evaluate',{expression:'__debug.hud.start({capture:false})',awaitPromise:true,userGesture:true});await page.waitForTimeout(5000);
  if(process.env.TRACE_STAGES==='1')await page.evaluate(()=>{
   const d=__debug;
   for(const [object,key,name] of [[d.terrain,'select','terrain.select'],[d.terrain,'build','terrain.build'],[d.terrain,'updateVegetation','terrain.vegetation'],[d.terrain,'sweep','terrain.sweep'],[d.terrain.vegetation,'update','vegetation.update'],[d.terrain.vegetation,'removeChunk','vegetation.removeChunk'],[d.terrain.vegetation,'removeFarChunk','vegetation.removeFarChunk'],[d.shared.plants,'buildNext','plants.buildNext'],[d.shared.plants,'disposeRetired','plants.disposeRetired'],[d.walkers,'drainRigs','walkers.drainRigs'],[d.walkers.model,'stream','walkers.stream'],[d.walkers.model,'update','walkers.model.update'],[d.waterLife,'add','waterLife.add'],[d.fauna.meshes,'update','fauna.meshes'],[d.fauna.model,'step','fauna.model.step'],[d.fauna.audio,'update','fauna.audio.update'],[d.fauna.audio,'prepareRays','fauna.audio.prepare'],[d.fauna.simulation,'update','fauna.simulation.update'],[d.fauna.light,'update','fauna.light.update'],[d.mites,'drainStream','mites.drainStream'],[d.shared.planarReflections,'capture','planar.capture']]){
    if(!object?.[key])continue;const original=object[key];object[key]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-at;if(ms>3)(globalThis.__frameStages ||= []).push({name,at,ms});}};
   }
  });
  page.on('console',message=>{if(['warning','error'].includes(message.type()))(report.console ||= []).push({type:message.type(),text:message.text()});});
  report.browser=await browser.version();report.device=await page.evaluate(()=>{const d=__debug,gl=d.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],pixelRatio:d.renderer.getPixelRatio(),targetFPS:d.hud.frameRate,presentationDepth:d.presentation?.depth,presentationActive:!!d.presentation?.active};});
  if(phone&&(!report.device.presentationActive||report.device.presentationDepth!==4))throw Error('Expected the default four-frame mobile presenter');
  await page.evaluate(capacity=>{
   const d=__debug,s=window.__frameTour={timestamps:new Float64Array(capacity),count:0,last:performance.now(),active:false,notes:0,pendants:0,original:d.hud.recordFrame,playerUpdate:d.player.update};
   d.hud.recordFrame=function(at){s.last=at;if(s.active){s.timestamps[s.count++]=at;const pending=s.pendingReaction;if(pending&&pending.model.fish.some(f=>f.escape?.at>=pending.time)){s.reactions.push(performance.now()-pending.at);s.pendingReaction=null;}}return s.original.call(this,at);};
   if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){s.longFrames=[];s.observer=new PerformanceObserver(list=>{if(s.active)for(const e of list.getEntries())s.longFrames.push(e.toJSON());});s.observer.observe({type:'long-animation-frame'});}
  },Math.ceil((capacitySeconds+60)*144));
  for(const kind of kinds){
   const seconds=sceneSeconds[kind]??Number(process.env.RUN_SECONDS||60);
   console.log('starting',kind);const t=thermal();
   if(profileCPU(kind)){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');}
   if(phone)await page.evaluate(capacity=>__debug.presentation.request('beginMeasurement',{capacity}),Math.ceil((seconds+30)*60));
   const start=await page.evaluate(({kind,seconds,rayLake})=>{
    const d=__debug,s=__frameTour;s.count=0;s.longFrames=[];s.notes=0;s.successfulNotes=0;s.reactions=[];s.pendingReaction=null;s.pendants=0;s.active=true;s.started=performance.now();s.first=s.last;s.distance=0;s.movingFrames=0;s.outsideWorld=0;s.caveFrames=0;s.playerFrames=0;s.waypoints=0;
    d.player.update=s.playerUpdate;d.player.keys.clear();
    if(kind==='walk'){
     d.faunaMenu.stop();
     d.player.position.set(-1071.4631,97.67768,414.52882);d.player.yaw=.3981578668;d.player.pitch=0;d.player.fly=true;d.player.locked=true;d.player.keys.add('KeyW');
     const yaw=d.player.yaw,began=performance.now(),limit=d.heightmap.size/2-768;
     const wx=d.player.position.x+d.heightmap.ox,wz=d.player.position.z+d.heightmap.oz,dx=-Math.sin(yaw),dz=-Math.cos(yaw);
     const edge=Math.min(dx?((dx>0?limit:-limit)-wx)/dx:Infinity,dz?((dz>0?limit:-limit)-wz)/dz:Infinity);
     const leg=Math.min(30,edge/150);if(leg<4)throw Error('Travel start is too close to the world boundary');s.travelLeg=leg;
     d.player.update=function(dt,time){const elapsed=(performance.now()-began)/1000,n=Math.floor(elapsed/leg),u=Math.min(1,(elapsed%leg)/3),turn=u*u*(3-2*u);this.yaw=yaw+(n?Math.PI*(n-1+turn):0);const x=this.position.x,z=this.position.z,result=s.playerUpdate.call(this,dt,time),moved=Math.hypot(this.position.x-x,this.position.z-z);s.distance+=moved;if(moved>.01)s.movingFrames++;if(Math.abs(this.position.x+d.heightmap.ox)>d.heightmap.size/2||Math.abs(this.position.z+d.heightmap.oz)>d.heightmap.size/2)s.outsideWorld++;return result;};
    }else if(kind==='forest'||kind.startsWith('cave-')){
     d.faunaMenu.stop();
     d.player.fly=false;d.player.locked=true;d.player.keys.add('KeyW');d.player.velocity.set(0,0,0);d.player.pitch=0;
     let path,index=1,direction=1;
     if(kind.startsWith('cave-')){
      const cave=d.world.caves.find(c=>!!c.wet===(kind==='cave-wet'));if(!cave)throw Error('Requested cave type is absent');
      path=cave.paths[0].points.slice(3,-2);if(path.length<2)throw Error('Cave route too short');
      d.player.position.set(path[0].x,path[0].floor+11,path[0].z);d.player.groundY=path[0].floor;
     }else{d.player.position.set(-1071.4631,97.67768,414.52882);d.player.yaw=.3981578668;}
     d.player.update=function(dt,time){
      if(path){let target=path[index],dx=target.x-this.position.x,dz=target.z-this.position.z;
       if(dx*dx+dz*dz<64){s.waypoints++;if(index===path.length-1)direction=-1;else if(index===0)direction=1;index+=direction;target=path[index];dx=target.x-this.position.x;dz=target.z-this.position.z;}
       this.yaw=Math.atan2(-dx,-dz);
      }else this.yaw+=dt*.14;
      const x=this.position.x,z=this.position.z,result=s.playerUpdate.call(this,dt,time),moved=Math.hypot(this.position.x-x,this.position.z-z);
      s.playerFrames++;if(d.shared.caveAmount>.9)s.caveFrames++;s.distance+=moved;if(moved>.01)s.movingFrames++;
      if(Math.abs(this.position.x+d.heightmap.ox)>d.heightmap.size/2||Math.abs(this.position.z+d.heightmap.oz)>d.heightmap.size/2)s.outsideWorld++;
      return result;
     };
    }else{d.player.locked=false;if(kind==='ray'&&rayLake!==null){const lake=d.fauna.lakes.find(l=>l.id===rayLake),group=lake&&d.fauna.addRaySite(d.fauna.raySite(lake));if(!group)throw Error('Requested ray lake is unavailable');d.faunaMenu.controller('ray').subject=group.members[0];}d.faunaMenu.visit(kind,false,false);}
    d.faunaMenu.setOpen(false);
    s.noteTimer=setInterval(()=>{const charges=[.2,.6,1];if(kind==='scarlet-fish'){const model=d.waterLife.entries.get(d.waterLife.focus?.id)?.model;if(model)s.pendingReaction={model,time:model.time,at:performance.now()};}d.shared.playerNotes.send(charges[s.notes%3]).then(sent=>{if(sent)s.successfulNotes++;});s.notes++;if(kind==='veil-willow'){const item=d.shared.plants.pendants[0];if(item){d.shared.plants.touchPendant(item,.6);s.pendants++;}}},6000);
    return{at:s.started,firstFrame:s.first,modelTime:d.fauna.model.time,audio:d.shared.audio.ctx.playbackStats.toJSON(),position:d.player.position.toArray(),reflections:{...d.shared.planarReflections.stats},seaReflections:{...d.water.reflectionStats},environment:{...d.environment.stats}};
   },{kind,seconds,rayLake:process.env.RAY_LAKE_ID===undefined?null:Number(process.env.RAY_LAKE_ID)});
   // No screenshots, result serialization, or diagnostic object allocation in
   // the timed interval. The phone's presentation worker records frame IDs.
   await page.waitForTimeout(seconds*1000);
   // Stop the clock before exporting worker arrays through DevTools. Export
   // serialization must not count as a game stall at the end of a run.
   const stopped=await page.evaluate(()=>{const d=__debug,s=__frameTour;s.active=false;clearInterval(s.noteTimer);d.player.keys.clear();d.player.update=s.playerUpdate;return{at:performance.now(),modelTime:d.fauna.model.time,audio:d.shared.audio.ctx.playbackStats.toJSON(),position:d.player.position.toArray(),reflections:{...d.shared.planarReflections.stats},seaReflections:{...d.water.reflectionStats},environment:{...d.environment.stats}};});
   if(profileCPU(kind)){const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(output,kind+'.cpuprofile'),JSON.stringify(profile));}
   let presentation;if(phone)presentation=await page.evaluate(()=>__debug.presentation.request('endMeasurement'));
   if(presentation){const stride=presentation.stride||2,rows=presentation.rows,kept=[];for(let i=0;i<rows.length;i+=stride)if(rows[i]>=start.at&&rows[i]<=stopped.at)for(let j=0;j<stride;j++)kept.push(rows[i+j]);presentation.rows=kept;}
   const end=await page.evaluate(()=>{
    const d=__debug,s=__frameTour;s.active=false;clearInterval(s.noteTimer);d.player.keys.clear();d.player.update=s.playerUpdate;
    return{at:performance.now(),frames:Array.from(s.timestamps.subarray(0,s.count)),longFrames:s.longFrames,stages:globalThis.__frameStages?.filter(r=>r.at>=s.started),gl:globalThis.__glSlow?.filter(r=>r.at>=s.started),modelTime:d.fauna.model.time,audio:d.shared.audio.ctx.playbackStats.toJSON(),position:d.player.position.toArray(),visibility:document.visibilityState,notes:s.notes,successfulNotes:s.successfulNotes,fishReactionMs:s.reactions,dropped:Math.max(0,s.count-s.timestamps.length),pendants:s.pendants,distance:s.distance,movingFrames:s.movingFrames,outsideWorld:s.outsideWorld,caveFrames:s.caveFrames,playerFrames:s.playerFrames,waypoints:s.waypoints,simulation:d.fauna.simulation?{active:d.fauna.simulation.active,failed:d.fauna.simulation.failed,reason:d.fauna.simulation.reason,stats:{...d.fauna.simulation.stats}}:null,population:d.fauna.model.creatures.length,retiredVegetation:d.terrain.vegetation.retiredMeshes?.length||0,weather:{...d.shared.weather.local},programs:d.renderer.info.programs.length,presentationFailed:!!d.presentation?.failed};
   });
   Object.assign(end,stopped);
   const intervals=end.frames.map((at,i)=>at-(i?end.frames[i-1]:start.firstFrame));
   const run={kind,start,end,temperatureStart:t,temperatureEnd:thermal(),interval:stats(intervals),simulationSeconds:end.modelTime-start.modelTime,audioUnderruns:end.audio.underrunEvents-start.audio.underrunEvents};
   if(presentation){const {rows,stride=2}=presentation,dt=[];let gaps=0;for(let i=stride;i<rows.length;i+=stride){dt.push(rows[i]-rows[i-stride]);if(rows[i+1]!==rows[i-stride+1]+1)gaps++;}run.presentation={...presentation,interval:stats(dt),sequenceGaps:gaps,starvations:presentation.end.starvations-presentation.start.starvations};}
   run.fps=1000/(run.presentation?.interval.mean??run.interval.mean);run.coverage=(end.frames.at(-1)-start.at)/(end.at-start.at);
   run.valid=end.visibility==='visible'&&run.coverage>.97&&!end.presentationFailed&&(!['walk','forest','cave-dry','cave-wet'].includes(kind)||end.distance>seconds*10&&!end.outsideWorld)&&(!phone||!run.presentation.sequenceGaps&&!run.presentation.dropped);
   report.runs.push(run);await Promise.all(pending);save();console.log(JSON.stringify({kind,valid:run.valid,fps:run.fps,interval:run.interval,presentation:run.presentation?{interval:run.presentation.interval,sequenceGaps:run.presentation.sequenceGaps,starvations:run.presentation.starvations}:null,audioUnderruns:run.audioUnderruns,distance:end.distance,skin:run.temperatureEnd?.skin}));
   await page.screenshot({path:path.join(output,`${report.runs.length}-${kind}.png`)});await page.waitForTimeout(1000);
  }
 }catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{save();if(phone){await cdp?.send('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});await page.close().catch(()=>{});}await browser.close();}
})();
