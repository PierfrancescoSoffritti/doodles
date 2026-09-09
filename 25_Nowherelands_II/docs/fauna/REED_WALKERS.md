# Reed walkers — the old river grazer

Character direction agreed in discussion: peaceful but inscrutable, like a very old elephant. Slow movement, little interest in surrounding commotion, grazing the river. Its apparent watchfulness comes from long feeding pauses, not vigilance or territorial patrols.

## This first study

Open `../../reed-study.html` through the local server. The atelier remains available for close inspection. The approved animals now also live in the game, managed by WorldReedWalkers alongside Lumens, Pebbles and birds.

The unresolved visual question is how a headless animal reaches its food. This candidate lowers its entire body between four bent legs until a small underside feeding pad reaches the water. All four feet remain planted and both segments of every leg keep their lengths. The loop spends ten seconds lowering, fourteen feeding, twelve rising and two resting, with individual pacing variation. A slider lets you compare any point in the posture. Front and side views reveal the leg fold and body clearance. Rest returns to the original stance; One slow stride shows a separate eight-second weight-transfer study with one foot airborne at a time.

Watch especially for the lowered stance becoming too insect-like, the body feeling too small or light, and the joints spreading too far. If those conflict with the old-elephant character, try a shorter-legged, heavier-bodied alternative or a small underside feeding extension before accepting this anatomy. The current visual design was approved for game integration.

## Form and individuality

Four slender articulated legs support a worn, headless seed-husk body with a shallow dorsal seam. The face is now part of the body material: two rounded, drooping eye openings with muted irises under heavy upper lids. The facial mouth/vent mark is removed. The entire eye is shaded directly on the husk; there are no separate eyeballs, eyelids, rims or iris meshes. Object-space shading follows the breathing surface exactly; slow blinks narrow the creases. Face view isolates one family member for inspection.

Adult males have broader, flatter husks and cool gray-green or stone colors. Females have a higher arched back and warmer moss, clay or sand tones. Each habitat retains its palette. Youngsters have smaller, rounder husks on proportionally lankier legs, paler colors, and a small seeded size difference. Age and wear vary independently between the parents.

Males grow a pair of tapered tusks that emerge from inside the forward body surface. Seeded shape families include long sweeps, upright curves, wide arcs, and short, worn tusks. Length, thickness, spread and upward curvature vary continuously within each shape. The two sides differ slightly, with stronger asymmetry in older animals; short, worn adult tusks have sealed blunt tips. Young males have substantially shorter, slimmer versions of these shapes, with milder asymmetry and fresh tips; females have none. Tusks follow body tilt and breathing. The first youngster is a son in this study; a second youngster may be a son or daughter according to the family seed.

The underside feeding pad still reaches the water through whole-body lowering. Resting includes breathing and a slow forward/back rock with all feet planted. Adults complete a .85-unit stride; youngsters take shorter .65-unit steps at a quicker individual pace. Males have slightly heavier rocking and females a gentler pitch amplitude. Resting pitch remains around seven degrees and walking pitch around 2.6 degrees, scaled by individual profile. The rig solves each leg against the body’s motion while preserving support contacts.

Three candidate habitat forms compare silhouette and palette: a tall dark reedbed grazer, a broad peat grazer, and a pale lean lake-margin grazer. Young, adult and old specimens differ in size, wear and voice; seeded variation changes proportions and pacing. These are design comparisons, not established biological subspecies. The first priority remains one convincing shared character.

## Family study

The preview opens on two parents and one or two youngsters. Family size is repeatable by seed, and the Youngsters control lets us compare either size directly. Both parents may be adult or old; sex and age are independent traits. These are individual differences, not fixed male/female body rules. All members share a habitat form but have repeatable, distinct proportions, sex palettes, wear and voices. Each family gets a repeatable random arrangement, with no side assigned to adults or youngsters. Another family changes both positions and individuals; habitat comparisons preserve the arrangement. They stand at least 5.5 units apart, with the smaller youngsters near both parents. The river patch is wider to give every animal space and keep all feeding pads in the water. Resting rhythms differ and movement starts are staggered. Feeding ripples follow each animal. Inspect & hear selects the family member for close-ups and voice auditions; One individual preserves the original age comparison.

This establishes the social character and visual grouping. The game preserves each family as a group. Members graze, rest and take slow, terrain-checked steps within their familiar patch; nearby players influence the next gentle turn without interrupting feeding. Long-distance migration and explicit call-and-answer exchanges remain future work.

## Sounds

Three opt-in synthesized sketches: a soft low rumble, a prolonged airy exhalation, and a wet feeding breath. Pitch follows individual body size, sex and habitat form. Males have a deeper resonance; youngsters have higher, shorter calls. Short feeding calls have additional gain to preserve presence in the game mix. All Reed voices now receive a further +4 dB after their overlap compressor and before the game master; the background listening level is unchanged. Upper harmonics retain presence above the low drone, and a short sustained envelope keeps the sound audible after its onset.

`ReedWalkerAudio` supplies reusable game routing: per-event levels, HRTF distance attenuation, a three-voice cap, overlap compression, and a peak guard after the game compressor. The guard is installed once on an engine hosting Reed walkers; ordinary samples remain linear, while coincident high peaks are softened before the analyser/output. Its bus feeds the production master outside ambient ducking. Accepted calls within 55 units briefly dip the ambient bus; muted, out-of-range or rejected calls do not. A stronger existing player-sound dip is preserved. The animal fades over distance rather than becoming equally loud everywhere.

