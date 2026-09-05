// Optional repeatable cave inspection route (?caves=1). Normal exploration has no tour UI.
export class CaveSurvey {
	constructor(shared) {
		this.shared=shared;this.index=0;this.frames=[];this.elapsed=-3;
		this.panel=document.createElement('aside');this.panel.className='river-survey cave-survey';
		const title=document.createElement('div');title.textContent='BENEATH THE MOUNTAINS';this.panel.append(title);
		this.output=document.createElement('output');
		for(const [name,action] of [
			['Entrance',()=>this.visit('entrance')],['Underground river',()=>this.visit('river')],['Upper gallery',()=>this.visit('upper')],['Deep chamber',()=>this.visit('deep')],
			['Mountain face',()=>this.findEntrance('mountain')],['Narrow fissure',()=>this.findEntrance('fissure')],['High entrance',()=>this.findEntrance('high')],
			['On approach',()=>{this.start=null;this.outside(this.selectedEntrance,true);this.elapsed=-3;this.frames=[];}],
			['Look outward',()=>this.lookOut()],
			['Next cave',()=>{this.index=(this.index+1)%shared.world.caves.length;this.visit('entrance');}],
			['Follow passage (24s)',()=>{this.visit('river');this.start=performance.now()+4000;this.moving=[];this.panel.dataset.profile='';}],
			['Explore here',()=>{shared.player.fly=false;shared.hud.enterBtn.click();this.panel.hidden=true;}]
		]) {const button=document.createElement('button');button.textContent=name;button.onclick=action;button.disabled=!shared.world.caves.length;this.panel.append(button);}
		this.panel.append(this.output);document.body.append(this.panel);
		shared.hud.intro.classList.add('hidden');shared.hud.el.classList.add('visible');this.visit('entrance');
	}
	findEntrance(type) {
		const caves=this.shared.world.caves,index=caves.findIndex(c=>c.entrances?.some(e=>e.type===type));
		if(index<0){this.output.textContent='No suitable '+type+' entrance in this world.';return;}
		this.index=index;this.visit('entrance',caves[index].entrances.find(e=>e.type===type));
	}
	visit(kind,entrance=null) {
		this.start=null;const cave=this.shared.world.caves[this.index];if(!cave){this.output.textContent='No suitable cave sites in this world.';return;}
		this.selectedEntrance=entrance||cave.entrance;this.kind=kind;this.elapsed=-3;this.frames=[];
		let path=cave.paths[0],i=kind==='deep'?19:kind==='river'?5:0;
		if(kind==='upper'){path=cave.paths.find(p=>!p.wet && p!==cave.paths[0])||path;i=Math.floor(path.points.length*.5);}
		if(kind==='entrance')this.outside(entrance||cave.entrance);else this.place(path,i);this.output.textContent=`${cave.name} ${cave.id+1} · ${kind} · settling…`;
	}
	lookOut() {
		const cave=this.shared.world.caves[this.index],e=this.selectedEntrance||cave.entrance,path=cave.paths[e.path||0],end=e.end==='end';
		this.start=null;this.elapsed=-3;this.frames=[];
		this.place(path,end?path.points.length-3:2);
		if(!end)this.shared.player.yaw+=Math.PI;
		this.shared.player.pitch=-.14;
		this.output.textContent='Looking out through the entrance · settling…';
	}
	outside(entrance,onFoot=false) {
		const cave=this.shared.world.caves[this.index],points=cave.paths[entrance.path||0].points,end=entrance.end==='end';
		const a=points[end?points.length-1:0],b=points[end?points.length-2:1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;
		const distance=onFoot?12:65,p=this.shared.player,x=a.x-dx/l*distance,z=a.z-dz/l*distance;
		const y=onFoot?this.shared.heightmap.height(x,z)+11:Math.max(a.floor+38,this.shared.heightmap.height(x,z)+14);
		p.position.set(x,y,z);p.groundY=y-11;p.velocity.set(0,0,0);p.fly=true;
		p.yaw=Math.atan2(-dx,-dz);p.pitch=onFoot?Math.atan2(b.floor+12-y,distance+l):Math.atan2(a.floor+16-y,distance);
	}
	place(path,index) {
		const points=path.points,i=Math.min(points.length-2,Math.floor(index)),t=index-i,a=points[i],b=points[i+1],p=this.shared.player;
		const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,floor=a.floor+(b.floor-a.floor)*t;
		const support=this.shared.heightmap.caves.column(x,z,floor+11);
		const actualFloor=support?.floor??floor;
		const water=path.wet?a.water+(b.water-a.water)*t:-1e6;
		p.position.set(x,Math.max(actualFloor,water-1.5)+11,z);p.groundY=p.position.y-11;p.velocity.set(0,0,0);p.fly=true;
		p.yaw=Math.atan2(a.x-b.x,a.z-b.z);p.pitch=-.05;
	}
	guide(now) {
		if(!this.start || now<this.start)return;
		const t=(now-this.start)/20000;
		if(t>=1){
			const values=this.moving.slice().sort((a,b)=>a-b),pick=q=>values[Math.min(values.length-1,Math.floor(values.length*q))]||0;
			const canvas=this.shared.renderer.domElement,cave=this.shared.world.caves[this.index];
			const result={seed:new URLSearchParams(location.search).get('seed'),cave:cave.id,resolution:`${canvas.width}x${canvas.height}`,seconds:20,frames:values.length,p50:pick(.5),p95:pick(.95),p99:pick(.99),max:pick(1),over33:values.filter(v=>v>33.4).length,over50:values.filter(v=>v>50).length};
			this.panel.dataset.profile=JSON.stringify(result);this.start=null;return;
		}
		this.place(this.shared.world.caves[this.index].paths[0],5+t*21);
	}
	update(ms) {
		if(this.panel.hidden)return;
		this.elapsed+=ms/1000;if(this.start&&performance.now()>=this.start)this.moving.push(ms);
		if(this.elapsed<0)return;
		this.frames.push(ms);if(this.frames.length<120)return;
		const sorted=this.frames.sort((a,b)=>a-b),cave=this.shared.world.caves[this.index];if(!cave)return;
		const p=this.shared.player.position,cover=Math.max(0,this.shared.heightmap.height(p.x,p.z)-p.y);
		this.panel.dataset.position=JSON.stringify(p.toArray());this.panel.dataset.cover=cover;
		this.panel.dataset.counts=JSON.stringify(this.shared.world.caves.map(c=>({wet:c.wet,paths:c.paths.length,length:c.length,cover:c.overburden})));
		this.panel.dataset.resolution=`${this.shared.renderer.domElement.width}x${this.shared.renderer.domElement.height}`;
		this.output.textContent=`${cave.name} ${cave.id+1} · ${Math.round(cover)} m below ground · ${Math.round(cave.length)} m main passage\n${(1000/sorted[Math.floor(sorted.length*.5)]).toFixed(0)} fps median · ${sorted[Math.floor(sorted.length*.95)].toFixed(1)} ms p95`;
		const result=this.panel.dataset.profile;if(result){const r=JSON.parse(result);this.output.textContent+=`\nPassage test · ${r.p99.toFixed(1)} ms p99 · ${r.over50} frames over 50 ms`;}
		this.frames=[];
	}
}
