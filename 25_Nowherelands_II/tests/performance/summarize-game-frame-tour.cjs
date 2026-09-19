const fs=require('node:fs');
function summarizeGameFrameTour(report){
 const target=report.phone?30:60;
 const distribution=a=>{const sorted=a.slice().sort((a,b)=>a-b);return{frames:a.length,fps:a.length*1000/a.reduce((x,y)=>x+y,0),p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1),over50:a.filter(v=>v>=50).length};};
 const runs=(report.runs||[]).map(run=>{
  const {start,end}=run,callbackIntervals=end.frames.map((at,i)=>at-(i?end.frames[i-1]:start.firstFrame));
  const callbacks=distribution(callbackIntervals),rows=run.presentation?.rows||[],stride=run.presentation?.stride||2,intervals=[];let lostImages=0;
  for(let i=stride;i<rows.length;i+=stride){intervals.push(rows[i]-rows[i-stride]);if(rows[i+1]!==rows[i-stride+1]+1)lostImages++;}
  const timestamps=report.phone?rows.filter((_,i)=>i%stride===0):end.frames;
  const windows=Array(Math.floor((end.at-start.at)/1000)).fill(0);
  for(const at of timestamps){const i=Math.floor((at-start.at)/1000);if(i>=0&&i<windows.length)windows[i]++;}
  const oneSecondFPS={minimum:Math.min(...windows),belowTolerance:windows.filter(n=>n<target-2).length,histogram:windows.reduce((bins,n)=>(bins[n]=(bins[n]||0)+1,bins),{})};
  let consecutiveSlow=0,maxConsecutiveSlow=0;for(const ms of (report.phone?intervals:callbackIntervals)){consecutiveSlow=ms>=50?consecutiveSlow+1:0;maxConsecutiveSlow=Math.max(maxConsecutiveSlow,consecutiveSlow);}
  const frames=report.phone?distribution(intervals):callbacks,elapsed=(end.at-start.at)/1000,simulation=(end.modelTime-start.modelTime)/elapsed;
  const result={kind:run.kind,...frames,oneSecondFPS,elapsed,simulationRate:simulation,distance:end.distance,caveFrames:end.caveFrames,playerFrames:end.playerFrames,waypoints:end.waypoints,notes:end.notes,successfulNotes:end.successfulNotes,audioUnderruns:end.audio.underrunEvents-start.audio.underrunEvents,workerHealthy:!end.simulation||end.simulation.active&&!end.simulation.failed,skin:run.temperatureEnd?.skin,lostImages};
  const baseMet=!!(run.valid&&frames.frames>elapsed*target*.97&&Math.abs(frames.fps-target)<.3&&frames.p99<(report.phone?38:25)&&callbackIntervals.every(v=>v>0)&&simulation>.995&&simulation<1.015&&result.audioUnderruns===0&&result.workerHealthy&&end.visibility==='visible'&&!end.dropped&&end.successfulNotes>=Math.max(0,Math.floor(elapsed/6)-1)&&(!report.phone||!run.presentation.dropped&&!lostImages&&!end.presentationFailed)&&
   (!['walk','forest','cave-dry','cave-wet'].includes(run.kind)||end.distance>elapsed*10&&end.movingFrames>frames.frames*.9&&!end.outsideWorld)&&(!run.kind.startsWith('cave-')||end.caveFrames/end.playerFrames>.9&&end.waypoints>2));
  result.met=baseMet&&frames.max<50&&callbacks.max<50;
  result.maxConsecutiveSlow=maxConsecutiveSlow;
  result.withinTolerance=baseMet&&frames.max<100&&callbacks.max<100&&oneSecondFPS.belowTolerance===0&&maxConsecutiveSlow<=1&&frames.over50<=Math.ceil(elapsed/120);
  return result;
 });
 const valid=!!(!report.failure&&!report.diagnostic&&!report.errors?.length&&report.device?.targetFPS===target&&runs.length===report.kinds?.length&&runs.length);
 return{withinTolerance:valid&&runs.every(r=>r.withinTolerance)&&runs.reduce((n,r)=>n+r.over50,0)<=Math.ceil(runs.reduce((n,r)=>n+r.elapsed,0)/120),met:!!(!report.failure&&!report.diagnostic&&!report.errors?.length&&report.device?.targetFPS===target&&runs.length===report.kinds?.length&&runs.length&&runs.every(r=>r.met)),target,runs,errors:report.errors,failure:report.failure};
}
module.exports={summarizeGameFrameTour};
if(require.main===module){if(!process.argv[2])throw Error('Pass a game-frame-tour report.json');const result=summarizeGameFrameTour(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify(result,null,2));process.exitCode=result.met?0:1;}
