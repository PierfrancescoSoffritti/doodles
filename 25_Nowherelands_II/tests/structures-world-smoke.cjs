const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_URL||'http://127.0.0.1:8793/25_Nowherelands_II/';
const output=process.env.STRUCTURE_OUTPUT||'/tmp/nowherelands-structures-world';
const seconds=Number(process.env.SAMPLE_SECONDS||12);
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--autoplay-policy=no-user-gesture-required']});
 const report={scope:'Short headless desktop integration/overhead check; not a sustained device acceptance run.',errors:[],seeds:[],samples:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))report.errors.push(m.text());});
  const cdp=await page.context().newCDPSession(page);
  async function open(seed,disabled=false){
   await page.goto(base+'?seed='+seed+'&structures='+(disabled?'off':'resonant-gate'));
   await page.waitForFunction(()=>window.__debug,null,{timeout:240000});
   await cdp.send('Runtime.evaluate',{expression:'__debug.hud.start({capture:false})',awaitPromise:true,userGesture:true});
   await page.waitForFunction(()=>__debug.player.enabled&&__debug.shared.audio?.ctx.state==='running');
   await page.evaluate(()=>__debug.faunaMenu.setOpen(false));await page.waitForTimeout(4000);
  }
  async function sample(label){
   await page.evaluate(()=>{const d=__debug,s=d.shared.structures;window.__structureMeasure={times:[],update:[],originalFrame:d.hud.recordFrame,originalUpdate:s.update};d.hud.recordFrame=function(t){__structureMeasure.times.push(t);return __structureMeasure.originalFrame.call(this,t);};s.update=function(dt){const at=performance.now();__structureMeasure.originalUpdate.call(this,dt);__structureMeasure.update.push(performance.now()-at);};});
   await page.waitForTimeout(seconds*1000);
   const result=await page.evaluate(()=>{const d=__debug,m=__structureMeasure;d.hud.recordFrame=m.originalFrame;d.shared.structures.update=m.originalUpdate;const summarize=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};return {frames:m.times.length,interval:summarize(m.times.slice(1).map((t,i)=>t-m.times[i])),structureUpdateMs:summarize(m.update),programs:d.renderer.info.programs.length,geometryCount:d.renderer.info.memory.geometries,audio:d.shared.audio.ctx.playbackStats?.toJSON?.()};});
   report.samples.push({label,...result});
  }
  await open('umbra');
  const first=await page.evaluate(()=>({sites:__debug.shared.structures.sites.map(({stones,route,...site})=>({...site,stoneCount:stones?.length})),stats:__debug.shared.structures.stats}));report.seeds.push({seed:'umbra',...first});assert.equal(first.sites.length,3);assert.equal(first.stats.draws,4);assert.ok(first.stats.triangles<3500,'wear stays within the small static geometry budget');
  const wear=await page.evaluate(()=>{const s=__debug.shared,g=s.structures.entries.find(e=>e.seam),geo=g.mesh.geometry;return {mask:s.gateGround.uGateGround.value.image.data.byteLength,active:s.gateGround.uGateActive.value,material:g.mesh.material.userData.wear.value,finite:Array.from(geo.attributes.position.array).every(Number.isFinite)&&Array.from(geo.attributes.normal.array).every(Number.isFinite)};});assert.equal(wear.mask,65536);assert.equal(wear.active,1);assert.equal(wear.material,1);assert.ok(wear.finite);
  await sample('umbra / gate enabled');
  for(const kind of ['resonant-gate','listening-fold','horizon-frame']){
   await page.evaluate(kind=>{__debug.faunaMenu.visit(kind,false,false);__debug.faunaMenu.setOpen(false);},kind);await page.waitForTimeout(2500);
   if(kind==='resonant-gate'){
    const response=await page.evaluate(async()=>{const s=__debug.shared,e=s.structures.entries.find(e=>e.seam),p=s.player,c=Math.cos(e.site.yaw),n=Math.sin(e.site.yaw);p.position.set(e.site.x+n*26,s.heightmap.height(e.site.x+n*26,e.site.z+c*26)+11,e.site.z+c*26);await s.playerNotes.send(0);return {count:s.structures.stats.responses,flash:e.model.flash};});assert.ok(response.count>0&&response.flash>0);
    // Exercise the real player controller along the complete open passage.
    await cdp.send('Runtime.evaluate',{expression:'__debug.renderer.domElement.requestPointerLock()',awaitPromise:true,userGesture:true});await page.waitForFunction(()=>__debug.player.locked);await page.evaluate(()=>{__debug.player.keys.add('KeyW');});await page.waitForTimeout(2600);await page.evaluate(()=>__debug.player.keys.clear());
    const z=await page.evaluate(()=>{const s=__debug.shared,e=s.structures.sites[0],p=s.player.position;return e.sin*(p.x-e.x)+e.cos*(p.z-e.z);});assert.ok(z<0,'actual player must cross the gate');await page.evaluate(()=>document.exitPointerLock());await page.evaluate(()=>__debug.faunaMenu.visit('resonant-gate',false,false));
   }
   if(kind==='listening-fold'){
    await page.evaluate(()=>{const s=__debug.shared,site=s.structures.fold.site,p=s.player;p.position.set(site.x,s.heightmap.height(site.x,site.z)+11,site.z);p.groundY=p.position.y-11;p.velocity.set(0,0,0);});
    await page.waitForFunction(()=>__debug.shared.structureShelter>.95);
    const mix=await page.evaluate(()=>{const s=__debug.shared;return {gain:s.conductor.layers.arpeggio.structureGain,roof:s.structures.roofAt(s.player.position.x,s.player.position.z),eye:s.player.position.y,exposure:s.weather.exposure};});assert.ok(mix.gain<.35&&mix.roof>mix.eye&&mix.exposure<.2);
    // Compile/draw the rain, snow and hail roof paths even in dry weather.
    await page.evaluate(()=>{const d=__debug;for(const system of [d.rain,d.snow,d.hail]){const precipitation=system.precipitation||system;const mesh=precipitation.points;if(mesh){const v=mesh.visible,parent=mesh.parent,temp=new d.scene.constructor();mesh.visible=true;temp.add(mesh);d.renderer.compile(temp,d.camera);parent.add(mesh);mesh.visible=v;}}});
    await sample('umbra / inside fold');
    await page.evaluate(()=>__debug.faunaMenu.visit('listening-fold',false,false));await page.waitForFunction(()=>__debug.shared.structureShelter<.01);assert.ok(await page.evaluate(()=>__debug.shared.conductor.layers.arpeggio.structureGain)>.99);
   }
   // The same repeated player input must reach every structure, with bounded tails.
   const repeats=await page.evaluate(async kind=>{const s=__debug.shared,e=s.structures.entries.find(e=>e.site.kind===kind),before=e.model.responses;for(let i=0;i<8;i++){await s.playerNotes.send(0);await new Promise(r=>setTimeout(r,200));}return {count:e.model.responses-before,voices:e.voices.length,energy:e.model.energy};},kind);
   assert.equal(repeats.count,8,kind+' answers repeated notes');assert.ok(repeats.voices<=4&&repeats.energy>0);
   const effects=await page.evaluate(kind=>{const s=__debug.shared,e=s.structures.entries.find(e=>e.site.kind===kind);let rings=0;const add=s.ripples.add;s.ripples.add=()=>rings++;const old=Array.from(e.model.pulseAges);const answered=s.structures.touch(e);s.ripples.add=add;return {rings,answered,preserved:old.every((a,i)=>a<0||e.model.pulseAges[i]===a),active:e.model.pulseCount,shared:e.material.userData.pulses.value===e.model.pulseAges};},kind);
   assert.ok(effects.answered&&effects.preserved&&effects.shared&&effects.active>=3);assert.equal(effects.rings,0,'structures do not emit ground rings');
   if(kind==='horizon-frame'){
    const summit=await page.evaluate(()=>{const s=__debug.shared,e=s.structures.altar;return {y:e.site.y,prominence:e.site.prominence,view:e.site.view};});assert.ok(summit.y>220&&summit.prominence>=35&&summit.view.drop>=220&&summit.view.nearDrop>=55);
    await cdp.send('Runtime.evaluate',{expression:'__debug.renderer.domElement.requestPointerLock()',awaitPromise:true,userGesture:true});await page.waitForFunction(()=>__debug.player.locked);
    async function walkTrail(up){
     return page.evaluate(async up=>{
      const s=__debug.shared,e=s.structures.altar.site,p=s.player;
      const route=e.route.filter((_,i)=>i%2===0).map(q=>({x:e.x+e.cos*q.x+e.sin*q.z,z:e.z-e.sin*q.x+e.cos*q.z}));
      const points=up?[...route.reverse(),{x:e.x,z:e.z+0}]:[...route,{x:e.x+e.cos*(e.arrivalX||0)+e.sin*e.arrivalZ,z:e.z-e.sin*(e.arrivalX||0)+e.cos*e.arrivalZ}];
      const deadline=performance.now()+18000;p.keys.add('KeyW');
      for(const target of points){
       while(Math.hypot(p.position.x-target.x,p.position.z-target.z)>3){
        if(performance.now()>deadline){p.keys.clear();throw new Error('Trail movement stalled at '+JSON.stringify({position:p.position,target}));}
        p.yaw=Math.atan2(p.position.x-target.x,p.position.z-target.z);await new Promise(requestAnimationFrame);
       }
      }
      p.keys.clear();await new Promise(r=>setTimeout(r,250));
      return {x:p.position.x,z:p.position.z,foot:p.position.y-11,floor:Math.max(s.heightmap.height(p.position.x,p.position.z),s.structures.floorAt(p.position.x,p.position.z)),siteX:e.x,siteZ:e.z,trailEnd:e.end};
     },up);
    }
    const top=await walkTrail(true);assert.ok(Math.hypot(top.x-top.siteX,top.z-top.siteZ)<10&&Math.abs(top.foot-top.floor)<1,'real player follows the stone trail to the summit: '+JSON.stringify(top));
    await page.evaluate(()=>{const s=__debug.shared,e=s.structures.altar.site;s.player.yaw=e.yaw;s.player.pitch=-Math.atan2(s.player.position.y-e.view.y,e.view.distance);});await page.waitForTimeout(300);await page.screenshot({path:output+'/frame-summit.png'});
    const bottom=await walkTrail(false);assert.ok(Math.hypot(bottom.x-bottom.siteX,bottom.z-bottom.siteZ)>bottom.trailEnd&&Math.abs(bottom.foot-bottom.floor)<1,'player can descend to the mountain: '+JSON.stringify(bottom));
    await page.evaluate(()=>{document.exitPointerLock();const s=__debug.shared;s.player.yaw=s.structures.altar.site.arrivalYaw;s.player.pitch=.23;});await page.waitForTimeout(300);await sample('umbra / summit trail');
   }
   await page.evaluate(()=>__debug.faunaMenu.setOpen(false));await page.screenshot({path:output+'/'+kind+'.png'});
   if(kind==='resonant-gate'){
    await page.evaluate(()=>{const d=__debug,s=d.shared.structures.sites.find(s=>s.kind==='resonant-gate'),p=d.player,x=s.x+s.cos*40+s.sin*78,z=s.z-s.sin*40+s.cos*78,y=d.heightmap.height(x,z);p.position.set(x,y+11,z);p.groundY=y;p.velocity.set(0,0,0);p.yaw=s.yaw+Math.atan2(40,78);p.pitch=.1;});await page.waitForTimeout(1000);await page.screenshot({path:output+'/gate-quarter.png'});
    await page.evaluate(()=>{const d=__debug,s=d.shared.structures.sites.find(s=>s.kind==='resonant-gate'),p=d.player,x=s.x-s.cos*19+s.sin*23,z=s.z+s.sin*19+s.cos*23,y=d.heightmap.height(x,z);p.position.set(x,y+11,z);p.groundY=y;p.velocity.set(0,0,0);p.yaw=s.yaw;p.pitch=-.16;});await page.waitForTimeout(1000);await page.screenshot({path:output+'/gate-detail.png'});
   }
  }
  // Same seed and gate viewpoint without structures. Natural vegetation remains,
  // so whole-frame timing is contextual; structure CPU is measured separately.
  await open('umbra',true);assert.equal(await page.evaluate(()=>__debug.shared.structures.entries.length),0);
  await page.evaluate(site=>{const d=__debug,s=site,p=d.player,x=s.x+s.sin*85,z=s.z+s.cos*85,y=d.heightmap.height(x,z);p.position.set(x,y+11,z);p.groundY=y;p.yaw=s.yaw;p.pitch=.08;},first.sites[0]);await page.waitForTimeout(4000);await sample('umbra / structures disabled');
  for(const seed of ['fern','ondine-ossia']){
   await open(seed);const data=await page.evaluate(()=>({sites:__debug.shared.structures.sites.map(({stones,route,...site})=>({...site,stoneCount:stones?.length})),stats:__debug.shared.structures.stats}));report.seeds.push({seed,...data});assert.ok(data.sites.length>0&&data.sites.length<=3,seed+' has a bounded valid population');assert.equal(new Set(data.sites.map(s=>s.kind)).size,data.sites.length);assert.ok(data.sites.every(s=>s.setting&&(!s.view||s.view.drop>=220)));assert.ok(data.sites.every(s=>s.relief<=(s.steps?20:s.kind==='listening-fold'?5:3.5)));
  }
  assert.deepEqual(report.errors,[]);report.status='passed';fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
