import { createPebbleAudioScene, pebbleEncounter } from './audio/PebbleAudioScene.js?v=pebble-audio-10';
import { readPebbleVolume, savePebbleVolume, watchPebbleVolume } from './audio/PebbleAudioSettings.js?v=pebble-audio-10';
import { checkPebbleMix, renderPebbleMix, encodeWav } from '../tests/PebbleMixChecks.js?v=pebble-audio-10';
const $=id=>document.getElementById(id);
let studio=null,timers=[],clipURL=null,activeScene;
$('volume').value=readPebbleVolume()*100;
const options=()=>({scene:$('scene').value,distance:Number($('distance').value),size:Number($('size').value),count:Number($('count').value),background:$('background').checked,volume:Number($('volume').value)/100});
function volume(){const v=options().volume;$('volumeText').textContent=Math.round(v*100)+'%';savePebbleVolume(v);if(studio){studio.audio.pebbles.volume=v;studio.audio.update();}}
const offVolume=watchPebbleVolume(v=>{$('volume').value=v*100;$('volumeText').textContent=Math.round(v*100)+'%';if(studio)studio.audio.pebbles.volume=v;});$('volume').oninput=volume;
async function ensure() {
 if(!studio || activeScene!==options().scene){stop();studio?.dispose();studio=createPebbleAudioScene(null,options());activeScene=options().scene;}
 await studio.engine.ctx.resume();studio.engine.master.gain.value=.9;studio.audio.muted=false;studio.audio.pebbles.volume=options().volume;studio.setBackground(options().background);return studio;
}
function stop(){timers.forEach(clearTimeout);timers=[];if(studio){studio.audio.muted=true;studio.audio.update();for(const v of [...studio.audio.pebbles.voices]){try{v.source.stop();}catch{}}studio.audio.pebbles.out.gain.cancelScheduledValues(studio.engine.now);studio.audio.pebbles.out.gain.setValueAtTime(0,studio.engine.now);studio.setBackground(false);}$('status').textContent='Stopped.';}
$('stop').onclick=stop;
$('background').onchange=()=>studio?.setBackground(options().background);
for(const id of ['scene','distance','size','count'])$(id).onchange=stop;
$('play').onclick=async()=>{
 stop();const s=await ensure(),config=options();s.audio.pebbles.history=[];let accepted=0,skipped=0;
 for(const event of pebbleEncounter(config))timers.push(setTimeout(()=>{
  if(s.audio.pebble(event.creature,event.event,{cave:config.scene!=='hill',listener:s.listener}))accepted++;else skipped++;
  $('status').textContent=`Playing · ${accepted} sounds${skipped?` · ${skipped} outside range or sound limit`:''}`;
 },event.time*1000));
 timers.push(setTimeout(()=>{$('status').textContent=`Finished · ${accepted} sounds${skipped?` · ${skipped} outside range or sound limit`:''}`;},6500));
};
$('reference').onclick=async()=>{const s=await ensure();s.reference();$('status').textContent='Playing the existing player tone at its usual level.';};
for(const button of $('sounds').querySelectorAll('button'))button.onclick=async()=>{
 const s=await ensure(),c=pebbleEncounter(options())[0].creature;
 const ok=s.audio.pebble(c,button.dataset.sound,{cave:options().scene!=='hill',listener:s.listener});
 $('status').textContent=ok?`Playing ${button.textContent.toLowerCase()}.`:'Outside hearing range, muted, or sound limit reached.';
};
$('checks').onclick=async()=>{
 $('checks').disabled=true;$('report').textContent='Rendering checks…';
 try{const report=await checkPebbleMix(message=>$('report').textContent=message);$('report').textContent='PASS\n'+JSON.stringify(report,null,2);document.body.dataset.audioChecks='pass';document.body.dataset.audioReport=JSON.stringify(report);}catch(e){$('report').textContent='FAIL: '+e.stack;document.body.dataset.audioChecks='fail';}finally{$('checks').disabled=false;}
};
$('record').onclick=async()=>{
 $('record').disabled=true;$('status').textContent='Rendering the selected encounter…';
 try {const {buffer}=await renderPebbleMix({...options(),mode:options().background?'mixed':'solo'});
  if(clipURL)URL.revokeObjectURL(clipURL);clipURL=URL.createObjectURL(new Blob([encodeWav(buffer)],{type:'audio/wav'}));
  $('clip').replaceChildren();const player=document.createElement('audio');player.controls=true;player.src=clipURL;const link=document.createElement('a');link.href=clipURL;link.download='pebble-encounter.wav';link.textContent='Download this replay';$('clip').append(player,link);$('status').textContent='Replay ready. This uses the same sound path as the game.';
 }catch(e){$('status').textContent=e.message;}finally{$('record').disabled=false;}
};
const samples=new Float32Array(512);
function meter(analyser,id){analyser.getFloatTimeDomainData(samples);let peak=0,sum=0;for(const v of samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;}$(id+'Meter').value=peak;$(id+'Level').textContent=`${sum? (20*Math.log10(Math.sqrt(sum/samples.length))).toFixed(1):'−∞'} dBFS · peak ${peak.toFixed(2)}`;}
function frame(){requestAnimationFrame(frame);if(!studio)return;studio.audio.update();meter(studio.audio.pebbles.meter,'pebble');meter(studio.engine.analyser,'mix');$('events').textContent=studio.audio.pebbles.history.slice(-5).map(h=>`${h.event} · ${h.distance.toFixed(0)} units${h.cave?' · cave':''}`).join('  /  ');}
requestAnimationFrame(frame);
addEventListener('pagehide',()=>{offVolume();stop();studio?.dispose();});
