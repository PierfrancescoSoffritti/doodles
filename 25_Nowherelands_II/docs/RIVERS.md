# Rivers: geomorphology, ecology and water rendering

The replacement keeps Nowherelands' faceted nocturnal palette, but gives the water a carved bed and a continuous optical body. The landscape evolution model remains the foundation: drainage is traced over eroded terrain, and channel shaping, rendering, rocks and plants all consume the same generated river records.

## Research and design decisions

- [Leopold & Wolman, USGS: River channel patterns](https://pubs.usgs.gov/publication/pp282B) describes the relationship between slope, discharge and channel pattern, and alternating pools and riffles. `ChannelMorphology.js` distinguishes alluvial, gravel, step-pool and torrent settings. Bed sequences span several channel widths. Low-confinement channels migrate laterally; hard, confined channels have much less mobility.
- [USGS: Hydrologic cycle and interactions](https://pubs.usgs.gov/circ/circ1139/htdocs/natural_processes_of_ground.htm) describes mountain streams exchanging water through coarse beds, pools, riffles and boulders. Mountain catchments receive more effective runoff, smaller high-elevation catchments can form streams, and roughness rises with confinement and exposed bedrock.
- [US Forest Service: Riparian communities associated with Pacific Northwest headwater streams](https://research.fs.usda.gov/treesearch/24499) describes the variety of habitats produced by stream, hillslope and riparian processes. Recruitment uses water depth, local current, aeration and altitude. Bramble stays above normal flow, reeds occupy sheltered margins, sedges follow wet banks, and submerged ribbons occur in shallow, slow water.
- [GPU Gems: Effective water simulation from physical models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models) uses depth to control transmission and wave amplitude and discusses river-aligned texture coordinates. The new inland shader combines refracted scene colour, exponential coloured absorption, Fresnel reflection, local surface normals, depth attenuation, foam wakes and moving caustic light.

The numeric coefficients are artistic approximations for this world's enlarged scale, not a calibrated hydrological simulation.

## Generation

1. Retain stream-power erosion and priority-flood drainage. Accumulate altitude-dependent runoff independently of geometric catchment, then use effective catchment consistently for river widths, discharge and delta splitting.
2. Resample drainage chains, preserve connections and constrain water elevation to a downstream-monotone profile.
3. Condition lateral migration on confinement, hardness and gradient. Broaden inner shelves, scour outer bends and give the surrounding floodplain asymmetric terraces.
4. Alternate width and depth over width-scaled pool–riffle sequences. Solve Manning reference depth using reach roughness, then obtain speed from discharge divided by the shaped section's area.
5. Integrate downstream travel time. This is the phase coordinate for moving waves: absolute time multiplied by locally different vertex velocities is deliberately avoided.
6. Place coarse bedload in mountain channels and clusters of smaller stones on sediment shelves. Surface-breaking stones also produce wakes. Existing driftwood, plunge pools and lake connections remain integrated.

The packed river record now has 15 floats; use `RIVER_STRIDE` and `RV`, never a literal stride. `RV.TRAVEL` is accumulated travel time in seconds. `RV.BAR` is the mid-channel sediment-bar strength. Cross-section discharge uses the remaining wetted area on both sides of the bar. River-space normals define a level cross-section even where the longitudinal profile descends.

## Rendering

`WaterOptics.js` copies the already-rendered linear HDR framebuffer once before inland surfaces render. It does **not** render the world a second time. Near and distant surfaces share that snapshot, absorption and reflection model. Geometry contains the sampled bed height; water depth controls colour transmission, shoreline coverage and near-wave amplitude. Near and distant meshes have mutually exclusive coverage and their displacement fades at the transition.

The moving surface retains facets, with restrained short waves in calm reaches and stronger travelling and standing waves in rapids. Rough-water reflections are blurred to avoid a chrome-like surface. Two overlapping flow phases advect surface detail; rocks deflect current and form reversing wakes. Drifting foam uses the same wave travel coordinate. Waterfalls accelerate by ballistic travel time, have a shared curved rock crest and deforming sheet, finer aeration, radial impact boils and seeded spray.

Screen-space refraction cannot recover objects hidden behind foreground objects or outside the viewport. Distortion is bounded near banks and rocks, and an environment capture supplies reflection. Water is optically volumetric over a carved bed; there is no live three-dimensional fluid solver, changing discharge, sediment transport or flood simulation.

`RiverEcology.js` creates solid polygonal leaves and blades alongside the original wire grass. Plants are instanced in the existing vegetation chunks, with at most nine additional plant draws per occupied chunk, capped at 420 plants total and no per-plant frame updates. Terrain gravel is procedural; riverbeds avoid double absorption and most of the wire grid so submerged stones read clearly.

## Inspect and verify

Serve the repository root and open `25_Nowherelands_II/?seed=river-check&rivers=1`. The optional tour finds mountain torrents, gravel reaches, calm lowland bends, a lake outlet and a deep pool in the generated seed. It also finds fallen trees, divided channels and a sheltered lake bank. It offers a water-level view and an **Explore here** button. Without `rivers`, the normal introduction and controls are unchanged.

The tour reports median frame rate and 95th-percentile frame time in rolling 120-frame windows, excluding the first three seconds after a jump. It also records render resolution and nearby plant counts on its panel for inspection. This is a repeatable visual check, not a cross-device performance guarantee. Terrain and vegetation streaming and periodic environment captures can still cause individual slower frames.

Run all regression checks from the repository root:

```sh
node --test 25_Nowherelands_II/tests/world/*Test.js 25_Nowherelands_II/tests/world/gen/*Test.js
```

Checks cover downhill profiles, conserved section discharge, bend scour and shelves, lake connectivity, riffle geometry, currents around rocks, reach variation, powerful headwaters and habitat exclusions. The complete 1024-resolution `river-check` world was also checked for finite samples, downhill profiles and conserved section discharge.

### Recorded local checks

On the development machine (Apple M5 Pro, 64 GB), the 1920 × 1080 browser render held a 60 fps median in the inspected gravel reach, deep pool and second-seed mountain torrent. Recent 95th-percentile windows were approximately 16.8–17.3 ms. These are settled-view measurements; they do not establish a locked 60 fps on every MacBook, at Retina resolution, or during terrain streaming. No shader compilation or WebGL warnings were reported in the inspected views.

## Habitat and shoreline variety

`WatersideFeatures.js` plans large wood once against the runtime heightmap, before the water caches obstacles. Fallen trees have supported bank ends, broken limbs and root wads. Only immersed sections create flow obstacles; a trunk bridging above the water produces no artificial wake. Smaller branches collect upstream of grounded ends. Drowned standing trunks occupy sheltered shallow lake margins. Root fans and small soil caps project from eroded banks. The world plan is spatially indexed; chunk reloads cannot duplicate current obstacles.

`WatersideMeshes.js` batches these details, shoreline cobbles and flood strandlines into one mesh per occupied chunk. Rock shading includes wet bands, older mineral marks and damp moss. Lake planting uses shoreline samples with upwind fetch: sheltered shallows recruit reeds, rushes, submerged ribbons and lily pads; higher banks support sedge, willow and bramble, with ferns responding to forest cover. Moss forms low mats. Recruitment has both per-community and total chunk limits.

`LakeMorphology.js` reshapes basin interiors into soft shoreline shelves and underwater sediment fans below tributary mouths. Larger basins can retain small islands; dry rims are preserved. Broad, unconfined river reaches develop tapered gravel islands with two wetted channels, integrated into terrain sampling, water clipping and section-area calculations. Mountain confinement suppresses these bars.

Water clarity varies with altitude, width, forest cover and rain: clearer headwaters, darker woodland water and more suspended sediment downstream. The existing shared current field also guides drifting leaves among the foam. A fixed budget of 160 nearby fish and bank insects uses one GPU draw, with depth checks keeping fish underwater. Three reusable spatial audio voices provide a low river wash, brighter trickle/lapping detail and reed rustle through the existing ambient mixer. Audio starts only through the normal Enter/Explore gesture.

Large wood, sediment and historical water marks are static landscape features. They do not simulate tree falls, log transport, seasonal flooding or live sediment erosion. Fish and insects are lightweight ambient animation, rather than an ecosystem simulation.

Follow-up validation (2026-09-05): the expanded habitat build held a 60 fps median at 1920 × 1080 in the inspected mountain, divided-channel and sheltered-lake views on the same M5 Pro. Recent p95 windows ranged from 16.8 ms to 18.7 ms, with the dense lake scene at the upper end. The browser reported no shader/WebGL errors, and normal exploration successfully started all three spatial ambience voices. The regression suite now includes a full-resolution 1024 `umbra` world as well as 512-resolution worlds. This caught and fixed a six-centimetre uphill sill caused by confluence rendering clearance after the original downhill-profile pass; source lake levels and downstream monotonicity are now reapplied after that clearance.

## Movement stutter investigation (2026-09-05)

The previous settled-view checks missed a main-thread spike every 40 metres: `InlandWater.rebuildNear` synchronously sampled terrain, clipped shores, rebuilt lake masks and allocated/uploaded a large detailed surface. On the `umbra` sheltered-lake route, a single rebuild took up to 295 ms.

`WaterMeshData.js` now supplies the same surface attributes through a DOM/Three-independent builder. `WaterMeshWorker.js` reconstructs the seeded heightmap once, builds nearby detail in a worker, and transfers its typed-array buffers back without copying them. Only one request is in flight, so fast movement cannot accumulate a backlog. Lake masks are cached, lake sampling is bounded to the nearby rectangle, and adjacent lake triangles share vertices. Facet spacing, bed sampling, wakes and shoreline clipping are retained. The worker adds one persistent copy of the baked world and its sampling indexes; it does not clone the world on every rebuild.

The old near mesh stays visible until replacement buffers arrive. Its coverage contracts if the player travels outside the built area; the static surface fills the rest immediately, including after a teleport or worker failure. Wave displacement and drifting foam share that coverage radius to avoid a height seam.

### Reproduce the movement test

Open `?seed=umbra&rivers=1&profile=1`, choose **Sheltered lake**, then **Test movement (24s)**. This waits four seconds, then covers 1,200 metres in 20 seconds using wall-clock movement. Start each comparison from the same tour stop in a freshly loaded world, keep only one game running, and check the actual canvas resolution. The panel records percentile frame intervals, slow-frame counts and CPU phase costs in its `data-profile` attribute. `waterBuild` measures request dispatch and `waterInstall` measures geometry attachment; GPU buffer uploads are included in rendering, not in those CPU timings. The hooks are opt-in and absent from normal gameplay.

Paired runs in the same browser tab, Apple M5 Pro / 64 GB, 1920 × 1080 canvas, full-resolution `umbra` world:

| Metric, 20-second moving route | Committed habitat build (`4695332`) | Worker streaming |
| --- | ---: | ---: |
| Median frame interval | 16.7 ms | 16.7 ms |
| 95th percentile | 17.4 ms | 17.0 ms |
| 99th percentile | 242.7 ms | 18.3 ms |
| Worst frame | 307.7 ms | 25.9 ms |
| Frames over 33.4 ms | 21 | 0 |
| Frames over 50 ms | 20 | 0 |
| Largest main-thread water rebuild / request | 295.1 ms | 0.1 ms |

These are local measurements, not a guarantee for every device, seed, browser state or Retina resolution. Earlier runs in a long-lived browser tab had much higher costs across all subsystems; the table uses the subsequent same-tab baseline/optimized pair. Remaining occasional frame overruns in that pair came from terrain/vegetation builds, shoreline-map work and the five-second environment capture. They were below 26 ms; these systems are still synchronous.

Validation adds checks for indexed lake coverage, finite transferred attributes, safe coverage during teleports, and exact geometry equivalence after reconstructing a cloned world with large-wood wakes. All 31 world regression tests pass, including full-resolution `umbra` drainage. Lake and mountain views were inspected without shader or worker errors.

A second full-resolution `halcyon` run starting at **Mountain torrent** recorded 1,200 frames over the moving interval: 16.9 ms p95, 18.1 ms p99, 18.5 ms maximum, and zero frames over 33.4 ms. No worker, shader or WebGL warnings were reported.
