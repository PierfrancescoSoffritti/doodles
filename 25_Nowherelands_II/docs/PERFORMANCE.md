# Performance work — 8 September 2026

Baseline: `3cfc977`, including the latest bird habitats and species changes. This work reduces rendering and streaming cost while retaining the world, vegetation density, creature population, audio, and simulation rate.

## Changes and checks

- **Vegetation culling.** Instanced plants, merged grass/reeds, tree lights and lanterns now have conservative bounds. Bounds include growth from the ground, easing overshoot, maximum wind and crystal pulses. Far trees retain bounds that cover their original instances when near copies replace them. The browser check compares full rendering against culling across 24 camera orientations/elevations at maximum wind and pulse. It allows only isolated one-step differences in 8-bit output, also observed in unchanged control renders.
- **Ocean reflection scheduling.** The main camera refreshes the ocean reflection at approximately 15 Hz while still and 30 Hz while moving, with immediate refreshes for large position/rotation changes. Waves continue animating at the chosen display rate. The texture and its world projection remain paired between captures. Hidden objects have their original visibility restored. Reflection callbacks from other mirrors/environment cameras reuse existing textures, preventing recursive scene captures. The existing sea test independently projects 27 points through the reflected camera and agrees to floating-point precision.
- **Environment capture.** A 128-pixel cubemap captures one face per frame and filters on the following frame. The previous complete environment remains installed during capture. Refreshes respond to travel and lighting changes, with a five-second minimum interval and a 30-second maximum age. Filtering reuses its target. Filtering itself remains a synchronous GPU operation and can still cause a smaller spike.
- **Streaming.** A single additional worker generates terrain vertices, entrance/cave masks, and complete shore distance/river-reach tiles. The main thread keeps the previous terrain parents and shore tiles until replacements are ready. Terrain/shore installation shares a three-millisecond cooperative budget with vegetation generation. Vegetation publishes meshes and colliders together; cancelled jobs dispose their private geometry. Worker failure restores the synchronous path. Tests compare installed worker output against synchronous sampling before and after a teleport, and check cancellation/failure handling. This trades additional worker memory for smoother main-thread work; it does not remove the cost of generating the world.
- **Lake sampling.** Repeated queries reuse the immutable list of lake candidates in a cell; dry cells return a shared empty list. The bounded cache does not memoize heights or scratch fields, so terrain detail, river water, shore distances and collision queries retain their original calculations.
- **Fauna neighbours.** Numeric nested cells replace string keys and repeated empty-cell work. Search order, distance thresholds, neighbour count and simulation cadence are preserved. A deterministic 640-creature replay returned exactly the same neighbours and reduced 96,000 queries plus grid rebuilds from 288 ms to 96 ms in a separate microbenchmark. Whole-game savings are smaller because other movement and terrain calculations remain.
- **Fauna geometry.** Lumen animals use 28×24, 14×12 or 10×8 tessellation according to projected size, with hysteresis at transitions. The original near mesh, shader deformation, colour, glow and population remain. The far body uses 160 rather than 1,344 triangles. All three meshes pass GPU deformation checks. A first, coarser 7×6 version failed the deformation check and was replaced. The 640 lumen animals continue simulating at 30 Hz, including distant journeys and encounters; simulation was not decimated.
- **Growth bookkeeping.** Pending counts include only genuinely unborn, non-empty plants. Finished/preborn groups no longer remain permanently pending. Installed groups are checked against their actual birth attributes.
- **Frame pacing.** The default is 60 fps, with a persistent 30 fps quiet option and display-rate option in the corner HUD. `?fps=30`, `?fps=60` and `?fps=0` support controlled comparisons. The cap applies only to presentation and environment captures. World and music controls retain their original requestAnimationFrame cadence, including callbacks that do not present a frame. Hidden documents skip presentation without introducing an extra music-update pause. Unit tests verify cadence at 60, 120 and 144 Hz and resumption without catch-up bursts.

## Measurement method

The browser comparison uses Chromium/ANGLE Metal on an Apple M5 Pro, seed `umbra`, a 1440×900 CSS viewport, device scale 2 and the unchanged 1.75 render scale cap (2520×1575). Each fresh page warms for 12 seconds, samples 12 seconds stationary, then travels 1.2 km over 20 seconds. Audio is not started. Full-game behaviour/audio tests run separately.

