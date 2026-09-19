// Replay the archived final measurements; optionally audit the current runtime.
const fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib'),{createHash}=require('node:crypto');
const {summarizeGameFrameTour}=require('./summarize-game-frame-tour.cjs');
const root=path.resolve(__dirname,'../..'),directory=path.join(root,'docs/performance/2026-09-19-frame-stability');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'runtime-sha256.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[];
for(const [name,sourceManifest] of [['mac-v16-final','runtime-v16-sha256.json'],['mac-v19-recheck','runtime-v19-sha256.json'],['phone-v19-routes','runtime-v19-sha256.json']]){
 const measuredManifest=JSON.parse(fs.readFileSync(path.join(directory,sourceManifest),'utf8'));
 const report=JSON.parse(gunzipSync(fs.readFileSync(path.join(directory,name+'.json.gz'))));
 const summary=summarizeGameFrameTour(report),mismatches=[];
 for(const [url,actual] of Object.entries(report.loadedSources)){
  const file=decodeURIComponent(new URL(url).pathname).split('/25_Nowherelands_II/')[1];
  if(measuredManifest[file]!==actual)mismatches.push(file||url);
 }
 results.push({name,strictPass:summary.met,withinTolerance:summary.withinTolerance,sources:Object.keys(report.loadedSources).length,sourceMismatches:mismatches,
  seconds:summary.runs.reduce((n,r)=>n+r.elapsed,0),worstFrame:Math.max(...summary.runs.map(r=>r.max)),
  belowToleranceSeconds:summary.runs.reduce((n,r)=>n+r.oneSecondFPS.belowTolerance,0),
  audioUnderruns:summary.runs.reduce((n,r)=>n+r.audioUnderruns,0),runs:summary.runs});
}
const changed=[];
if(process.argv.includes('--check-sources'))for(const [file,expected] of Object.entries(manifest)){
 if(!fs.existsSync(path.join(root,file))||hash(fs.readFileSync(path.join(root,file)))!==expected)changed.push(file);
}
const passed=results.every(r=>r.withinTolerance&&!r.sourceMismatches.length)&&!changed.length;
console.log(JSON.stringify({passed,currentSourcesChecked:process.argv.includes('--check-sources'),changed,results},null,2));
process.exitCode=passed?0:1;
