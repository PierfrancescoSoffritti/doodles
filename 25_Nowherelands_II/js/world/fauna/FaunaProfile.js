// Opt-in CPU/frame telemetry for reproducing interactions (?faunaProfile=1).
export class FaunaProfile {
	constructor(fauna) {
		this.fauna = fauna;
		for (const [object, method, name] of [[fauna,'stream','stream'],[fauna.model,'step','simulation'],[fauna.meshes,'update','rig']]) {
			const original = object[method];
			object[method] = (...args) => {
				const start = performance.now();
				try { return original.apply(object,args); } finally { this.costs[name] = (this.costs[name] || 0) + performance.now() - start; }
			};
		}
		this.reset();
	}
	reset() { this.frames=[];this.costs={};this.last=0;this.start=performance.now(); }
	begin() { const now=performance.now();this.interval=this.last?now-this.last:0;this.last=now;this.costs={}; }
	end() {
		if(this.frames.length>=1800)return;
		this.frames.push({time:(performance.now()-this.start)/1000,frame:this.interval,...this.costs,states:this.fauna.model.creatures.filter(c=>c.kind==='hopper').map(c=>c.pebble.state)});
	}
	summary() {
		const metrics={};
		for(const key of ['frame','stream','simulation','rig']) {
			const v=this.frames.map(f=>f[key]||0).sort((a,b)=>a-b);
			metrics[key]={p50:v[Math.floor(v.length*.5)]||0,p95:v[Math.floor(v.length*.95)]||0,max:v.at(-1)||0};
		}
		return {frames:this.frames.length,metrics,worst:this.frames.slice().sort((a,b)=>(b.simulation||0)-(a.simulation||0)).slice(0,4)};
	}
}
