# Frame stability investigation

Optimization stopped after the user reported smooth play on both devices. The Mac meets the target in the measured tours. The final phone routes deliver about 30 FPS with one one-second dip to 28, but retain an isolated 93.3 ms frame interval and one 40 ms audio underrun. This is a practical stopping point, not a claim that every automated quality gate passes or that frame pacing is perfect.

## Desktop result

| Measurement | Duration | FPS across sections | Worst frame | Audio underruns |
|---|---:|---:|---:|---:|
| Complete v16 tour: ten first encounters, travel, forest and both caves | 16.5 min | 59.90–59.99 | 36.2 ms | 0 |
| Final v19 recheck: forest and both caves | 6 min | 59.91–59.92 | 36.2 ms | 0 |

Both runs pass the strict frame-time gate and the requested rare-dip gate. Raw reports and source hashes are retained in [the full tour](mac-v16-final.json.gz) and [the final recheck](mac-v19-recheck.json.gz). The complete tour predates the final mobile optimizations; the final source was checked on the three sustained routes. Desktop retains synchronous creature searches and 120 Hz contact integration.

## Phone result

The final v19 source was measured on three two-minute routes with real audio and the warm connected Samsung (43.2–43.6°C skin temperature at section ends):

| Route | Mean FPS | 99th percentile interval | Worst interval | Audio underruns |
|---|---:|---:|---:|---:|
| Forest | 30.000 | 35.1 ms | 39.5 ms | 1 (40 ms) |
| Dry cave | 30.000 | 35.0 ms | 37.0 ms | 0 |
| Wet cave | 29.981 | 34.9 ms | 93.3 ms | 0 |

The wet cave had one complete second at 28 FPS and 119 at 30 FPS. Its two intervals above 50 ms were isolated, not adjacent; no images were lost. These rendering results fit the recorded rare-dip allowance, but the forest audio underrun keeps the overall requested-tolerance gate false. The 93.3 ms interval also fails the separate strict 50 ms gate. See [the final phone report](phone-v19-routes.json.gz) and [its summary](phone-final-summary.json).

The full 18.25-minute phone tour was last run on v18 and failed on sustained forest/wet-cave pacing. It remains archived below. That entire tour was **not rerun on v19**; the final six-minute route checks and the user's playtest support stopping, but do not establish exhaustive sustained acceptance. If stutter returns, the saved harness can reproduce the longer warm-device tour before further changes.

## Reproduced problems

The starting revision was `7c15e33933d59249cb9bd4ebcba7ded5f02aaf53`. Diagnostic profiles reproduced first-view shader stalls of roughly 0.8–1 second, desktop lighting-layout recompilation during travel, synchronous bank construction/retirement, expensive fish escape validation, and excessive reflection/outline work on the phone. These were measured in instrumented diagnostic runs, not treated as final acceptance results.

## Retained changes

- Warm actual streamed materials and retain their program owners. Main-view and reply-mask lighting layouts are warmed separately, and the outline effect prepares both linear-buffer and screen-output variants before play.
- Preserve every authored desktop point light in a stable shader layout. Hidden lights retain zero-intensity slots, avoiding recompilation when a parent is hidden for a reflection or a cave transition.
- Construct complete plant patches over several frames and retire their resources after removing them from the view and picking. Indexed batches retain the original triangles and articulated transforms. The renderer skips hidden source rigs that have no live mirrors.
- Stop recalculating hidden willow leaf geometry after batching. World batches retain their original vertex snapshot and continue receiving the same animated part transforms.
- Cache fish-route clearance using numeric cells and bound fresh terrain sampling across frames. Pending route attempts retry from the current fish pose, retaining continuous movement and the existing geometric validation.
- Scale planar reflection targets to their projected size and reduce refresh frequency for tiny pendants. Main-scene geometry, animation, and interaction keep the selected game frame rate.
- Defer auxiliary mobile reflections until the presenter has transferred every requested image, so background captures do not compete with a depleted image queue. Subsequent planar mirror captures use the same idle phase; their first image remains synchronous.
- Share a measured CPU allowance across mobile auxiliary captures, preventing independent reflection timers from exhausting foreground frame time.
- Detach departing vegetation immediately and release its GPU buffers within the shared streaming budget. Remove distant tree copies before near chunks, avoiding repeated updates to copies that are also leaving. This addresses a measured 31.7 ms vegetation cleanup frame.
- Keep mobile Lumen flocks on full local steering inside 600 units (720-unit sleep threshold), beyond their 220-unit interaction/light range. Distant flocks retain all animals, guides and 30 Hz movement; nearby motion and note responses pass an exact replay comparison. Skip unused habitat sampling during route planning.
- Limit worker catch-up messages to two fixed steps while preserving all ordered inputs. A previously overloaded worker fell permanently back to the main thread during the tour; the revised worker remained active through all encounters and eight minutes of travel.
- Register mobile light owners once, then inspect only those lights and their ancestors each frame. Explicit discovery remains available for new light owners. The hot forest CPU trace spent about 8% of its slow interval repeatedly traversing the whole scene just to rediscover unchanged lights. Light selection, properties and fading are unchanged.
- Keep mobile terrain catch-up work at its ordinary 3 ms budget instead of doubling it during area entry alongside fauna and plant construction.
- Cache complete cave support queries at exact coordinates in a bounded 512-entry table per colony. Repeated feet/body queries reuse the same triangle result; callers receive independent records and replacing the cave mesh invalidates the table. Collision sampling remains exact.
- Run mobile pebble contact integration at 60 Hz, with desktop retaining 120 Hz. The physical-behavior contracts pass at both rates, including fast thin-wall collision, fixed foot contacts, slopes, cave steps, swimming, escape and reunion. The world behavior clock remains 30 Hz and rendering keeps its original interpolation.
- Schedule mobile cave escape searches in a shared 2 ms allowance, rotating after each footprint probe. Search snapshots stay private until complete; new goals and removed creatures cancel obsolete work. Every actual movement still checks the full footprint and intervening route immediately. A deliberately expensive-search test verifies prompt reactions, safe support and eventual reunion across deferred searches.
- Prune creature steering candidates whose best possible score cannot beat an already clear path. A deterministic 10,000-case comparison preserves every navigation decision and state change while reducing terrain probes by 50.8%.
- Skip hidden surface-fauna appearance work in caves and refresh those buffers immediately on exit. Bypass vegetation rebatching for the reply-mask layer. View/reflection comparisons verify unchanged pixels.
- Skip inactive scalar reply masks, render their two faces in one order-independent pass, and search for outline distances outward with exact early termination. The original contour, colors, widths, and echo ordering remain intact.

