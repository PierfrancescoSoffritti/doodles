import {AudioSampleBank} from './AudioSampleBank.js?v=stable-30-3';
import {buildLanternSamples} from './LanternMiteSamples.js?v=stable-30-3';
export class LanternMiteBuffers extends AudioSampleBank {
 constructor(ctx,options={}) {super(ctx,{workerFactory:()=>new Worker(new URL('./LanternMiteVoiceWorker.js?v=stable-30-3',import.meta.url),{type:'module'}),build:buildLanternSamples,key:o=>[o.sampleRate,o.mite.id,o.mite.size,!!o.reply].join(':'),limit:64,...options});}
}
