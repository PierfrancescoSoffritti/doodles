// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node .../tests/water-atelier-smoke.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.ATELIER_URL||'http://127.0.0.1:8793/25_Nowherelands_II/';
const output=process.env.ATELIER_OUTPUT||'/tmp/nowherelands-water-atelier';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function open(species='pool',extra=''){await page.goto(base+'water-atelier.html?seed=atelier-check&species='+species+extra);await page.waitForFunction(()=>document.body.dataset.status==='ready');}
  await open('pool','&snail=mixed');
  assert.equal(await page.locator('#snail').count(),0);assert.equal(new URL(page.url()).searchParams.has('snail'),false);
  assert.equal(await page.locator('#atelier-species option[value=wobble-snail]').count(),0);
  await page.waitForFunction(()=>window.__waterStudy.model.time>.15);
  await page.locator('#pause').click();const frozen=await page.evaluate(()=>window.__waterStudy.model.time);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__waterStudy.model.time),frozen);
  for(const [value,count] of [['solo',1],['small',4],['medium',9],['large',20],['mixed',20]]){await page.selectOption('#school',value);assert.equal(await page.evaluate(()=>window.__waterStudy.model.fish.length),count);}
  const resources=[];for(let i=0;i<4;i++){await page.locator('#individual').click();await page.waitForTimeout(60);resources.push(await page.evaluate(()=>window.__waterStudy.renderer.info.memory.geometries));}assert.equal(new Set(resources).size,1,'replacing specimens retains a stable geometry count');
  for(const view of ['top','side','quarter'])await page.selectOption('#view',view);
  for(const light of ['day','night']){await page.selectOption('#light',light);assert.equal(await page.evaluate(()=>window.__waterStudy.meshes.night),light==='night');}
  await page.locator('#surface').uncheck();assert.equal(await page.evaluate(()=>window.__waterStudy.meshes.water.visible),false);await page.locator('#surface').check();
  await page.screenshot({path:output+'/pool.png'});
  await page.locator('#splash').click();await page.waitForFunction(()=>window.__waterStudy.model.disturbedAt>=0);
  await page.locator('#pause').click();
  await page.evaluate(()=>{for(let i=0;i<240;i++)window.__waterStudy.model.update(1/60);});
  await page.selectOption('#atelier-species','light-lily');await page.waitForURL('**/water-atelier.html?species=light-lily*');await page.waitForFunction(()=>document.body.dataset.status==='ready');assert.equal(new URL(page.url()).searchParams.get('seed'),'atelier-check');
  await page.locator('#touch').click();await page.waitForFunction(()=>window.__waterStudy.audio.context?.state==='running');
  await page.evaluate(()=>{for(let i=0;i<75;i++)window.__waterStudy.model.update(1/60);});
  await page.waitForFunction(()=>window.__waterStudy.audio.sources.size>0&&window.__waterStudy.model.plants.some(p=>p.glow>.15));
  await page.locator('#pause').click();await page.screenshot({path:output+'/light-lily.png'});
  await page.locator('#tab-life').click();await page.locator('#stop-audio').click();await page.waitForFunction(()=>window.__waterStudy.audio.context.state==='suspended');assert.equal(await page.locator('#sound').isChecked(),false);
  await page.selectOption('#atelier-species','bell-reed');await page.waitForURL('**/vegetation-atelier.html*');await page.waitForFunction(()=>document.body.dataset.status==='ready');assert.ok(await page.locator('#atelier-species option[value=pool]').count());
  await page.selectOption('#atelier-species','hopper');await page.waitForURL('**/fauna-atelier.html*');await page.waitForFunction(()=>document.body.dataset.status==='ready');
  await page.selectOption('#atelier-species','scarlet-fish');await page.waitForFunction(()=>document.body.dataset.status==='ready'&&window.__waterStudy?.model.species==='scarlet-fish');
  await page.selectOption('#school','large');
  const fishCost=await page.evaluate(async()=>{const {Scene}=await import('three'),s=window.__waterStudy,scene=new Scene(),mesh=s.meshes.fish.mesh,parent=mesh.parent;scene.attach(mesh);s.renderer.render(scene,s.camera);const cost={count:mesh.count,calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles};parent.attach(mesh);return cost;});
  assert.deepEqual(fishCost,{count:20,calls:1,triangles:2360});
  await page.selectOption('#school','solo');assert.equal(await page.evaluate(()=>window.__waterStudy.model.fish.length),1);
  await page.locator('#pause').click();
  const hit=await page.evaluate(async()=>{const {Vector3}=await import('three');const p=new Vector3(0,0,1).project(window.__waterStudy.camera),r=document.getElementById('canvas').getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};});
  assert.equal(await page.locator('#touch').isVisible(),false);assert.equal(await page.locator('#splash').isVisible(),false);
  await page.locator('#tab-life').click();assert.equal(await page.locator('#invite').isVisible(),false);
  await page.mouse.click(hit.x,hit.y);await page.locator('#canvas').focus();await page.keyboard.press('n');await page.keyboard.press('s');
  assert.deepEqual(await page.evaluate(()=>({touch:window.__waterStudy.model.touchAt,paused:window.__waterStudy.paused,ripples:window.__waterStudy.model.ripples.length})),{touch:-100,paused:true,ripples:0});
  await open('pool');await page.locator('#pause').click();
  const poolHit=await page.evaluate(async()=>{const {Vector3}=await import('three');const p=new Vector3(0,0,1).project(window.__waterStudy.camera),r=document.getElementById('canvas').getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};});
  await page.mouse.click(poolHit.x,poolHit.y);assert.ok(await page.evaluate(()=>window.__waterStudy.model.touchAt>=0));
  const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(base+'water-atelier.html');await mobile.waitForFunction(()=>document.body.dataset.status==='ready');assert.equal(await mobile.evaluate(()=>window.__waterStudy.paused),true);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.screenshot({path:output+'/mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',errors,resources,fishCost,screenshots:output},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
