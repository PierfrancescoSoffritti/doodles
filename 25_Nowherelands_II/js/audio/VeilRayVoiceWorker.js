import {synthesizeVeilRay} from './VeilRayVoice.js?v=stable-30-3';
self.onmessage=({data:{id,options}})=>{
 try{const samples=synthesizeVeilRay(options);self.postMessage({id,samples},[samples.buffer]);}
 catch(error){self.postMessage({id,error:String(error)});}
};
