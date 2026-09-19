// One worker and one bounded installation queue for terrain and moving shore maps.
// Jobs waiting to start are replaceable when the player changes direction.
export class SurfaceWork {
	constructor(heightmap, seed) {
		this.ready = false; this.failed = false; this.jobs = new Map(); this.completed = []; this.serial = 0; this.busy = null;
		this.simulations=new Set();
		this.stats = { completed: 0, discarded: 0, installed: 0 };
		try {
			this.worker = new Worker(new URL('./SurfaceWorker.js?v=streaming-60-30-19', import.meta.url), { type: 'module' });
			this.worker.onerror = event => { event.preventDefault(); this.fail(); };
			this.worker.onmessage = ({ data }) => {
				if (data.type === 'ready') { this.ready = true; this.dispatch(); return; }
				const job = this.busy; this.busy = null;
    if(data.workMs!==undefined){this.stats.maxWorkerMs=Math.max(this.stats.maxWorkerMs||0,data.workMs);this.stats.maxSliceMs=Math.max(this.stats.maxSliceMs||0,data.maxSliceMs);}
				if (data.error) { this.fail(); return; }
				if (job && this.jobs.get(job.key) === job) { this.completed.push({ job, data: data.result }); this.stats.completed++; }
				else this.stats.discarded++;
				this.dispatch();
			};
			this.worker.postMessage({ type: 'init', seed, world: heightmap.world });
		} catch { this.fail(); }
	}

 // A private channel keeps simulation replies separate from terrain job IDs.
 // The worker already owns the same generated world, so init sends no clone.
 simulationWorker() {
  if(this.failed||!this.worker)return null;
  const channel=new MessageChannel(),owner=this;
  const adapter={
   shared:true,onmessage:null,onerror:null,onmessageerror:null,
   postMessage(data,transfer=[]){channel.port1.postMessage(data.type==='init'?{type:'init',waterLevel:data.waterLevel}:data,transfer);},
   terminate(){if(!owner.simulations.delete(adapter))return;channel.port1.postMessage({type:'dispose'});channel.port1.close();}
  };
  channel.port1.onmessage=event=>adapter.onmessage?.(event);
  channel.port1.onmessageerror=event=>adapter.onmessageerror?.(event);
  this.simulations.add(adapter);
  try{this.worker.postMessage({type:'simulation',port:channel.port2},[channel.port2]);}
  catch(error){adapter.terminate();channel.port2.close();return null;}
  return adapter;
 }
	fail() {
		this.ready = false; this.failed = true;
  for(const simulation of [...this.simulations]){simulation.onerror?.({message:'Shared surface worker failed',preventDefault(){}});simulation.terminate();} this.worker?.terminate(); this.jobs.clear(); this.completed.length = 0; this.busy = null;
		console.warn('Surface worker unavailable; using synchronous streaming.');
	}
	request(key, payload, priority, install) {
		if (this.jobs.has(key)) return;
		this.jobs.set(key, { key, payload, priority, install, id: ++this.serial, sent: false });
	}
	prune(prefix, needed) {
		for (const [key] of this.jobs) if (key.startsWith(prefix) && !needed.has(key)) this.jobs.delete(key);
	}
	dispatch() {
		if (!this.ready || this.busy) return;
		let best;
		for (const job of this.jobs.values()) if (!job.sent && (!best || job.priority < best.priority)) best = job;
		if (!best) return;
		this.busy = best; best.sent = true; this.worker.postMessage({ ...best.payload, id: best.id });
	}
	drain(deadline) {
		while (this.completed.length && performance.now() < deadline) {
			const { job, data } = this.completed.shift();
			if (this.jobs.get(job.key) === job) { this.jobs.delete(job.key); job.install(data); this.stats.installed++; }
			else this.stats.discarded++;
		}
		this.dispatch();
	}
}
