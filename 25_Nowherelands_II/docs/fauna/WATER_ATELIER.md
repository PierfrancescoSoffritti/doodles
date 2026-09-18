# Water atelier

An isolated moving study developed from the [aquatic exploration](underwater-exploration-v2/README.md). Open **Water · atelier studies** from the existing fauna, Reed walker or vegetation atelier selectors. The world seed is carried between pages.

Serve the repository root and open `water-atelier.html`:

```sh
python3 -m http.server 8793 --bind 127.0.0.1
```

[The living pool](http://127.0.0.1:8793/25_Nowherelands_II/water-atelier.html?species=pool) combines fish and lilies. Focus studies are available for [Scarlet fish](../../water-atelier.html?species=scarlet-fish) and [Light lilies](../../water-atelier.html?species=light-lily). Both now live in the game: open **Scarlet fish** or **Light lilies** in the field guide. See [world integration](WATER_WORLD.md).

## Try the study

- Select a solitary fish, schools of 4, 9 or 20, or a combined encounter with one solitary fish and schools of 4 and 15. Fish are solid vermilion bodies with two opposing pectoral fins and a vertical fan tail. They swim below the surface, with different proportions and fin phases.
- **Touch water**, click/tap the pool, or press **N** for a ripple. Floating lilies open and brighten when the ripple reaches them, with a short provisional sound. Fish are passive ambient life: taps, splashes and player presence never change their routes or fin beats. Interaction controls appear only in studies with lilies.
- **Splash**, or press **S**, to close the lilies a little before they settle. **Give them space** returns to quiet behavior.
- Drag to orbit, scroll/pinch to approach, compare bank/above/low views, and switch overcast/moonlight. Water clarity and the surface toggle help inspect submerged anatomy.
- Pause freezes simulation time, responses and motion while leaving the camera available. Reduced-motion preference starts paused; a deliberate interaction resumes the study.
- Sound starts only after an interaction, obeys level/enable/stop controls, and stops on pause, blur, hiding or leaving the page. Fish have no assigned voice. Flower sounds reuse the vegetation atelier's bounded audition voice with fixed pentatonic tuning.

## Implementation and boundaries

`js/atelier/WaterStudy.js` owns seeded identities, bounded swimming routes, lily disturbance responses and ripple-arrival timing. School members share an elliptical cruising route with different offsets and depths. This is a controllable first study, not a complete flocking or obstacle-avoidance simulation. Every fish remains inside the pool and clears the bed and surface.

`js/atelier/WaterMeshes.js` builds simple articulated geometry and the shallow pool. The lilies have no submerged stems. Flowers sit on the water, with a shallow closed-bottom cup surrounding each luminous core; petals open above that core. Pads remain at the surface. The snail design was dropped and its meshes, simulation and controls removed. All owned geometry and materials are disposed when a specimen changes.

The water uses a transparent, Fresnel-like studio tint and subtle wave highlights. Flower reflections are local animated light patches rather than planar reflections. This study does not reproduce the game's full absorption/refraction model; use the world field guide to check color and visibility through the production water. Three local flower lights are suitable for the study but are not a proposed per-plant world lighting budget.

`js/water-atelier.js` connects the controls, camera, lighting, pointer/keyboard input and existing audition audio. `AtelierCatalog.js` adds the water studies while preserving the vegetation and fauna routes. Existing atelier entry imports have refreshed cache versions.

## Fish rendering budget

`js/atelier/WaterFish.js` combines each body, animated fins and flat eight-triangle eyes into a single **118-triangle** mesh, shared by one `InstancedMesh` and one material for the entire study population. It preserves the previous body silhouette and red pigment. Tail/fin animation runs in the vertex shader with a per-instance phase. Position matrices update only when simulation time changes; paused/hidden simulations do not upload unchanged instance transforms. Frustum culling uses a conservative pool-sized bound. Fish cast and receive no shadows, and have no textures, lights or extra reflection passes of their own.

An isolated browser render of the maximum 20-fish population measured:

| Fish-only main pass | Previous | Current |
| --- | ---: | ---: |
| Draw calls | 120 | 1 |
| Triangles | 8,760 | 2,360 |
| Triangles per fish | 438 | 118 |

This is a draw/geometry budget comparison, not an FPS claim or a whole-game benchmark. The former baseline excludes its additional shadow passes; the current fish never enter a shadow pass. The world integration uses spatial patch batches and nearby population limits; see [world integration](WATER_WORLD.md) for the current budget. The atelier caps its fish population at 20 and uses cheap bounded school routes.

## Validation

Run from the repository root:

```sh
node --test 25_Nowherelands_II/tests/world/WaterStudyTest.js 25_Nowherelands_II/tests/world/WaterMeshesTest.js 25_Nowherelands_II/tests/world/VegetationStudyTest.js 25_Nowherelands_II/tests/audio/VegetationAudioTest.js
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node 25_Nowherelands_II/tests/water-atelier-smoke.cjs
```

Node checks cover deterministic specimens, all school counts, underwater/boundary constraints and unchanged fish motion through repeated disturbances, ordered bounded flower replies, flower/core placement, pause, navigation, finite geometry, resource disposal and shared audio behavior. Browser checks measure the actual fish draw call/triangle count and exercise controls, actual audio startup/stop, direct water taps, specimen resource stability, old/new atelier navigation, and the 390×844 reduced-motion layout. Screenshots default to `/tmp/nowherelands-water-atelier`; override with `ATELIER_OUTPUT`. Set `ATELIER_URL` if using a different local server.

Continue refining silhouettes in the atelier and reviewing their appearance through the production water. World lilies now answer with opening petals, light and size-based chimes, following the bell-reed interaction pattern.
