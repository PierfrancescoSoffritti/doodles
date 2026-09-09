import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfaceWork } from '../../js/world/SurfaceWork.js';

class WorkerStub {
	constructor() { this.messages=[]; }
	postMessage(data) { this.messages.push(data); }
	terminate() { this.terminated=true; }
	reply(data) { this.onmessage({data}); }
}
test('teleporting discards stale terrain results and installs the latest request once', () => {
	const original=globalThis.Worker;globalThis.Worker=WorkerStub;
	try {
		const work=new SurfaceWork({world:{}},'umbra'), worker=work.worker, installed=[];
		assert.equal(worker.messages[0].seed,'umbra');worker.reply({type:'ready'});
		work.request('terrain:old',{type:'terrain'},0,data=>installed.push(data));work.drain(Infinity);
		work.prune('terrain:',new Set(['terrain:new']));
		work.request('terrain:new',{type:'terrain'},0,data=>installed.push(data));
		worker.reply({result:'stale'});worker.reply({result:'current'});work.drain(Infinity);work.drain(Infinity);
		assert.deepEqual(installed,['current']);assert.equal(work.jobs.size,0);assert.equal(work.stats.discarded,1);
	} finally { globalThis.Worker=original; }
});
test('worker failure makes synchronous fallback available and drops unfinished jobs', () => {
	const original=globalThis.Worker, warn=console.warn;globalThis.Worker=WorkerStub;console.warn=()=>{};
	try {
		const work=new SurfaceWork({world:{}},'umbra');work.worker.reply({type:'ready'});
		work.request('shore:0',{type:'shore'},0,()=>assert.fail('failed result was installed'));work.drain(Infinity);
		work.worker.reply({error:'failed'});assert.equal(work.ready,false);assert.equal(work.failed,true);
		assert.equal(work.jobs.size,0);assert.ok(work.worker.terminated);
	} finally { globalThis.Worker=original;console.warn=warn; }
});
