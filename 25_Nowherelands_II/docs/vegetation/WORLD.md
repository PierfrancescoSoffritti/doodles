# Vegetation in the world

Open `index.html?plants=bell-reed&seed=ondine-ossia` or `index.html?plants=veil-willow&seed=ondine-ossia`. The field guide includes both plants alongside the fauna. Select a species to enter and visit it, **Visit another patch/willow** to move through distinct sites, and **Explore here** to walk around it. Visits preserve the seed in the URL and keep the selected plant in the streamed set.

Bell reeds grow in compact families along river margins and lake shores: a mature or weathered adult with two or three individually rooted companions, including smaller young plants. Companion scales range from 43–82% of the adult, with the young form shorter again, within 3.5–7.5 world units. Complete patches stream together. Willows stand farther up sheltered damp banks, with ribbons, sprays and veils. Roots use detailed terrain heights; placement rejects submerged ground, steep slopes, foamy water and cave openings. Willow trunks have collision. Existing terrain vegetation remains, so density and overlap with that vegetation are still useful things to tune in this first world pass.

Reed stems have one external hook: the internal bulb support begins beneath the crown. Bulbs have a soft white resting glow like a dim miniature lamp, warming to gold and brightening during interaction. **N**, a held N, or a world click sends the player's existing note; reeds within the full visible blip radius answer with their original staggered sound-and-light phrase. Each new note restarts the phrase, replacing unfinished replies without delaying an imminent answer. There is no musical recovery lockout or blanket flash. Replies use the current world scale, spatial panning and shared mixer, with six plant bell voices; when full, an older tail fades out over 30 ms so the new reply still sounds. Plant replies cannot start another response. Walking close bends reeds away from the actual player. Both species follow world wind; surface plants sleep while underground.

About one in five willows carries two mirror pendants. Aim at a pendant to enlarge the reticle and light its rim, then click to swing it and play the same `Conductor.mirrorTouch` sound and ripple as a standing mirror. Stable, slightly enlarged pick volumes follow the moving pendants; each click is accepted. While the field guide is open, the reticle follows the mouse over the world and target clicks work without entering mouse-look. Normal play still uses center-screen gaze, and touch keeps its existing gesture controls. Pendants and existing mirror landmarks share a global limit of two active planar reflections. This pass adds willow pendants; it does not yet migrate the original standing mirror encounters or their discovery progression.

World rigs are streamed within 360 units, with up to three complete reed patches and three willows (two/two on mobile detail). A material batch combines articulated parts into persistent buffers: ordinary willows take two draws instead of dozens. Distant animations update at 10 Hz; nearby plants and active replies animate each frame. Plants grow in over a short fade and shrink over the outer 60 units. Retiring specimens release source geometry, batch buffers, materials, reflectors and colliders. There are no per-bulb point lights.

Implementation: `PlantHabitats.js`, `WorldPlants.js`, `PlantMeshBatch.js`, `PlantSurvey.js`; shared forms remain in the atelier model/mesh modules.

Verification:

```sh
node --test tests/world/WorldPlantsTest.js tests/world/VegetationMeshesTest.js tests/world/VegetationStudyTest.js tests/world/PlayerNoteTest.js tests/audio/VegetationAudioTest.js tests/audio/AudioLifetimeTest.js
```

World regressions cover deterministic habitat placement and forms, terrain rejection, spacing, streamed caps, finite batched geometry (including zero-delta startup), collider cleanup, nearby player-note filtering, bounded retriggerable phrases, synchronized sound and light, voice replacement, full note reach, companion heights, stable pendant picking, matching mirror sound and real-player brushing. Browser checks cover both species, repeat visits and player-note replies in the full game.

Willow pendant clicks add a bounded impulse to a damped swing, preserving its current pose even on fast repeats. The existing mirror chime stays at the pendant; ground rings originate at the tree root. The clicked pendant uses the fauna silhouette echo pass. Repeated clicks let the current outline travel finish before a fresh echo begins, and streamed removal releases its mask resources.
