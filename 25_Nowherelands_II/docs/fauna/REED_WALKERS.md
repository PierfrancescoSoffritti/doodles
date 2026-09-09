# Reed walkers — the old river grazer

Character direction agreed in discussion: peaceful but inscrutable, like a very old elephant. Slow movement, little interest in surrounding commotion, grazing the river. Its apparent watchfulness comes from long feeding pauses, not vigilance or territorial patrols.

## This first study

Open `../../reed-study.html` through the local server. The atelier remains available for close inspection. The approved animals now also live in the game, managed by WorldReedWalkers alongside Lumens, Pebbles and birds.

The unresolved visual question is how a headless animal reaches its food. This candidate lowers its entire body between four bent legs until a small underside feeding pad reaches the water. All four feet remain planted and both segments of every leg keep their lengths. The loop spends 2.5 seconds lowering, four feeding, 3.5 rising and two resting (12 seconds total), with individual pacing variation. A slider lets you compare any point in the posture. Front and side views reveal the leg fold and body clearance. Rest returns to the original stance; One slow stride shows a separate eight-second weight-transfer study with one foot airborne at a time.

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

Two opt-in synthesized voices: a soft low rumble and a prolonged airy exhalation. The “A mouthful of river” feeding sound has been removed from both the atelier and game. Pitch follows individual body size, sex and habitat form. Males have a deeper resonance; youngsters have higher, shorter calls. All Reed voices receive +1 dB after their overlap compressor (reduced by 3 dB from the previous mix) and before the game master; the background listening level is unchanged. Upper harmonics retain presence above the low drone, and a short sustained envelope keeps the sound audible after its onset.

`ReedWalkerAudio` supplies reusable game routing: per-event levels, HRTF distance attenuation, a three-voice cap, overlap compression, and a peak guard after the game compressor. The guard is installed once on an engine hosting Reed walkers; ordinary samples remain linear, while coincident high peaks are softened before the analyser/output. Its bus feeds the production master outside ambient ducking. Accepted calls within 55 units briefly dip the ambient bus; muted, out-of-range or rejected calls do not. A stronger existing player-sound dip is preserved. The animal fades over distance rather than becoming equally loud everywhere.

The Voice tab now compares creature-only, river, and busy music/rain/water settings at 20, 45 and 90 units. It uses `AudioEngine`, every `Conductor` layer constructor, real `WatersideAmbience` voices and fixed phrases using the production tone/bell recipes. Background alone and Stop listening allow direct comparisons. Listening level changes the whole audition, preserving the relative mix.

This remains a repeatable listening fixture, not a full live-world encounter. The game schedules spatial rumbles and breaths through the same production mixer. Numerical masking margins are screening checks, not a guarantee of subjective audibility on every speaker or against every transient (such as thunder).

## Habitat and behavior proposals

Shallow slow rivers, backwaters and vegetated banks provide submerged growth and stable footing. Avoid rapids, surf, deep crossings and exposed ridges. Familiar grazing routes should make recurring individuals recognizable. Lives in small family units: a father, mother and one or two youngsters. The bonded adults share familiar feeding routes, with their youngsters remaining nearby. Each grazes and rests at its own pace; the youngsters follow a little later when they move. Quiet contact rumbles and comfortable proximity suggest their bond. No alarm chorus or active surveillance.

A later encounter should allow the player to remain near it without interrupting its routine. It can gradually route around a person; a touch might earn a slow weight shift or rumble. Game movement checks all supporting feet and the swept step against the terrain. Feeding is visual; it does not deplete a simulated food resource.

## Validation

`node --test 25_Nowherelands_II/tests/world/ReedWalkerStudyTest.js` checks seeded identity, age/voice relationships, bone lengths and fixed contacts through the full lowering range across 360 specimens of both sexes, loop continuity and the four-step sequence. The Voice tab runs 35 mix cases, including all three forms and both sounds for older males at 20 and 45 units, plus female and young male/female breaths in every habitat, distance falloff, mute, startup, overlapping calls and player ducking. Identical seeded stereo renders measure the foreground and background separately before compression; the complete mix is independently checked after the production compressor. The targets are at least +3 dB foreground/background during the main call at 20 units, at least 0 dB at 45 units, and output peaks below −0.45 dBFS. Visual browser inspection is required for the actual mesh, controls, and water contact.

