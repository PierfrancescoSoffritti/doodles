import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherModel, snowFraction, condense, stormEnvelope } from '../../js/world/weather/WeatherModel.js';

const make = (seed = 'weather-test', options = {}) => new WeatherModel(seed, { res: 20, size: 10000, originX: -5000, originZ: -5000, height: (x, z) => Math.max(0, 1300 - Math.hypot(x, z) * .35), ...options });

test('snow is mountain-only even in very cold air; elevation smoothly changes phase', () => {
	for (const line of [0, 650, 740, 900, 1100]) for (let h=-100;h<=700;h+=10) assert.equal(snowFraction(h,line),0);
	assert.equal(snowFraction(1100,800),1);
	let previous=0;
	for(let h=700;h<=1100;h++){const snow=snowFraction(h,800);assert.ok(snow>=previous && snow-previous<.025);previous=snow;}
});

test('condensation and evaporation conserve total water and do not create negative phases', () => {
	for(const [v,c,cap] of [[1,.1,.4],[.2,.5,.9],[.1,0,.8]])for(const dt of [.01,.5,10,100]) {
		const [v1,c1]=condense(v,c,cap,dt);assert.ok(v1>=0&&c1>=0);assert.ok(Math.abs(v1+c1-v-c)<1e-12);
		if(v>cap)assert.ok(c1>c);else assert.ok(c1<=c);
	}
});

test('weather is deterministic across frame rates and independent of observer sampling', () => {
	const a=make(),b=make();
	for(let i=0;i<1800;i++){a.update(1/30);a.sample(i,50,-i);}
	for(let i=0;i<3600;i++)b.update(1/60);
	assert.deepEqual(a.weatherData,b.weatherData);assert.deepEqual(a.surfaceData,b.surfaceData);
	assert.deepEqual(a.storms,b.storms);
});

test('the same column rains in the valley and snows above the snowline', () => {
	const m=make();m.preview='rain';m.update(.5);
	const valley=m.sample(0,20,0),peak=m.sample(0,1200,0);
	assert.ok(valley.rain>.8);assert.equal(valley.snow,0);
	assert.equal(peak.rain,0);assert.ok(peak.snow>.8);
});

test('snowpack accumulates at altitude, persists after rain stops, and never whitens lowlands', () => {
	const m=make();m.preview='rain';m.update(60);
	let i=0;for(let j=0;j<m.ground.length;j++)if(m.ground[j]>m.ground[i])i=j;
	assert.ok(m.snowpack[i]>.1);
	const before=m.snowpack[i];m.preview='clear';m.update(10);
	assert.ok(m.snowpack[i]>before*.8);
	for(let j=0;j<m.ground.length;j++)if(m.ground[j]<700)assert.equal(m.snowpack[j],0);
});

test('storm cells grow, produce rain and lightning, then dissipate; hail is brief and localized', () => {
	const m=make();m.stormTimer=1e9;
	const c=m.addStorm(0,0,{hail:true});
	assert.equal(stormEnvelope(0,c.duration),0);assert.equal(stormEnvelope(c.duration,c.duration),0);
	let hadHail=false,hadLightning=false,hailSteps=0;
	for(let i=0;i<850;i++){
		m.update(.5);hadLightning ||= m.strikes.length>0;
		if(Math.max(...m.hail)>.01){hadHail=true;hailSteps++;assert.equal(m.sample(-5000,20,-5000).hail,0);}
	}
	assert.ok(hadHail);assert.ok(hadLightning);assert.ok(hailSteps<85);assert.equal(m.storms.length,0);
});

test('natural hail eligibility is rare, deterministic, and observes the cooldown', () => {
	const m=make();let count=0;
	for(let i=0;i<2000;i++){m.hailCooldown=0;if(m.addStorm(0,0).hail)count++;m.storms=[];}
	assert.ok(count>30&&count<115,`hail in ${count}/2000 storms`);
	m.addStorm(0,0,{hail:true});for(let i=0;i<100;i++)assert.equal(m.addStorm(0,0).hail,false);
});

test('long-running natural weather stays finite and bounded and retains geographic variation', () => {
	const m=make();m.update(7200);
	for(const name of ['vapor','liquid','coverage','precipitation','snowpack','wetness','convection']) {
		for(const v of m[name])assert.ok(Number.isFinite(v)&&v>=0&&v<(name==='vapor'||name==='liquid'?3:1.00001),`${name}: ${v}`);
	}
	assert.ok(Math.max(...m.coverage)-Math.min(...m.coverage)>.15);
});


test('rain, snow and hail partition the precipitation budget at every elevation', () => {
 const m=make();m.preview='hail';m.update(.5);
 for(let h=0;h<1500;h+=10){const p=m.sample(0,h,0);assert.ok(Math.abs(p.rain+p.snow+p.hail-p.precipitation)<1e-6);}
});

