const fs = require('node:fs');

// Summarize every timed section, including the stationary + travelling pair.
// These are bounded-session criteria, not a guarantee about arbitrary OS pauses.
function summarizeMobileWork(report) {
 const runs = report.runs.map(run => {
  const measurement = run.presentationMeasurement, stride = measurement?.stride || 2;
  const rows = measurement?.rows || [], gaps = [], ages = [];
  let sequenceGaps = 0;
  for (let i = 0; i < rows.length; i += stride) {
   if (i) { gaps.push(rows[i] - rows[i - stride]); if (rows[i + 1] !== rows[i - stride + 1] + 1) sequenceGaps++; }
   if (stride >= 7 && rows[i + 6] > 0) ages.push(rows[i] - rows[i + 6]);
  }
  const sorted = gaps.slice().sort((a,b) => a-b);
  const elapsed = (run.wall - run.start.wall) / 1000;
  const fps = gaps.length ? gaps.length * 1000 / gaps.reduce((a,b) => a+b,0) : null;
  const p99 = sorted[Math.floor(sorted.length * .99)] ?? null, max = sorted.at(-1) ?? null;
  const result = {
   scenario: run.scenario, walking: run.walking, valid: run.valid,
   depth: run.scene?.profile?.presentationDepth, frames: rows.length / stride,
   fps, p99, max, over50: gaps.filter(g => g >= 50).length,
   audioUnderruns: run.underruns, totalAudioUnderruns: run.audio?.underrunEvents,
   simulationSeconds: run.simulationSeconds, elapsedSeconds: elapsed,
   sequenceGaps, dropped: measurement?.dropped,
   starvations: measurement?.end && measurement?.start ? measurement.end.starvations - measurement.start.starvations : null,
   meanFrameAgeAfterProduction: ages.length ? ages.reduce((a,b) => a+b,0) / ages.length : null,
   skin: [run.temperatureAtReady?.skin,run.temperatureAtEnd?.skin],
   thermalStatus: run.temperatureAtEnd?.status,
   movement: run.movement, lumenWatch: run.lumenWatch, scriptedNotes: run.scriptedNotes,
  };
  result.met = !!(run.valid && gaps.length && Math.abs(fps-30)<.2 && p99<38 && max<50 &&
   result.audioUnderruns===0 && result.totalAudioUnderruns===0 && sequenceGaps===0 &&
   result.dropped===0 && run.simulationSeconds/elapsed>.995 && !report.errors.length &&
   (!run.movement || (run.movement.frames>gaps.length*.95 && run.movement.movingFrames/run.movement.frames>.9 && run.movement.distance/elapsed>10 && (run.movement.outsideWorldFrames??0)===0)) &&
   (!run.lumenWatch || (run.lumenWatch.frames>gaps.length*.95 && run.lumenWatch.coarseFrames===0 && run.lumenWatch.missingFrames===0)) &&
   (!run.scriptedNotes || run.scriptedNotes.sent>=Math.max(1,Math.floor(elapsed/run.scriptedNotes.intervalSeconds)-1)));
  return result;
 });
 return {met: !report.failure && runs.length>0 && runs.every(r=>r.met), runs, errors:report.errors, failure:report.failure};
}
module.exports = {summarizeMobileWork};
if (require.main === module) {
 if (!process.argv[2]) throw Error('Usage: node summarize-mobile-work.cjs /path/to/report.json');
 console.log(JSON.stringify(summarizeMobileWork(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));
}
