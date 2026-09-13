import {lanternSamples} from './LanternMiteSamples.js?v=stable-30-3';
self.onmessage=({data:{id,options}})=>{
 try{const samples=lanternSamples(options.mite,options.reply,options.sampleRate);self.postMessage({id,samples},[samples.buffer]);}
 catch(error){self.postMessage({id,error:String(error)});}
};
