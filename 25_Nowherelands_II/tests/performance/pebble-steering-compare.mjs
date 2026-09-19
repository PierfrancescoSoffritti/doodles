// Compare decisions and terrain work against an explicit pre-optimization revision.
// BASELINE=<revision> node tests/performance/pebble-steering-compare.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const baseline=process.env.BASELINE;if(!baseline)throw Error('Set BASELINE to the original revision to compare');
const root=process.cwd(),file='js/world/fauna/PebbleHoppers.js';
async function load(source){source=source.replace(/from '([^']+)'/g,(_,p)=>`from '${new URL(p,pathToFileURL(root+'/'+file)).href}'`);return import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {steering};').toString('base64'));}
const before=await load(execFileSync('git',['show',baseline+':25_Nowherelands_II/'+file],{encoding:'utf8'}));
const after=await load(fs.readFileSync(file,'utf8'));
let seed=7351;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);let oldProbes=0,newProbes=0,savedCases=0;
for(let n=0;n<10000;n++){
 const cave=n%2===0, width=1+rnd()*10, wallAngle=rnd()*Math.PI*2, turn=(rnd()-.5)*.2, heading=(rnd()-.5)*Math.PI*2;
 const original={pos:{x:0,z:0},ground:2,size:.6+rnd(),speed:rnd()*28,yaw:(rnd()-.5)*6,pebble:{refuge:{x:(rnd()-.5)*100,z:(rnd()-.5)*100},steerAt:0,heading:n%7?heading:undefined,avoiding:n%3===0,returning:n%5===0,blockedUntil:n%4===0?2:0,blockedHeading:heading}};
 function run(fn){let probes=0;const c=structuredClone(original);c.group={sample:cave,stones:[],members:[c]};const model={listener:{x:40,z:40},environment:{sample(x,z){probes++;const u=x*Math.cos(wallAngle)+z*Math.sin(wallAngle),v=-x*Math.sin(wallAngle)+z*Math.cos(wallAngle);return{ground:2,water:-4,roof:Math.abs(v-turn*u*u)>width,clearance:10,slope:.08,cave};}}};fn(c,model,1);return{state:c.pebble,probes};}
 const a=run(before.steering),b=run(after.steering);assert.deepEqual(b.state,a.state,`case ${n}`);assert.ok(b.probes<=a.probes);oldProbes+=a.probes;newProbes+=b.probes;savedCases+=b.probes<a.probes;
}
console.log(JSON.stringify({cases:10000,identicalDecisions:true,oldProbes,newProbes,reduction:1-newProbes/oldProbes,savedCases},null,2));
