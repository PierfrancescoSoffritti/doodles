# Nowherelands II

A procedural night landscape that sings back. Walk a 16 km continent of mountain ranges, river valleys, lakes and sea cliffs, find the landmarks, and the music grows with what you discover.

Open `index.html` through any static server (ES modules need `http://`). A seed can be pinned with `?seed=word`; the link in the corner shares the current world. Each seed bakes its own continent in a worker while the intro shows, five to eight seconds on a laptop.

## Controls

| input | action |
| --- | --- |
| W A S D / arrows, Shift | walk, sprint |
| mouse | look (pointer lock) |
| click | touch a thing: cycle a monolith's note, ring a stone, flip time |
| hold click | charge a strike: louder, brighter, bigger ripple |
| R | record the session's audio to a `.webm` |
| gamepad | left stick move, right stick look, A / RT touch |
| touch | left half joystick, right half look, tap to touch |

Stand still for a while and a sprout grows where you rest. Walk into a lake or a river and you wade.

## The land

The world is not noise: it is a landscape evolution model run at load time (`js/world/gen/WorldGen.js`, in a Web Worker).

1. A warped island mask gives coast and coastal plain; two or three tectonic spines give uplift.
2. Stream-power erosion (Braun & Willett ordering, implicit solve) cuts drainage networks into the uplifted ranges, with hillslope diffusion and talus. Hard rock erodes slowly, so it leaves cliffs, gorges and stepped strata; soft rock gives beaches and rounded hills. A coarse pass shapes the ranges, an upsampled fine pass carves the small valleys.
3. Depression filling finds the lakes, from lowland lake districts to cirque tarns high in the ranges.
4. Drainage area traces the rivers, and each one is shaped in turn (`js/world/gen/Rivers.js`). The water follows the land: its grade is the land's grade, capped only for big rivers, so lowland streams sit half a metre below their meadows and can be walked into. A gorge is cut only where the land drops faster than the river can, never deeper than the local relief allows, and past that the river runs as a chute on the canyon floor. Waterfalls happen only where the land itself has a cliff; nothing is stamped into a smooth slope to make one. Moderately steep reaches pool and step (step-pool cascades with a bar of stones at every lip), steep reaches slide as white water, gentle reaches simply slope. Widths swell in the pools and pinch in the rapids, and a river bends because something hard is in the way: the path is pushed off hard rock and outcrops, and the outcrop that turned it is left standing on the outer bank. The valley is stamped as a wide flat floodplain in the lowlands and a narrow bench with steep walls in the mountains.
5. You spawn on a lowland shore near the largest river's mouth, facing upstream toward the mountains.

The baked height grid is sampled bicubically with procedural close-up relief; river channels, banks and waterfall faces are carved analytically from the river data so streams stay crisp at any distance. The terrain renderer is a quadtree with skirts: 3 m cells underfoot (1.7 m where a river runs), 300 m cells on the horizon, the entire continent always in view under a height fog that pools in the valleys. The sea is a reflective plane; lakes and rivers are their own meshes. River vertices carry their position in river space (metres along and across the channel), foam, speed and the nearest rocks that break the surface, so the shader draws flat-toned water with flow streaks, hard-edged white water below every drop, foam wakes behind the rocks, drifting flecks and short steep riffle ramps. Waterfalls are solid: an opaque sheet with a rounded brow that hugs the rock face and closes onto it at the sides, shaded in three tones that stretch and whiten on the way down, over a plunge disc of foam rings, thrown spray and a slow mist; riffle steps throw splashes of their own. Boulders sit on scree, at cliff feet, on hard-rock outcrops, across every riffle lip, in the chutes and pools and on the outer banks of bends, with driftwood stranded on the calm banks.

## What reacts to what

- **World to music.** Altitude opens the filter, walking speed raises note density, stillness thins everything back to the drone. Snow adds wind and shimmer. The moon's height picks the mode at each key change: lydian high, aeolian low.
- **Music to world.** Note attacks pulse the grid, grass tips and sprouts; bass feeds the lines and the water grid; highs twinkle stars and the aurora. Every spatial note rings a ripple on the ground from where it sounded.
- **Discovery.** Each landmark permanently adds a layer: the spiral unlocks the arpeggio, the hollow stones the bells, the still clock the sub bass, the wanderer the shimmer, the mirrors lengthen the reverb.
- **Events.** Snow, aurora, meteor showers, an eclipse that drops the drone an octave, and the hum.

## Layout

```
js/core        seed, PRNG + simplex noise, event bus
js/audio       engine (voices, reverb, delay, analyser, recorder), scale/modes,
               lookahead scheduler, layers (drone, arpeggio, bells, bass, wind, shimmer), conductor
js/world/gen   world generation: uplift, erosion, lakes, rivers, spawn (runs in a worker)
js/world       heightmap sampling, quadtree terrain + shader, height fog, sea / lakes / rivers,
               sky (dome, moon, stars, aurora, meteors), snow, vegetation + boulders, fireflies, sprouts, ripples
js/landmarks   sequencer spiral, octahedrons, time monolith, mirrors, wanderer, interaction + discovery
js/player      pointer lock / touch / gamepad controls, head bob, collisions, footsteps
js/fx          bloom, grain, vignette, chromatic aberration
js/ui          intro, crosshair, toasts, seed link
js/events      rare event director
```

A rebuild of the 2017 Nowherelands doodle, which lives on untouched in `13_Nowherelands`. three.js 0.185 is vendored in `../common/libs/three-0.185` and resolved through the import map in `index.html`.
