const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const out=process.env.WATER_OUTPUT||'/tmp/nowherelands-water-world';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  const mobile=!!process.env.WATER_MOBILE;
  const page=await browser.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.WATER_URL||'http://127.0.0.1:8793/25_Nowherelands_II/?seed=umbra&plants=light-lily&fps=30');
  await page.waitForFunction(()=>window.__debug,null,{timeout:180000});
  const population=await page.evaluate(()=>{const w=window.__debug.waterLife;return {sites:w.sites.length,fishSites:w.sites.filter(s=>s.groups.length).length,lilySites:w.sites.filter(s=>s.plants.some(p=>p.bloom)).length,groups:[...new Set(w.sites.flatMap(s=>s.groups.map(g=>g.count)))],mountainFish:w.sites.filter(s=>s.y>650&&s.groups.length).length,active:w.entries.size};});
  console.log(JSON.stringify({population,errors}));assert.ok(population.sites>0);assert.ok(population.fishSites>0);assert.ok(population.lilySites>0);
  await page.locator('[data-fauna="light-lily"]').click();
  await page.waitForTimeout(2000);
  await page.waitForFunction(()=>[...window.__debug.waterLife.entries.values()].some(e=>e.fade===1),null,{timeout:20000});
  await page.evaluate(()=>window.__debug.faunaMenu.setOpen(false));await page.screenshot({path:out+'/lilies.png'});
  const hit=await page.evaluate(async()=>{
   const {Vector3}=await import('three'),d=window.__debug,send=d.shared.playerNotes.send.bind(d.shared.playerNotes);window.__lilyPresses=[];
   d.shared.playerNotes.send=(charge,target)=>{window.__lilyPresses.push({charge,target});return send(charge,target);};
   const candidates=d.waterLife.targets.map(t=>({p:t.mesh.getWorldPosition(new Vector3()).project(d.camera)})).sort((a,b)=>Math.hypot(a.p.x,a.p.y)-Math.hypot(b.p.x,b.p.y));
   const p=candidates[0].p,r=d.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  });
  if(mobile)await page.touchscreen.tap(280,422);else await page.mouse.click(hit.x,hit.y);
  await page.waitForFunction(()=>window.__lilyPresses.some(p=>p.target?.waterSite),null,{timeout:5000});
  await page.waitForTimeout(200);
  if(mobile){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y:422}]});await page.waitForTimeout(1450);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else {await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.waitForTimeout(1450);await page.mouse.up();}
  await page.waitForFunction(()=>window.__lilyPresses.some(p=>p.target?.waterSite&&p.charge>.66),null,{timeout:5000});
  await page.waitForTimeout(250);
  await page.keyboard.press('n');await page.waitForFunction(()=>window.__debug.waterLife.voices.length>0,null,{timeout:10000});
  const reply=await page.evaluate(()=>{
   const w=window.__debug.waterLife,e=[...w.entries.values()].find(e=>e.model.plants.some(p=>p.bloom)),t=w.time;
   w.hearNote({layer:'player-note',position:{x:e.site.x,y:e.site.y+10,z:e.site.z},radius:100,velocity:.5});
   for(let i=0;i<30;i++)w.update(1/60);
   return {glow:Math.max(...e.model.plants.map(p=>p.glow)),draws:e.lilies.batches.length,fish:e.model.fish.length};
  });assert.ok(reply.glow>.1);assert.ok(reply.draws<=3);
  assert.ok(await page.evaluate(()=>[...window.__debug.waterLife.entries.values()].every(e=>e.lilies.batches.every(b=>window.__debug.shared.mirrorHide.has(b.mesh)))));
  await page.screenshot({path:out+'/lilies-reply.png'});
  if(!mobile){
   // Inspect the flower at core height: its opaque bowl must hide the interior.
   await page.evaluate(()=>{
    const d=window.__debug,w=d.waterLife,e=w.entries.get(w.focus.id),p=e.model.plants.filter(p=>p.bloom).sort((a,b)=>b.size-a.size)[0];
    const x=e.site.x+p.x-.23*Math.cos(p.turn)*p.size,z=e.site.z+p.z+.23*Math.sin(p.turn)*p.size,y=e.site.y+.13*p.size*(p.flowerHeight??.85);
    d.faunaMenu.active.subject={x,y,z};d.player.position.set(x,y,z+p.size*2.2);d.player.velocity.set(0,0,0);
    window.__sideLily={e,p};
   });
   await page.waitForTimeout(700);await page.screenshot({path:out+'/lilies-side.png'});
   await page.evaluate(()=>{const {e,p}=window.__sideLily;p.glow=1.1;p.nod=.16;e.lilies.update();e.lilies.update=()=>{};});
   await page.waitForTimeout(100);await page.screenshot({path:out+'/lilies-side-reply.png'});
   await page.evaluate(()=>{const {e}=window.__sideLily;delete e.lilies.update;});
  }

  await page.evaluate(()=>window.__debug.faunaMenu.setOpen(true));
  await page.locator('[data-fauna="scarlet-fish"]').click();
  await page.waitForFunction(()=>window.__debug.faunaMenu.active?.species==='scarlet-fish'&&[...window.__debug.waterLife.entries.values()].some(e=>e.model.fish.length));
  await page.waitForTimeout(2000);await page.evaluate(()=>window.__debug.faunaMenu.setOpen(false));await page.screenshot({path:out+'/fish.png'});
  await page.evaluate(()=>{const d=window.__debug,c=d.faunaMenu.active;c.visited=new Set(d.waterLife.sites.filter(s=>!s.groups.some(g=>g.count>=9)).map(s=>s.id));c.visit(c.group);});
  await page.waitForTimeout(2000);
  const school=await page.evaluate(()=>{const w=window.__debug.waterLife;return {focus:w.focus?.id,resident:w.entries.has(w.focus?.id),fish:w.entries.get(w.focus?.id)?.model.fish.length,position:window.__debug.player.position.toArray(),site:w.focus&&[w.focus.x,w.focus.y,w.focus.z]};});console.log({school});assert.ok(school.resident);assert.ok(school.fish>=9);
  await page.screenshot({path:out+'/school.png'});
  await page.keyboard.press('n');
  await page.waitForFunction(()=>{const w=window.__debug.waterLife;return w.entries.get(w.focus.id)?.model.fish.some(f=>f.escape);},null,{timeout:5000});
  await page.waitForTimeout(250);await page.screenshot({path:out+'/school-startled.png'});
  const startled=await page.evaluate(()=>{const w=window.__debug.waterLife,e=w.entries.get(w.focus.id);return {count:e.model.fish.filter(f=>f.escape).length,burst:Math.max(...e.model.fish.map(f=>f.burst)),draws:e.fish.mesh?1:0};});
  assert.ok(startled.count>0);assert.ok(startled.burst>0);assert.equal(startled.draws,1);console.log({startled});
  const escapeRoutes=await page.evaluate(()=>{
   const d=window.__debug,w=d.waterLife,hm=d.heightmap;let checked=0,invalid=0,far=0;
   for(const e of w.entries.values())for(const f of e.model.fish){const b=f.escape;if(!b)continue;
    let excursion=0;
    for(let t=0;t<=b.duration+b.roamDuration+b.returnDuration;t+=.08){const p=e.model.swimPose(f,b.at+t),ground=hm.sample(e.site.x+p.x,e.site.z+p.z),y=e.site.y+e.model.swimY(f,b.at+t);
     checked++;if(y-f.size*.42<ground+.1||y+f.size*.42>hm._water-.1)invalid++;
     excursion=Math.max(excursion,Math.hypot(p.x-f.group.x,p.z-f.group.z)-f.group.radius);
    }
    far=Math.max(far,excursion);
   }
   return {checked,invalid,far};
  });console.log({escapeRoutes});assert.ok(escapeRoutes.checked>0);assert.equal(escapeRoutes.invalid,0);assert.ok(escapeRoutes.far>10,'fish leave their old school boundary');


  const mountain=await page.evaluate(()=>{const w=window.__debug.waterLife;return w.sites.filter(s=>s.groups.length).sort((a,b)=>b.y-a.y)[0]?.y;});console.log({highestFishLake:mountain});
  const optics=await page.evaluate(()=>({depth:window.__debug.inland.uniforms.uHasSceneDepth.value,copied:!!window.__debug.inland.optics.depthTarget}));assert.deepEqual(optics,{depth:1,copied:true});
  const validity=await page.evaluate(async()=>{
   const {PoolLifeModel}=await import('./js/world/WaterHabitats.js');
   const d=window.__debug,w=d.waterLife,hm=d.heightmap;let checked=0,invalid=0,maxDraws=0;
   for(const site of w.sites){
    // Check all real, detailed terrain routes at multiple phases.
    for(const e of w.entries.values())if(e.site===site)maxDraws=Math.max(maxDraws,(e.fish.mesh?1:0)+e.lilies.batches.length);
   }
   for(const site of w.sites){const model=new PoolLifeModel(site,w.seed);for(let t=0;t<60;t+=2){model.update(t);model.hear(site.x,site.z,100);model.update(t+.4);for(const f of model.fish){const x=site.x+f.x,z=site.z+f.z,ground=hm.sample(x,z),y=site.y+f.y;checked++;if(y-f.size*(.8+.2*f.bodyWidth)*.4<ground+.1||y+f.size*(.8+.2*f.bodyWidth)*.4>hm._water-.1)invalid++;}}}
   return {checked,invalid,maxDraws,active:w.entries.size,cap:w.cap};
  });assert.equal(validity.invalid,0);assert.ok(validity.maxDraws<=4);assert.ok(validity.active<=validity.cap);assert.equal(validity.cap,mobile?8:12);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',population,reply,optics,validity,screenshots:out},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
