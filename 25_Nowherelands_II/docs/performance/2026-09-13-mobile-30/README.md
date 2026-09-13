# Samsung performance validation

The retained build passes four eight-minute tests on the Samsung SM-A155F: cave walking, forest walking, a tracked close Lumen with repeated notes, and sustained travel. Each maintains approximately 30 unique images per second with no measured interval at or above 50 ms and zero audio underruns, including startup.

## Results

Device: Samsung SM-A155F, Mali-G57 MC2, Android 16, Chrome 152.0.7977.82, 4 GB reported device memory, 90 Hz display. Tests use the `fern` seed, real audio, thermal gating and the same frozen runtime. No CPU throttling emulation, source overrides, CPU/GC/native tracing or screen recording is used for acceptance.

| Scenario | Duration | FPS | p99 / maximum interval | Audio underruns | End skin temperature |
|---|---:|---:|---:|---:|---:|
| Cave walk | 480 s | 30.000 | 35.2 / 46.6 ms | 0 | 41.9°C |
| Forest walk | 480 s | 30.000 | 35.2 / 43.9 ms | 0 | 42.8°C |
| Close Lumen and repeated notes | 480 s | 30.000 | 35.0 / 44.3 ms | 0 | 43.0°C |
| Sustained travel | 480 s | 30.000 | 35.1 / 41.5 ms | 0 | 40.5°C |

The preceding 30-second stationary travel section also passes, with a maximum interval of 39.2 ms. All 640 Lumen remain present, simulation advances at real time, and there are no lost image IDs, overflowing measurement buffers, or browser/HTTP errors. All four reports have identical hashes for 235 runtime JavaScript files; all 220 loaded JavaScript responses in each report match those hashes.

These are bounded-session results on this phone and browser. Worker image-transfer timestamps measure delivery of distinct game images, not physical input-to-photon latency. Native SurfaceFlinger/FrameTimeline records include or omit intermediate compositions and are not used as the unique-game-image acceptance oracle. Average FPS alone is insufficient.

## Retained changes

- **Rendering:** cull geometry outside both the main and reflection views; share and index static plant, water and cave geometry; fuse compatible post-processing work; avoid repeated cloud and reflection captures. Mali-specific depth and lighting paths reduce overdraw and skip zero-contribution lighting. Cave noise lookup retains the original noise calculations, with an unsupported-extension fallback.
- **World and fauna:** bound caches and work queues; stage expensive construction; transfer simulation and geometry work where appropriate. Cave queries use finer triangle bins, exact bounded result caching, reusable cave sections, and incremental cache eviction. Packed numeric keys and direct result construction reduce temporary allocations. Local fauna updates no longer wait for the flock worker to finish.
- **Audio:** retire completed nodes, reuse noise buffers, and move eligible PCM synthesis out of the render thread. Existing audio graph/tail and PCM comparisons cover the retained changes.
- **Presentation:** on low-memory phones, a separate worker presents a bounded queue of four complete images at 30 Hz. Resize, visibility changes and worker failure have lifecycle coverage; failure restores direct rendering.

Shared query, allocation, geometry and audio-lifetime improvements also apply to desktop. Hardware-specific settings remain automatic:

| Default | Desktop | Low-memory mobile, including this Samsung |
|---|---|---|
| Frame-rate target | 60 FPS | 30 FPS |
| Render pixel-ratio cap | 1.75 | 0.875 |
| Vegetation radius | 4 | 2 |
| Presentation queue | Off | Four images |
| Audio sample rate | Device default | 32 kHz |

Touch devices request a 40 ms audio latency hint; the Samsung reports 60 ms base latency. The mobile profile also uses cheaper distant fauna behavior while preserving full detail for the tracked nearby Lumen. It is selected from pointer capabilities, with the constrained profile additionally requiring reported device memory of 4 GB or less. Explicit diagnostic URL overrides remain available; the user's frame-rate selection is respected.

**Latency tradeoff:** the four-image queue adds roughly 100 ms of image buffering compared with the original path. Mean measured image age after production is 115.6–117.8 ms in the final runs. The final query/allocation changes do not reduce visual detail further, but the earlier mobile profile still applies. Normal touch play should assess responsiveness.

## Evidence and regression coverage

