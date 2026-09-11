import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveNote,updateNote} from '../../js/world/fauna/NoteResponse.js?v=pebble-voice-4b';
import {FaunaModel} from '../../js/world/fauna/FaunaModel.js?v=pebble-voice-4b';
import {ReedWalkerWorldModel} from '../../js/world/fauna/ReedWalkerWorldModel.js?v=pebble-voice-4b';
import {BirdEncounter} from '../../js/world/fauna/BirdEncounter.js?v=pebble-voice-4b';
import {LanternMiteStudy} from '../../js/world/fauna/LanternMiteStudy.js?v=pebble-voice-4b';
import {rayHabitatSite} from '../../js/world/fauna/VeilRayHabitat.js';
const note=(position={x:0,y:10,z:20},velocity=.35)=>({layer:'player-note',position,velocity});
const sample=(x,z)=>({ground:0,water:0,slope:0,hardness:1,forest:0,wet:0,foam:0});

test('only local player notes react; spam queues one finite alarm after the gesture',()=>{
 const c={pos:{x:0,y:10,z:0}};let gestures=0,sounds=0;
 assert.equal(receiveNote(c,0,{...note(),layer:'fauna:reply'}),false);
 assert.equal(receiveNote(c,0,note({x:1000,y:10,z:0})),false);
 assert.ok(receiveNote(c,0,note()));const start=c.noteResponse.start;
 receiveNote(c,.2,note());receiveNote(c,.4,note());receiveNote(c,.6,note());assert.equal(c.noteResponse.start,start);
 for(let i=0;i<360;i++)updateNote(c,i/30,()=>gestures++,()=>sounds++);
 assert.equal(gestures,2);assert.equal(sounds,2);assert.equal(c.noteGlow,0);assert.equal(c.noteResponse,null);
});
test('pebble colony answers in sequence with a raised double hop, sound and glow, then folds',()=>{
 const m=new FaunaModel('notes',{sample:(x,z)=>({...sample(x,z),ground:5})});const g=m.addGroup('stones','hopper',0,0,30);assert.ok(g);m.listener={x:g.home.x+35,y:11,z:g.home.z};m.observing=true;
 let sounds=0,firstSound=Infinity,maxStand=0,maxHop=0,lit=0;const peaks=new Map();const launches=new Map();m.onNoteReply=()=>{sounds++;firstSound=Math.min(firstSound,m.time);};
 m.hear({...note(m.listener),strength:.35,radius:82.5});
 for(let i=0;i<210;i++){m.step(1/30);for(const c of g.members){if(c.pebble.answerHop>.1&&!launches.has(c.id))launches.set(c.id,m.time);maxStand=Math.max(maxStand,c.pebble.stand);maxHop=Math.max(maxHop,c.pebble.answerHop||0);peaks.set(c.id,Math.max(peaks.get(c.id)||0,(c.pebble.answerHop||0)/c.size));lit+=c.noteGlow>.5?1:0;}}
 assert.ok(maxStand>.95&&maxHop>2&&lit>20);assert.ok(Math.max(...launches.values())-Math.min(...launches.values())>.08);assert.ok(Math.max(...peaks.values())-Math.min(...peaks.values())>.15);assert.ok(firstSound<=.17);assert.ok(Math.max(...launches.values())<=.4);assert.equal(sounds,g.members.length);assert.ok(g.members.every(c=>c.pebble.stand===0&&c.noteGlow===0));
});
test('lumen notes change the actual flight path and produce bounded group replies',()=>{
 const make=()=>{const m=new FaunaModel('lights',{sample:(x,z)=>({...sample(x,z),ground:-5,water:0})});m.addGroup('school','lumen',0,0,4);m.listener={x:0,y:12,z:30};m.observing=true;return m;};
 const a=make(),b=make();let replies=0;a.onNoteReply=()=>replies++;a.hear({...note(a.listener),strength:.35});
 for(let i=0;i<90;i++){a.step(1/30);b.step(1/30);}
 assert.ok(a.creatures.some(c=>c.noteGlow>.5));assert.ok(replies>0&&replies<=3);
 assert.ok(a.creatures.some((c,i)=>Math.hypot(c.pos.x-b.creatures[i].pos.x,c.pos.z-b.creatures[i].pos.z)>2));
});
test('walkers pause feeding, take a supported answering step, light up and call',()=>{
 const sampler=()=>({ground:10.6,water:11,slope:.03,foam:.01,roof:false});
 const m=new ReedWalkerWorldModel('notes',[{id:'bank',x:0,z:0,yaw:0,radius:30,form:'reedbed'}],sampler);m.stream({x:0,z:0});
 const members=[...m.groups.values()].flatMap(g=>g.members);assert.ok(members.length);
 const first=members[0],source={x:first.position.x+30,y:first.position.y,z:first.position.z+10},before={...first.origin};let calls=0,lit=false;
 m.onNoteReply=()=>calls++;m.hearNote(note(source));
 for(let i=0;i<300;i++){m.update(1/30,source);lit ||= first.noteGlow>.5;assert.ok(members.every(c=>Object.values(c.position).every(Number.isFinite)));}
 assert.ok(lit);assert.ok(calls>0);assert.ok(Math.hypot(first.origin.x-before.x,first.origin.z-before.z)>.5);assert.equal(first.noteGlow,0);
});
test('a bird answers with a directed ground hop, wing display, color and a phrase',()=>{
 const e=new BirdEncounter({x:0,y:0,z:0},{x:30,y:10,z:0},2.8);e.enableForaging({sample:()=>0,valid:()=>true});let replies=0;e.onNoteReply=()=>replies++;
 assert.ok(e.hearNote(note({x:20,y:2,z:0})));let lit=false,open=false;
 for(let i=0;i<180;i++){e.update(1/30);lit ||= e.pose.noteGlow>.5;open ||= e.pose.fold<.6;}
 assert.ok(lit&&open);assert.equal(replies,1);assert.ok(e.forage.hops>=1);assert.equal(e.noteGlow,0);
});
test('mite colony emerges in a bright staggered orbit and gives glassy replies',()=>{
 const m=new LanternMiteStudy('notes');let calls=0,max=0,orbit=false;m.onNoteSound=()=>calls++;
 assert.ok(m.answerPlayer(note({x:0,y:1.7,z:4}),12));
 for(let i=0;i<240;i++){m.update(1/30);for(const c of m.mites){max=Math.max(max,c.brightness);orbit ||= c.state==='note-orbit';assert.ok(Object.values(c.pos).every(Number.isFinite));}}
 assert.ok(orbit&&max>.55&&max<1.5);assert.equal(calls,5);assert.ok(m.mites.every(c=>c.noteGlow===0));
});
test('rays visibly answer a universal note promptly, then keep the pass inside their lake',()=>{
 const lake={id:3,y:20,shore:[{x:0,z:7,y:20,nx:0,nz:1,tx:-1,tz:0}]};const sampler=(x,z)=>({ground:z<1?21:16,water:20,foam:0,slope:.01,lake:3});let site;
 for(let i=0;!site&&i<20;i++)site=rayHabitatSite(lake,'seed'+i,sampler);
 assert.ok(site);const m=new FaunaModel('ray',{sample:sampler,raySites:true}),g=m.addGroup(site.id,'ray',site.x,site.z,1,{raySite:site});m.listener=site.view;m.playerSpeed=0;
 let calls=0,lit=false,maxBank=0;m.onCall=()=>{calls++;return true;};m.hear({...note(site.view),strength:.35});
 for(let i=0;i<90;i++){m.step(1/30);lit ||=g.members[0].energy>.8;maxBank=Math.max(maxBank,Math.abs(g.members[0].bank));assert.ok(Math.hypot(g.members[0].pos.x-site.x,g.members[0].pos.z-site.z)+g.members[0].radius+1.99<=site.radius);}
 assert.ok(calls>=1&&lit&&maxBank>.35);assert.equal(g.members[0].state,'approach');
 for(let i=0;i<210;i++)m.step(1/30);
 g.members[0].nextInvite=m.time+55;m.hear({...note(site.view),strength:.35});m.step(1/30);
 assert.equal(g.members[0].state,'approach');assert.ok(m.time-g.members[0].noteBankAt<.1);
});

