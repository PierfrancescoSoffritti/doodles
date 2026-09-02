# Nowherelands II

A procedural night landscape that sings back. Walk an endless synthwave terrain, find the landmarks, and the music grows with what you discover.

Open `index.html` through any static server (ES modules need `http://`). A seed can be pinned with `?seed=word`; the link in the corner shares the current world.

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

Stand still for a while and a sprout grows where you rest. Walk into a lake and you wade.

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
js/world       analytic heightmap, streamed terrain chunks + shader, reflective water,
               sky (dome, moon, stars, aurora, meteors), snow, vegetation, fireflies, sprouts, ripples
js/landmarks   sequencer spiral, octahedrons, time monolith, mirrors, wanderer, interaction + discovery
js/player      pointer lock / touch / gamepad controls, head bob, collisions, footsteps
js/fx          bloom, grain, vignette, chromatic aberration
js/ui          intro, crosshair, toasts, seed link
js/events      rare event director
```

A rebuild of the 2017 Nowherelands doodle, which lives on untouched in `13_Nowherelands`. three.js 0.185 is vendored in `../common/libs/three-0.185` and resolved through the import map in `index.html`.
