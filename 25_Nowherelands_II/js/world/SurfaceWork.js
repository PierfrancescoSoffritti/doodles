// One worker and one bounded installation queue for terrain and moving shore maps.
// Jobs waiting to start are replaceable when the player changes direction.
export class SurfaceWork {
	constructor(heightmap, seed) {
		this.ready = false; this.failed = false; this.jobs = new Map(); this.completed = []; this.serial = 0; this.busy = null;
		this.stats = { completed: 0, discarded: 0, installed: 0 };
		try {
			this.worker = new Worker(new URL('./SurfaceWorker.js', import.meta.url), { type: 'module' });
			this.worker.onerror = event => { event.preventDefault(); this.fail(); };
			this.worker.onmessage = ({ data }) => {
				if (data.type === 'ready') { this.ready = true; this.dispatch(); return; }
				const job = this.busy; this.busy = null;
				if (data.error) { this.fail(); return; }
				if (job && this.jobs.get(job.key) === job) { this.completed.push({ job, data: data.result }); this.stats.completed++; }
				else this.stats.discarded++;
				this.dispatch();
			};
			this.worker.postMessage({ type: 'init', seed, world: heightmap.world });
		} catch { this.fail(); }
	}
	fail() {
		this.ready = false; this.failed = true; this.worker?.terminate(); this.jobs.clear(); this.completed.length = 0; this.busy = null;
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
