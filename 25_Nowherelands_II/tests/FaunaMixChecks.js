import { AudioEngine } from '../js/audio/AudioEngine.js';
import { FaunaAudio } from '../js/audio/FaunaAudio.js';
import { Scale } from '../js/audio/Scale.js';
import { Drone } from '../js/audio/layers/Drone.js';
import { Wind } from '../js/audio/layers/Wind.js';

// Exercise the actual drone/wind voices, HRTF positioning and master compressor,
// not just an isolated oscillator connected straight to the output.
export async function checkAlarmMix() {
	const reports = [];
	for (const mode of ['background', 'alarm', 'mixed']) {
		const ctx = new OfflineAudioContext(2, 44100 * 5, 44100);
		const engine = Object.create(AudioEngine.prototype); engine.ctx = ctx;
		engine.master = ctx.createGain(); engine.master.gain.value = 0.9;
		engine.layerBus = ctx.createGain(); engine.layerBus.connect(engine.master);
		const compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value=-18; compressor.knee.value=20; compressor.ratio.value=4;
		compressor.attack.value=0.01; compressor.release.value=0.35;
		engine.master.connect(compressor); compressor.connect(ctx.destination);
		engine.reverb = ctx.createConvolver();
		engine.noiseBuffer = ctx.createBuffer(1, 44100*2, 44100);
		const impulse = ctx.createBuffer(2, 44100*2, 44100);
		let random = 17;
		for(const buffer of [engine.noiseBuffer, impulse])for(let ch=0;ch<buffer.numberOfChannels;ch++) {
			const data=buffer.getChannelData(ch);
			for(let i=0;i<data.length;i++) {
				random=(Math.imul(random,1664525)+1013904223)>>>0;
				data[i]=(random/2147483648-1)*(buffer===impulse?Math.exp(-i/18000):1);
			}
		}
		engine.reverb.buffer=impulse;
		const reverbGain=ctx.createGain();reverbGain.gain.value=0.75;
		engine.reverb.connect(reverbGain);reverbGain.connect(engine.master);
		const scale=new Scale(50,'pentMinor');
		if(mode!=='alarm') {
			const drone=new Drone(engine,scale),wind=new Wind(engine);
			drone.out.gain.value=0.22;wind.out.gain.value=0.18;
		}
		const audio=new FaunaAudio(engine,{scale});
		const scheduled=ctx.suspend(2).then(async()=>{
			engine.ctx=new Proxy(ctx,{get(target,key){if(key==='state')return 'running';const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
			if(mode==='background')engine.duck(0.28,1.8);
			else if(!audio.escape({kind:'lumen',degree:0,voice:0,id:'mix',pos:{x:12,y:0,z:-16}}))throw new Error('Alarm rejected in mix');
			await ctx.resume();
		});
		const buffer=await ctx.startRendering();await scheduled;
		let sum=0,peak=0,count=0;
		for(let ch=0;ch<2;ch++) {
			const data=buffer.getChannelData(ch);
			for(let i=0;i<data.length;i++) {
				if(!Number.isFinite(data[i]))throw new Error('Non-finite '+mode+' mix');
				peak=Math.max(peak,Math.abs(data[i]));
				if(i>=2.05*44100 && i<3.05*44100){sum+=data[i]*data[i];count++;}
			}
		}
		reports.push({mode,rms:Math.sqrt(sum/count),peak});audio.dispose();
	}
	const [background,alarm,mixed]=reports;
	if(alarm.rms<background.rms || mixed.peak>=0.95)throw new Error('Alarm masked or mix clipped: '+JSON.stringify(reports));
	return {reports,alarmToBackgroundDb:20*Math.log10(alarm.rms/background.rms)};
}
