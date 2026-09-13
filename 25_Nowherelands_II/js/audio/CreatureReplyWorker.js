import {synthesizeCreatureReply} from './CreatureReplyAudio.js?v=stable-30-3';
self.onmessage=({data:{id,options:o}})=>{
 try{const samples=synthesizeCreatureReply(o.kind,o.alarm,o.sampleRate,o.profile);self.postMessage({id,samples},[samples.buffer]);}
 catch(error){self.postMessage({id,error:String(error)});}
};