test('render interpolation moves clouds every frame without jumps at fixed-step boundaries', () => {
 const m=make();m.update(2);
 let last=m.renderMotion(),smallest=Infinity,largest=0;
 for(let i=0;i<180;i++){
  m.update(1/60);const p=m.renderMotion(),distance=Math.hypot(p.x-last.x,p.z-last.z);
  smallest=Math.min(smallest,distance);largest=Math.max(largest,distance);last=p;
 }
 assert.ok(smallest>.1);assert.ok(largest/smallest<1.05,`${smallest}..${largest}`);
 m.accumulator=.5-1e-7;const before=m.sample(0,1200,0,{},true);m.update(2e-7);
 const after=m.sample(0,1200,0,{},true);
 for(const key of ['coverage','rain','snow','windSpeed'])assert.ok(Math.abs(before[key]-after[key])<1e-5,key);
});

test('manual rain, snow and hail vary independently and respect the mountain snowline', () => {
 const m=make();m.setControls({coverage:.4,rain:.2,snow:.75,hail:.35,wind:0,gust:0,storm:0,lightning:0});m.update(15);
 let coast=m.sample(0,20,0),peak=m.sample(0,1200,0);
 assert.ok(Math.abs(coast.rain-.2)<1e-5);assert.equal(coast.snow,0);
 assert.ok(Math.abs(peak.snow-.75)<1e-5);assert.equal(peak.rain,0);
 assert.ok(Math.abs(peak.hail-.35)<1e-5);assert.ok(coast.windSpeed<1e-5);
 m.setControls({...m.controls,rain:0,hail:0});m.update(15);
 peak=m.sample(0,1200,0);coast=m.sample(0,20,0);
 assert.ok(coast.rain<1e-5&&coast.hail<1e-5);assert.ok(Math.abs(peak.snow-.75)<1e-5);
 m.setControls(null);m.update(15);assert.ok(m.controlState.weight<1e-5);
});

test('fair-weather climate retains clear, scattered and wet columns across seeds', () => {
 for(const seed of ['umbra','alba','weather-test']) {
  const m=make(seed);let clear=0,scattered=0,wet=0,total=0;
  for(let t=0;t<1200;t+=30){m.update(30);for(let i=0;i<m.coverage.length;i++){
   clear+=m.coverage[i]<.1;scattered+=m.coverage[i]>=.1&&m.coverage[i]<.45;wet+=m.precipitation[i]>.1;total++;
  }}
  assert.ok(clear/total>.3,`${seed}: clear ${clear/total}`);
  assert.ok(scattered/total>.08,`${seed}: scattered ${scattered/total}`);
  assert.ok(wet/total>.02,`${seed}: wet ${wet/total}`);
 }
});

test('storm gusts vary continuously, bend vegetation strongly, and can be made calm', async () => {
 const {weatherPresets,vegetationWind}=await import('../../js/world/weather/WeatherModel.js');
 const m=make();m.setControls(weatherPresets.storm);m.update(15);
 let min=Infinity,max=0,previous=m.sample(0,20,0,{},true).windSpeed;
 for(let i=0;i<600;i++){
  m.update(1/60);const speed=m.sample(0,20,0,{},true).windSpeed;
  assert.ok(Math.abs(speed-previous)<.5);min=Math.min(min,speed);max=Math.max(max,speed);previous=speed;
 }
 assert.ok(min>25&&max>45&&max-min>10,`${min}..${max}`);
 assert.ok(vegetationWind(45)>vegetationWind(8)*8);assert.equal(vegetationWind(0),0);
 m.setControls({...weatherPresets.clear,wind:0,gust:0});m.update(15);
 assert.ok(m.sample(0,20,0).windSpeed<1e-5);
 assert.ok(Math.max(...m.coverage)<1e-5);
});

test('outdoor precipitation remains active beside a dry listener and throughout interpolation', () => {
 const m=make('cave-visibility',{res:20,size:1900,originX:0,originZ:0,height:()=>300});
 m.precipitation.fill(0);m.previous.precipitation.fill(0);m.hail.fill(0);
 // The listener's column is dry; a wet column lies outside the entrance, still in particle range.
 m.precipitation[10*m.res+12]=.8;
 assert.equal(m.sample(1000,300,1000).precipitation,0);
 assert.equal(m.hasPrecipitation(1000,1000),true);
 assert.equal(m.hasPrecipitation(0,0),false);
 m.previous.precipitation.set(m.precipitation);m.precipitation.fill(0);
 assert.equal(m.hasPrecipitation(1000,1000),true,'keep rendering the previous map while it fades');
 m.previous.precipitation.fill(0);assert.equal(m.hasPrecipitation(1000,1000),false);
});

test('snow and hail overrides activate outdoor particles without depending on listener elevation', () => {
 const m=make();m.precipitation.fill(0);m.previous.precipitation.fill(0);
 Object.assign(m.controlState,{weight:1,rain:0,snow:.8,hail:0});
 assert.equal(m.sample(0,100,0).snow,0,'a low cave listener has no local snow');
 assert.equal(m.hasPrecipitation(0,0),true,'nearby mountain flakes must still reach the shader');
 Object.assign(m.controlState,{snow:0,hail:.5});assert.equal(m.hasPrecipitation(0,0),true);
 Object.assign(m.controlState,{hail:0});assert.equal(m.hasPrecipitation(0,0),false);
});
