import { AudioEngine } from '../js/audio/AudioEngine.js?v=pebble-audio-10';
import { Conductor } from '../js/audio/Conductor.js?v=pebble-audio-10';

// Locked layers are still constructed by the game. Their wet sends must be silent too.
async function renderGameLayers(shimmerVolume) {
 let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const ctx=new OfflineAudioContext(2,44100*3,44100),engine=new AudioEngine(ctx,random);
 engine.master.gain.value=.9;
 const conductor=new Conductor(engine);
 conductor.layers.shimmer.out.gain.value=shimmerVolume;
 const buffer=await ctx.startRendering();
 let peak=0;for(let ch=0;ch<2;ch++)for(const v of buffer.getChannelData(ch)){if(!Number.isFinite(v))throw new Error('Non-finite game mix');peak=Math.max(peak,Math.abs(v));}
 conductor.dispose();engine.offNote();return peak;
}

export async function checkLockedGameLayers() {
 const peak=await renderGameLayers(0);
 if(peak>1e-7)throw new Error('Silent game layers leak through effects: peak '+peak);
 const active=await renderGameLayers(.25);
 if(active<.01 || active>=.95)throw new Error('Shimmer must still play at its intended layer volume: '+active);
 return {silentGameLayersPeak:peak,activeShimmerPeak:active};
}