test('soft notes have a shorter reach while charged notes keep the original reach',()=>{
 for(const [distance,velocity,accepted] of [[80,.35,true],[90,.35,false],[160,.95,true],[170,.95,false]]){
 const c={pos:{x:0,y:10,z:0}};assert.equal(receiveNote(c,0,note({x:distance,y:10,z:0},velocity)),accepted);
 }
});

test('higher answering hops preserve cave headroom and settle back onto the floor',()=>{
 const cave=()=>({ground:5,water:0,slope:0,hardness:1,forest:0,wet:0,foam:0,cave:true,clearance:7});
 const m=new FaunaModel('ceiling',{sample:cave}),g=m.addGroup('stones','hopper',0,0,30,{sample:cave});assert.ok(g);
 m.listener={x:g.home.x+30,y:11,z:g.home.z};m.observing=true;m.hear({...note(m.listener),strength:.35,radius:82.5});
 let jumped=false;
 for(let i=0;i<210;i++){m.step(1/30);for(const c of g.members){
  jumped ||= c.pebble.answerHop>.2;
  assert.ok(c.pos.y+1.7*c.size<=12.01,'shell and eyes stay below ceiling');
  assert.ok(Number.isFinite(c.pos.y)&&c.pos.y>=5,'body stays above floor');
 }}
 assert.ok(jumped);assert.ok(g.members.every(c=>c.pebble.answerHop===0&&c.pebble.stand===0));
});