No new reduction in the main rendering pixel ratio or increase in the mobile presentation queue is used. The existing four-image mobile queue still applies.

## Verification

526 Node tests and another 45 physical-behavior tests under the mobile contact and path-search settings pass on the cleaned current source. The checks cover streamed ownership, GPU warmup, worker recovery, collision behavior, and bounded scheduling. The [GPU pixel checks](reply-mask-pixels.json) pass on both the Apple and Mali GPUs: single-pass masks halve the tested mask draw calls from eight to four with zero changed pixels, and the bounded outline searches match the exhaustive search exactly in sparse, overlapping, and dense scenes.

The final main/reflection visibility comparisons have zero changed pixels across twelve views on [Mac](fauna-visibility-mac.json) and [phone](fauna-visibility-phone.json), including verification that hidden surface-fauna buffers refresh on cave exit.

The [runtime manifest](runtime-sha256.json) identifies all 261 final runtime files. The offline verifier audits measured response hashes against the matching manifests and optionally checks current source files. It intentionally exits with status 1 for the retained phone audio finding; a nonzero result must not be relabeled as a pass. The maintained [test guide](../../../tests/performance/README.md) documents cold-entry tours, actual travel, real audio, distinct phone image IDs, source-response hashes, and diagnostic versus acceptance collection. Screenshots and report export occur outside the timed interval; test pages close afterward to avoid retaining past game pages in browser history caches.

## Measurement conditions

Tests use installed Chrome on an Apple M5 Pro Mac and the USB-connected Samsung SM-A155F (Mali-G57 MC2, Android 16). The Mac runs at a 1728×1000 CSS viewport with the existing 1.75 pixel-ratio cap; the phone retains its existing default render scale and four-image presenter. The seed is `fern` and real audio stays enabled. Notes cycle through three strengths every six seconds.

Phone timing counts unique images submitted by the presentation worker, checks their sequence, and records queue starvation. Desktop timing records actual presentation callbacks. Both retain raw timestamps, one-second FPS counts, audio underruns, simulation progress, and source-response hashes. Travel must remain within the generated world; cave routes must spend more than 90% of their frames inside a real cave and cross multiple waypoints.

The automatic summary retains a deliberately strict 50 ms maximum-frame check (`met`), reported separately from `withinTolerance`. A failed strict flag must be read alongside the raw gap timing and one-second FPS counts: the requested tolerance allows rare 28–29 FPS / 58–59 FPS dips, but not repeated stalls. Diagnostic runs with instrumentation or CPU sampling never count as acceptance.

The requested-tolerance check keeps the same mean FPS, 99th-percentile timing, audio, worker-health, image-order, simulation-speed and movement checks. It additionally requires every complete second to contain at least 58 / 28 frames, every frame gap to be below 100 ms, no adjacent gaps of 50 ms or more, and at most one such isolated gap per two minutes (rounded up for short sections, with the same limit across the full tour). This allows rare isolated dips while rejecting the earlier clustered forest failures. Both strict and tolerance results remain visible in the saved summaries.

The v11 fish failure is retained, rather than discarded in favor of an earlier passing run. It prompted the shared auxiliary budget in v12. The first v12 fish repeat delivered 30 frames in every complete measured second for 90 seconds, with no audio underruns. Its planar reflections continued at about 7.5 captures/second, sea reflections at 5.1/second, and environment captures completed three cycles. The first fish route response took 251 ms and subsequent measured responses took 34–161 ms; the route planner publishes only complete, continuously connected paths.

