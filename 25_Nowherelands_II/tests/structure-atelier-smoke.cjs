// PLAYWRIGHT_MODULE=/path/to/playwright node 25_Nowherelands_II/tests/structure-atelier-smoke.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.ATELIER_URL||'http://127.0.0.1:8793/25_Nowherelands_II/';
const output=process.env.ATELIER_OUTPUT||'/tmp/nowherelands-structure-atelier';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome',args:['--use-angle=metal']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>document.body.dataset.status==='ready');
  await page.goto(base+'structure-atelier.html?species=resonant-gate&seed=structure-check');await ready();
  assert.equal(await page.evaluate(()=>window.__structureStudy.audio.engine),null,'no audio autoplay');
  await page.screenshot({path:output+'/gate.png'});
  await page.locator('#quick-note').click();await page.waitForFunction(()=>window.__structureStudy.model.responses===1&&window.__structureStudy.audio.engine?.ctx.state==='running');
  for(let i=0;i<5;i++){await page.waitForTimeout(180);await page.locator('#quick-note').click();}assert.equal(await page.evaluate(()=>window.__structureStudy.model.responses),6,'each deliberate repeated note gets a response');assert.ok(await page.evaluate(()=>window.__structureStudy.model.pulseAges.filter(a=>a>=0).length)>=3,'several independent light pulses coexist');assert.ok(await page.evaluate(()=>window.__structureStudy.audio.replyVoices.length)<=4);
  await page.locator('#tab-life').click();await page.locator('#stop-audio').click();assert.equal(await page.evaluate(()=>window.__structureStudy.audio.engine),null);
  await page.locator('#tab-form').click();await page.selectOption('#view','walk');await page.locator('#canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(3400);await page.keyboard.up('w');
  assert.ok(await page.evaluate(()=>window.__structureStudy.model.visitor.z<0),'keyboard movement passes through gate');
  assert.equal(await page.evaluate(()=>window.__structureStudy.camera.position.y),11);
  await page.selectOption('#view','quarter');
  const resources=[];for(let i=0;i<5;i++){await page.locator('#individual').click();await page.waitForTimeout(80);resources.push(await page.evaluate(()=>window.__structureStudy.renderer.info.memory.geometries));}assert.equal(new Set(resources).size,1);
  await page.selectOption('#material','ceramic');await page.selectOption('#light','day');await page.screenshot({path:output+'/gate-ceramic.png'});
  await page.selectOption('#atelier-species','listening-fold');await page.waitForURL('**/structure-atelier.html?species=listening-fold*');await ready();
  assert.equal(new URL(page.url()).searchParams.get('seed'),'structure-check');await page.screenshot({path:output+'/fold.png'});
  await page.locator('#tab-life').click();await page.locator('#music').click();await page.waitForFunction(()=>window.__structureStudy.audio.music);
  await page.waitForTimeout(2000);
  assert.ok(await page.evaluate(()=>{const e=window.__structureStudy.audio.engine,a=new Float32Array(e.analyser.fftSize);e.analyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.00001);}),'production music reaches the output');
  await page.locator('#enter').click();await page.waitForFunction(()=>window.__structureStudy.model.shelter>.98);
  const inside=await page.evaluate(()=>{const a=window.__structureStudy.audio;return {mix:a.mix,drone:a.conductor.layers.drone.target,arp:a.conductor.layers.arpeggio.current,cutoff:a.conductor.layers.drone.cutoff};});
  assert.ok(inside.cutoff>=125,'the main drone remains in the audible range under the fold');
  assert.ok(inside.mix.arpeggio<.32&&inside.mix.density<.42&&inside.mix.drone>1.17);
  await page.screenshot({path:output+'/fold-inside.png'});
  await page.locator('#leave').click();await page.waitForFunction(()=>window.__structureStudy.model.shelter<.01);
  const outside=await page.evaluate(()=>window.__structureStudy.audio.mix);assert.ok(outside.arpeggio>.99&&outside.cutoff>.99);
  await page.locator('#pause').click();assert.equal(await page.evaluate(()=>window.__structureStudy.audio.engine),null,'pause stops scheduler and closes audio');
  const time=await page.evaluate(()=>window.__structureStudy.model.time);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__structureStudy.model.time),time);
  await page.selectOption('#atelier-species','horizon-frame');await page.waitForURL('**/structure-atelier.html?species=horizon-frame*');await ready();
  assert.equal(await page.locator('#quick-note').isVisible(),true);await page.locator('#canvas').focus();await page.keyboard.press('n');await page.waitForFunction(()=>window.__structureStudy.model.responses===1&&window.__structureStudy.audio.engine?.ctx.state==='running');await page.screenshot({path:output+'/frame.png'});
  for(const [id,path] of [['bell-reed','vegetation-atelier.html'],['pool','water-atelier.html'],['hopper','fauna-atelier.html']]){
   await page.selectOption('#atelier-species',id);await page.waitForURL('**/'+path+'*');await ready();assert.equal(new URL(page.url()).searchParams.get('seed'),'structure-check');assert.equal(await page.locator('#atelier-species option[value=resonant-gate]').count(),1);
  }
  await page.selectOption('#atelier-species','reed');await page.waitForURL('**/reed-study.html*');await page.waitForSelector('#atelier-species option[value=listening-fold]',{state:'attached'});
  await page.selectOption('#atelier-species','resonant-gate');await page.waitForURL('**/structure-atelier.html*');await ready();
  const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(base+'structure-atelier.html?species=listening-fold');await mobile.waitForFunction(()=>document.body.dataset.status==='ready');assert.equal(await mobile.evaluate(()=>window.__structureStudy.paused),true);
  for(const width of [320,390,850]){await mobile.setViewportSize({width,height:844});await mobile.waitForTimeout(100);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await mobile.setViewportSize({width:390,height:844});await mobile.screenshot({path:output+'/mobile.png',fullPage:true});
  await mobile.locator('#tab-life').click();await mobile.locator('#enter').click();await mobile.waitForFunction(()=>window.__structureStudy.model.shelter>.9);
  const button=mobile.locator('[data-move=forward]');await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();const before=await mobile.evaluate(()=>window.__structureStudy.model.visitor.z);await mobile.mouse.move(box.x+box.width/2,box.y+box.height/2);await mobile.mouse.down();await mobile.waitForTimeout(200);await mobile.mouse.up();assert.ok(await mobile.evaluate(()=>window.__structureStudy.model.visitor.z)<before,'direction pad moves the visitor');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',errors,resources,inside:inside.mix,outside,screenshots:output},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
