# Structure atelier

Open [the resonant gate](../../structure-atelier.html?species=resonant-gate&seed=umbra), [listening fold](../../structure-atelier.html?species=listening-fold&seed=umbra) or [horizon frame](../../structure-atelier.html?species=horizon-frame&seed=umbra) through any static server. The existing fauna, vegetation, water and reed study selector now includes **Structures · atelier studies**. Navigation preserves the world seed.

This uses the existing atelier navigation and paper/sage interface, with a dedicated structure scene in the same way that vegetation and water have their own scenes. The three selected families are implemented as early geometry/interaction studies. The user subsequently requested world integration; see [the first world integration](WORLD.md). The atelier remains available for isolated comparison.

## Inspecting and walking

Form provides stone/ceramic materials, night/overcast lighting, four orbit views and a walking view. Drag to orbit and scroll to change distance. A player-height marker compares the silhouette against the game's 11-unit eye height. Gate and fold proportions vary reproducibly with seed and specimen number.

Choose **Walk at player height**, then drag to look and use WASD/arrows or the on-screen direction pad to walk. The ground is flat; separate conservative support bounds leave the central passage open. Movement uses short collision substeps. Experience offers repeatable approach/inside/outside positions. These position buttons move immediately so comparisons do not require a camera animation.

The gate responds to **N**, a held N, the note button or a click on its visible inset. Orbit drag is separate from clicking. The button/N audition in orbit uses a fixed nearby visitor position; walking uses the actual visitor position. All three structures now respond to repeated notes with a surface pulse and bounded voices. A 120 ms duplicate guard replaces the old cooldown. A stronger invitation adds decay; non-player replies cannot retrigger structures.

The listening fold is a larger open pavilion: 100 units wide, 72 deep and 63 high. The horizon frame previews a rough, winding stone trail on a small hillside; the actual world places the same trail on a mountain summit.

## Listening fold and the main music

Choose **Experience → Listen with game music**, then **Step inside** and **Step outside**. This runs the production `AudioEngine`, `Conductor`, scheduler and musical layers in a fixed dry-night fixture, with arpeggio, bells, bass and shimmer unlocked for comparison. The same piece continues through the threshold. It is not a separate replacement soundtrack.

The atelier uses the production conductor's spatial fold mix. Fully inside, the drone multiplier is 165%, arpeggio 12%, bells 20%, shimmer 28%, and pulse 35%. Density is 30% and cutoff 12%; the drone's filter modulation also falls so the darker sound remains clear. The drone reverb send reaches 95%. Music restores continuously on leaving. This is a mix for iteration, not a final master.

The adapter passes shelter into the same conductor path as the game. It does not unlock layers in the game or create a second soundtrack. Status text also makes the spatial change visible with audio off.

No audio starts on page load. Explicit music/note actions unlock it. Volume controls the complete audition; Stop, Pause, hiding/leaving the page and window blur stop the scheduler and close its audio context, including tails. Reduced-motion preference starts the study paused. Resuming animation does not automatically restart sound.

## Scope and next decisions

The scene is a small static landscape, with faceted geometry, shadowed supports, lake and ridge silhouettes, rough materials, tone mapping and restrained bloom. It is not the production terrain, water or atmospheric renderer. These shapes need another visual pass inside the full world before acceptance.

In this standalone atelier, production weather, continent-wide placement, vegetation exclusion, full gamepad movement and arbitrary mesh-ground support are not implemented. The world version now has fold weather shelter and seeded structure placement. The atelier auditions the music and note tail in isolation. Walking bounds are conservative body-height footprints, suitable for these static forms rather than a general building physics system.

Source: `js/atelier/StructureStudy.js` owns geometry outlines, movement bounds, spatial response and music parameters; `StructureAudio.js` adapts the game music; `js/structure-atelier.js` supplies the scene, geometry, input and shared interface. The selected direction is recorded in [DIRECTION.md](DIRECTION.md); the earlier [concept study](exploration-v1/README.md) remains available.

## Verification

Run from the repository root:

```sh
node --test 25_Nowherelands_II/tests/world/StructureStudyTest.js 25_Nowherelands_II/tests/world/VegetationStudyTest.js 25_Nowherelands_II/tests/world/WaterStudyTest.js
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node 25_Nowherelands_II/tests/structure-atelier-smoke.cjs
```

The browser fixture uses a server at `http://127.0.0.1:8793/25_Nowherelands_II/` and the installed Chrome channel by default. `ATELIER_URL`, `ATELIER_OUTPUT` and `BROWSER_CHANNEL` override these. It checks actual keyboard passage, audible production output, fold entry/exit, bounded gate responses, audio stop/pause, stable geometry counts after replacements, material/light/view controls, seed-preserving navigation through the existing studies, direction-pad input, reduced motion and 320/390/850px layout. Screenshots are written to `/tmp/nowherelands-structure-atelier` by default.

Automated output/gain checks verify that the music plays and changes; they do not substitute for a subjective listening pass with the user.

All three share the aging treatment: clipped and beveled edges, dark charcoal mineral detail and a short fracture, with no moss or lichen. Stone uses the production aging material; ceramic keeps the surface plain. See [world integration and aging](WORLD.md).

## Overlapping light responses

Each accepted blip starts a separate travelling band; existing bands continue uninterrupted. The atelier shares the production eight-slot pulse buffer and shader. The old floor ring is removed. The World link now visits the currently selected structure in the same seed, to compare its actual landscape placement.