The v12 history trace also exposed an independent simulation failure: a four-step worker batch took 207 ms, the input backlog passed twelve steps, and the game permanently moved Lumen simulation back to the rendering thread. The v13 changes reduce distant steering work and publish worker progress more frequently. The twelve-step failure guard remains intact.

The full v13 phone tour is retained as a failed intermediate run. Encounters and eight-minute travel delivered 30.0 FPS, but sustained hot forest/cave routes dipped to 29.18–29.66 FPS with clusters of 50–95 ms gaps. The worker remained healthy throughout. Later light-registration, cleanup and contact-integration changes resolved the forest load. The v17 cave trace then identified up to 106 ms in a single creature-simulation step; v18 makes cave path searches resumable. Intermediate failures remain archived; the average alone is not an acceptance pass.

## Reproduction

Run from `25_Nowherelands_II` with a repository-root HTTP server on port 8797.
Replace the Playwright module path and device serial when using another machine.
These commands reproduce the full tours using normal gameplay, audio and defaults, without profiling instrumentation. The full phone command is available for future validation; the final v19 phone measurement instead used `SCENES=forest,cave-dry,cave-wet RUN_SECONDS=120 START_SKIN=46` with the other phone settings below.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
SCENES=scarlet-fish,veil-willow,light-lily,bell-reed,hopper,lumen,ray,reed,bird,mite,walk,forest,cave-dry,cave-wet \
RUN_SECONDS=15 SCENE_SECONDS='{"walk":480,"forest":120,"cave-dry":120,"cave-wet":120}' \
OUTPUT=/tmp/mac-final node tests/performance/game-frame-tour.cjs

PHONE=1 ADB=/path/to/adb ANDROID_SERIAL=R58X90C6N8X \
PLAYWRIGHT_MODULE=/path/to/playwright START_SKIN=45 START_THERMAL_STATUS=2 \
SCENES=bell-reed,veil-willow,light-lily,lumen,reed,bird,mite,scarlet-fish,hopper,ray,walk,forest,cave-dry,cave-wet RUN_SECONDS=15 \
SCENE_SECONDS='{"scarlet-fish":45,"hopper":60,"ray":45,"walk":480,"forest":120,"cave-dry":120,"cave-wet":120}' \
OUTPUT=/tmp/phone-final node tests/performance/game-frame-tour.cjs

node tests/performance/summarize-game-frame-tour.cjs /tmp/phone-final/report.json
node tests/performance/verify-frame-stability.cjs --check-sources
```

The phone command deliberately permits an already warm device at startup. It does not disable or alter Android thermal management. ADB requires port 9223 forwarded to `chrome_devtools_remote` and port 8797 reversed to the host server.

The archived CPU profiles for the [forest](phone-v14-forest.cpuprofile.gz) and [cave](phone-v15-cave.cpuprofile.gz) can be decompressed and opened in Chrome DevTools. They are diagnostic evidence, not acceptance runs. Historical `v3`–`v18` reports retain earlier successes and failures. Read the final summaries with the scope limits above; a later short check does not erase an earlier sustained failure.

## Retained failures and interpretation

The v17 full phone tour is retained as [a failed warm-device run](phone-v17-failed-hot.json.gz): its forest rendering was smooth but logged one 40 ms audio underrun, and its caves had clustered slow frames. The [instrumented cave trace](phone-v17-cave-trace.json.gz) and [CPU profile](phone-v17-cave-dry.cpuprofile.gz) identified synchronous escape searches as the remaining source of large simulation spikes.

The [first short v17 Mac recheck](mac-v17-short-forest.json.gz) is also retained. Its short forest route missed the required movement coverage, and dry-cave rendering had one 54.7 ms outlier. The subsequent longer recheck and final v18 recheck passed. An average FPS number alone is never used to discard a failure.

The [full v18 phone tour](phone-v18-failed-hot.json.gz) delivered 30 FPS through all ten encounters and eight minutes of travel, but failed during sustained routes: forest had one 27 FPS second and adjacent slow intervals; wet cave averaged 29.91 FPS with fourteen intervals at least 50 ms and one audio underrun. The [subsequent diagnostic trace](phone-v18-live-trace.json.gz) informed the final hidden-fauna and reply-mask batching changes. Its warm repeat is diagnostic evidence, not a replacement acceptance pass.

## Commit-readiness cleanup

Review removed a redundant scene-root assignment: the root already had `matrixAutoUpdate = false` in the baseline. That line was not an additional performance improvement. The existing identity-root behavior and its rendering check remain. An unused test variable was also removed. These changes preserve runtime behavior; the measured v19 response hashes remain in `runtime-v19-sha256.json`, while `runtime-sha256.json` records the cleaned current files. The verifier checks each report against its measured version, separately from the current-file audit.

Commit-readiness validation passed: 526 Node tests, 45 mobile physics tests, syntax checks for all 83 changed JavaScript files, runtime import resolution, documentation links, compressed-report integrity, source hashes, and `git diff --check`. No blocking code issues were found. The performance audit continues to report the known phone quality finding described above. No additional device benchmark was run for this behavior-preserving cleanup.