Validation for the pace/idle/mix revision: five motion/identity tests and all 23 browser mix cases passed. The busy-background comparison measured +3.5 to +6.0 dB at 20 units and +0.4 to +2.8 dB at 45 units during the main call window. The distant reference faded to −6.8 dB at 90 units. Mixed peaks remained at or below approximately −0.9 dBFS, including three overlapping animals. These are measurements of the fixture and capture window described above, not universal perceptual audibility guarantees.


Validation for the integrated-face/tusk/family revision: seven motion and trait checks passed, including both sexes through the full lowering range and family layouts with one or two youngsters. All 41 browser audio checks passed after tuning the deeper breath and shorter young feeding calls. The lowest nearby fixture margin was +3.08 dB, and the largest output sample was .905 (about −0.87 dBFS). The eyes are body-material shading rather than additional meshes; browser inspection covered male/female and young forms, tusk attachment, and habitat changes. Family grouping remains a study scene, not world spawning or pathfinding.

Validation for randomized placement, louder voices and the tired-eye revision: eight motion/trait/layout checks pass. Across 100 seeds of each family size, every role appears in all four sides/quadrants, while layouts remain deterministic. All 41 audio cases pass after the +4 dB change; the lowest nearby margin is +7.08 dB and the peak sample is .906 (about −0.86 dBFS). The visible face has no mouth mark; the underside feeding anatomy remains functional.


Tusk variation validation: nine motion/trait/layout tests pass. The new check samples 300 individuals across all habitats for stable identity, distinct shapes, bounded curves and smaller juvenile pairs. All four adult silhouettes were inspected in the browser. The Face view steps back for longer tusks so the tips remain visible.


## Game integration

`WorldReedWalkers` streams up to two families around the player and releases distant rigs and geometry. Candidates come from real rivers and lake margins. Families are separated by at least 420 world units, including when using the field guide. A whole family must fit very shallow fresh water along the shoreline (0.04–0.75 units deep beneath each body) with no cave roof, strong foam or blocking collider; invalid sites are skipped. Ordinary adults return to roughly the original 5–6-unit height (world multiplier 1.0). About 2.5% of adult identities have a 1.7–2× exceptional size; youngsters never receive that multiplier. The approved family count, randomized arrangement, sex/age colors, eyes and tusks are reused directly.

Each support pad uses sampled riverbed height. Feet can straddle the shoreline, from slightly dry ground to water at most 1.1 units deep; candidate footprints and walking paths retain an additional 0.08-unit safety margin. The body must remain over shallow water. Four-foot stepping interpolates individual contacts, keeps supporting feet fixed, and permits small turns. The full movement is checked before committing to a step. The world step cycle is 2.5 seconds before individual pace variation, with longer strides and short pauses between steps. Grazing lasts 12 seconds and follows six steps. Every member stays near its familiar patch and emits spatial sounds. The body lowers to the water when feeding and creates ripples at the feeding pad. Underground streaming hides the surface population and suppresses its sounds.

Open `../../?seed=umbra&reeds=1` for the in-world family guide. Find a family and Visit another family visit validated habitat rather than placing an animal at an arbitrary camera position.

World validation: terrain-contact unit tests cover 200 seconds of grazing/rest/turning/walking, family population limits and invalid habitats. `node 25_Nowherelands_II/tests/reed-world-audit.mjs` validates twenty minutes of movement in generated umbra and vesper terrain. Live browser inspection confirmed families in the full game with no runtime errors.

World movement regression: the body origin now follows the riverbed through each
stride, preventing accumulated overextension while wandering downhill. Habitat
checks cover the entire resting and feeding cycle with a small reach reserve.
The generated-terrain audit runs twenty minutes in each of two seeds, including
the full-resolution umbra family that exposed the downhill resting failure.

Shallow-edge and voice revision: all 16 study/world tests and both twenty-minute generated-terrain audits pass. All 35 remaining browser audio cases pass, with the lowest nearby margin +7.63 dB at 20 units and +4.21 dB at 45 units. Rounded eye openings have drooping outer corners and lower-contrast pupils, shaded into the body without separate components. World family identity now receives the selected world seed at construction.


## Family moments

