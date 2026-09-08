import { readPebbleVolume, savePebbleVolume } from '../audio/PebbleAudioSettings.js?v=pebble-audio-10';
import { SPECIES } from '../world/fauna/FaunaModel.js';

// Optional in-world field guide. Only visits real members of the current population.
export class FaunaSurvey {
	constructor(shared, fauna) {
		this.shared = shared; this.fauna = fauna; this.kind = 'lumen'; this.tracking = false; this.frames = [];
		this.panel = document.createElement('aside'); this.panel.className = 'fauna-guide';
		this.panel.innerHTML = '<div class="fauna-guide-kicker">NOWHERELANDS · FIELD NOTES</div><h2>Living echoes</h2><p>Living lights and watchful stones.<br>Choose a creature to meet it.</p>';
		this.list = document.createElement('div'); this.list.className = 'fauna-guide-list'; this.buttons = {};
		for (const [kind, def] of Object.entries(SPECIES)) {
			const b = document.createElement('button'); b.type = 'button'; b.textContent = def.name;
			b.onclick = () => this.visit(kind); this.list.append(b); this.buttons[kind] = b;
		}
		this.panel.append(this.list);
		this.detail = document.createElement('p'); this.detail.className = 'fauna-guide-detail'; this.panel.append(this.detail);
		const actions = document.createElement('div'); actions.className = 'fauna-guide-actions';
		this.listen = document.createElement('button'); this.listen.textContent = 'Hear its voice';
		this.listen.onclick = () => { this.startAudio(); const c = this.subject || fauna.nearest(this.kind); if (c) fauna.model.call(c); };
		this.answer = document.createElement('button'); this.answer.textContent = 'Send a tone';
		this.answer.onclick = () => {
			this.startAudio(); const e = shared.audio;
			if (e) e.playTone({ freq: shared.conductor.scale.freq(0, 2), position: shared.player.position, velocity: 0.42, attack: 0.05, duration: 0.3, release: 1, type: 'sine', layer: 'invitation', dest: e.playerBus });
		};
		actions.append(this.listen, this.answer); this.panel.append(actions);
		const explore = document.createElement('button'); explore.className = 'fauna-guide-explore'; explore.textContent = 'Explore here ↗';
		explore.onclick = () => {
			this.startAudio(); this.tracking = false; this.watchFlight = null; this.watchPebble = null; shared.player.fly = false;
			if (!shared.player.locked) {
				// Embedded previews may reject mouse capture; leave the guide usable.
				try { const request = shared.renderer.domElement.requestPointerLock?.(); request?.catch(() => {}); } catch {}
			}
		};
		this.panel.append(explore);
		this.approach = document.createElement('button'); this.approach.className = 'fauna-guide-explore'; this.approach.textContent = 'Approach the school';
		this.approach.onclick = () => {
			const c = this.subject || fauna.nearest(this.kind); if (!c || !['lumen', 'hopper'].includes(c.kind)) return;
			this.startAudio(); this.tracking = false; fauna.model.observing = false; fauna.profile?.reset(); this.soundPeak=0;
			const p = c.pos, player = shared.player;
			const view = c.kind === 'hopper' && c.group.sample ? this.caveView(c, 5.8, 11) : null;
			const x = view?.x ?? p.x + (c.kind === 'hopper' ? 5 : 7), z = view?.z ?? p.z + (c.kind === 'hopper' ? 3 : 7), surface = (c.group.sample || fauna.sample)(x, z);
			player.groundY = Math.max(surface.ground, surface.water - 1.5);
			player.position.set(x, view?.y ?? player.groundY + 11, z); player.velocity.set(0, 0, 0); player.fly = false; this.watchFlight = c.kind === 'lumen' ? c.navigation || c.group : null; this.watchPebble = c.kind === 'hopper' ? c : null;
			player.yaw = Math.atan2(p.x - x, p.z - z) + Math.PI; player.pitch = Math.atan2(p.y - player.position.y, Math.hypot(p.x - x, p.z - z));
		}; this.panel.append(this.approach);
		this.nextStream = document.createElement('button'); this.nextStream.className = 'fauna-guide-explore'; this.nextStream.textContent = 'Next flock ↗';
		this.nextStream.onclick = () => this.kind === 'hopper' ? this.nextColony() : this.nextFlock(); this.panel.append(this.nextStream);
		this.audioToggle = document.createElement('button'); this.audioToggle.className = 'fauna-guide-quiet'; this.audioToggle.textContent = 'Quiet fauna';
		this.audioToggle.onclick = () => { if (fauna.audio) { fauna.audio.muted = !fauna.audio.muted; this.audioToggle.textContent = fauna.audio.muted ? 'Hear fauna' : 'Quiet fauna'; } };
		this.panel.append(this.audioToggle);
  const volumeLabel=document.createElement('label');volumeLabel.textContent='Pebble sounds ';
  const volume=document.createElement('input');volume.type='range';volume.min=0;volume.max=150;volume.step=5;volume.value=readPebbleVolume()*100;volume.setAttribute('aria-label','Pebble volume');
  volume.oninput=()=>{const value=Number(volume.value)/100;savePebbleVolume(value);if(fauna.audio)fauna.audio.pebbles.volume=value;};
  volumeLabel.append(volume);this.panel.append(volumeLabel);
  this.volumeControl=volume;
  const soundStudio=document.createElement('a');soundStudio.href='./pebble-sound.html';soundStudio.target='_blank';soundStudio.textContent='Pebble sound studio ↗';soundStudio.style.cssText='display:block;margin:10px 0;font-size:12px;color:#afcdcf';this.panel.append(soundStudio);
		const soundDetails=document.createElement('details');const soundSummary=document.createElement('summary');soundSummary.textContent='Sound diagnostics';this.soundReadout=document.createElement('output');soundDetails.append(soundSummary,this.soundReadout);this.panel.append(soundDetails);
		this.readout = document.createElement('output'); this.panel.append(this.readout);
		const help = document.createElement('small'); help.textContent = 'Esc releases the mouse · F toggles flight'; this.panel.append(help);
		const study = document.createElement('a'); study.href = './fauna-motion.html'; study.textContent = 'Close-up motion studies ↗'; study.style.cssText = 'display:block;margin-top:12px;font-size:11px;color:#afcdcf'; this.panel.append(study);
		document.body.append(this.panel);
		document.addEventListener('pointerlockchange', () => {
			const locked = document.pointerLockElement === shared.renderer.domElement;
			this.panel.classList.toggle('playing', locked);
			if (locked) {
				this.tracking = false; this.watchFlight = null; this.watchPebble = null; fauna.model.observing = false;
			} else if (this.pendingVisit) {
				this.pendingVisit = false; this.guide(1, true);
			}
		});
	}
	nextFlock() {
		// Entering directly and exploring does not select a guide subject.
		// Start from the nearest real flock in that case, then cycle normally.
		const c = this.subject?.kind === 'lumen' && this.fauna.model.creatures.includes(this.subject) ? this.subject : this.fauna.nearest('lumen');
		const streams = c?.group.flow?.branches.filter(b => b.members.length);
		if (!streams?.length) { this.visit('lumen'); return; }
		const index = streams.indexOf(c.navigation);
		this.subject = streams[(index + 1) % streams.length].members[0];
		this.visit('lumen');
	}
	nextColony() {
		const { fauna } = this;
		const colonies = [...fauna.model.groups.values()].filter(g => g.kind === 'hopper' && g.members.length).sort((a, b) => a.id.localeCompare(b.id));
		const current = this.subject?.kind === 'hopper' && fauna.model.creatures.includes(this.subject) ? this.subject : fauna.nearest('hopper');
		const index = colonies.indexOf(current?.group);
		const next = fauna.findPebbleColony ? fauna.findPebbleColony(current?.group) : colonies.length > 1 ? colonies[(index + 1) % colonies.length] : null;
		if (!next) {
			if (!current) this.visit('hopper');
			else this.detail.textContent = 'No other rocky colony found nearby. Explore farther inland.';
			return;
		}
		this.subject = next.members[0]; this.visit('hopper');
	}

