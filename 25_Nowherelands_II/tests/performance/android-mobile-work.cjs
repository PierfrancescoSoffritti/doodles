const {AndroidFrameTimeline}=require('./AndroidFrameTimeline.cjs');
const {AndroidSurfaceFrames}=require('./AndroidSurfaceFrames.cjs');
let activeSurface,activeAudioTimer,activeTimeline;
// Explicit device only; fresh loads, thermal gating, audio and simulation-clock accounting.
// Run from any directory with PLAYWRIGHT_MODULE, ADB and ANDROID_SERIAL set.
const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs');
const {createHash}=require('node:crypto'),path=require('node:path');
const output=process.env.MOBILE_OUTPUT||'/tmp/nowherelands-mobile';
const {execFileSync,spawn}=require('child_process');
const adb=process.env.ADB,serial=process.env.ANDROID_SERIAL;
if(!adb||!serial)throw Error('Set ADB and ANDROID_SERIAL for temperature-controlled device testing');
const thermal=()=>{const raw=execFileSync(adb,['-s',serial,'shell','dumpsys','thermalservice'],{encoding:'utf8',timeout:10000});const current=raw.split('Current temperatures from HAL:')[1]||'';return{at:new Date().toISOString(),status:Number(raw.match(/Thermal Status: (\d+)/)?.[1]),skin:Number(current.match(/mValue=([\d.]+), mType=3, mName=SKIN/)?.[1]),raw};};
const scenario=process.env.SCENARIO||'walk';
if(!['walk','lumen','forest','cave'].includes(scenario))throw Error('SCENARIO must be walk, lumen, forest or cave');
const duration=Number(process.env.RUN_SECONDS)||(scenario==='lumen'?45:scenario==='forest'?300:scenario==='cave'?120:90);
const variants=(process.env.VARIANTS||'after,before').split(',');
if(variants.some(v=>!['after','before'].includes(v)))throw Error('VARIANTS must contain before and/or after');
const gameURL=process.env.GAME_URL||'http://127.0.0.1:8797/25_Nowherelands_II/';
const stats=a=>{a=a.slice().sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)}};
(async()=>{fs.mkdirSync(output,{recursive:true});const b=await chromium.connectOverCDP(process.env.ANDROID_CDP||'http://127.0.0.1:9223');let p=b.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('25_Nowherelands_II')||p.url()==='about:blank');if(!p)throw Error('Open the game or a blank Chrome tab on the selected phone');let cdp;const report={at:new Date().toISOString(),serial,browser:await b.version(),runs:[],errors:[]};report.harness=createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');const root=path.resolve(__dirname,'../..');const sourceFiles=fs.readdirSync(path.join(root,'js'),{recursive:true}).filter(f=>f.endsWith('.js')).sort();report.sources=Object.fromEntries(sourceFiles.map(name=>['js/'+name,createHash('sha256').update(fs.readFileSync(path.join(root,'js',name))).digest('hex')]));if(process.env.OVERRIDE_JS_DIR)report.overrides=Object.fromEntries(fs.readdirSync(process.env.OVERRIDE_JS_DIR).filter(f=>f.endsWith('.js')).sort().map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(process.env.OVERRIDE_JS_DIR,name))).digest('hex')]));report.options=Object.fromEntries(['TRAVEL_TURN_SECONDS','NOTE_EVERY_SECONDS','EXPECT_PRESENT_DEPTH','CPU_PROFILE','SHARED_SIMULATION','BASELINE_NOISE_LOOKUP','CAVE_WET','MEMORY_AFTER','BASELINE_CAVE_FLOOR','GC_AFTER_SECONDS','STAGE_AFTER_SECONDS','PACER_TRACE','PACER_NOW','PACER_LATE','WORKER_PRESENT','OVERRIDE_JS_DIR','STAGE_TRACE','LONG_FRAMES','BASELINE_FAUNA_MESH','NO_AUDIO_RENDER','SCREEN_RECORD','NATIVE_SCHED','NATIVE_SCHED_ONLY','CHROME_TRACE','SILENT_SHIMMER','DISPLAY_HZ','GPU_TRACE','NO_BACKDROP','PERFETTO','MITE_SLOW','FRAME_HEIGHT','AUDIO_LATENCY','TIMED_RAF','GL_FLUSH','AUDIO_BLOCK_SPATIAL','AUDIO_RATE','MINIMAL','AUDIO_TRACE','SCENARIO','RUN_SECONDS','PROFILE_DEFAULTS','LUMEN_WORKER','TEST_RATIO','PLANT_RADIUS','RAF_CLOCK','AUX_FRAMES','AUX_TIMER','PLANT_BATCHES','BUFFER_FRAMES','HEIGHT_CACHE','SURFACE_FRAMES','GL_SLOW','GC_TRACE','HEAP_PROFILE','START_SKIN'].map(k=>[k,process.env[k]||null]));try{
for(const variant of variants){
 // A fresh tab evicts old worlds retained by Chrome's back/forward cache.
 // Repeated game -> blank -> game navigation otherwise retains several workers
 // and GPU worlds, producing memory-pressure results unrelated to one game.
 const previous=p;p=await previous.context().newPage();await p.goto('about:blank');await previous.close();
 cdp=await p.context().newCDPSession(p);await p.bringToFront();
 let audioContextId;const audioRealtime=[];if(process.env.AUDIO_TRACE==='1'){cdp.on('WebAudio.contextCreated',({context})=>{if(context.contextType==='realtime')audioContextId=context.contextId;});await cdp.send('WebAudio.enable');}
 const loadedSources={},pendingSources=[];
 p.on('response',response=>{const url=response.url();if(!url.includes('/25_Nowherelands_II/js/')||!url.split('?')[0].endsWith('.js'))return;pendingSources.push(response.body().then(body=>{loadedSources[url]=createHash('sha256').update(body).digest('hex');}).catch(error=>{loadedSources[url]={error:String(error)};}));});
 p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text()+(m.location().url?' ['+m.location().url+']':''))});
 p.on('response',r=>{if(r.status()>=400)(report.httpErrors ||= []).push({status:r.status(),url:r.url()});});

 if(process.env.OVERRIDE_JS_DIR)await p.route('**/*.js*',route=>{const url=new URL(route.request().url()),name=path.basename(url.pathname),file=path.join(process.env.OVERRIDE_JS_DIR,name);return url.pathname.includes('/25_Nowherelands_II/js/')&&fs.existsSync(file)?route.fulfill({contentType:'text/javascript',body:fs.readFileSync(file,'utf8')}):route.continue();});
 const instrumentStages=body=>{
  const labels=[];
  // Instrument the original call sites without replacing hot methods or
  // allocating per-frame objects. Keep only stages over 5 ms in a bounded buffer.
  body=body.replace(/^(\s*)([a-zA-Z][\w.]*\.(?:update|advance|render|prepareReflection|advancePending))\(([^\n]*)$/gm,(line,space,name,tail)=>{
   if(!body.includes(line))return line;
   const id=labels.push(name)-1;
   return `${space}{const stageAt=performance.now();${name}(${tail}const stageMs=performance.now()-stageAt;if(stageMs>5){const s=globalThis.__stageTrace;if(s&&stageAt>=s.after){if(s.count<10000){const i=s.count++*3;s.rows[i]=${id};s.rows[i+1]=stageAt;s.rows[i+2]=stageMs;}else s.dropped++;}}}`;
  });
  body=`globalThis.__stageTrace={labels:${JSON.stringify(labels)},rows:new Float64Array(30000),count:0,dropped:0,after:Infinity};\n`+body;
  return body;
 };
 if(process.env.BASELINE_NOISE_LOOKUP&&variant==='before')await p.route('**/js/world/NoiseLookup.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:fs.readFileSync(process.env.BASELINE_NOISE_LOOKUP,'utf8')});});
 if(process.env.BASELINE_CAVE_FLOOR&&variant==='before')await p.route('**/js/world/caves/CaveFloorSurface.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:fs.readFileSync(process.env.BASELINE_CAVE_FLOOR,'utf8')});});
 if(process.env.BASELINE_FAUNA_MESH&&variant==='before')await p.route('**/js/world/fauna/FaunaMeshes.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:fs.readFileSync(process.env.BASELINE_FAUNA_MESH,'utf8')});});
 if(process.env.SILENT_SHIMMER==='1'&&variant==='after')await p.route('**/js/audio/layers/Shimmer.js*',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('this.proximity = 0;','this.proximity = 0;this.trem.disconnect(this.out);this.branchMuted=true;').replace('update(dt, p) {','update(dt, p) {if(this.branchMuted&&this.unlocked){this.trem.connect(this.out);this.branchMuted=false;}');await route.fulfill({response,body});});
 if(process.env.PACER_LATE==='1')await p.route('**/js/core/FramePacer.js*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('const interval = 1000 / fps;', 'const interval = 1000 / fps, deliveredAt=performance.now();if(deliveredAt-now>=interval/3)now=deliveredAt;');await route.fulfill({response,body});});
 if(process.env.PACER_NOW==='1')await p.route('**/js/core/FramePacer.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('accept(now, fps) {','accept(now, fps) { now=performance.now();')});});
 if(process.env.DISPLAY_HZ)await p.route('**/js/core/FramePacer.js*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('const interval = 1000 / fps;',`const interval = fps===30?${3*1000/Number(process.env.DISPLAY_HZ)}:1000/fps;`);await route.fulfill({response,body});});
 if(process.env.GL_SLOW==='1')await p.addInitScript(()=>{window.__glSlow=[];for(const key of ['getProgramInfoLog','getProgramParameter','getUniformLocation','getActiveUniform','linkProgram','compileShader','bufferData','bufferSubData','texImage2D','texSubImage2D']){const original=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){const at=performance.now();try{return original.apply(this,args)}finally{const ms=performance.now()-at;if(ms>5)__glSlow.push({key,ms,at,environmentFace:window.__debug?.environment.face,shaders:key==='getProgramInfoLog'?(this.getAttachedShaders(args[0])||[]).map(shader=>this.getShaderSource(shader)):undefined})}}}});
 if(process.env.MITE_SLOW==='1')await p.route('**/js/audio/LanternMiteSamples.js*',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('export function lanternSamples(', 'function originalLanternSamples(');body+=`\nexport function lanternSamples(...args){const at=performance.now();try{return originalLanternSamples(...args);}finally{const ms=performance.now()-at;if(ms>3)(globalThis.__modelSlow ||= []).push({name:'lanternSamples',at,ms});}}\n`;await route.fulfill({response,body});});
 if(process.env.MODEL_SLOW==='1')await p.route('**/js/world/fauna/FaunaModel.js*',async route=>{const response=await route.fetch();let body=await response.text();for(const name of ['updatePebble','updateWorldRays']){body=body.replace(' '+name+',',' '+name+' as original_'+name+',');body+=`\nfunction ${name}(...args){const at=performance.now();try{return original_${name}(...args)}finally{const ms=performance.now()-at;if(ms>5)(globalThis.__modelSlow ||= []).push({name:'${name}',at,ms,id:args[0].id});}}\n`;}await route.fulfill({response,body});});
 if(process.env.GL_FLUSH==='1'||process.env.TIMED_RAF||process.env.AUDIO_LATENCY||process.env.FRAME_HEIGHT||process.env.STAGE_TRACE==='1'||process.env.RAF_CLOCK==='1')await p.route('**/js/main.js*',async route=>{
  const response=await route.fetch(),candidate=process.env.OVERRIDE_JS_DIR&&path.join(process.env.OVERRIDE_JS_DIR,'main.js');
  let body=candidate&&fs.existsSync(candidate)?fs.readFileSync(candidate,'utf8'):await response.text();
  if(process.env.GL_FLUSH==='1')body=body.replace('if(!post.buffered)hud.recordFrame(performance.now());','if(!post.buffered)hud.recordFrame(performance.now());else renderer.getContext().flush();');
  if(process.env.FRAME_HEIGHT==='1')body=body.replace('const advance = () => {','const advance = () => {heightCache?.reset();');
  if(process.env.AUDIO_LATENCY)body=body.replace(/latencyHint: config\.isTouch \? .* : 'interactive'/,"latencyHint: config.isTouch ? "+Number(process.env.AUDIO_LATENCY)+" : 'interactive'");
  if(process.env.TIMED_RAF){
   body=body.replace('requestAnimationFrame(frame);','');
   body=body.replace('\tframe();',`const tick=(timestamp)=>{frame(timestamp);const delay=mobileDetail&&hud.frameRate===30&&!document.hidden?Math.max(0,pacer.next-performance.now()-${Number(process.env.TIMED_RAF)}):0;if(delay>0)setTimeout(()=>requestAnimationFrame(tick),delay);else requestAnimationFrame(tick);};tick(performance.now());`);
  }
  if(process.env.RAF_CLOCK==='1')body=body.replace('function frame() {','function frame(timestamp = performance.now()) {').replace('pacer.accept(now, hud.frameRate)','pacer.accept(timestamp, hud.frameRate)');
  if(process.env.STAGE_TRACE==='1')body=instrumentStages(body);
  await route.fulfill({response,body});
 });
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 const deadline=Date.now()+15*60*1000;
 let temperature;
 do{temperature=thermal();if(!Number.isFinite(temperature.skin)||!Number.isFinite(temperature.status))throw Error('Device thermal readings are unavailable');console.log('cooling',variant,temperature.status,temperature.skin);if(temperature.status<=1&&temperature.skin<=Number(process.env.START_SKIN||35.5))break;if(Date.now()>deadline)throw Error('Phone did not cool enough for a comparable start');await p.waitForTimeout(30000);}while(true);
 report.thermalStart??={};report.thermalStart[variant]=temperature;
 await p.goto(gameURL+(process.env.PROFILE_DEFAULTS==='1'?'?seed=fern&fps=30'+(process.env.WORKER_PRESENT?'&workerPresent='+process.env.WORKER_PRESENT:'')+(process.env.SHARED_SIMULATION?'&sharedSimulationWorker='+(process.env.SHARED_SIMULATION==='compare'?(variant==='after'?'1':'0'):process.env.SHARED_SIMULATION):'')+(process.env.AUDIO_BLOCK_SPATIAL?'&audioBlockSpatial='+process.env.AUDIO_BLOCK_SPATIAL:'')+(process.env.AUDIO_RATE?'&audioRate='+process.env.AUDIO_RATE:''):'?seed=fern&fps=30&lumenWorker='+encodeURIComponent(process.env.LUMEN_WORKER||'0')+(process.env.HEIGHT_CACHE?'&heightCache='+process.env.HEIGHT_CACHE:'')+(process.env.BUFFER_FRAMES?'&bufferFrames='+process.env.BUFFER_FRAMES:'')+(process.env.LEAF_TRIM?'&leafTrim='+process.env.LEAF_TRIM:'')+(process.env.PLANT_BATCHES?'&plantBatches='+process.env.PLANT_BATCHES:'')+(process.env.AUX_TIMER?'&auxTimer='+process.env.AUX_TIMER:'')+(process.env.AUX_FRAMES?'&auxFrames='+process.env.AUX_FRAMES:'')+'&mobileDetail='+(variant==='after'?'1':'0')+(process.env.PLANT_RADIUS?'&plantRadius='+encodeURIComponent(process.env.PLANT_RADIUS):'')),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>!!window.__debug,null,{timeout:180000});
 await p.evaluate(()=>{const d=__debug;d.player.position.set(-1071.4631,97.67768,414.52882);d.player.yaw=.3981578668;d.faunaMenu?.setOpen(false)});
 await cdp.send('Runtime.evaluate',{expression:'__debug.hud.start({capture:false})',userGesture:true,awaitPromise:true});await p.waitForTimeout(12000);
 await Promise.all(pendingSources);report.loadedSources??={};report.loadedSources[variant]=loadedSources;
 console.log('ready',variant);
 if(process.env.NO_AUDIO_RENDER==='1'&&variant==='after')await p.evaluate(()=>__debug.shared.audio.analyser.disconnect());
 if(process.env.NO_BACKDROP==='1')await p.addStyleTag({content:'.fauna-menu-toggle,.fauna-guide{backdrop-filter:none!important}'});
 const temperatureAtReady=thermal();
 if(process.env.TEST_RATIO)await p.evaluate(r=>{const d=__debug;d.renderer.setPixelRatio(r);d.post.composer.setPixelRatio(r);d.sky.clouds.uniforms.uResolution.value.set(d.renderer.domElement.width,d.renderer.domElement.height)},Number(process.env.TEST_RATIO));
 const scene=await p.evaluate(()=>{const d=__debug,v=d.terrain.vegetation,attrs=new Set();let total=0,meshes=0;for(const chunks of[v.chunks,v.farChunks])for(const c of chunks.values())for(const m of c.meshes){meshes++;for(const a of[m.geometry.index,...Object.values(m.geometry.attributes)].filter(Boolean)){total+=a.array.byteLength;attrs.add(a)}}return{audioLayers:Object.fromEntries(Object.entries(d.shared.conductor.layers).map(([name,l])=>[name,{unlocked:l.unlocked,current:l.current,branchMuted:l.branchMuted}])),deviceMemory:navigator.deviceMemory,profile:{presentation:!!d.presentation?.active,presentationDepth:d.presentation?.depth,buffered:d.post.buffered,worker:!!d.fauna.simulation?.active,aux:d.water.deferReflection,batches:!!d.plantBatches,heightCache:!!d.heightCache,plantRadius:d.terrain.vegetation.radius},programs:d.renderer.info.programs.length,position:d.player.position.toArray(),time:d.fauna.model.time,meshes,plantBytesIfCloned:total,plantUniqueBytes:[...attrs].reduce((n,a)=>n+a.array.byteLength,0),shaderDiagnostics:d.renderer.debug.checkShaderErrors,postFused:d.post.fused,faunaCull:d.fauna.meshes.cullLumen,audio:d.shared.audio.ctx.baseLatency,audioRate:d.shared.audio.ctx.sampleRate,ratio:d.renderer.getPixelRatio(),loadedStep:d.fauna.model.step.toString(),sharedBuffers:!!v.geometryBounds}});
 if(process.env.EXPECT_PRESENT_DEPTH&&scene.profile.presentationDepth!==Number(process.env.EXPECT_PRESENT_DEPTH))throw Error('Unexpected presentation depth: '+scene.profile.presentationDepth);
 for(const walking of (scenario==='lumen'?[false]:(scenario==='forest'||scenario==='cave')?[true]:[false,true])){
 if(process.env.SPRAY_SLOW==='1')await p.evaluate(async()=>{const{ReedWalkerSpray}=await import('./js/world/fauna/ReedWalkerSpray.js?v=world-spray-1');for(const key of ['configure','update']){const original=ReedWalkerSpray.prototype[key];ReedWalkerSpray.prototype[key]=function(...args){const at=performance.now();try{return original.apply(this,args)}finally{const ms=performance.now()-at;if(ms>5)(window.__spraySlow ||= []).push({key,at,ms});}};}});
 if(scenario==='lumen'){await p.evaluate(()=>{__debug.faunaMenu.visit('lumen');__debug.faunaMenu.setOpen(false)});await p.waitForTimeout(5000);await cdp.send('Runtime.evaluate',{expression:'__debug.fauna.playerRayNote(.6)',userGesture:true});}
 if(scenario==='cave'){
  await p.evaluate(wet=>{const d=__debug,cave=d.world.caves.find(c=>!!c.wet===wet)||d.world.caves[0],path=cave.paths[0].points.slice(3,-2);if(path.length<2)throw Error('Cave route too short');d.caveTestPath=path;const a=path[0],b=path[1];d.player.position.set(a.x,a.floor+11,a.z);d.player.groundY=a.floor;d.player.yaw=Math.atan2(a.x-b.x,a.z-b.z);d.player.pitch=0;d.faunaMenu.setOpen(false);},process.env.CAVE_WET==='1');
  await p.waitForTimeout(5000);
 }
 let start=await p.evaluate(({walking,turning,duration})=>{const d=__debug,s=window.__stutter={rows:[],hud:d.hud.recordFrame,fauna:d.fauna.update,terrain:d.terrain.update,cost:0,terrainCost:0,extra:{},originals:{},raf:[],pacer:d.pacer.accept,audioEvents:[]};d.pacer.accept=function(now,fps){const accepted=s.pacer.call(this,now,fps);s.raf.push([now,performance.now(),accepted]);return accepted};d.fauna.update=function(...a){const t=performance.now();try{return s.fauna.apply(this,a)}finally{s.cost+=performance.now()-t}};d.terrain.update=function(...a){const t=performance.now();try{return s.terrain.apply(this,a)}finally{s.terrainCost+=performance.now()-t}};for(const name of ['reedCall','reedPlan','reedStream','reedSync','birdStream','birdChoice','birdRoute','birdSky','faunaStream','faunaStep','faunaMeshes','faunaLight','faunaAudio','mites','miteSites','miteAdd','miteStream','environment','post','localLights','inland','birds','walkers','drift','atmosphere','sky','shoreMap','player','faunaMenu','reflection']){const target=({reedCall:d.walkers,reedPlan:d.walkers.model,reedStream:d.walkers.model,reedSync:d.walkers,birdStream:d.birds,birdChoice:d.birds,birdRoute:d.birds,birdSky:d.birds.sky,faunaStream:d.fauna,faunaStep:d.fauna.model,faunaMeshes:d.fauna.meshes,faunaLight:d.fauna.light,faunaAudio:d.fauna.audio})[name]||(name==='reflection'?d.water:name.startsWith('mite')?d.mites:d[name]),key=({reedCall:'call',reedPlan:'plan',reedStream:'stream',reedSync:'sync',birdStream:'stream',birdChoice:'changeTree',birdRoute:'clearRoute',faunaStream:'stream',faunaStep:'step',miteSites:'siteFor',miteAdd:'add',miteStream:'stream',post:'render',reflection:'captureReflection'})[name]||'update';if(!target?.[key])continue;s.originals[name]=[target,key,target[key]];target[key]=function(...args){const t=performance.now();try{if(name==='player'&&turning)this.yaw+=(args[0]||0)*.14;return s.originals[name][2].apply(this,args)}finally{s.extra[name]=(s.extra[name]||0)+performance.now()-t}}}d.hud.recordFrame=function(...a){if(s.rows.length%15===0)s.audioEvents.push({at:performance.now(),...d.shared.audio.ctx.playbackStats.toJSON()});s.rows.push({at:performance.now(),fauna:s.cost,terrain:s.terrainCost,...s.extra});const result=s.hud.apply(this,a);s.extra={};s.cost=0;s.terrainCost=0;return result};s.restore=()=>{for(const [target,key,method]of Object.values(s.originals))target[key]=method;d.pacer.accept=s.pacer;d.hud.recordFrame=s.hud;d.fauna.update=s.fauna;d.terrain.update=s.terrain;d.player.keys.delete('KeyW');delete window.__stutter};s.timer=setTimeout(s.restore,(duration+20)*1000);if(walking)d.player.keys.add('KeyW');return{frameStats:{...d.post.frameStats},visibility:document.visibilityState,wall:performance.now(),modelTime:d.fauna.model.time,audio:d.shared.audio.ctx.playbackStats.toJSON(),position:d.player.position.toArray()}},{walking,turning:scenario==='forest',duration});
 if(process.env.MINIMAL==='1')await p.evaluate(({turning,duration})=>{
  const d=__debug,s=__stutter;
  for(const[name,[target,key,original]]of Object.entries(s.originals)){
   target[key]=original;
   if(name==='player'&&turning)target[key]=function(dt,time){this.yaw+=dt*.14;return original.call(this,dt,time);};
   else delete s.originals[name];
  }
  d.pacer.accept=s.pacer;d.fauna.update=s.fauna;d.terrain.update=s.terrain;
  // Acceptance collection must not grow a heap of per-frame objects or run
  // audio diagnostics during gameplay. Convert these timestamps only at export.
  s.timestamps=new Float64Array(Math.ceil((duration+30)*120));s.count=0;
  d.hud.recordFrame=function(now){s.timestamps[s.count++]=now;return s.hud.call(this,now);};
 },{turning:scenario==='forest',duration});
 if(process.env.PACER_TRACE==='1')await p.evaluate(duration=>{const d=__debug,s=__stutter;s.pacerRows=new Float64Array(Math.ceil((duration+30)*144)*4);s.pacerCount=0;d.pacer.accept=function(timestamp,fps){const now=performance.now(),next=this.next,accepted=s.pacer.call(this,timestamp,fps);const i=s.pacerCount++*4;s.pacerRows[i]=timestamp;s.pacerRows[i+1]=now;s.pacerRows[i+2]=next;s.pacerRows[i+3]=accepted?1:0;return accepted;};},duration);
 if(scenario==='cave')await p.evaluate(()=>{
  const d=__debug,s=__stutter,old=d.player.update,path=d.caveTestPath;
  const walk=s.caveWalk={frames:0,insideFrames:0,waypoints:0,index:1,direction:1};
  s.originals.cavePlayer=[d.player,'update',old];
  d.player.update=function(dt,time){
   let target=path[walk.index],dx=target.x-this.position.x,dz=target.z-this.position.z;
   if(dx*dx+dz*dz<64){walk.waypoints++;if(walk.index===path.length-1)walk.direction=-1;else if(walk.index===0)walk.direction=1;walk.index+=walk.direction;target=path[walk.index];dx=target.x-this.position.x;dz=target.z-this.position.z;}
   this.yaw=Math.atan2(-dx,-dz);walk.frames++;if(d.shared.caveAmount>.9)walk.insideFrames++;
   return old.call(this,dt,time);
  };
 });
 if(scenario==='walk'&&walking)await p.evaluate(turnSeconds=>{
  const d=__debug,s=__stutter,record=d.hud.recordFrame,position=d.player.position;
  const movement=s.movement={frames:0,movingFrames:0,outsideWorldFrames:0,distance:0,lastX:position.x,lastZ:position.z};
  if(turnSeconds>0){
   const old=d.player.update,yaw=d.player.yaw,began=performance.now(),limit=d.heightmap.size/2-256;
   const wx=position.x+d.heightmap.ox,wz=position.z+d.heightmap.oz,dx=-Math.sin(yaw),dz=-Math.cos(yaw);
   const edge=Math.min(dx?((dx>0?limit:-limit)-wx)/dx:Infinity,dz?((dz>0?limit:-limit)-wz)/dz:Infinity);
   if(edge<256)throw Error('Travel start is too close to the generated world boundary');
   const leg=Math.min(turnSeconds,edge/72);movement.turnSeconds=leg;
   s.originals.travelPlayer=[d.player,'update',old];
   d.player.update=function(dt,time){const elapsed=(performance.now()-began)/1000,n=Math.floor(elapsed/leg),u=Math.min(1,(elapsed%leg)/3),turn=u*u*(3-2*u);this.yaw=yaw+(n?Math.PI*(n-1+turn):0);return old.call(this,dt,time);};
  }
  d.hud.recordFrame=function(now){const dx=position.x-movement.lastX,dz=position.z-movement.lastZ,distance=Math.sqrt(dx*dx+dz*dz);movement.frames++;if(Math.abs(position.x+d.heightmap.ox)>d.heightmap.size/2||Math.abs(position.z+d.heightmap.oz)>d.heightmap.size/2)movement.outsideWorldFrames++;if(distance>.01)movement.movingFrames++;movement.distance+=distance;movement.lastX=position.x;movement.lastZ=position.z;return record.call(this,now);};
 },Number(process.env.TRAVEL_TURN_SECONDS)||0);
 if(scenario==='lumen')await p.evaluate(()=>{
  const d=__debug,s=__stutter,old=d.faunaMenu.guide;
  const watch=s.lumenWatch={frames:0,coarseFrames:0,missingFrames:0};
  s.originals.lumenGuide=[d.faunaMenu,'guide',old];
  d.faunaMenu.guide=function(dt){const result=old.call(this,dt),c=this.active?.subject;watch.frames++;if(!c||c.kind!=='lumen')watch.missingFrames++;else if(c.navigation.coarse)watch.coarseFrames++;return result;};
 });
 if(Number(process.env.NOTE_EVERY_SECONDS)>0)await p.evaluate(seconds=>{
  const s=__stutter,restore=s.restore;s.scriptedNotes={attempts:0,sent:0,intervalSeconds:seconds,charges:[.2,.6,1]};
  s.noteTimer=setInterval(async()=>{if(window.__stutter!==s){clearInterval(s.noteTimer);return;}const charge=s.scriptedNotes.charges[s.scriptedNotes.attempts%3];s.scriptedNotes.attempts++;if(await __debug.shared.playerNotes.send(charge))s.scriptedNotes.sent++;},seconds*1000);
  s.restore=()=>{clearInterval(s.noteTimer);restore();};
 },Number(process.env.NOTE_EVERY_SECONDS));
 if(process.env.STAGE_TRACE==='1')await p.evaluate(()=>{
  const d=__debug,s=__stutter,trace=__stageTrace,old=d.terrain.recordStreamStep,labels=new Map();
  s.originals.terrainSlowStage=[d.terrain,'recordStreamStep',old];
  d.terrain.recordStreamStep=function(stage,work){const at=performance.now();try{return old.call(this,stage,work);}finally{
   const ms=performance.now()-at;if(ms>5&&at>=trace.after){if(trace.count<10000){const name='terrain.'+(stage||this.vegetation.streamStage);let id=labels.get(name);if(id===undefined){id=trace.labels.push(name)-1;labels.set(name,id);}const i=trace.count++*3;trace.rows[i]=id;trace.rows[i+1]=at;trace.rows[i+2]=ms;}else trace.dropped++;}
  }};
 });
 if(process.env.LONG_FRAMES==='1')await p.evaluate(()=>{
  const s=__stutter;s.longFrames=[];s.longFramesDropped=0;s.longFramesSupported=PerformanceObserver.supportedEntryTypes.includes('long-animation-frame');
  if(!s.longFramesSupported)return;
  s.saveLongFrames=entries=>{for(const entry of entries){if(s.longFrames.length<1000){const row=entry.toJSON();row.scripts=entry.scripts.map(script=>script.toJSON());s.longFrames.push(row);}else s.longFramesDropped++;}};
  s.longFrameObserver=new PerformanceObserver(list=>s.saveLongFrames(list.getEntries()));s.longFrameObserver.observe({type:'long-animation-frame'});
  const restore=s.restore;s.restore=()=>{s.longFrameObserver.disconnect();restore();};
 });
 if(process.env.GPU_TRACE==='1')await p.evaluate(()=>{
  const d=__debug,gl=d.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const state=window.__gpuTrace={supported:!!ext,rows:[],pending:[],dropped:0};if(!ext)return;
  const original=d.post.render;__stutter.originals.gpuPost=[d.post,'render',original];
  d.post.render=function(...args){
   const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
   while(state.pending.length&&gl.getQueryParameter(state.pending[0].q,gl.QUERY_RESULT_AVAILABLE)){
    const item=state.pending.shift(),ns=gl.getQueryParameter(item.q,gl.QUERY_RESULT);gl.deleteQuery(item.q);
    if(!disjoint)state.rows.push({at:item.at,ms:ns/1e6});else state.dropped++;
   }
   if(state.pending.length>8)return original.apply(this,args);
   const q=gl.createQuery(),at=performance.now();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
   try{return original.apply(this,args);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);state.pending.push({q,at});}
  };
 });
 let recording;
 if(process.env.SCREEN_RECORD==='1'){
  const devicePath='/sdcard/codex-game-'+Date.now()+'.mp4';
  const child=spawn(adb,['-s',serial,'shell','screenrecord','--size','540x1170','--bit-rate','4000000','--time-limit',String(Math.min(180,duration+8)),devicePath]);
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('screenrecord exit '+code)));});
  recording={devicePath,done,at:Date.now()};
 }
 if(process.env.PERFETTO==='1'){activeTimeline=new AndroidFrameTimeline(adb,serial,output);activeTimeline.start(duration);}
 if(process.env.CPU_PROFILE==='1'&&walking){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');}
 // Let instrumentation deoptimization settle before the timed interval.
 await p.waitForTimeout(1500);
 start=await p.evaluate(stageDelay=>{const d=__debug,s=__stutter,wall=performance.now();if(globalThis.__stageTrace){__stageTrace.count=0;__stageTrace.dropped=0;__stageTrace.after=wall+stageDelay;}s.count=0;s.pacerCount=0;s.rows.length=0;s.raf.length=0;s.audioEvents.length=0;if(s.longFrames)s.longFrames.length=0;s.cost=0;s.terrainCost=0;s.extra={};return{frameStats:{...d.post.frameStats},visibility:document.visibilityState,wall,modelTime:d.fauna.model.time,audio:d.shared.audio.ctx.playbackStats.toJSON(),position:d.player.position.toArray()};},Number(process.env.STAGE_AFTER_SECONDS||process.env.GC_AFTER_SECONDS||0)*1000);
 if(process.env.WORKER_PRESENT==='1')await p.evaluate(capacity=>{if(!__debug.presentation?.active||__debug.presentation.failed)throw Error('Separate presentation is not active');return __debug.presentation.request('beginMeasurement',{capacity});},Math.ceil(duration*60+100));
 if(process.env.SURFACE_FRAMES==='1'){activeSurface=new AndroidSurfaceFrames(adb,serial);activeSurface.start();}
 if(process.env.AUDIO_TRACE==='1')activeAudioTimer=setInterval(()=>{if(audioContextId)cdp.send('WebAudio.getRealtimeData',{contextId:audioContextId}).then(r=>audioRealtime.push({at:Date.now(),...r.realtimeData})).catch(error=>audioRealtime.push({error:String(error)}));},1000);
 if(process.env.HEAP_PROFILE==='1'&&walking)await cdp.send('HeapProfiler.startSampling',{samplingInterval:65536,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
 const measureMs=(walking||scenario==='lumen'?duration:30)*1000,traceDelay=process.env.GC_TRACE==='1'?Math.min(measureMs-1000,Math.max(0,Number(process.env.GC_AFTER_SECONDS)||0)*1000):0;
 if(traceDelay)await p.waitForTimeout(traceDelay);
 if(process.env.GC_TRACE==='1'){await cdp.send('Tracing.start',{categories:process.env.CHROME_TRACE==='1'?'-*,toplevel,cc,gpu,audio,disabled-by-default-audio,v8,disabled-by-default-v8.gc,blink.user_timing':'-*,disabled-by-default-v8.gc,blink.user_timing',transferMode:'ReturnAsStream'});await p.evaluate(()=>performance.mark('benchmark-clock-'+performance.now()));if(process.env.WORKER_PRESENT==='1')await p.evaluate(()=>__debug.presentation.request('markClock'));}
 await p.waitForTimeout(measureMs-traceDelay);
 // Stop display collection before serializing thousands of diagnostic rows.
 // DevTools result serialization can itself stall the page after the timed run.
 const surface=activeSurface?.stop();activeSurface=null;activeTimeline?.stop();clearInterval(activeAudioTimer);activeAudioTimer=null;
 let presentationMeasurement=null;if(process.env.WORKER_PRESENT==='1'){try{presentationMeasurement=await p.evaluate(()=>__debug.presentation.request('endMeasurement'));}catch(error){presentationMeasurement={error:String(error)};}}
 const end=await p.evaluate(()=>{const d=__debug,s=__stutter,wall=performance.now();s.saveLongFrames?.(s.longFrameObserver.takeRecords());const r={presentation:d.presentation?{active:d.presentation.active,failed:d.presentation.failed}:null,surfaceWork:d.shared.surfaceWork?.stats,staticWaterCopies:d.staticWaterCopies?{...d.staticWaterCopies}:null,caveWalk:s.caveWalk,movement:s.movement,lumenWatch:s.lumenWatch,scriptedNotes:s.scriptedNotes,caveAmount:d.shared.caveAmount,caveGridStats:globalThis.__caveGridStats,faunaStepCounts:d.fauna.stepCounts,caveFloorCache:{hits:d.heightmap.caveFloorSurface?.cacheHits,misses:d.heightmap.caveFloorSurface?.cacheMisses,bytes:d.heightmap.caveFloorSurface?.sampleCache?.byteLength,referencesBytes:d.heightmap.caveFloorSurface?.references.byteLength,cells:d.heightmap.caveFloorSurface?.cells.size},stageTrace:globalThis.__stageTrace?{after:__stageTrace.after,dropped:__stageTrace.dropped,labels:__stageTrace.labels,rows:Array.from(__stageTrace.rows.subarray(0,__stageTrace.count*3))}:null,longFrames:s.longFrames,longFramesSupported:s.longFramesSupported,longFramesDropped:s.longFramesDropped,gpu:window.__gpuTrace?{supported:__gpuTrace.supported,rows:__gpuTrace.rows,dropped:__gpuTrace.dropped}:null,audioDetail:{rayCalls:d.fauna.audio?.history.filter(v=>v.kind==='ray'),rayPending:d.fauna.audio?.pendingRays.size,rayBuffers:d.fauna.audio?.rayBank?.cache.size,replies:d.shared.playerNotes.replies?.history,replyPending:d.shared.playerNotes.replies?.pending.length},heightCache:d.heightCache?{hits:d.heightCache.hits,misses:d.heightCache.misses}:null,glSlow:window.__glSlow,modelSlow:window.__modelSlow,spraySlow:window.__spraySlow,frameStats:{...d.post.frameStats},rows:s.timestamps?Array.from(s.timestamps.subarray(0,s.count),at=>({at,fauna:0,terrain:0})):s.rows,raf:s.raf,pacerTrace:s.pacerRows?Array.from(s.pacerRows.subarray(0,s.pacerCount*4)):null,audioEvents:s.audioEvents,modelTime:d.fauna.model.time,visibility:document.visibilityState,wall,environmentWork:d.environment.stats,plantBatches:d.plantBatches?.stats,programs:d.renderer.info.programs.length,terrainStreaming:d.terrain.streamStats,birdSpawnMax:d.birds.sky.maxSpawnSlice,birdStreamMax:d.birds.maxStreamSlice,reedBuildMax:d.walkers.maxBuildStepMs,reflections:d.water.reflectionStats,miteStreaming:{...d.mites.streamStats,error:d.mites.streamError,pending:!!d.mites.streamWork,waiting:d.mites.streamWaiting},nearBranchCoarse:d.faunaMenu.active?.subject?.navigation?.coarse,pool:d.localLights?.slots.length,population:d.fauna.model.creatures.filter(c=>c.kind==='lumen').length,distant:d.fauna.model.creatures.filter(c=>c.kind==='lumen'&&c.navigation.coarse).length,simulation:d.fauna.simulation?{active:d.fauna.simulation.active,reason:d.fauna.simulation.reason,stats:d.fauna.simulation.stats}:null,audio:d.shared.audio.ctx.playbackStats.toJSON(),position:d.player.position.toArray()};clearTimeout(s.timer);s.restore();return r});
 // Preserve the completed measurement even if optional trace extraction fails.
 fs.writeFileSync(output+'/measurement-'+variant+'-'+(walking?'walk':'stationary')+'.json',JSON.stringify({variant,scenario,walking,scene,start,...end},null,2));
 if(process.env.CPU_PROFILE==='1'&&walking){const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(output+'/walk.cpuprofile',JSON.stringify(profile));await cdp.send('Profiler.disable');}
 if(process.env.GC_TRACE==='1'){const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await complete;const fd=fs.openSync(output+'/'+(walking?'walk':'stationary')+'.trace.json','w');try{for(;;){const chunk=await cdp.send('IO.read',{handle:stream});fs.writeSync(fd,chunk.base64Encoded?Buffer.from(chunk.data,'base64'):chunk.data);if(chunk.eof)break;}}finally{fs.closeSync(fd);await cdp.send('IO.close',{handle:stream});}}
 if(process.env.HEAP_PROFILE==='1'&&walking){const {profile}=await cdp.send('HeapProfiler.stopSampling');fs.writeFileSync(output+'/allocations.json',JSON.stringify(profile));}
 const frameTimeline=activeTimeline?.save();activeTimeline=null;
 if(recording){await recording.done;execFileSync(adb,['-s',serial,'pull',recording.devicePath,output+'/screen.mp4'],{timeout:30000});execFileSync(adb,['-s',serial,'shell','rm',recording.devicePath],{timeout:10000});}
 const r={presentationMeasurement,recording:recording?{started:recording.at,path:output+'/screen.mp4'}:null,frameTimeline,audioRealtime,surface,variant,scenario,walking,scene,start,...end,temperatureAtReady,temperatureAtEnd:thermal(),interval:stats(end.rows.slice(1).map((v,i)=>v.at-end.rows[i].at)),fauna:stats(end.rows.map(v=>v.fauna)),terrain:stats(end.rows.map(v=>v.terrain))};r.coverage=(end.rows.at(-1).at-end.rows[0].at)/(end.wall-start.wall);r.valid=r.coverage>.97&&end.visibility==='visible';
 if(process.env.WORKER_PRESENT==='1'){
  const m=presentationMeasurement,rows=m?.rows||[],stride=m?.stride||2,intervals=[];let sequenceGaps=0;
  for(let i=stride;i<rows.length;i+=stride){intervals.push(rows[i]-rows[i-stride]);if(rows[i+1]!==rows[i-stride+1]+1)sequenceGaps++;}
  r.presentationCheck={frames:rows.length/stride,interval:intervals.length?stats(intervals):null,sequenceGaps,dropped:m?.dropped,starvations:m?.end?.starvations-m?.start?.starvations,error:m?.error};
  r.valid=r.valid&&end.presentation?.active&&!end.presentation?.failed&&rows.length>2&&!sequenceGaps&&!m?.dropped&&!m?.error;
 }
 r.fps=1000/r.interval.mean;r.underruns=end.audio.underrunEvents-start.audio.underrunEvents;r.simulationSeconds=end.modelTime-start.modelTime;report.runs.push(r);console.log(JSON.stringify({variant,walking,surface:surface?{fps:surface.fps,interval:surface.interval,coverage:surface.coverage,frameRatio:surface.rows.length/end.rows.length}:null,valid:r.valid,coverage:r.coverage,fps:r.fps,interval:r.interval,fauna:r.fauna,terrain:r.terrain,underruns:r.underruns,simulationSeconds:end.modelTime-start.modelTime,simulation:end.simulation?{...end.simulation,stats:{...end.simulation.stats,slowFrames:undefined}}:null,distant:end.distant,skin:r.temperatureAtEnd.skin,thermalStatus:r.temperatureAtEnd.status}));fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));
 }
 fs.writeFileSync(output+'/'+variant+'.png',execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{timeout:10000,maxBuffer:16*1024*1024}));
}
if(process.env.MEMORY_AFTER==='1')report.memoryAfter=await require('./AndroidMemory.cjs').collectAndroidMemory(adb,serial,process.env.ANDROID_CDP||'http://127.0.0.1:9223');
await p.goto('about:blank');
}catch(error){report.failure=String(error);throw error;}finally{activeTimeline?.stop();clearInterval(activeAudioTimer);activeSurface?.stop();activeSurface=null;fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));await p.evaluate(()=>{if(window.__stutter){clearTimeout(__stutter.timer);__stutter.restore()}}).catch(()=>{});await p.goto('about:blank').catch(()=>{});await p.unrouteAll({behavior:'wait'});await cdp.send('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
