# Structures in the world

Up to one resonant gate, listening fold and horizon frame appear per seed when suitable terrain exists. All share worn, dark charcoal stone, clipped corners and mineral detail, with no moss or lichen. The atelier uses the same geometry and material.

## Interactions

Every structure answers player notes (N, free click or touch). There is immediate surface feedback and a short musical answer after 65 ms. Repeated notes add independent travelling pulses and build a bounded resonance envelope. Up to eight pulse ages live in a fixed buffer; each completes its 0.9-second journey, and new notes never reset an active pulse. This covers the maximum admitted input rate. The shader skips the pulse loop when idle. Structures emit no ground-ring response; the atelier ring has also been removed. A 120 ms duplicate guard replaces the old two-second gate cooldown; the existing player instrument admits notes at 160 ms intervals. Replies are tagged separately to prevent feedback loops.

- **Gate:** a low pitched answer, an inset that brightens, and an automatic response when walking through.
- **Fold:** a pair of harmonizing tones plus a response when entering. The new open pavilion is 100 units wide, 72 deep and 63 high. Under it, the existing main drone becomes stronger and darker, bright melodic layers recede, density falls and reverb increases. A 130 Hz minimum at full shelter keeps the bass voices audible even when the outdoor mix is already dark. This is audible even before melodic discoveries because the drone is always present. Leaving smoothly restores the normal mix.
- **Frame:** a clear ringing answer and a travelling pulse, plus an arrival response at its mountain summit. A narrow, winding trail of chipped stones follows the existing hillside up to it.

Player blips also briefly open the main music filter and increase melodic density, with a larger existing ground ripple and a shorter ducking recovery. Existing plant and animal note reactions remain connected to the same player event.

Direct visits preserve the world seed:

- [Resonant gate](../../index.html?seed=umbra&structures=resonant-gate)
- [Listening fold](../../index.html?seed=umbra&structures=listening-fold)
- [Horizon frame](../../index.html?seed=umbra&structures=horizon-frame)

## Terrain, placement and walking

Gate and fold evaluate up to 560 seeded candidates within 3,600 units of spawn. Local relief, the outlook, nearby water and the existing forest habitat map score eight orientations; only the best two undergo footprint checks. Gates favor ridge passages, woodland transitions and shore/valley reveals. Folds require woodland-edge contrast or rising ground at their backs/sides, with an open or waterside outlook. Uniform empty clearings are rejected. Every accepted footprint and arrival corridor must remain dry, cave-free and separated from landmarks. Their footprint relief limits are 3.5 and 5 units respectively. The fold roof clips rain, snow and hail at each particle's position; outdoor weather stays visible through the opening.

The frame has a separate summit search. It reads the existing height grid, refines at most 32 local maxima and tests sixteen viewing orientations. It requires elevation above 220 units and at least 35 units of local prominence. The view must drop at least 55 units within 160, open out across a wider cone, and face a land valley at least 220 units below, with rising terrain on both flanks. A sampled sightline verifies that the valley floor is visible from player height. It rejects wet or cave-pierced sites and checks each stone tread against the terrain. A seed without a suitable summit skips the frame. There is no lowland fallback or terrain deformation.

The frame sits directly in the summit ground and faces the qualifying valley. The trail can climb a different, gentler flank; its polygons and arrival pose are transformed into the frame’s coordinates. Its length adapts to 88, 112 or 148 units so a safe upper slope can be used without extending into a cave or cliff. The approach has at most 64 uneven treads, variable width and chipped edges; some treads comprise two stones. Their bases sink into the existing slope. Polygon floor queries use a small foot contact patch to bridge chipped joints; climbing compares against the current supporting stone rather than the lagging camera height. Adjacent rises are bounded at 1.7 units. A narrow 160-unit corridor ahead of the opening excludes tall plants and crystal spires (both their solid bodies and outlines), while retaining low ground cover. Vegetation remains at the path edges instead of clearing a broad rectangular stair corridor. Body-height support collision still derives from the same outlines, keeping each opening clear.

Vegetation reserves footprints and approaches during normal generation. The gate's existing 64 KiB ground mask still gives it exposed foundation, soil pockets and returning low vegetation. No moss overlay is used.

## Performance constraints

Baseline: remote commit **604884b**, including the [frame-stability work](../performance/2026-09-19-frame-stability/README.md).

