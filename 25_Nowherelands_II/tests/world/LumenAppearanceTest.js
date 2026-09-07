import test from 'node:test';
import assert from 'node:assert/strict';
import { lumenAppearance } from '../../js/world/fauna/LumenAppearance.js';

test('light varies with movement but stays within a restrained colour and brightness range', () => {
	const rest=lumenAppearance(0.7,0,0,0,5), moving=lumenAppearance(0.7,90,0.8,0,5);
	assert.ok(Math.abs(rest.r-moving.r)>0.025);
	assert.ok(Math.abs(rest.brightness-moving.brightness)>0.06);
	for(let i=0;i<2000;i++) {
		const c=lumenAppearance(i*0.3,i%160,(i%20)/10,(i%10)/10,i/30);
		assert.ok(c.brightness>=0.54 && c.brightness<=0.88);
		assert.ok(c.r>=0.33 && c.r<=0.6 && c.g>=0.65 && c.g<=0.82 && c.b===0.96);
		// The body's brightest-facing fragment stays below the previous HDR peak.
		assert.ok(c.brightness*1.65<1.46);
	}
});

test('colour and brightness evolve smoothly and individuals do not pulse in lockstep', () => {
	let last=null, min=Infinity, max=-Infinity;
	for(let frame=0;frame<1800;frame++) {
		const t=frame/60,c=lumenAppearance(0.4,45+40*Math.sin(t),0.5+0.5*Math.sin(t*0.8),0,t);
		if(last) for(const k of ['r','g','b','brightness'])assert.ok(Math.abs(c[k]-last[k])<0.006);
		min=Math.min(min,c.brightness);max=Math.max(max,c.brightness);last=c;
	}
	assert.ok(max-min>0.1);
	assert.notDeepEqual(lumenAppearance(0,35,0.2,0,8),lumenAppearance(3,35,0.2,0,8));
});