- [Final summary and source manifest](v30-final-acceptance.json) contains every timed section, workload counters and the runtime hashes.
- [Complete acceptance reports](v30-runs.json.gz) retain the frame sequences, audio counters, thermal readings and source captures for all four runs in one compressed JSON object, keyed by scenario.
- [Recorded regression evidence](regression-evidence.json) consolidates the retained pixel, audio, geometry, query-equivalence, worker-recovery and lifecycle checks. Original report names identify their measurement stage; these checks are not all measurements of the final build.

The cave route remains underground for all 14,464 route updates and crosses 664 waypoints. The close-Lumen run records 14,467 full-detail guide updates and 60 successful notes, cycling strengths 0.2/0.6/1. Travel covers 17,728.75 world units, moves on 14,459 of 14,463 observed frames, and never leaves the generated world. Ordinary walking and eased turns are used; the requested 90-second legs shorten to 52.25 seconds to respect the map boundary. Terrain publications advance from 22 to 461 and reflection captures from 353 to 4,468. Two brief read-only status snapshots were taken during travel.

The final normal-play reload uses only `?seed=fern`: 30 FPS and depth-four presentation activate by default, audio runs at 32 kHz, all 640 Lumen are present, and no benchmark wrapper or page error is present.

After artifact cleanup, all 411 Node tests pass across 95 test modules, the complete saved acceptance replay passes, all 235 runtime hashes still match, and `git diff --check` is clean. Node regression coverage includes exact cave-query results, cache collisions and eviction, returned-object ownership, worker checkpoint/recovery state, streaming cancellation/disposal, audio lifetime, and rejection of false acceptance from average FPS, lost images, slow simulation or incomplete workloads. Earlier unsuccessful experiments and verbose intermediate output are excluded from the commit; the retained acceptance reports can be independently rechecked.

## Rechecking saved evidence

From the repository root:

```sh
node 25_Nowherelands_II/tests/performance/verify-mobile-acceptance.cjs --check-sources
```

This recomputes acceptance from the complete saved frame sequences, checks the summaries and loaded source hashes, then compares the current runtime with the accepted build. Omit `--check-sources` to inspect historical measurements after subsequent code changes.

Run the Node tests from the game directory:

```sh
node --test $(rg -l 'node:test' tests -g '*.js' -g '*.mjs' -g '*.cjs')
```

Browser-only checks must run in a browser; see the [performance harness guide](../../../tests/performance/README.md).

## Reproducing on a phone

Serve the repository root on port 8797. Set `PLAYWRIGHT_MODULE` to an installed Playwright module, `ADB` to the adb executable and `ANDROID_SERIAL` to the explicit target device. Forward Chrome DevTools to local port 9223 and reverse the game server:

```sh
"$ADB" -s "$ANDROID_SERIAL" forward tcp:9223 localabstract:chrome_devtools_remote
"$ADB" -s "$ANDROID_SERIAL" reverse tcp:8797 tcp:8797
```

Keep Chrome foreground with a game or blank tab open, and keep the phone awake for the run. The runner opens a fresh tab, closes the previous game/blank tab, cools the device before loading, starts audio and leaves the tab blank afterward. Restore any temporary screen-timeout change after testing.

```sh
VARIANTS=after PROFILE_DEFAULTS=1 START_SKIN=37.5 \
SCENARIO=walk RUN_SECONDS=480 TRAVEL_TURN_SECONDS=90 \
MINIMAL=1 WORKER_PRESENT=1 EXPECT_PRESENT_DEPTH=4 \
MOBILE_OUTPUT=/tmp/mobile-travel \
node 25_Nowherelands_II/tests/performance/android-mobile-work.cjs

node 25_Nowherelands_II/tests/performance/summarize-mobile-work.cjs /tmp/mobile-travel/report.json
```

Repeat with `SCENARIO=cave` and `SCENARIO=forest`; for close creatures use `SCENARIO=lumen NOTE_EVERY_SECONDS=8`. Give each run its own output directory. The summary requires every timed section to pass: approximately 30 FPS, p99 below 38 ms, maximum below 50 ms, clean startup and timed audio, sequential image IDs, and simulation keeping pace with elapsed time. Workload counters reject coarse/missing subjects, missing notes, stalled movement and travel outside the world.