- Three merged stone meshes plus the gate inset: **four draws at most per scene render** before culling. Trail geometry adds static triangles, not extra game-world meshes or draws.
- Shared shader program, two procedural surface noise samples, fixed response uniforms, including eight pulse ages per structure. No new lights, shadow maps, render targets or render passes. Existing warmup covers the actual materials.
- Three fixed entries updated each frame, bounded collision/floor/roof queries and a reused music mix. Summit searching only occurs at load time.
- Structure audio is capped at two retained voices per gate/frame and four for the fold; displaced voices fade and stop within 120 ms. Existing routing retires nodes after their tails. Music uses existing layers, with no second soundtrack.
- `?structures=off` remains available for comparison. Vegetation differs when clearings are disabled, so whole-frame comparisons are contextual.

## Validation

Node tests cover deterministic placement, invalid-site rejection, repeated notes, bounded resonance, audio voice cancellation, walkable stair heights, roof bounds and music restoration. Browser fixtures exercise the real player controller, repeated notes on all three forms, climbing and descending the winding summit trail, fold music and weather, three world seeds, atelier navigation, resource disposal and narrow layouts.

```sh
node --test 25_Nowherelands_II/tests/world/Structure*Test.js 25_Nowherelands_II/tests/world/SummitSiteTest.js 25_Nowherelands_II/tests/audio/AudioLifetimeTest.js
PLAYWRIGHT_MODULE=/path/to/playwright node 25_Nowherelands_II/tests/structures-world-smoke.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node 25_Nowherelands_II/tests/structure-atelier-smoke.cjs
```

Short headless desktop samples check integration and overhead; they do not replace sustained physical-phone acceptance. Current results are recorded below. Older checks and rejected visual studies are retained as history.

## Current verification — 19 September 2026

All **546 Node tests passed**. World and atelier browser checks passed: eight consecutive notes receive eight answers per structure, existing pulse ages survive subsequent notes, structure responses emit no floor rings, and actual keyboard movement climbs and descends the trail. All three tested seeds (`umbra`, `fern`, `ondine-ossia`) have three qualifying sites. The final sightline clearing and camera direction were also checked visually in the running world.

In `umbra`, the gate marks a shore/woodland transition, the fold sits at a sheltered waterside edge, and the frame stands at elevation 1436 facing a valley about 639 units below. Its 31-tread path ends on the safe upper slope before a cave entrance. The population is **2314 triangles/four draws** before culling.

| View | Mean interval | p95 | Maximum | Audio underruns |
| --- | ---: | ---: | ---: | ---: |
| umbra / gate enabled | 16.66 ms | 19.70 ms | 24.10 ms | 0 |
| umbra / inside fold | 16.67 ms | 20.80 ms | 25.20 ms | 0 |
| umbra / summit trail | 16.67 ms | 20.50 ms | 22.60 ms | 0 |
| umbra / structures disabled | 16.69 ms | 19.60 ms | 35.40 ms | 0 |

Measured structure-update averages were 0.002–0.009 ms, with coarse browser clock resolution. These are short headless desktop samples, not physical-phone acceptance. The disabled comparison changes vegetation as well. An exploratory run combining teleports and rapid notes recorded two cumulative audio underruns; it did not isolate their timing. A separate 12-second rapid-blip sample after warmup kept six pulses active, averaged 16.69 ms (20.50 ms p95), and recorded zero audio underruns both before and after the sample. [Rapid-blip check](placement-v1/rapid-blips.json).

[World checks](placement-v1/checks.json) · [Atelier checks](placement-v1/atelier-checks.json) · [View from the frame](placement-v1/valley-view.png) · [Mountain trail](placement-v1/mountain-trail.png).

## Earlier iterations

### Earlier interaction verification — 19 September 2026

All **539 Node tests passed**. The atelier and full-world browser fixtures passed with no page or shader errors. Actual keyboard movement climbed and descended the winding mountain trail; eight consecutive player notes received eight responses on each structure. Fold music restored outside, with the main drone kept audible beneath the roof. Three seeds were checked.

The `umbra` population has **2974 triangles and four draws** before culling. The four-draw budget is unchanged. Short headless desktop samples:

| View | Mean interval | p95 | Maximum | Audio underruns |
| --- | ---: | ---: | ---: | ---: |
| umbra / gate enabled | 16.68 ms | 20.40 ms | 31.70 ms | 0 |
| umbra / inside fold | 16.66 ms | 23.00 ms | 25.00 ms | 0 |
| umbra / summit trail | 16.67 ms | 20.70 ms | 23.70 ms | 0 |
| umbra / structures disabled | 16.69 ms | 19.60 ms | 33.30 ms | 0 |

These are short desktop checks, not physical-phone acceptance. Disabling structures also changes vegetation, so the comparison is contextual. [Recorded checks](interaction-v1/checks.json) · [Atelier checks](interaction-v1/atelier-checks.json) · [Mountain trail](interaction-v1/mountain-trail.png).



### Recorded check — 19 September 2026