Youngsters occasionally linger for nine seconds, shifting their weight toward the water while the adults continue. They then take steps at 1.6 times their usual cadence to close the gap with a parent. Once nearby, they settle back into the family rhythm. Following updates the youngster's familiar patch instead of pulling it back to the place it left.

During a quiet pause, a youngster can approach either flank of a resting parent and lean against its side/leg for twelve seconds. A sideways body tilt and planted weight shift carry the gesture; the parent subtly lowers and shifts toward it. Each interaction eases in and out. Grazing and airborne steps are not interrupted. Only one pair interacts per family, with thirty to fifty-five seconds between moments. Blocked approaches time out; the family never teleports or crosses unsafe water to complete a gesture. Paths retain a 0.03-unit body-depth margin in addition to the existing foot-depth reserve.

The atelier's **04 Traits** tab includes **A distracted youngster** and **A quiet lean**. These isolate mother and son on the diorama, with the same controller, terrain planner, and poses used by the game. Replay either button, pause at any point, or return to Rest/Graze/One slow stride for the normal randomized family study. The world can select either youngster and either parent.

Behavior validation: 72 staged encounters across the three forms and twelve family seeds check completed interactions, actual approach distance, fixed resting contacts, continuous movement, and reachable legs. A blocked-approach case verifies a safe timeout and that a grazing parent is not interrupted. A fifteen-minute autonomous family test exercises both behaviors without preview triggers. The twenty-minute umbra and vesper movement audits pass with the new behavior and sideways hip transform.

The quieter +1 dB voice bus (3 dB below the previous version) passes all 35 mix checks, with minimum margins of +4.63 dB nearby and +1.21 dB across the bank. Family behavior does not add new sounds.


## Visibility on dark riverbanks

The rig now shares a low-light shading treatment between the game and atelier. A minimum diffuse fill follows upward-facing facets, with a small edge lift; thin legs receive a stronger fill than the husk. It uses the final shaded surface color, preserving the integrated eyes, family palettes, and darker undersides. The previous flat emissive addition in the world renderer is removed. Normal lighting still takes over when it is brighter than this minimum.

In Form, choose **Light → Dark riverbank · game visibility** to inspect the silhouettes under dim purple ambient light and red directional light at the game's exposure. **Compare without the visibility lift** switches to the earlier flat fill in that preset. This is a lighting comparison; the real game retains its own vegetation, weather, bloom and fog. The normal daylight and moonlight views remain available.


## Stored-water spray

The atelier's Form tab now has **Drink → hold → spray** and **Jump to the spray**. The first plays a complete sequence; the second pauses at the selected animal's plume for comparison (Resume lets it fall). Inspect & hear chooses which member's reservoir and release are inspected. Family members drink and spray at staggered times; One individual isolates any age, sex or habitat. The same release pose and particle renderer are used by the game.

The existing 12-second graze supplies the drinking posture. Water fills between 2.5 and 6.5 seconds, subtly expanding the husk; the animal then carries it for a seeded pause before a one-second brace. Adults produce one sustained upward plume. Youngsters have two smaller, separated spurts, retaining half their reservoir between them. The shell compresses and settles as water is released. Fixed-size batches of faceted droplets rise ballistically, fall, deflect outward when returning onto the husk, and disappear at the water surface. All particle positions are derived from sequence time so pausing, jumping and replaying are repeatable. Lighting comparison presets also adjust droplet contrast.

Validation: 180 age/sex/form/seed combinations check stored volume, phase continuity, planted feet and reachable legs. Additional checks cover stable adult/young burst differences and repeatable droplet paths. World tests additionally check automatic drinking, carrying water while walking, empty reservoirs, cooldowns, one release per family, social exclusions, fixed contacts, and resumed movement. All 25 Reed tests pass, along with twenty-minute generated-terrain audits for umbra and vesper. The spray adds no new audio.

In the world, grazing fills a persistent reservoir. After a seeded 8–22-second minimum hold, the walker waits for a resting pause outside any family interaction. It braces and releases, remaining planted until the droplets settle. Only one family member can release at a time, and each individual has a 30–55-second cooldown before another release. Walking and social interactions continue while carrying water. Sprays allocate one reusable instanced mesh per animal only when first observed within 140 world units; distant particles are hidden and skipped, and all resources are disposed when a family unloads. Returning drops use an approximate husk-footprint deflection, not triangle collision or fluid simulation.
