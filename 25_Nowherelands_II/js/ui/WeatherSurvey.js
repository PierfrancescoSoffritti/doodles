import { weatherPresets } from '../world/weather/WeatherModel.js';
// Repeatable visual QA (?weather=1). No weather controls are added to normal exploration.
export class WeatherSurvey {
	constructor(shared, sky) {
		this.shared = shared; this.sky = sky; this.frames = []; this.elapsed = 0;
		this.panel = document.createElement('aside'); this.panel.className = 'river-survey weather-survey';
		Object.assign(this.panel.style, { maxWidth: '420px', maxHeight: 'calc(100vh - 44px)', overflowY: 'auto', pointerEvents: 'auto' });
		this.sliders = {}; this.values = { ...weatherPresets.clear, brightness: 1, thunder: 1 };
		const title = document.createElement('div'); title.textContent = 'WEATHER SURVEY'; this.panel.append(title);
		for (const [label, action] of [
			['Natural', () => this.setWeather(null)], ['Clear', () => this.setWeather('clear')], ['Scattered', () => this.setWeather('scattered')], ['Snow', () => this.setWeather('snow')], ['Rain', () => this.setWeather('rain')],
			['Storm', () => this.setWeather('storm')], ['Hail', () => this.setWeather('hail')],
			['Coast', () => this.place('coast')], ['Mountain', () => this.place('mountain')], ['Cave', () => this.place('cave')], ['Cave mouth', () => this.place('mouth')],
			['Look up', () => { shared.player.pitch = .7; }], ['Look ahead', () => { shared.player.pitch = .05; }],
			['Look down', () => { shared.player.pitch = -1.15; }], ['Turn around', () => { shared.player.yaw += Math.PI; }],
			['Face sun/moon', () => { const d = shared.sun.height > 0 ? shared.sun.dir : shared.moon.dir; shared.player.yaw = Math.atan2(-d.x, -d.z); shared.player.pitch = Math.asin(d.y); }],
			['Lightning', () => { const p=shared.player.position;shared.weather.strike({x:p.x+600,z:p.z-700,strength:1,seed:42},p); }],
			['Low cloud quality', () => { sky.clouds.uniforms.uDetail.value = 3; }],
			['Clouds off/on', () => { sky.clouds.disabled=!sky.clouds.disabled; }],
			['Enable sound', () => { shared.hud.enterBtn.click(); }],
		]) { const b=document.createElement('button'); b.textContent=label; b.onclick=()=>{action();this.frames=[];this.elapsed=-2;};this.panel.append(b); }
		const hint = document.createElement('p'); hint.textContent = 'Sliders override natural weather. Snow falls only above the mountain snowline. Enable sound to hear thunder.'; hint.style.fontSize = '11px'; this.panel.append(hint);
		for (const [key, label, max, step, unit] of [
			['coverage', 'Cloud cover', 1, .01, '%'], ['wind', 'Wind speed', 60, 1, 'm/s'], ['gust', 'Gust variation', 1, .01, '%'],
			['rain', 'Rain intensity', 1, .01, '%'], ['snow', 'Snow intensity', 1, .01, '%'], ['hail', 'Hail intensity', 1, .01, '%'],
			['storm', 'Storm development', 1, .01, '%'], ['lightning', 'Lightning frequency', 30, 1, '/min'],
			['brightness', 'Lightning brightness', 1, .01, '%'], ['thunder', 'Thunder volume', 1, .01, '%'],
		]) {
			const row = document.createElement('label'); row.htmlFor = `weather-${key}`;
			Object.assign(row.style, { display: 'grid', gridTemplateColumns: '140px 1fr 52px', alignItems: 'center', gap: '8px', fontSize: '11px', margin: '5px 0' });
			const text = document.createElement('span'); text.textContent = label;
			const input = document.createElement('input'); input.id = row.htmlFor; input.type = 'range'; input.min = 0; input.max = max; input.step = step; input.style.width = '100%';
			const output = document.createElement('output'); output.htmlFor = input.id;
			const show = value => { input.value = value; output.textContent = unit === '%' ? `${Math.round(value * 100)}%` : `${Math.round(value)}${unit}`; };
			input.oninput = () => { this.values[key] = Number(input.value); show(this.values[key]); this.shared.weather.model.preview = null; this.shared.weather.model.setControls(this.values); this.mode = 'custom'; };
			this.sliders[key] = show; show(this.values[key]); row.append(text, input, output); this.panel.append(row);
		}
		this.output = document.createElement('output'); this.panel.append(this.output); document.body.append(this.panel);
		shared.hud.intro.classList.add('hidden'); shared.hud.el.classList.add('visible');
		this.place('coast');
	}
	setWeather(kind) {
		const m = this.shared.weather.model; m.preview = null; this.mode = kind || 'natural';
		if (!kind) { m.setControls(null); return; }
		this.values = { ...weatherPresets[kind], brightness: this.values.brightness, thunder: this.values.thunder };
		m.setControls(this.values);
		for (const key in this.sliders) this.sliders[key](this.values[key]);
	}
	place(kind) {
		const s=this.shared,p=s.player,w=s.world;
		let x=0,z=0,y=Math.max(0,s.heightmap.height(0,0))+22;
		if(kind==='mountain') {
			let best=-Infinity,idx=0;
			for(let i=0;i<w.height.length;i++)if(w.height[i]>best){best=w.height[i];idx=i;}
			x=(idx%w.res)*w.cell-w.size/2-w.spawn.x;z=Math.floor(idx/w.res)*w.cell-w.size/2-w.spawn.z;y=s.heightmap.height(x,z)+25;
		}
		if(kind==='cave' && w.caves?.length) {
			const a=w.caves[0].paths[0].points[8];x=a.x;z=a.z;
			const support=s.heightmap.caves.column(x,z,a.floor+11);y=(support?.floor??a.floor)+11;
		}
		let mouth = null;
		if (kind === 'mouth' && w.caves?.length) {
			const cave = w.caves.find(c => c.entrances?.some(e => e.type === 'mountain')) || w.caves[0];
			const e = cave.entrances.find(e => e.type === 'mountain') || cave.entrance;
			const points = cave.paths[e.path || 0].points, end = e.end === 'end';
			const a = points[end ? points.length-3 : 2]; mouth = points[end ? points.length-1 : 0];
			x = a.x; z = a.z; const support = s.heightmap.caves.column(x,z,a.floor+11); y = (support?.floor ?? a.floor)+11;
		}
		p.position.set(x,y,z);p.velocity.set(0,0,0);p.groundY=y-11;p.fly=true;p.pitch=.12;p.yaw=kind==='coast'?w.spawn.yaw:0;
		if(mouth){p.yaw=Math.atan2(x-mouth.x,z-mouth.z);p.pitch=Math.atan2(mouth.floor+11-y,Math.hypot(x-mouth.x,z-mouth.z));}
	}
	update(ms) {
		this.elapsed+=ms/1000;if(this.elapsed<0)return;
		this.frames.push(ms);if(this.frames.length<90)return;
		const s=this.shared,l=s.weather.local,sorted=this.frames.slice().sort((a,b)=>a-b),p=s.player.position;
		const stats={altitude:p.y,rain:s.state.rainVisible,snow:s.state.snowVisible,hail:s.state.hailVisible,storm:l.storm,cover:l.coverage,snowLine:l.snowLine,wind:l.windSpeed,offset:[s.weather.motion.x,s.weather.motion.z],blend:s.weather.model.blend,controls:{...s.weather.controls},precipitationNearby:s.weather.precipitationNearby,particleLayers:{...s.weather.particleLayers},roofMapReady:s.shoreMap.covers(p.x,p.z),exposure:s.weather.exposure,lightning:s.weather.uniforms.uLightning.value,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],cloudSize:[this.sky.clouds.target.width,this.sky.clouds.target.height]};
		this.panel.dataset.weather=JSON.stringify(stats);
		this.output.textContent=`${this.mode || 'natural'} · elevation ${p.y.toFixed(0)} · snowline ${l.snowLine.toFixed(0)}\nRain ${(stats.rain*100).toFixed(0)}% · snow ${(stats.snow*100).toFixed(0)}% · hail ${(stats.hail*100).toFixed(0)}%\nClouds ${(l.coverage*100).toFixed(0)}% · wind ${l.windSpeed.toFixed(1)} m/s · exposure ${(stats.exposure*100).toFixed(0)}%\n${(1000/stats.p50).toFixed(0)} fps median · ${stats.p95.toFixed(1)} ms p95 · clouds ${stats.cloudSize.join('×')}`;
		this.frames=[];
	}
}