The Voice tab now compares creature-only, river, and busy music/rain/water settings at 20, 45 and 90 units. It uses `AudioEngine`, every `Conductor` layer constructor, real `WatersideAmbience` voices and fixed phrases using the production tone/bell recipes. Background alone and Stop listening allow direct comparisons. Listening level changes the whole audition, preserving the relative mix.

This remains a repeatable listening fixture, not a full live-world encounter. The game schedules spatial calls, breath and feeding sounds through the same production mixer. Numerical masking margins are screening checks, not a guarantee of subjective audibility on every speaker or against every transient (such as thunder).

## Habitat and behavior proposals

Shallow slow rivers, backwaters and vegetated banks provide submerged growth and stable footing. Avoid rapids, surf, deep crossings and exposed ridges. Familiar grazing routes should make recurring individuals recognizable. Lives in small family units: a father, mother and one or two youngsters. The bonded adults share familiar feeding routes, with their youngsters remaining nearby. Each grazes and rests at its own pace; the youngsters follow a little later when they move. Quiet contact rumbles and comfortable proximity suggest their bond. No alarm chorus or active surveillance.

A later encounter should allow the player to remain near it without interrupting its routine. It can gradually route around a person; a touch might earn a slow weight shift or rumble. Game movement checks all supporting feet and the swept step against the terrain. Feeding is visual and audible; it does not deplete a simulated food resource.

## Validation

`node --test 25_Nowherelands_II/tests/world/ReedWalkerStudyTest.js` checks seeded identity, age/voice relationships, bone lengths and fixed contacts through the full lowering range across 360 specimens of both sexes, loop continuity and the four-step sequence. The Voice tab runs 41 mix cases, including all three forms and sounds for older males at 20 and 45 units, plus female and young male/female feeding calls in every habitat, distance falloff, mute, startup, overlapping calls and player ducking. Identical seeded stereo renders measure the foreground and background separately before compression; the complete mix is independently checked after the production compressor. The targets are at least +3 dB foreground/background during the main call at 20 units, at least 0 dB at 45 units, and output peaks below −0.45 dBFS. Visual browser inspection is required for the actual mesh, controls, and water contact.

Validation for the pace/idle/mix revision: five motion/identity tests and all 23 browser mix cases passed. The busy-background comparison measured +3.5 to +6.0 dB at 20 units and +0.4 to +2.8 dB at 45 units during the main call window. The distant reference faded to −6.8 dB at 90 units. Mixed peaks remained at or below approximately −0.9 dBFS, including three overlapping animals. These are measurements of the fixture and capture window described above, not universal perceptual audibility guarantees.


Validation for the integrated-face/tusk/family revision: seven motion and trait checks passed, including both sexes through the full lowering range and family layouts with one or two youngsters. All 41 browser audio checks passed after tuning the deeper breath and shorter young feeding calls. The lowest nearby fixture margin was +3.08 dB, and the largest output sample was .905 (about −0.87 dBFS). The eyes are body-material shading rather than additional meshes; browser inspection covered male/female and young forms, tusk attachment, and habitat changes. Family grouping remains a study scene, not world spawning or pathfinding.

Validation for randomized placement, louder voices and the tired-eye revision: eight motion/trait/layout checks pass. Across 100 seeds of each family size, every role appears in all four sides/quadrants, while layouts remain deterministic. All 41 audio cases pass after the +4 dB change; the lowest nearby margin is +7.08 dB and the peak sample is .906 (about −0.86 dBFS). The visible face has no mouth mark; the underside feeding anatomy remains functional.


Tusk variation validation: nine motion/trait/layout tests pass. The new check samples 300 individuals across all habitats for stable identity, distinct shapes, bounded curves and smaller juvenile pairs. All four adult silhouettes were inspected in the browser. The Face view steps back for longer tusks so the tips remain visible.


## Game integration

`WorldReedWalkers` streams up to two families around the player and releases distant rigs and geometry. Candidates come from real rivers and lake margins. Families are separated by at least 420 world units, including when using the field guide. A whole family must fit dry bank terrain beside fresh water with no cave roof, strong foam or blocking collider; invalid sites are skipped. Ordinary adults return to roughly the original 5–6-unit height (world multiplier 1.0). About 2.5% of adult identities have a 1.7–2× exceptional size; youngsters never receive that multiplier. The approved family count, randomized arrangement, sex/age colors, eyes and tusks are reused directly.

Each support pad uses sampled bank height and must remain above the waterline. Four-foot stepping interpolates individual contacts, keeps supporting feet fixed, and permits small turns. The full movement is checked before committing to a step. The world step cycle is 2.5 seconds before individual pace variation, with longer strides and short pauses between steps. Grazing lasts 22 seconds and follows six steps. Every member stays near its familiar patch and emits spatial sounds. The body lowers to bank vegetation when feeding; dry grazing does not create water ripples. Underground streaming hides the surface population and suppresses its sounds.

Open `../../?seed=umbra&reeds=1` for the in-world family guide. Find a family and Visit another family visit validated habitat rather than placing an animal at an arbitrary camera position.

World validation: terrain-contact unit tests cover 200 seconds of grazing/rest/turning/walking, family population limits and invalid habitats. `node 25_Nowherelands_II/tests/reed-world-audit.mjs` validates twenty minutes of movement in generated umbra and vesper terrain. Live browser inspection confirmed families in the full game with no runtime errors.

World movement regression: the body origin now follows the riverbed through each
stride, preventing accumulated overextension while wandering downhill. Habitat
checks cover the entire resting and feeding cycle with a small reach reserve.
The generated-terrain audit runs twenty minutes in each of two seeds, including
the full-resolution umbra family that exposed the downhill resting failure.