	startAudio() {
		if (!this.shared.audio) this.shared.hud.enterBtn.click();
		this.shared.audio?.resume();
	}
	visit(kind) {
		const { shared, fauna } = this;
		let c = ['lumen', 'hopper'].includes(kind) && this.subject?.kind === kind && fauna.model.creatures.includes(this.subject) ? this.subject : fauna.nearest(kind);
		if (!c) {
			const p = shared.player.position;
			fauna.model.addGroup(`guide:${kind}:${Math.round(p.x / 100)}:${Math.round(p.z / 100)}`, kind, p.x, p.z, 650);
			c = fauna.nearest(kind);
		}
		if (!c) { this.detail.textContent = 'No suitable habitat nearby. Explore another shore.'; return; }
		this.kind = kind; this.subject = c; this.tracking = true;
		this.watchFlight = null; this.watchPebble = null;
		this.offset = kind === 'lumen' ? { x: 48, y: 23, z: 58 } : { x: 14, y: 6, z: 17 };
		for (const [key, b] of Object.entries(this.buttons)) b.setAttribute('aria-pressed', String(key === kind));
		this.detail.textContent = SPECIES[kind].voice + ' · ' + (kind === 'lumen' ? 'a call travels through the group' : 'listen, then send a tone');
		shared.player.keys.clear(); shared.player.velocity.set(0, 0, 0);
		if (shared.player.locked) {
			this.pendingVisit = true; document.exitPointerLock();
		} else this.guide(1, true);
	}
	caveView(c, radius, height) {
		for (let i = 0; i < 16; i++) {
			const a = 0.85 + i * Math.PI / 4, r = i < 8 ? radius : radius * 0.45;
			const x = c.pos.x + Math.cos(a) * r, z = c.pos.z + Math.sin(a) * r, s = c.group.sample(x, z);
			if (Number.isFinite(s.ground) && (s.clearance ?? Infinity) > height + 2 && Math.abs(s.ground - c.ground) < 5) return { x, z, y: s.ground + height };
		}
		return { x: c.pos.x, z: c.pos.z, y: c.ground + Math.min(height, 3) };
	}

