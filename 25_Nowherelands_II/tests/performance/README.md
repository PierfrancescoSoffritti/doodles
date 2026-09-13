# Performance checks

Run commands from the repository root unless stated otherwise. Browser scripts use Playwright from `PLAYWRIGHT_MODULE` (or the installed `playwright` package) and a repository-root HTTP server on port 8797. Measurements normally write to `/tmp`; keep exploratory traces, screenshots and profiles outside the source tree.

## Final Samsung acceptance

The [performance report](../../docs/performance/2026-09-13-mobile-30/README.md) documents the four eight-minute workloads, device setup, acceptance criteria and known latency tradeoff.

```sh
node 25_Nowherelands_II/tests/performance/verify-mobile-acceptance.cjs --check-sources
```

This replays the saved full reports and verifies the current runtime hashes without connecting to a phone. A runtime change requires new measurements before claiming that the recorded acceptance applies to it.

`android-mobile-work.cjs` is the maintained device runner. Use `VARIANTS=after PROFILE_DEFAULTS=1 MINIMAL=1` for final-build acceptance, with an explicit `ADB` and `ANDROID_SERIAL`. `SCENARIO` selects `cave`, `forest`, `lumen`, or `walk`. The walk includes a separate stationary section; `TRAVEL_TURN_SECONDS` keeps long routes in the generated world. `NOTE_EVERY_SECONDS` exercises player notes during the tracked Lumen visit. `summarize-mobile-work.cjs` checks every timed section independently.

The runner also supports opt-in CPU, GC, native-frame and memory diagnostics. These are investigative measurements with overhead, not acceptance runs. `AndroidFrameTimeline.cjs`, `AndroidSurfaceFrames.cjs`, `AndroidMemory.cjs` and `android-frame-gaps.sql` support those diagnostics; native surface counts do not replace unique-image measurements.

## Functional and rendering checks

From `25_Nowherelands_II`, run all Node tests:

```sh
node --test $(rg -l 'node:test' tests -g '*.js' -g '*.mjs' -g '*.cjs')
```

The `*Test.js`, `*Test.mjs` and `*Test.cjs` modules cover algorithms, ownership, cleanup, worker recovery and acceptance validation. Files under `tests/browser` are browser checks and must not be passed to Node's test runner.

The following game-relative pages provide focused browser checks:

| Page | Coverage |
|---|---|
| `tests/fauna-visibility.html` | Main/reflection view culling and creature continuity |
| `tests/film-output.html` | Fused film/output presentation |
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
| `plant-work.cjs` | Complete geometry, collider and resumable-work comparison with a source snapshot |
| `lumen-worker-work.cjs` | Worker simulation replay against the main-thread model |
| `mobile-spatial-check.cjs` | Water culling and reflection correctness |
| `foliage-depth-work.cjs`, `point-light-work.cjs` | Frozen pixel comparisons on the supported Android graphics path |
| `presentation-work.cjs` | Post-processing/presentation comparison |

Read each script's environment options before running it. Device scripts operate on the selected Chrome tab; launch them only when the phone is available for testing. Historical before/after experiments require the original baseline revision or source snapshot and cannot be treated as a comparison with the final build by changing the label.
