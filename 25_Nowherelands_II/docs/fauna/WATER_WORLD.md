# Scarlet fish and light lilies in the world

Open **Scarlet fish** or **Light lilies** in the field guide, then visit another habitat to compare communities. **Explore here** returns to ordinary movement. Direct links accept `?seed=umbra&fauna=scarlet-fish` or `?seed=umbra&plants=light-lily`.

## Revision after the first world pass

Remote changes through `397d644` were pulled, including the new bell-reed tap, hold, light, movement and musical-reply behavior. Local aquatic work was restored and merged without replacing those changes.

The initial fish were confined to small circles, had too little variation and were incorrectly attenuated through the depth of the lake bed. The new population has larger cruising ranges, individual excursions, changing spacing and gentle separation. The water now snapshots opaque depth with the existing color snapshot and reconstructs the actual immersion of visible fish. A fish one metre beneath a deep lake's surface is no longer shaded as though it were on the lake bed. This adds a depth-buffer copy, not an additional scene render. Color/depth targets resize with the renderer; the water retains its fallback when no depth texture is available.

## Communities and habitat

`WaterHabitats.js` plans world-stable communities from real lake margins and calm river reaches, with no altitude cutoff: mountain lakes are eligible too. Fish require a completely wet disk at least **27 world units across**, including body clearance, and at least 2.6 units deep across that footprint. Dry banks, narrow channels, small pools, foam, fast current and cave openings reject a site. Candidate disks are checked on a grid and around their perimeter. Several suitable areas of a lake can host different groups, with gaps between them.

Groups have 1, 2, 4, 6, 9 or 13 members; larger schools require larger swimming areas. A community can have two separate groups. Routes span radii of 10–22 world units. Cruise pace, orientation and aspect vary; individuals have their own changing offsets and lanes. Local separation keeps adult fish from stacking into one silhouette. Fish range from 0.75–2.1 in scale, with slender and rounder bodies, red/coral/rose/orange pigments and optional pale caps, bands or stripes. They remain below the surface. A nearby player blip makes them turn into a curved escape, usually travelling 35–50 units through open water, then slow down and loop back into their original cruising route. Escape paths can leave the school’s home disk. Both outward and return curves are checked against cached terrain clearance, with shorter or angled routes near banks. The launch takes roughly 40% less time than the first curved escape, with faster animated turning and visible movement in the first 200 ms; the relaxed return keeps its original timing. Heading changes are animated; repeated blips start from current positions and headings. Terrain checks happen on the blip, not each frame. Ordinary proximity does not disturb them.

Lily patches contain up to six plants, including large adults (5–7.5 in scale), intermediate plants and small companions (1.8–3). Five flower/leaf palettes combine cream, pink, lilac, apricot or mint flowers with different greens, teal and blue-green leaves. Leaf aspect, count, flower width and petal length vary independently. Rounded, pointed and ruffled petals use per-instance shape parameters with the same geometry and draw budget. Flower height varies independently: shallow saucers, medium cups and taller upright blooms closer to the original form. The height range is roughly threefold, with a continuous opaque bowl in every form; the luminous core lies entirely below its rim. Reply emission is reduced by roughly 18%, while the visible opening and nod remain. Actual leaf footprints are checked against the water; cups rest on its surface, cores sit inside the petals, and there are no submerged stems. Existing small riparian pads remain as background vegetation.

## Player interaction

Aim at a flower and tap/click, or play **N** nearby. The aimed flower leads within 45 ms, opening and flexing its petals, lighting its heart and sounding a short chime. Small flowers answer higher and settle sooner. Further answers vary across the patch instead of always ranking by distance. Rapid taps retrigger, keeping an already travelling phrase within an eight-event bound. Hold to charge: every eligible flower answers with a shared onset. Sound voices are bounded to six and use the existing player-note/plant-reply path, with no reply feedback loop. Fish startle from player blips only, including notes emitted by tapping a lily; plant replies do not trigger them. They have no click targets.

## Rendering and streaming

`WorldWaterLife.js` streams up to four communities within 180 world units, or two on mobile. Each community uses at most four draws: one fish batch and three lily batches (leaves, petals/cups, cores). Fish remain **118 triangles per individual**, with shared geometry/material and GPU fin animation; palette and marking variation add no draws. Lily transforms remain static and their surface motion and response deformation run in the vertex shader. Glow/nod instance attributes update during replies.

Distance fades retain world size and height. Stream-out disposes owned geometry, materials and instance buffers; hidden surface populations suspend work in caves. There are no per-fish or per-lily shadow passes, point lights, textures or reflection render targets. The environment probe excludes these animated inhabitants. Lilies are excluded from the sea-level planar mirror: reflecting an inland flower across that lower plane creates a detached duplicate beneath the lake. Sky and landscape reflections remain. Exclusion registrations are released on stream-out. These are structural budgets, not whole-game FPS claims.

## Validation

```sh
node --test 25_Nowherelands_II/tests/world/WaterHabitatsTest.js 25_Nowherelands_II/tests/world/WorldWaterLifeTest.js 25_Nowherelands_II/tests/world/WaterOpticsTest.js 25_Nowherelands_II/tests/world/WaterMeshesTest.js 25_Nowherelands_II/tests/world/WaterStudyTest.js
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node 25_Nowherelands_II/tests/water-world-smoke.cjs
WATER_MOBILE=1 WATER_OUTPUT=/tmp/water-mobile PLAYWRIGHT_MODULE=/absolute/path/to/playwright node 25_Nowherelands_II/tests/water-world-smoke.cjs
```

Tests cover high-altitude eligibility, small/narrow-pool rejection, substantial travel, palettes and size variation, bounds, blip escape/recovery/retriggering, side-view core occlusion, tap/hold replies, audio limits, scene-depth reconstruction, streaming and disposal. Browser checks run the generated world, inspect real mouse/touch tap-and-hold targets, note audio, shader compilation, copied depth, field-guide travel and terrain clearance across all planned fish habitats. `WATER_URL` selects another world/seed; screenshots default to `/tmp/nowherelands-water-world`.
