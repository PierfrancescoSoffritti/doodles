const test=require('node:test'),assert=require('node:assert/strict');
const {summarizeMobileWork}=require('./summarize-mobile-work.cjs');
function run(){return{scenario:'walk',walking:true,valid:true,scene:{profile:{presentationDepth:4}},start:{wall:0},wall:10000,simulationSeconds:10,underruns:0,audio:{underrunEvents:0},presentationMeasurement:{stride:7,rows:Array.from({length:300},(_,i)=>[i*100/3,i+1,3,0,0,0,0]).flat(),dropped:0,start:{starvations:0},end:{starvations:0}}};}
test('mobile acceptance rejects a hitch even when average presentation remains near 30 FPS',()=>{
 const r=run();assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,true);
 for(let i=150*7;i<r.presentationMeasurement.rows.length;i+=7)r.presentationMeasurement.rows[i]+=20;
 const result=summarizeMobileWork({runs:[r],errors:[]});assert.ok(Math.abs(result.runs[0].fps-30)<.2);assert.equal(result.met,false);
});
test('mobile acceptance requires every section, complete reporting and clean startup audio',()=>{
 let r=run();r.audio.underrunEvents=1;assert.equal(summarizeMobileWork({runs:[run(),r],errors:[]}).met,false);
 assert.equal(summarizeMobileWork({runs:[run()],errors:[],failure:'measurement interrupted'}).met,false);
 assert.equal(summarizeMobileWork({runs:[run()],errors:['game error']}).met,false);
 assert.equal(summarizeMobileWork({runs:[],errors:[]}).met,false);
});
test('mobile acceptance rejects lost images, collection overflow and slowed simulation',()=>{
 for(const change of [r=>r.presentationMeasurement.rows[101*7+1]++,r=>r.presentationMeasurement.dropped=1,r=>r.simulationSeconds=9.9,r=>r.valid=false]){
  const r=run();change(r);assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
 }
});
test('close-creature acceptance requires the tracked full-detail subject and scripted notes',()=>{
 const r=run();r.scenario='lumen';r.lumenWatch={frames:300,coarseFrames:0,missingFrames:0};r.scriptedNotes={sent:4,attempts:4,intervalSeconds:2};
 assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,true);
 r.lumenWatch.coarseFrames=1;assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
 r.lumenWatch.coarseFrames=0;r.lumenWatch.missingFrames=1;assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
 r.lumenWatch.missingFrames=0;r.scriptedNotes.sent=3;assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
});
test('travel acceptance rejects a stationary or mostly obstructed route',()=>{
 const r=run();r.movement={frames:300,movingFrames:295,distance:360};
 assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,true);
 r.movement.movingFrames=200;assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
 r.movement.movingFrames=295;r.movement.distance=10;assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
 r.movement.distance=360;r.movement.outsideWorldFrames=1;assert.equal(summarizeMobileWork({runs:[r],errors:[]}).met,false);
});
