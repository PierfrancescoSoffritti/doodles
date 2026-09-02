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
4. Drainage area traces the rivers. Each river grades its own bed to a concave profile (the maximum gradient falls with catchment), cutting a gorge where the land drops too fast and taking the height in a waterfall once a gorge would grow too deep. The water surface is quantised into pools and drops of varying height, riffles spaced by channel width, widths that swell in the pools and pinch at the lips, and gentle reaches meander with a wavelength of about eleven widths.
5. You spawn on a lowland shore near the largest river's mouth, facing upstream toward the mountains.

The baked height grid is sampled bicubically with procedural close-up relief; river channels are carved analytically from the polylines so streams stay crisp at any distance. The terrain renderer is a quadtree with skirts: 3 m cells underfoot, 300 m cells on the horizon, the entire continent always in view under a height fog that pools in the valleys. The sea is a reflective plane; lakes and rivers are their own meshes with per-vertex level, flow direction and white water; every drop is a vertical face, a foaming lip for a riffle or a streaked curtain for a waterfall, with mist rising from the plunge pool. Boulders sit on scree, at cliff feet, on hard-rock outcrops, across every riffle lip and in the shallows, with driftwood stranded on the banks.

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
