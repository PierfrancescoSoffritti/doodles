const test=require('node:test'),assert=require('node:assert/strict');
const {summarizeGameFrameTour}=require('./summarize-game-frame-tour.cjs');
function fixture(slow=[]){
 const frames=[];let at=0;
 while(at<120000){at+=slow.length&&frames.length>=900&&frames.length<900+slow.length?slow[frames.length-900]:1000/60;if(at<=120000)frames.push(at);}
 return{phone:false,device:{targetFPS:60},errors:[],kinds:['lumen'],runs:[{kind:'lumen',valid:true,start:{at:0,firstFrame:0,modelTime:0,audio:{underrunEvents:0}},end:{at:120000,frames,modelTime:120,notes:20,successfulNotes:20,audio:{underrunEvents:0},visibility:'visible',dropped:0}}]};
}
test('the requested rare-dip tolerance remains separate from strict 50 ms acceptance',()=>{
 assert.equal(summarizeGameFrameTour(fixture()).met,true);
 const r=summarizeGameFrameTour(fixture([54.7,1000/60-4.7]));assert.equal(r.met,false);assert.equal(r.withinTolerance,true);assert.equal(r.runs[0].maxConsecutiveSlow,1);
});
test('a cluster of slow frames and a freeze cannot pass on a healthy average',()=>{
 for(const slow of [Array(6).fill(55),[200]]){const r=summarizeGameFrameTour(fixture(slow));assert.ok(r.runs[0].fps>59.7);assert.equal(r.withinTolerance,false);}
});
test('rare-dip tolerance still rejects audio underruns, worker failure and invalid measurements',()=>{
 for(const change of [r=>r.runs[0].end.audio.underrunEvents++,r=>r.runs[0].end.simulation={active:false,failed:true},r=>r.diagnostic=true,r=>r.runs[0].valid=false]){const r=fixture();change(r);assert.equal(summarizeGameFrameTour(r).withinTolerance,false);}
});
