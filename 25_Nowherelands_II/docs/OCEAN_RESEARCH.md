# Ocean reference review and implementation direction

Research/code audit, 6 September 2026. This document proposes a replacement for the current coastal wave approximation; it does not describe an implemented simulation.

## What the references show

- [Rocky coast aerial photograph, Jake Allison](https://unsplash.com/photos/aerial-view-of-beach-during-daytime-0Uf_Y4KUaMY): inspected the full image. A diagonal breaking front meets rocks and sand differently. Bright aerated water behind it becomes a branching, irregular foam network, with clear water between patches. The important visual distinction is the moving front versus the foam it leaves behind. This photograph is a visual reference, not evidence of subsurface depths or motion over time.
- [Aerial wave-refraction photograph](https://www.coastalwiki.org/w/images/7/71/WaveRefraction.jpg), linked from [Coastal Wiki](https://www.coastalwiki.org/wiki/Refraction): inspected the image. Offshore crests run obliquely to the beach; closer in, their orientation changes. Most offshore crests are visible through light and shadow, while whitewater occupies discontinuous stretches near land. Attribution on the image: 2021 Maxar Technologies. Reference only; not a project texture.
- [USGS Santa Cruz coastal cameras](https://www.usgs.gov/centers/pcmsc/science/using-video-imagery-study-coastal-change-santa-cruz-beaches): provides snapshots and processed video imagery. USGS explains that time-averaged bright breaking zones indicate shallow sandbars. These are useful future validation views for distinguishing a breaking region from an individual moving crest. Reviewed the documentation; no video playback was inspected in this audit.

The physical basis is described in the [SWAN model documentation](https://swanmodel.sourceforge.io/online_doc/swantech/node5.html): propagation, depth-dependent refraction and shoaling, obstruction, whitecapping, bottom friction and depth-induced breaking are distinct processes. Its [wave-kinematics equations](https://swanmodel.sourceforge.io/online_doc/swantech/node11.html) relate propagation and direction changes to the depth field. SWAN is a research reference for the processes, not a proposed runtime dependency or a direct surface renderer.

## The seabed already exists

| Code | Existing behavior | Consequence |
| --- | --- | --- |
| `js/world/gen/WorldGen.js`, `baseTerrain` | Generates negative elevations below sea level, with broad relief. | The water is above an actual heightfield. |
| `WorldGen.js`, `shapeCoast` | Shapes hard-rock cliffs, shallow undercut shelves and soft beach ramps. | Some coastal morphology already exists, mainly close to the shoreline. |
| `js/world/Heightmap.js`, `base` / `sample` | Continues the bed downward outside the baked grid. Adds detailed carved river-mouth beds and shoals inside it. | Extending the terrain domain is not a prerequisite. |
| `js/world/Terrain.js`, `select` | Omits terrain nodes whose estimated maximum height is below -9 m. | Invisible seabed geometry is deliberately culled; its height data remains available. Drawing every deep node would add work without fixing wave motion. |
| `js/world/ShoreMap.js` / `ShoreMapData.js` | Detailed moving height maps plus a 512-square world overview. | Local depth is available, but the roughly 32 m overview texels cannot describe narrow bars and channels reliably. |

The overview uses the generated height grid, whereas nearby maps use the complete carved height sampler. A future propagation bake should consume a consistent bathymetry source, including river-mouth features, rather than silently switching between these representations.

## Why the current water is uniform

`ShoreWaves.js` defines phase as shoreline distance times one wave number, plus one shared clock and a little noise. Consequently, crests follow contours around the entire island. Every coast receives 58 m spacing, an 8.4-second period, a 360 m approach envelope, and the same 65–145 m breaking range. That produces the repeated-outline appearance visible in the current screenshots.

Depth limits in the Gerstner shader and the landward cliff check affect height and impact foam, but do not determine how the incoming rollers travel or where their energy is lost. `SeaShader.js` also paints a white lip on approaching crests independently of whether local water depth warrants breaking. Its foam has no stored history: it is reconstructed from phase and noise each frame.

`Weather.js` supplies one smoothed `swell` value based on weather at the observer. This helps transitions but cannot distinguish a sheltered bay from an exposed coast, or represent remotely generated swell. The offshore wave directions are built from the initial weather angle.

## Recommended replacement

1. **Start with directional incoming swell.** Use a small number of bands with different periods, directions and phases, retaining wave groups and quieter intervals. Keep long swell and faster wind chop separate. Drive the sea state from offshore weather, with gradual energy changes, rather than the viewer's altitude or shelter.
2. **Bake propagation through the depth field.** Prototype a stationary phase/travel-time and energy field for the dominant swell directions in the world-generation worker. Depth changes should alter crest spacing and direction coherently; island obstruction should reduce energy on the sheltered side. Use wave-height/energy loss to determine breaking. Shore distance remains useful for the final waterline and run-up mask, not for constructing every incoming crest.
3. **Validate bathymetry sensitivity before adding more terrain detail.** First compare a simple sloping beach, submerged bar with a channel, headland and sheltered bay under identical incoming swell. Then extend submerged terrain generation with variable shelf widths, bars, rocky ridges, deeper cuts and delta deposits. Preserve the dry coastline, lake levels and river connections. Keep invisible deep geometry culled.
4. **Make foam the result of breaking.** Whitewater should begin in localized breaking regions, spread behind the front and decay. Evaluate a bounded, low-resolution foam-history map for the nearby coast, with a cheaper distant coverage treatment. It needs measured memory/update costs before adoption. Avoid reinstating the previous large foam/spray systems as a package.
5. **Retain the art direction.** Feed improved motion into the existing mesh, flat triangle shading and reflection material. Keep offshore water primarily readable through slope and reflections. Match large-scale wave behavior to references before tuning small foam detail.

Do not replace the current phase with `k(localDepth) * dot(direction, position)`: independently changing spatial frequency at each point does not create a coherent propagated phase. Likewise, arbitrary per-coast intensity noise can hide repetition without producing shelter or bathymetry dependence. The propagation prototype must demonstrate those behaviors directly.

The wave-field approach is an engineering proposal. A small directional approximation will not reproduce all diffraction, reflections, crossing seas or breaking-wave turbulence. It should be validated before being described as realistic.

## Acceptance views and cost checks

| Fixture | Required visible difference |
| --- | --- |
| Exposed beach with an offshore bar | Breaking concentrated over the bar; broader wash toward shore. |
| Deep channel through that bar | A persistent interruption in the breaking zone under the same swell. |
| Steep rocky headland | More localized impacts, with incoming direction still legible. |
| Bay behind the headland | Reduced incident energy, not a copy of the exposed coast. |

Record fixed-camera motion clips at beach height and mountain height. Track individual crests into the breaking zone; compare normal playback, not only isolated stills. Verify that changing a submerged bar while leaving the shoreline unchanged changes the wave field. Verify that changing incoming direction changes which coast is sheltered.

Measure warm and moving-camera frame times against the retained low-poly renderer on target hardware, including storm weather. Report extra textures, memory, render passes and worker time separately. The previous desktop checks were vsync-limited and cannot establish sufficient performance headroom for another simulation system.