	guide(dt, snap = false) {
		this.fauna.model.observing = this.tracking && !this.shared.player.locked;
		if (!this.tracking && (this.watchFlight || this.watchPebble) && !this.shared.player.locked) {
			const p = this.watchPebble ? (this.watchPebble.renderPosition || this.watchPebble.pos) : this.watchFlight.center, player = this.shared.player;
			const dx = p.x - player.position.x, dz = p.z - player.position.z;
			player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(p.y - player.position.y, Math.hypot(dx, dz));
		}
		if (!this.tracking || !this.subject || this.shared.player.locked) return;
		const { shared, subject: c, offset: o } = this, p = c.kind === 'lumen' ? c.navigation.center : (c.renderPosition || c.pos);
		const width=c.kind==='lumen' ? (c.navigation.state==='resting'?2.4:2.8) : 1;
		let x = p.x + o.x*width, z = p.z + o.z*width, y = Math.max(p.y + o.y*width, shared.heightmap.height(x, z) + 4);
		if (c.kind === 'hopper' && c.group.sample) {
			const view = this.caveView(c, 9, 5); x = view.x; z = view.z; y = view.y;
		}
		const k = snap ? 1 : 1 - Math.exp(-dt * 1.6), player = shared.player;
		player.position.x += (x - player.position.x) * k; player.position.y += (y - player.position.y) * k; player.position.z += (z - player.position.z) * k;
		player.velocity.set(0, 0, 0); player.fly = true;
		const dx = p.x - player.position.x, dz = p.z - player.position.z;
		player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(p.y - player.position.y, Math.hypot(dx, dz));
	}
	update(ms) {
		this.approach.hidden = !['lumen', 'hopper'].includes(this.kind); this.nextStream.hidden = !['lumen', 'hopper'].includes(this.kind);
		this.nextStream.textContent = this.kind === 'hopper' ? 'Next colony ↗' : 'Next flock ↗';
		this.approach.textContent = this.kind === 'hopper' ? 'Approach the stones' : 'Approach the school';
		this.approach.disabled = this.subject?.kind === 'lumen' && !['resting', 'settling'].includes(this.subject.navigation.state);
		if (this.kind === 'lumen' && this.subject?.group.state) {
			const population = this.subject.group, group = this.subject.navigation, descriptions = { resting: 'Playing along the shore', startled: 'Startled · scattering upward', playing: 'Playing in the sky · no destination yet', travelling: 'Heading toward the next shore', settling: 'Descending toward the shore' };
			if(this.fauna.model.time>=(this.flightSampleAt||0)) {
				this.flightSampleAt=this.fauna.model.time+1;
				const v={x:0,y:0,z:0};for(const c of group.members)for(const axis of ['x','y','z'])v[axis]+=c.vel[axis]/group.members.length;
				const speeds=group.members.map(c=>c.speed).sort((a,b)=>a-b),heights=group.members.map(c=>c.pos.y-Math.max(c.ground,c.water));
				this.panel.dataset.flight=JSON.stringify({time:this.fauna.model.time,flock:group.index,state:group.state,medianSpeed:speeds[Math.floor(speeds.length/2)],localMotion:group.members.reduce((n,c)=>n+Math.hypot(c.vel.x-v.x,c.vel.y-v.y,c.vel.z-v.z),0)/group.members.length,meanClearance:heights.reduce((a,b)=>a+b,0)/heights.length,maxClearance:Math.max(...heights),landed:group.members.filter(c=>c.landed).length});
			}
			const flow=population.flow;
			const encounter=group.weave;
			const activity=encounter?(encounter.stage==='merged'?'Mixing into one flowing flock':'Joining a nearby flock'):descriptions[group.state];
			const size=encounter?.stage==='merged'?encounter.branches.reduce((n,b)=>n+b.members.length,0):group.members.length;
			this.detail.textContent = `${activity} · ${size} lights · flock ${group.index+1}/${flow.branches.length}${group.highland?' · highland wanderers':''}`;
			this.panel.dataset.school = JSON.stringify({ time:this.fauna.model.time, observing:this.fauna.model.observing, playerDistance:Math.hypot(this.subject.pos.x-this.shared.player.position.x,this.subject.pos.y-this.shared.player.position.y,this.subject.pos.z-this.shared.player.position.z), state: group.state, lake: group.lake.id, destination: group.destination?.id, center: group.center, visits: group.visits, speed: this.subject.speed, members: population.members.length, flocks: [...this.fauna.model.groups.values()].filter(g=>g.kind==='lumen').length, escapeCues: this.fauna.audio?.history.filter(h=>h.event==='escape').length || 0, flow: {phase: flow.phase, cycles: flow.cycles, joins: flow.joins, branches: flow.branches.length}, streams: flow.branches.map(b=>({index:b.index, state:b.state, members:b.members.length, lake:b.lake.id, destination:b.destination?.id, height:b.center.y, highland:b.highland, encounter:b.weave?.stage, visits:b.visits})) });
		}
		if (this.kind === 'hopper' && this.subject?.pebble) {
			const c = this.subject, b = c.pebble;
   this.volumeControl.value=(this.fauna.pebbleVolume ?? 1)*100;
   const sound=this.fauna.audio?.pebbles;
   if(sound && this.fauna.model.time >= (this.soundMeterAt || 0)) {
    this.soundMeterAt=this.fauna.model.time+.05;
    this.soundSamples ||= new Float32Array(512);
    const level=node=>{node.getFloatTimeDomainData(this.soundSamples);let peak=0,sum=0;for(const v of this.soundSamples){peak=Math.max(peak,Math.abs(v));sum+=v*v;}return {peak,rms:Math.sqrt(sum/this.soundSamples.length)};};
    const pebble=level(sound.meter),mix=level(this.shared.audio.analyser),engine=this.shared.audio;
    this.soundPeak=Math.max(this.soundPeak || 0,pebble.peak);
    const last=sound.history.at(-1),db=this.soundPeak?20*Math.log10(this.soundPeak):-Infinity;
    this.soundReadout.textContent=`${engine.ctx.state} · ${Math.round(sound.volume*100)}%${this.fauna.audio.muted?' · muted':''} · encounter peak ${Number.isFinite(db)?db.toFixed(1):'−∞'} dBFS${last?' · last '+last.event:''}`;
    this.panel.dataset.pebbleSound=JSON.stringify({context:engine.ctx.state,muted:this.fauna.audio.muted,volume:sound.volume,voices:sound.voices.length,pebble,mix,peak:this.soundPeak,master:engine.master.gain.value,reduction:engine.compressor.reduction,events:sound.history.slice(-8)});
   }
			const descriptions = { rest: 'Watchful eyes among the stones', notice: 'Eyes following your approach', rise: 'Startled · unfolding its legs', flee: 'Scattering at full speed', regroup: 'Hurrying back to the colony', wait: 'Waiting upright for the colony', brake: 'Slowing · finding its footing', settle: 'Folding back into a stone' };
			const colonies = [...this.fauna.model.groups.values()].filter(g => g.kind === 'hopper' && g.members.length).sort((a, b) => a.id.localeCompare(b.id));
			this.detail.textContent = descriptions[b.state] + ` · ${this.fauna.pebbleTour?.stops ? 'tour stop ' + this.fauna.pebbleTour.stops + ' · ' : ''}${c.group.habitat || 'rocky foothills and gravel shores'}`;
			this.panel.dataset.pebble = JSON.stringify({ rendered: { visible: this.fauna.meshes.root.visible, eyes: this.fauna.meshes.pebbles.eyes.bulbs.count, position: c.renderPosition }, state: b.state, stand: b.stand, speed: c.speed, steps: b.steps, escapes: b.escapes, position: c.pos, playerDistance: Math.hypot(c.pos.x - this.shared.player.position.x, c.pos.z - this.shared.player.position.z), stones: c.group.stones.length, habitat: c.group.habitat, reunion: c.group.reunion, colony: c.group.id, colonies: colonies.length, tourStops: this.fauna.pebbleTour?.stops, knownSites: this.fauna.pebbleTour?.locations.size, home: c.group.home });
		}
		this.listen.disabled = this.answer.disabled = !this.shared.audio;
		this.frames.push(ms);
		if (this.frames.length >= 120) {
			if (this.fauna.profile) this.panel.dataset.performance = JSON.stringify(this.fauna.profile.summary());
			const sorted = this.frames.sort((a, b) => a - b), n = this.fauna.model.creatures.length;
			this.readout.textContent = `${n} creatures · ${(1000 / sorted[60]).toFixed(0)} fps`;
			this.panel.dataset.stats = JSON.stringify({ count: n, p95: sorted[114], voices: (this.fauna.audio?.voices.length || 0) + (this.fauna.audio?.pebbles.voices.length || 0), population: this.fauna.meshes.root.userData.population });
			this.frames = [];
		}
	}
}