The unbounded baseline and unbounded optimized run isolate code changes from the new frame limit. The 60/30 runs show the additional effect of pacing. The original uncapped measurements use `performance.now()` around updates and render submission. The updated runner measures every requestAnimationFrame callback, including unpresented updates; it can include driver waits and is not a GPU-duration or electrical-power measurement. Browser scheduling and background load affect timings. Draw/triangle counts are more directly comparable than headless frame rate. Fan speed and battery power were not measured.

## Results

| Measurement | Baseline, display rate | Optimized, display rate | Reduction |
| --- | ---: | ---: | ---: |
| Stationary median draw calls/frame | 1,700 | 606 | 64% |
| Stationary mean triangles/frame | 4.25 million | 2.22 million | 48% |
| Stationary mean main-thread work/frame | 6.34 ms | 4.19 ms | 34% |
| Travel mean main-thread work/frame | 9.08 ms | 5.61 ms | 38% |
| Travel p95 main-thread work/frame | 18.0 ms | 9.9 ms | 45% |
| Travel p95 terrain-update time | 6.9 ms | 3.2 ms | 54% |
| Travel worst terrain-update time | 38.2 ms | 13.5 ms | 65% |
| Travel worst environment update | 13.0 ms | 8.1 ms | 38% |

**Music correction:** the original capped-mode measurements also throttled world/music control updates. That changed the audio and was a regression. Those **50–62% workload-reduction figures are withdrawn**. The frame cap now controls presentation only; the uncapped comparisons above still describe the rendering/streaming optimizations. Re-run the updated performance runner before quoting new capped-mode CPU savings.

The music regression check compares the actual production mixer with the pre-optimization `3cfc977` audio modules using fixed randomness and scripted controls. At display rate, 60 fps and 30 fps, all 1,440 music updates, note choices and control values match exactly over a 12-second replay. The maximum sample difference from the reference was 0.00000042 (RMS difference below 0.00000005), comparable to repeated uncapped renders. Reproducing the defective whole-loop 30 fps cap reduced updates to 360 and produced an RMS audio difference of 0.177. The live game additionally confirmed equal world/music/engine update counts on every animation callback while presentation alone dropped to 60/30 fps. See [music regression evidence](performance/2026-09-08-music-checks.json).

The final browser comparison reported no JavaScript or WebGL errors. The worker queues drained after both routes. Node validation passed **177 tests**. Browser checks additionally covered 50 installed terrain nodes across two positions, four complete shore tiles, 879 growth groups, cancellation without orphan colliders, 27 reflection projections, all three lumen geometry levels, and 113 pebble contact poses. The culling replay removed 17,562 draws over 24 views; its total difference was 12 one-step colour channels, with six one-step differences also seen between unchanged control renders. All three bird species passed their GPU foot-contact checks (376 poses/species; maximum foot drift below 0.00000004).

Raw evidence: [browser benchmark](performance/2026-09-08-benchmark.json), [visual and worker checks](performance/2026-09-08-browser-checks.json), [neighbour replay](performance/2026-09-08-neighbours.json).

## Reproducing

Serve a checkout of `3cfc977` on port 8798 and this checkout on 8797, both from the repository root. With Playwright available:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node 25_Nowherelands_II/tests/performance/compare.cjs
```

`BASELINE_PORT`, `OPTIMIZED_PORT` and `PERFORMANCE_OUTPUT` override the defaults. The runner measures all four modes sequentially and closes its browser afterward.

In a loaded island, the browser checks are exported by `tests/browser/PerformanceChecks.js`; sea projection is in `tests/browser/SeaReflectionTest.js`. `checkFaunaShaders(detail)` accepts detail levels 0, 1 and 2. `tests/performance/music-timing.cjs` verifies offline music output and the live game's update/render cadence. Set `BASELINE_DIRECTORY` to a checkout of `3cfc977` to compare with the original audio modules; otherwise it compares presentation modes against the current unbounded reference. Its audio output is muted during live browser testing. Example:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright BASELINE_DIRECTORY=/path/to/baseline node 25_Nowherelands_II/tests/performance/music-timing.cjs
```

Node tests reside under `tests/performance/` alongside the existing world, weather, audio and UI tests. Browser modules must be run in the browser, not passed to `node --test`.

## Remaining costs

Full-rate fauna simulation, world rendering during movement, GPU uploads for newly installed vegetation, and environment filtering remain meaningful costs. The three-millisecond streaming budget is cooperative: one geometry stage or GPU upload can exceed it. Rendering quality and bloom resolution are unchanged. These measurements support reduced rendering load and smoother streaming; the final judgement of motion/reflection feel should also include normal play on the target Mac.
