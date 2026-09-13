import {buildVeilRay} from './VeilRayVoice.js?v=stable-30-3';
import {AudioSampleBank} from './AudioSampleBank.js?v=stable-30-3';
export class VeilRayBuffers extends AudioSampleBank {
 constructor(ctx,options={}) {super(ctx,{workerFactory:()=>new Worker(new URL('./VeilRayVoiceWorker.js?v=stable-30-3',import.meta.url),{type:'module'}),build:buildVeilRay,key:o=>[o.sampleRate,o.frequency,o.phrase,o.size,o.identity].join(':'),...options});}
}
