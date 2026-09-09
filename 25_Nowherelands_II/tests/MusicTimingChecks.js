import { AudioEngine } from '../js/audio/AudioEngine.js?v=pebble-audio-10';
import { Conductor } from '../js/audio/Conductor.js?v=pebble-audio-10';

const rendered = new Map();

// Render the production mixer with repeatable controls and randomness. The display
// clock remains 120 Hz while presentation varies; the audio scheduler retains its
// independent 25 ms lookahead clock. legacyGate reproduces the whole-loop cap bug.
export async function renderMusicTiming({ fps = 0, legacyGate = false, AudioEngineClass = AudioEngine, ConductorClass = Conductor } = {}) {
	let seed = 17, now = 0;
	const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
	const originalRandom = Math.random;
	const offline = new OfflineAudioContext(2, 44100 * 12, 44100);
	const context = new Proxy(offline, { get(target,key) {
		if (key === 'currentTime') return now;
		const value = Reflect.get(target,key,target); return typeof value === 'function' ? value.bind(target) : value;
	} });
	let engine, conductor, updates = 0, frames = 0, buffer;
	const notes = [], controls = [];
	try {
		Math.random = random;
		engine = new AudioEngineClass(context, random);
		engine.master.gain.setTargetAtTime(.9, 0, 1.5);
		engine.emitNote = (freq, position, velocity, layer, time) => notes.push({ freq, velocity, layer, time });
		conductor = new ConductorClass(engine);
		for (const layer of Object.values(conductor.layers)) layer.unlock();
		conductor.keyTimer = 3; conductor.chordTimer = 2;
		conductor.scheduler.nextStepTime = .1;
		const world = { player: { position: { x:0,y:11,z:0 }, speed:0, pitch:0, yawRate:0, looking:false, wading:false },
			heightmap:{waterLevel:0}, moon:{height:.7,intensity:.9}, sun:{height:-1,intensity:0},
			weather:{exposure:1}, state:{hum:0}, wandererProximity:0 };
		let lastUpdate = 0;
		// 1200 ticks/second represents both 120 Hz display and 40 Hz scheduler exactly.
		for (let tick = 0; tick < 12*1200; tick++) {
			now = tick/1200;
			if (tick%10 === 0) {
				const render = !fps || tick % (1200/fps) === 0;
				if (render) frames++;
				if (!legacyGate || render) {
					const dt = Math.min(.05, now-lastUpdate); lastUpdate=now; updates++;
					const p=world.player;
					p.position.y=11+8*Math.sin(now*.4);p.speed=now<7?20+10*Math.sin(now):0;
					p.pitch=.35*Math.sin(now*.7);p.yawRate=.8*Math.cos(now);p.looking=now<7;p.wading=now>5&&now<6;
					world.state.rainVisible=now>4&&now<7?.25:0;world.state.snowVisible=now>8?.2:0;
					world.wandererProximity=.4+.3*Math.sin(now*.5);
					engine.update(dt);engine.updateListener(p.position,{x:0,y:0,z:-1},{x:0,y:1,z:0});
					conductor.update(dt,world);
					controls.push([now,conductor.params.cutoff,conductor.params.density,conductor.layers.drone.current]);
				}
			}
			if (tick%30 === 0) conductor.scheduler.tick();
		}
		buffer = await offline.startRendering();
	} finally {
		Math.random = originalRandom; conductor?.dispose(); engine?.offNote();
	}
	const samples = new Float32Array(buffer.length*2);
	let energy=0,peak=0;
	for(let ch=0;ch<2;ch++){
		const channel=buffer.getChannelData(ch);samples.set(channel,ch*buffer.length);
		for(const value of channel){if(!Number.isFinite(value))throw new Error('Non-finite music sample');energy+=value*value;peak=Math.max(peak,Math.abs(value));}
	}
	const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
	const id = rendered.size; rendered.set(id, samples);
	return { id, fps, legacyGate, updates, frames, notes:notes.length, peak, rms:Math.sqrt(energy/samples.length),
		pcmHash:await hash(samples.buffer), controlsHash:await hash(new TextEncoder().encode(JSON.stringify({notes,controls}))) };
}

export function compareMusicSamples(referenceId, candidateId) {
	const a=rendered.get(referenceId),b=rendered.get(candidateId);
	if(!a||!b||a.length!==b.length)throw new Error('Missing/mismatched music recordings');
	let peakError=0,energy=0;
	for(let i=0;i<a.length;i++){const d=a[i]-b[i];peakError=Math.max(peakError,Math.abs(d));energy+=d*d;}
	return { samples:a.length, peakError, rmsError:Math.sqrt(energy/a.length) };
}
