const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const noteDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export const isPlayerNote=note=>note.layer==='player-note';
// One finite exchange per animal. Spam queues one alarm after the current gesture;
// it cannot keep restarting the animation, accumulating sounds or extending it.
export function receiveNote(owner,time,note,{duration=5,delay=0,range=110,position=owner.pos||owner.position}={}) {
 if(!isPlayerNote(note)||!note.position||!position)return false;
 const distance=note.radius!==undefined?Math.hypot(position.x-note.position.x,position.z-note.position.z):noteDistance(position,note.position);
 if(distance>(note.radius??range*(note.velocity>.75?1.5:.75)))return false;
 if(note.radius!==undefined)delay=0;
 if(time-(owner.noteHeardAt??-100)<.12)return false;
 owner.noteHeardAt=time;owner.noteTimes=(owner.noteTimes||[]).filter(t=>time-t<5);owner.noteTimes.push(time);
 const alarm=note.velocity>.75||owner.noteTimes.length>=3;
 const current=owner.noteResponse;
 if(current&&time<current.end){if(alarm&&!current.alarm&&!current.pending)current.pending={...note,velocity:1,expires:time+8};return false;}
 if(time<(owner.noteReady||0))return false;
 owner.noteResponse={start:time+delay,end:time+delay+duration,duration,alarm,source:{...note.position},acted:false,sounded:false};
 owner.noteReady=time+delay+duration+1;owner.noteCount=(owner.noteCount||0)+1;return true;
}
export function responseAt(owner,time) {
 let r=owner.noteResponse;
 if(r&&time>=r.end){
  const pending=r.pending;owner.noteResponse=null;
  if(pending&&time<=pending.expires){owner.noteReady=0;owner.noteHeardAt=-100;receiveNote(owner,time,pending,{position:owner.pos||owner.position||pending.position,range:160});r=owner.noteResponse;}else r=null;
 }
 if(!r||time<r.start)return null;
 const age=time-r.start,phase=clamp(age/r.duration),light=smooth(age/.5)*smooth((r.duration-age)/1.2);
 return {r,age,phase,light};
}
export function updateNote(owner,time,act,sound,soundDelay=.65) {
 const state=responseAt(owner,time);owner.noteGlow=state?.light||0;owner.notePhase=state?.phase||0;owner.noteAlarm=!!state?.r.alarm;
 if(!state)return null;
 if(!state.r.acted){state.r.acted=true;act?.(state.r);}
 if(!state.r.sounded&&state.age>=soundDelay){state.r.sounded=true;sound?.(state.r);}
 return state;
}