All **533 Node tests passed**. Both the world and atelier browser fixtures passed without page errors. The world fixture covered three seeded placement checks (`umbra`: three sites; `fern`: two; `ondine-ossia`: three). Short 12-second headless desktop samples:

| View | Mean frame interval | 95th percentile | Maximum | Audio underruns |
| --- | ---: | ---: | ---: | ---: |
| Gate, enabled | 16.69 ms | 19.0 ms | 33.0 ms | 0 |
| Inside fold | 16.66 ms | 20.0 ms | 22.4 ms | 0 |
| Gate location, disabled | 16.69 ms | 19.7 ms | 32.0 ms | 0 |

Shader program count remained 123 in all samples. Average measured structure-update time was 0.002–0.006 ms when enabled; the browser clock has coarse resolution, so this is an overhead estimate. Disabling structures also removes vegetation clearings, so this is a contextual comparison, not a controlled GPU microbenchmark. No new physical-phone performance run was made. [Recorded results](world-checks-2026-09-19.json).

## Gate aging pass

The resonant gate is the first aging study. Its clipped corners and narrow bevels interrupt the perfect edges without enlarging its collision footprint. The current direction is dark, bare stone: no moss or lichen. Isotropic mineral mottling, subtle granular relief and one short angular fracture break up the stone. The material has no emission; a restrained reflected-diffuse ambient floor keeps its shape readable without adding a scene light.

A broken, shallow threshold and twelve small fragments are merged into the same gate mesh. Their vertices sample the existing terrain; there is no heightmap deformation or new walking surface. A seeded ground mask blends dark exposed foundation stone and accumulated soil into the landscape, and suppresses most grid lines beneath it. Low plant placement reads that same map; trees and large rocks keep the wider clearance. This is a visual history of the site, not simulated erosion or growth.

The atelier shares the worn gate geometry and stone shader. Ceramic mode suppresses surface wear for inspecting the form. Ground integration belongs to the actual world; the atelier retains its simple comparison stage. Fold and frame aging remain for the next iteration.

### Aging verification

All **535 Node tests passed**. Both browser fixtures passed, including world movement, gate response, fold music/shelter, three-seed placement and atelier navigation/audio/resource checks. Gate geometry has finite positions and normals; the added ground mask is 65,536 bytes. Site tests verify deterministic masks, zero influence at their borders, a clear passage and matching rotated vegetation placement.

The final 12-second headless desktop samples were:

| View | Mean frame interval | 95th percentile | Maximum | Audio underruns |
| --- | ---: | ---: | ---: | ---: |
| umbra / gate enabled | 16.69 ms | 20.00 ms | 35.90 ms | 0 |
| umbra / inside fold | 16.66 ms | 19.10 ms | 23.50 ms | 0 |
| umbra / structures disabled | 16.69 ms | 19.50 ms | 32.90 ms | 0 |

Enabled views held 125 shader programs after warmup (two more than the disabled view's 123), with no page or shader errors. Geometry rose from 188 to 434 triangles across all structures; the draw budget stayed at four. No new physical-phone run was performed. The disabled scene has different vegetation, so timing remains a contextual check rather than a controlled GPU benchmark.

[Final results](gate-aging-v1/checks.json) · [In-game night view](gate-aging-v1/world.png).

### Material revision after visual feedback

The first pass was rejected because the vertical streaks read as wood and the green moss looked radioactive. The revised material removes directional streaks, the wrapping fault bands and all surface emission. Cool grey mineral color and small isotropic relief replace the grain; moss coverage is sparse, desaturated olive, and the threshold retains visible bare stone. Ground moss uses the same muted palette. Geometry, site masks, collisions and musical behavior are unchanged.

The final 12-second desktop view averaged **16.66 ms/frame**, with **20.10 ms p95**, **22.60 ms maximum**, no audio underruns and no page/shader errors. The stone's emissive color is zero. The population remains **434 triangles/four draws**, with 125 warmed shader programs. This is a short material check, not phone acceptance. [Results](gate-aging-v2/checks.json) · [World view](gate-aging-v2/world.png) · [Close view](gate-aging-v2/detail.png). The v1 captures above document the rejected treatment.

### Earlier material direction: dark stone, no moss

At the user's request, the gate now uses dark charcoal stone (`#62636d`) with a lower ambient floor. Moss and lichen have been removed from its surface, threshold and fragments; the structure-specific ground moss overlay has also been removed. The site mask's former moss channel is zero and unused. Existing natural riverbank moss elsewhere in the world is unrelated to this structure treatment.

Worn edges, mineral relief, the short fracture, the broken threshold, soil pockets and returning low vegetation remain. The atlas dimensions, geometry and draw count are unchanged; surface shading now needs two noise samples instead of three. Earlier captures above are historical studies, not the current appearance.
