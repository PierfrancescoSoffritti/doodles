const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { summarizeMobileWork } = require('./summarize-mobile-work.cjs');

// Replay the saved measurements without a phone. --check-sources additionally
// checks that this checkout still contains the runtime that was measured.
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'docs/performance/2026-09-13-mobile-30');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'v30-final-acceptance.json')));
const reports = JSON.parse(gunzipSync(fs.readFileSync(path.join(directory, 'v30-runs.json.gz'))));
const sources = manifest.runtimeSources;

assert.deepEqual(Object.keys(reports).sort(), ['cave', 'forest', 'lumen', 'travel']);
for (const [scene, report] of Object.entries(reports)) {
  const saved = manifest.results.find(result => result.scene === scene);
  assert.ok(saved, `${scene}: missing summary`);
  assert.deepEqual(report.sources, sources, `${scene}: runtime differs`);
  assert.equal(report.overrides, undefined, `${scene}: source override`);
  assert.equal((report.httpErrors || []).length, 0, `${scene}: HTTP error`);
  assert.equal(report.harness, saved.harness, `${scene}: harness differs`);

  const loaded = Object.entries(report.loadedSources.after);
  assert.equal(loaded.length, saved.loadedSourcesVerified, `${scene}: incomplete source capture`);
  for (const [url, hash] of loaded) {
    const name = new URL(url).pathname.split('/25_Nowherelands_II/')[1];
    assert.equal(hash, sources[name], `${scene}: loaded source differs: ${name}`);
  }

  const summary = summarizeMobileWork(report);
  assert.equal(summary.met, true, `${scene}: acceptance failed`);
  assert.deepEqual(JSON.parse(JSON.stringify(summary.runs)), saved.runs, `${scene}: summary differs`);
  assert.equal(report.runs.length, scene === 'travel' ? 2 : 1);
  for (const run of report.runs) {
    assert.equal(run.scene.profile.presentationDepth, 4);
    assert.equal(run.population, 640);
    assert.equal(run.simulation.active, true);
    const expectedSeconds = scene === 'travel' && !run.walking ? 30 : 480;
    assert.ok((run.wall - run.start.wall) / 1000 >= expectedSeconds);
    if (scene === 'cave') {
      assert.equal(run.caveWalk.insideFrames, run.caveWalk.frames);
      assert.ok(run.caveWalk.waypoints > 0);
    }
    if (scene === 'lumen') {
      assert.ok(run.lumenWatch && run.scriptedNotes);
    }
    if (scene === 'travel' && run.walking) assert.ok(run.movement);
  }
  console.log(`${scene}: all timed sections and ${loaded.length} loaded sources verified`);
}

if (process.argv.includes('--check-sources')) {
  for (const [name, hash] of Object.entries(sources)) {
    const current = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
    assert.equal(current, hash, `Runtime changed since acceptance: ${name}`);
  }
  console.log(`${Object.keys(sources).length} current runtime files match the accepted build`);
}
