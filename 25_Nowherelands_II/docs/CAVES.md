# Deep caves — research and implementation design

Research completed 2026-09-05, before changing terrain code. The goal is geologically believable, explorable caves in Nowherelands' faceted nocturnal style, with some active underground rivers and the existing 60 fps MacBook Pro target.

## Geological basis

- [NPS: Solution caves](https://www.nps.gov/subjects/caves/solution-caves.htm): weakly acidic water enlarges connected weaknesses in soluble rock. Recharge, discharge elevation and gradient govern the network. Steep systems include shafts and cascades; flatter systems include flooded passages. For this world, use a coherent karst family with dry upper galleries and lower flowing conduits, rather than mixing lava tubes, sea caves and limestone dripstone indiscriminately.
- [NPS: Cave geology in depth](https://www.nps.gov/grba/planyourvisit/cave-geology-in-depth.htm): fractures and faults influence passage direction; water-table history leaves older levels. Dissolution scallops, ceiling breakdown and sediment tell different parts of that history. Use correlated forms and branching paths, avoiding uniformly round tubes and unstructured three-dimensional noise.
- [USGS: Karst aquifers](https://www.usgs.gov/mission-areas/water-resources/science/karst-aquifers): recharge and conduits are connected to springs and surface drainage. Cave water needs a plausible source and outlet. Open-channel water surfaces must decline toward the spring; fully flooded siphons would require a different hydraulic model. The first implementation should model groundwater-fed spring caves without inventing disappearing surface discharge.
- [NPS: Speleothems](https://www.nps.gov/subjects/caves/speleothems.htm): stalactites hang from drip sites, stalagmites build beneath them, columns connect the two, and flowstone follows moving films of water. Deposit placement should follow seepage and dry shelves, with sparse or absent delicate floor deposits in the active channel.
- [NPS: Cave ecology](https://www.nps.gov/subjects/nnlandmarks/nnlartwork_caves.htm): entrance, twilight and dark zones support different communities. Photosynthetic vegetation requires light. Keep green growth near daylight, and use mineral surfaces, sediment, water and restrained ambient life deeper inside. A player light is an artistic/navigation provision, not a claim of naturally luminous rock.

## Technical references and decision

[Paris et al., 2021, Synthesizing Geologically Coherent Cave Networks](https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.14420) separates a geologically controlled network skeleton from conduit geometry formed with implicit primitives, blending and warping. This is the most relevant model for coherent connectivity and passage variation. Our design is a simpler seeded approximation, not a reproduction of the paper's anisotropic shortest-path solver.

[NVIDIA GPU Gems 3, Generating Complex Procedural Terrains](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu) explains density fields, isosurface extraction and bounded geometry blocks. Its DirectX geometry-shader implementation is not directly portable to this WebGL game. Use worker-generated geometry with bounded chunks and cached buffers instead.

The current `Terrain` renders a height field, `Heightmap` returns one surface elevation, and both walking and flight clamp to that elevation. Adding a cave-shaped visual object alone would leave solid terrain and collision blocking the entrance. The implemented hybrid keeps the continental height field, subtracts local cave openings, and adds volumetric cave walls/floors/ceilings. Collision, openings and rendering must consume the same cave definition. Three-dimensional position must also distinguish cave water from an unrelated river or sea above/below it.

## Acceptance checks

- Continuous walk/fly entry and exit; no surface snapping, ceiling penetration or tunnelling through walls.
- Connected, seeded networks with measurable overburden and variation in width, height, chamber scale and elevation.
- Cave openings agree between terrain rendering and collision at every nearby terrain LOD.
- Underground water declines toward an actual surface outlet and remains within its carved channel.
- Dry galleries, sheltered mineral deposits and breakdown contrast with active stream passages.
- No sky, surface fog, rainfall, surface vegetation or ocean sheets appearing through deep interiors.
- Worker generation and bounded rendering; repeatable movement profiles near entrances and inside, including percentile/max timings rather than settled median fps alone.

## Implementation

`CaveGen` selects separated valley-side sites with suitable rock cover, then builds a main spring conduit (or dry fossil passage), a higher bypass where the mountain permits it, and a blind side gallery. Main passages are 520–900 metres long; depth is actual overburden beneath the existing mountain, not an arbitrary vertical translation. Cave placement is a seeded karst approximation; the world does not yet carry surveyed lithological strata or a groundwater pressure solver.

`CaveField` defines a union of variable-width conduits with broad roofs, incised stream beds, irregular shelves and wall relief. `CaveMeshData` extracts that volume into fixed-grid local blocks using marching tetrahedra, clips the shell to the surface, and adds anchored dripstone and low breakdown forms. The existing generation worker produces these buffers before play; rendering caches them and culls distant cave groups/blocks. Continental terrain keeps its height-field LOD. A matching local cave mask removes the entrance from that terrain, and unsupported surface vegetation/rocks are suppressed at the opening.

Walking and flight use the same three-dimensional field. Vertical air intervals are merged before choosing a floor, preventing invisible floors where passages overlap. Movement is swept in small steps to prevent fast travel through walls. Surface terrain remains the support outside cave openings; walking does not globally switch to an underground height map.

Wet caves model spring-fed groundwater already included in the receiving river's baseflow: ten percent of the existing local discharge is assigned to the cave, rather than added again downstream. Flow speed follows local wetted area; integrated travel time advects surface motion toward the outlet. The channel has a closed-end recharge pool, depth-coloured transmission and a snapshot of local cave geometry for refraction. This is prescribed steady flow, not dynamic infiltration, flooding, pressure-driven siphons or cave diving.

Deep rock has local lighting with an automatic warm exploration light, reduced entrance daylight, bedding bands, wet patches and mineral colour variation. Ordinary green vegetation and airborne weather stay outside. Surface river/reed ambience is replaced by the local underground wash when the player is inside a wet cave, using the existing audio voices and Enter gesture. Mineral decorations are visual detail; they are not a separate rigid-body simulation.

## Inspection

Serve the repository and open `25_Nowherelands_II/?seed=umbra&caves=1`. The tour offers the entrance, underground river, upper gallery, deep chamber and next cave. **Explore here** returns to the normal walking controls; **F** switches to flight. **Follow passage (24s)** waits four seconds and moves along the main conduit for twenty seconds, recording percentiles and slow-frame counts on the panel's `data-profile` attribute. It is a rendering/streaming route; the collision sweeps are separately regression-tested, including continuous entry and exit.

The regular game has no inspection panel. Caves are part of the same terrain and can be reached through their actual valley-side openings.

## Recorded checks — 2026-09-05

All 37 world tests passed, including seeded cave connectivity, roof cover, dry/wet variation, shared mesh attributes, separated levels, dissolved junction floors, high-speed wall/ceiling collision, continuous entry/exit, and the existing full-resolution river regressions.

On the development M5 Pro / 64 GB machine, a full-resolution `umbra` cave route at a 1920 × 1080 canvas recorded 1,748 frames over the twenty-second movement interval: 11.0 ms median, 15.2 ms p95, 16.6 ms p99, 22.9 ms maximum, and no frames over 33.4 ms. The inspected main passage was 641 metres long, with viewpoints roughly 240–276 metres below the surface. Entrance, wet conduit, chamber and dry upper gallery views were checked without shader or worker errors. These measurements describe this local route, not a locked frame rate on every MacBook or display resolution.

The separate post-change surface movement recheck initially lost two preview tabs. After reconnecting, the full-resolution `umbra` Sheltered lake route completed its four-second warmup and twenty-second, 1,200-metre movement interval: 11.2 ms p95, 13.8 ms p99, and no frames over 50 ms. These figures were recovered from the benchmark's visible readout; canvas resolution and the full timing dataset were not captured for that run, so it is not a resolution-matched comparison with the cave route. The existing river regression tests also passed.

## Mountain entrances and their surroundings — 2026-09-05

The first entrance pass selected every cave beside a river and left a clean aperture in the slope. Placement now reserves sites for independent mountain-face galleries and narrow fissures. These dry passages descend into the mountain. Where cover and gradient permit, an additional high opening connects to an existing spring cave through a rising dry branch. Every entrance has an explicit terrain-mask range; daylight uses both mouths. Swept movement also treats the outside hillside and cave volume as one air space, avoiding invisible end caps at raised entrances.

Further entrance research, prompted by visual review:

- [NPS, Cave geology in depth](https://www.nps.gov/grba/planyourvisit/cave-geology-in-depth.htm) distinguishes limestone dissolution from physical scouring, and describes surface erosion exposing passages and collapse near weakened roofs. The application here is an exposed, weathered face around a pre-existing solution passage, rather than claiming runoff excavated the entire cave.
- [NPS, Talus caves](https://www.nps.gov/subjects/caves/talus-caves.htm) illustrates large angular blocks, irregular voids and soil/vegetation developing over older debris. These provide references for collapse material at our entrances; the deep networks remain karst caves, rather than being reclassified as talus caves.
- [Inria, Efficient Debris-flow Simulation for Steep Terrain Erosion](https://radar.inria.fr/report/2024/graphdeco/index.html#section8) describes erosion scars and competing deposits, and why simply smoothing steep slopes misses their character. Our bounded entrance pass is a simpler approximation: prescribed joint/weathering scars and runoff grooves create sediment, part is deposited below the face, and 36 conservative transport iterations redistribute only loose sediment down steep gradients. It is not the paper's coupled debris-flow solver or a calibrated geological timescale.
- [NPS, cave entrance lichen survey](https://irma.nps.gov/DataStore/DownloadFile/690760) separates rim, sheltered and twilight habitats. Plants therefore recruit in daylight and sheltered soil pockets, with no planting in the deep dark galleries. Fern, bramble, sedge and moss meshes reuse the existing vegetation vocabulary, with altitude, slope, water and rock occupancy checks.

`EntranceTerrain` bakes local 3-metre height patches, with zero displacement at their boundaries. Runtime height sampling, vegetation anchors, terrain rendering and the worker's cave-shell clipping all use these patches. The surface material exposes weathered rock and reduces the glowing grid over the disturbed ground. Existing spring-channel mouths retain their drainage geometry.

`EntranceHabitat` places irregular clusters of large fallen blocks and smaller rubble beside a clear central approach. Their material shares surface terrain lighting. The earlier exterior cone-shaped decorations are removed. Large blocks have conservative collision proxies; small rubble and plants remain visual detail. Instances share geometry/materials and are culled with their cave group. Geometry generation and sediment transport do not run during movement.

The cave inspection panel now includes **Mountain face**, **Narrow fissure**, and **High entrance**. All 39 world tests passed after the entrance work, including seeded mountain sites, actual openings at both ends, erosion/deposition, plant recruitment, large-block collision and existing river regressions. Earlier frame measurements above predate this entrance expansion; do not treat them as a matched performance comparison for the new exterior detail.

A new full-resolution `umbra` spring-cave movement profile in Chrome completed after the entrance expansion at a 3598 × 1830 canvas: 2,225 frames over twenty seconds, 8.9 ms median, 10.0 ms p95, 10.7 ms p99, 15.2 ms maximum, and zero frames over 33.4 or 50 ms. This is an interior traversal with the added entrance assets present; it is not an exterior approach benchmark or a matched browser/resolution comparison with the older results. Broad, fissure and high entrance views were inspected without console errors. A protruding roof block that looked artificially placed was removed during the final visual review.

## Uneven floors and continuous approaches — reference revision, 2026-09-05

The supplied entrance photographs highlighted the remaining artificial arch, straight floor edge and isolated rock scatter. `CaveRelief` now supplies continuous world-space floor undulations, worn bedrock ledges and compact fractured slabs. The same relief feeds the cave field, collision and exterior approach. Segment floors continue their gradient through joins instead of producing flat end caps. Wet thalwegs receive only a small fraction of the displacement so their existing water surface and drainage remain intact.

Mouths use asymmetric fracture profiles and stronger correlated wall relief. The exposed approach is a broad, curved talus slope with fractured erosion scars, sheltered vegetation, embedded blocks and rubble extending into the light zone. The approach grade is bounded and the sill is filled to meet the actual passage floor. This final terrain shaping is an artistic accessibility constraint, beyond the sediment-transport approximation described above; it is not mass-conserving physical erosion.

Open path ends are clipped at their mouth plane to avoid an extra rounded void underneath the apron. Terrain and cave meshes retain a small geometric overlap to cover differences between terrain LOD interpolation and the fixed cave-meshing grid. Rock shading suppresses bedding stripes on upward-facing floors, adds patchy sediment, and blends exterior illumination into cave lighting. Instanced entrance rocks share that lighting, including the exploration lamp indoors. Plants remain confined to the daylight zone.

The survey adds **On approach** and **Look outward** for checking the threshold at walking height and from inside. Tests cover dry floor variation and continuity, absence of exterior end-cap voids, traversal through generated eroded mountain/fissure entrances in both directions, and access with large-rock collision enabled. The full 40-test world suite passed during this revision; affected cave tests were rerun after the final geometry changes. Separate full-resolution `umbra` checks also traversed both generated mountain entrance types successfully. Visual checks include the outward view's uneven floor, the broader mountain opening, and removal of an overly regular rock arrangement.

The cave mesher now evaluates each horizontal cross-section once per X/Z sample and reuses it through the vertical column. Extra terrain shaping and habitat generation remain worker-time operations; movement does not run erosion or rebuild cave meshes.

Performance follow-up: a 3598 × 1832 Chrome mountain-gallery route initially recorded 30.5 ms p99 / 57.5 ms maximum while world tests were running. An otherwise idle repeat recorded 11.0 ms median, 17.0 ms p95, 27.2 ms p99 and 49.5 ms maximum (4 frames above 33.4 ms, none above 50 ms). Those hitches were retained in the measurements rather than inferred away from the high median fps. Surface LOD selection was subsequently corrected to reserve extra cave-related subdivisions for openings, rather than every buried passage beneath the mountain.

The LOD-only change did not resolve the hitches: a fresh 3598 × 1830 run measured 12.6 ms median, 20.3 ms p95, 34.5 ms p99 and 99.2 ms maximum. Inspection then found that surface terrain, shore maps and detailed surface-water streaming were still following the player deep underground. These updates now pause beneath 96 metres of cover and resume near the entrance; water uniforms and static coverage continue updating. The final fresh mountain-gallery run at the same 3598 × 1830 resolution recorded 2,388 frames in twenty seconds: 8.3 ms median, 9.4 ms p95, 10.3 ms p99, 19.7 ms maximum, and no frames over 33.4 or 50 ms. This measures the interior route on the development machine, not a guaranteed frame rate throughout every exterior scene. No browser shader/worker warnings or errors were recorded.

Final visual review found debris suspended above an exposed lower gallery at a high entrance. Debris support now checks physical cave floors independently of the player's eye-height interval, and large blocks are excluded where they would project across a cave void. The affected cave tests passed again, and the high-entrance outward view was rechecked with the suspended block removed. Large exterior vistas still have a heavier GPU cost than the measured enclosed passage; the high entrance's full-resolution view was around 49 fps during inspection, so the interior result should not be read as a project-wide 60 fps guarantee.
