import test from 'node:test';
import assert from 'node:assert/strict';
import {playerNoteRadius,rippleRadius,RIPPLE_LIFETIME} from '../../js/world/RippleWave.js?v=player-notes-13';
import {receiveNote,updateNote} from '../../js/world/fauna/NoteResponse.js?v=player-notes-13';
import {PlayerNotes} from '../../js/player/PlayerNotes.js?v=outline-2';
import {FaunaModel} from '../../js/world/fauna/FaunaModel.js?v=player-notes-13';
import {BirdEncounter} from '../../js/world/fauna/BirdEncounter.js?v=outline-2';
const source={x:0,y:10,z:0};
const note=(velocity=.35)=>({position:source,layer:'player-note',velocity,radius:playerNoteRadius(velocity)});

test('ripples start fast, slow down monotonically and never extend beyond the hearing radius',()=>{
 for(const velocity of [.35,.5,.75,.95]){
  const radius=playerNoteRadius(velocity);let before=0,speed=Infinity;
  for(let i=1;i<=180;i++){
   const r=rippleRadius(radius,i/30),step=r-before;
   assert.ok(r>=before&&r<=radius);assert.ok(step<=speed+.00001);before=r;speed=step;
  }
  assert.equal(before,radius);assert.equal(rippleRadius(radius,20),radius);
  assert.ok(rippleRadius(radius,1)>radius*.4);
 }
 assert.equal(playerNoteRadius(.35),82.5);assert.equal(playerNoteRadius(.95),165);
});
test('every point inside the rendered circle responds on click, including elevated animals and the outer edge',()=>{
 for(const velocity of [.35,.6,.95])for(const distance of [0,60,playerNoteRadius(velocity)]){
  const c={pos:{x:distance,y:45,z:0}};let reacted=false;
  assert.ok(receiveNote(c,10,note(velocity),{delay:1.3,range:12}));
  updateNote(c,10,()=>reacted=true);assert.ok(reacted);assert.equal(c.noteResponse.start,10);
 }
 const c={pos:{x:playerNoteRadius(.35)+.01,y:10,z:0}};assert.equal(receiveNote(c,0,note()),false);
});
test('the live note dispatch gives the renderer and all creature systems the identical range immediately',()=>{
 const heard=[],rings=[];const shared={hue:.2,ripples:{add:(...a)=>rings.push(a)},fauna:{model:{creatures:[],hear:n=>heard.push(n)}},walkers:{root:{visible:false},hearNote:n=>heard.push(n)},birds:{root:{visible:false},hearNote:n=>heard.push(n)},mites:{root:{visible:false},hearNote:n=>heard.push(n)}};
 Object.assign(Object.create(PlayerNotes.prototype),{shared}).hear(note(.8));
 assert.equal(heard.length,4);assert.equal(rings.length,1);
 assert.ok(heard.every(n=>n.radius===rings[0][5]&&n.radius===playerNoteRadius(.8)));
});
test('pebbles at the far edge answer immediately, instead of waiting for the ring',()=>{
 const sample=()=>({ground:5,water:0,slope:0,hardness:1,forest:0,wet:0,foam:0});
 const m=new FaunaModel('range',{sample}),g=m.addGroup('stones','hopper',65,0,1);m.listener=source;m.observing=true;
 m.hear({...note(),strength:.35});assert.ok(g.members.every(c=>c.noteResponse));m.step(1/30);
 assert.ok(g.members.every(c=>c.pebble.state==='answer'));
});
test('a bird in flight within the circle can still acknowledge the note',()=>{
 const e=new BirdEncounter({x:0,y:0,z:0},{x:30,y:10,z:0},2.8);e.start();e.update(.5);
 assert.ok(e.journey.active);assert.ok(e.hearNote(note()));e.update(1/30);assert.ok(e.noteResponse.acted);
});

 test('a sprinting player stays behind the ripple edge throughout its visible life',()=>{
 const radius=playerNoteRadius(.35);
 for(let i=1;i<=120;i++){const t=RIPPLE_LIFETIME*i/120;assert.ok(rippleRadius(radius,t)>80*t);}
 const lateSpeed=(rippleRadius(radius,RIPPLE_LIFETIME)-rippleRadius(radius,RIPPLE_LIFETIME-.01))/.01;assert.ok(lateSpeed>80);
 });
