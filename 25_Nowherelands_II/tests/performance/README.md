# Performance checks

Run commands from the repository root unless stated otherwise. Browser scripts use Playwright from `PLAYWRIGHT_MODULE` (or the installed `playwright` package) and a repository-root HTTP server on port 8797. Measurements normally write to `/tmp`; keep exploratory traces, screenshots and profiles outside the source tree.

## Earlier Samsung acceptance

The September 13 [performance report](../../docs/performance/2026-09-13-mobile-30/README.md) documents the four eight-minute workloads, device setup, acceptance criteria and known latency tradeoff.

```sh
node 25_Nowherelands_II/tests/performance/verify-mobile-acceptance.cjs --check-sources
```

This replays the saved full reports and verifies the current runtime hashes without connecting to a phone. A runtime change requires new measurements before claiming that the recorded acceptance applies to it.

`android-mobile-work.cjs` is the maintained device runner. Use `VARIANTS=after PROFILE_DEFAULTS=1 MINIMAL=1` for final-build acceptance, with an explicit `ADB` and `ANDROID_SERIAL`. `SCENARIO` selects `cave`, `forest`, `lumen`, or `walk`. The walk includes a separate stationary section; `TRAVEL_TURN_SECONDS` keeps long routes in the generated world. `NOTE_EVERY_SECONDS` exercises player notes during the tracked Lumen visit. `summarize-mobile-work.cjs` checks every timed section independently.

The runner also supports opt-in CPU, GC, native-frame and memory diagnostics. These are investigative measurements with overhead, not acceptance runs. `AndroidFrameTimeline.cjs`, `AndroidSurfaceFrames.cjs`, `AndroidMemory.cjs` and `android-frame-gaps.sql` support those diagnostics; native surface counts do not replace unique-image measurements.

The September 19 [frame-stability investigation](../../docs/performance/2026-09-19-frame-stability/README.md) supersedes those earlier runtime hashes and records the latest Mac and Samsung measurements.

The final September 19 reports and loaded script hashes can be replayed locally:

```sh
node 25_Nowherelands_II/tests/performance/verify-frame-stability.cjs --check-sources
```

This replays the live tour checks and applies the report’s documented rare-dip tolerance, while also reporting the stricter 50 ms result. Unique-image, simulation, movement, worker-health and audio requirements remain mandatory. `--check-sources` also detects runtime changes since the measurements.

## Cold entries and desktop frame pacing

`game-frame-tour.cjs` checks the current defaults in a fresh Chrome page, starting
measurement before visiting each subject. It keeps audio on, cycles note strengths
every six seconds, clicks willow pendants, and includes actual movement and world
boundary counters for `walk`. `forest` walks a turning ground route; `cave-dry`
and `cave-wet` follow real cave waypoints with collision, checking that at least
90% of the route is inside the cave. Phone runs also record distinct presented image IDs.
Screenshots and result serialization happen outside the measured interval. Test
pages are closed afterward so their previous game cannot remain in back/forward
cache across repeated profiling runs.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
SCENES=bell-reed,veil-willow,light-lily,scarlet-fish,walk RUN_SECONDS=60 \
OUTPUT=/tmp/game-tour node 25_Nowherelands_II/tests/performance/game-frame-tour.cjs

node 25_Nowherelands_II/tests/performance/summarize-game-frame-tour.cjs /tmp/game-tour/report.json
```

Use `SCENE_SECONDS='{"walk":480,"forest":120,"cave-dry":120,"cave-wet":120}'` to extend selected routes within one continuous warm-device session. Other scenes use `RUN_SECONDS`. The summary reports one-second FPS counts alongside the stricter frame-time checks.

Add `PHONE=1 ADB=/path/to/adb ANDROID_SERIAL=<serial>` for the connected phone.
The default startup gate requires skin temperature ≤37.5°C and thermal status ≤1.
Use explicit `START_SKIN` / `START_THERMAL_STATUS` limits for a warm-device repeat;
the report retains the actual start/end temperatures and status.
The default desktop viewport is 1728×1000 CSS pixels at device scale 2; `WIDTH`,
`HEIGHT`, and `CHANNEL` can override it. The game's own pixel-ratio cap still
applies. `TRACE_STAGES=1` enables GL and subsystem diagnostics and marks the
report ineligible for acceptance. `CPU_PROFILE=1` additionally saves DevTools CPU profiles and also marks the run diagnostic. Use `SCENES=forest,cave-dry,cave-wet` for ground and cave movement. Averages alone do not pass: the summary also checks tail
latency, freezes, unique image order, simulation speed, real movement, audio,
and successful notes.

## Functional and rendering checks

From `25_Nowherelands_II`, run all Node tests:

```sh
node --test $(rg -l 'node:test' tests -g '*.js' -g '*.mjs' -g '*.cjs')
```

The mobile creature contact profile also runs the same physical contracts at 60 Hz with budgeted cave steering:

```sh
PEBBLE_CONTACT_HZ=60 PEBBLE_STEERING_BUDGET=2 node --test tests/world/PebbleHoppersTest.js tests/world/PebbleCaveFloorTest.js tests/world/PebbleHabitatsTest.js
```

The `*Test.js`, `*Test.mjs` and `*Test.cjs` modules cover algorithms, ownership, cleanup, worker recovery and acceptance validation. Files under `tests/browser` are browser checks and must not be passed to Node's test runner.

The following game-relative pages provide focused browser checks:

| Page | Coverage |
|---|---|
| `tests/fauna-visibility.html` | Main/reflection view culling and creature continuity |
| `tests/film-output.html` | Fused film/output presentation |
| `tests/reply-mask.html` | Exact single-pass versus two-pass outline pixels and draw counts |
| `tests/noise-lookup.html` | Cave noise lookup precision |
| `tests/plant-batches.html` | Plant batching, pixels and lifecycle |
| `tests/plant-line-data.html` | Packed/indexed plant geometry |
| `tests/water-streaming.html` | Water installation, generation and streaming |

Additional reusable scripts remain available:

| Script | Purpose |
|---|---|
| `compare.cjs`, `travel-work.cjs` | Desktop rendering and travel comparisons against an explicit baseline |
| `cpu-profile.cjs`, `cpu-work.cjs` | Live CPU diagnosis and deterministic subsystem comparisons |
| `music-timing.cjs` | Audio behavior across presentation rates |
| `distance-transitions.cjs` | Creature detail transitions |
| `pebble-steering-compare.mjs` | Compare 10,000 navigation decisions and terrain-probe counts against an explicit `BASELINE` revision (run from the game directory) |
| `plant-work.cjs` | Complete geometry, collider and resumable-work comparison with a source snapshot |
| `lumen-worker-work.cjs` | Worker simulation replay against the main-thread model |
| `mobile-spatial-check.cjs` | Water culling and reflection correctness |
| `foliage-depth-work.cjs`, `point-light-work.cjs` | Frozen pixel comparisons on the supported Android graphics path |
| `presentation-work.cjs` | Post-processing/presentation comparison |

Read each script's environment options before running it. Device scripts operate on the selected Chrome tab; launch them only when the phone is available for testing. Historical before/after experiments require the original baseline revision or source snapshot and cannot be treated as a comparison with the final build by changing the label.

The archived September 19 final phone routes retain one audio underrun, so `verify-frame-stability.cjs --check-sources` intentionally exits with status 1 even when all source hashes match. See [the investigation report](../../docs/performance/2026-09-19-frame-stability/README.md) for the stopping decision and the limits of the final six-minute phone check.
