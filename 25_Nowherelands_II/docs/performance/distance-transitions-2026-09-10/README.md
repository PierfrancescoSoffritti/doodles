# Distance transitions: implemented and checked

This first pass fixes the ocean's outer geometric seam and the chunk cutoff for small vegetation. Grass, shrubs, sprouts, reeds, crystals and riparian plants now taper between 640 and at most 960 world units. Plants have slightly different fade endpoints, fixed by their base position. Chunk removal begins no nearer than 1,024 units. Terrain shading carries a subtle meadow/reed tint into the distance using the existing habitat and noise samples.

All distance decisions use the player's position, including reflection and environment renders. A chunk's small-plant meshes stop drawing once every possible plant base in that chunk lies beyond the fade. The chunk, its colliders and its growth records remain loaded as before. Trees, rocks and attached tree lights keep their existing behaviour.

The ocean fade now ends at 4,064 units, inside the actual 4,096-unit half-width. The 32-unit margin covers the largest offset between the player and the snapped mesh centre. Measuring the envelope from the continuously moving player avoids making the fade jump when the mesh snaps by 64 units. All displacement components reach zero at the join. Geometry, draw distance and reflection scheduling are unchanged.

**Evidence from the actual GPU and rendered pixels**

| Check | Before | Final result |
| --- | --- | --- |
| Production ocean vertex shader: 36,864 boundary samples, including corners, translated grids, shore/mouth/deep water and calm/storm waves | Maximum separation from the flat horizon: 4.939 units | Zero separation |
| Existing inner ocean vertices under the same inputs | Control | Exactly matching GPU positions; waves still move |
| Same world vertices across a 64-unit mesh snap, player moving 0.002 units | Control | Maximum displacement change 0.0000083 units |
| Eight small-plant material paths, rendered with maximum wind and pulse | Still visible at 1,024 | All absent by 960; intermediate distances visibly taper |
| Those plant fixtures at 100 and 640 units | Control | Identical pixel hashes |
| Remove the outgoing small plants in the real scene, then compare the final image including bloom | About 3,500 changed pixels from the lower view and 30,800 from the overlook | No difference beyond repeated-render control noise |
| Force distance-culled small-plant meshes back on across 24 positions/orientations | Full rendering control | Visually identical within measured repeated-render noise; 2,100 mesh exclusions accumulated over the views |

The ocean check executes the production vertex shader using WebGL transform feedback. The controlled shoreline values make each case reproducible; the fade is not reimplemented in JavaScript. Plant fixtures use production geometries and materials with an orthographic inspection camera so even distant blades remain large enough to inspect. These fixtures establish actual shader behaviour, not natural apparent size.

Scene deletion checks hold camera, shaders, time and all other scene objects fixed and toggle only outgoing small-plant meshes. Tiny differences from repeated rendering are measured separately; they are not counted as a visible cutoff. The final direct scene check had zero changed pixels in the lower view and two in the overlook, with those same two pixels also differing between unchanged control renders. All raw measurements and final source hashes are in [checks.json](checks.json).

**Measured rendering cost**

Chromium/ANGLE Metal, 1280 × 800, seed `umbra`, no audio. Both versions render the same frozen world and geometry; only the affected materials and the new distance-culling flags are switched. Each view warms both shader sets, then measures 60-frame blocks in before/after/after/before order, 120 measured frames per version. GPU duration comes from `EXT_disjoint_timer_query_webgl2`, with no disjoint results. The test fixes reflection captures to one per four rendered frames to prevent scheduling jitter from giving one version more reflection work. It does not change the game's production reflection scheduler.

| View | Mean GPU before → after | GPU p95 before → after | Mean draws before → after |
| --- | --- | --- | --- |
| Shore | 4.858 → 4.692 ms | 7.938 → 7.842 ms | 542.25 → 507.25 |
| Overlook | 4.420 → 4.569 ms | 7.149 → 8.169 ms | 497.25 → 462.25 |
| Inland | 5.480 → 5.203 ms | 8.535 → 7.202 ms | 697.75 → 657.75 |

Mean GPU duration across these equally weighted views decreased by 1.99%; individual means changed by −3.4%, +3.4% and −5.1%. Draw calls fell 5.7–7.0%. CPU render-submission means also fell. The overlook's tail timing increased in this sample, so these results support broadly unchanged rendering cost, not a claim that every frame or viewpoint is faster. This is a rendering benchmark with frozen simulation, not a full-game frame-rate or power measurement.

An earlier prototype incurred additional GPU cost. The final version skips fully faded meshes and clips fully faded lines in the vertex shader, retaining early depth rejection for nearby grass. No extra textures, geometry or render passes were added.

**Other regression checks**

Sixteen relevant Node tests passed: surface work/data, frame pacing, fauna neighbours, water-mesh coverage, river flow and waterside feature checks. The existing browser checks also passed for 21 terrain nodes, both shore-map tiers, 436 growth groups, cancellation without orphan colliders, 24 frustum-culling views and 27 reflection projections (maximum error below 2e-16). The camera replay crossed a chunk boundary in both directions, then teleported 1,800 units. After streaming settled, all 81 near chunks were installed, the queue was empty, the fade origin matched the player and the worker had not failed. No JavaScript or WebGL errors were reported.

Visual evidence: [before overlook](before-overlook.png), [after overlook](after-overlook.png), [plant transitions](plant-transitions.png), and [boundary/teleport replay](boundary-replay.webm). The overview images illustrate the appearance; the numerical before/after pixel assertions use the controlled toggles described above. The replay is a smoke check for movement and recovery, not a before/after performance comparison. Its frames were inspected at the boundary and after the teleport.

Large-tree model transitions, the far-tree cutoff, attached tree lights, fog unification and the inland-water wave handoff remain for subsequent passes. This pass does not claim to eliminate every kind of distant popping.

**Reproduce**

Serve the repository on port 8791. Save the original `Vegetation.js`, `RiverEcology.js`, `TerrainMaterial.js`, `SeaShader.js` and `Water.js` from `f335e23` into one baseline directory; these five files had no pre-existing working-tree changes when snapshotted. Keep the rest of the current checkout so that unrelated river changes are shared by both versions.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
DISTANCE_BASELINE_DIR=/path/to/baseline-world-modules \
DISTANCE_SCENE=1 \
DISTANCE_OUTPUT=/tmp/distance-checks \
node 25_Nowherelands_II/tests/performance/distance-transitions.cjs
```

Omit `DISTANCE_BASELINE_DIR` to run the final shader assertions alone. Set `DISTANCE_URL` to override the local URL; the complete fixture set is designed for seed `umbra`. Browser helper modules require a paused, disposable audit page, as provided by the runner. The runner reports the expected baseline failure, asserts the final edge and plant results, compares nearby controls, checks distance culling against full rendering, saves the scene comparisons and measures GPU cost. Timing results require interpretation rather than a brittle machine-independent pass/fail threshold.

```sh
node --test 25_Nowherelands_II/tests/performance/*Test.js \
  25_Nowherelands_II/tests/world/WaterMeshDataTest.js \
  25_Nowherelands_II/tests/world/WatersideFeaturesTest.js \
  25_Nowherelands_II/tests/world/RiverFlowTest.js
```

The Node output is preserved in [node-tests.txt](node-tests.txt). Existing browser regression entry points are in `tests/browser/PerformanceChecks.js` and `tests/browser/SeaReflectionTest.js`.
