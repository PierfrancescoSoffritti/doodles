# Veil rays — sharing the shoreline

Character direction agreed in discussion, 2026-09-10. Keep the approved membrane appearance. The behavior-and-voice study and the first world integration below implement the encounter. Broader basin navigation and ecological variation remain future work. Keep ray work uncommitted while we iterate.

## Form to preserve

Keep the existing thin violet membrane, translucent interior, fine luminous rim, broad fin strokes and delayed trailing edges. Communicate attention through route, bank, pace and a restrained change in the rim. The current shape should remain recognizable throughout the encounter. Keep its scale for the first study and judge proximity from the normal player viewpoint.

## Character

Proposed direction: quiet, unhurried and selectively sociable. A ray can acknowledge a visitor without abandoning its own journey. Its distinctive gesture is a long, shallow bank followed by a close passing glide. The player should be able to recognize when a route has changed because of them.

The main reward is briefly sharing space and hearing the creature nearby. This direction is open for discussion; it does not yet establish taming, riding or persistent companionship.

## Habitat and daily life

Start with scattered sheltered freshwater lakes and broad, slow backwaters. A suitable site needs room for the full membrane and wide turns, connected open water, an accessible observation shore, and a quieter refuge within the same basin. A tiny pond can pass a water-depth check and still be unsuitable.

Proposed population: usually one ray, occasionally a loose pair or three at a larger site. Leave many otherwise suitable waters empty. Site choice and individual identity should repeat with the world seed. Returning to a shore should feel like revisiting an animal's home.

Rays fly through the air above water. Their routine alternates between low skimming passes, broad crossings and near-motionless glides in sheltered air. A possible ecological explanation is collecting fine airborne drift on the membrane; treat this as fictional background for movement, with no food-resource mechanic in the first study.

Dusk and overcast conditions favor exposed crossings. Bright sun encourages lower, sheltered routes; strong wind or heavy rain sends animals toward the quieter part of their basin. Weather changes routes gradually. The first version should stay within one connected freshwater habitat; coast, rapids, waterfalls, deep caves and overland migration need separate decisions.

## Movement and social behavior

Choose meaningful destinations around the basin: a sheltered pocket, a broad skimming stretch and an open crossing. Join them with long curves. Alternate powered strokes with glides; turn effort and asymmetric fin motion should agree. Whole-membrane clearance matters at banks, branches and rocks. A blocked route should lead to another reachable destination.

During a low pass, stroke amplitude softens and the body remains above the surface. During a crossing, a few deeper strokes gain clearance before settling into a glide. Rest is a slow drift within shelter, with small corrective strokes.

Pairs sometimes travel alongside each other, then separate to different patches. A meeting can include one slow bank toward the other and an occasional contact call. Give individuals different pacing, route preferences and willingness to approach. Pairing is temporary; family roles and age variants are outside this first study.

## Voice

Use a warm, hollow singing tone with a little breath and a slow pitch arc. The sustained fundamental and rounded upper harmonics should carry above water without a buzzy edge. Two gentle breath swells give the contact phrase shape; the acknowledgment opens upward and ends sooner. Keep the voice distinct from the walkers' rumble and exhalation.

Two contexts can share one voice family:

- **Contact:** a soft sustained tone during an occasional meeting or departure. A second ray may answer after a pause.
- **Acknowledgment:** one shorter, slightly rising or opening phrase during an accepted pass near the player. It relates to the current musical palette without copying every note.

Most movement stays silent. Flight does not produce a continuous drone, and fin strokes do not each trigger a sound. Start with a 3–5 second contact phrase, a 2–3 second acknowledgment and long irregular quiet intervals. These are audition values, not final timings.

A call has a visible source: slight rim brightening and a fuller stroke or slow bank. Light follows the accepted sound event. Keep spatial direction and distance falloff clear, allow room between phrases, and audition beside both quiet water and the busy game mix. A disturbance closes an active phrase with a short fade and cancels any pending reply.

## Meeting the player

| Player action | Proposed response |
| --- | --- |
| Walk along the shore at a distance | The ray continues its route. It may subtly bank to keep the visitor in view. |
| Approach its current path | It opens the curve and preserves comfortable clearance. A calm approach alone does not trigger a flight response. |
| Remain nearby quietly | After a few seconds, it can resume a route closer to the visitor. This is voluntary and need not happen every time. |
| Make one soft invitation | An available ray may bank toward the source, finish a safe approach, and acknowledge during one passing glide. |
| Walk slowly along a suitable shore after an accepted pass | It may travel parallel for a short stretch, then turn back into its basin. |
| Rush at it, crowd it, or make a strong nearby sound | It takes several firmer strokes toward open water or shelter. Repeated disturbance prolongs avoidance. |
| Repeat invitations rapidly | The ray stops accepting invitations and gives itself more distance. |
| Leave | It returns to its own route; another encounter can happen after a quiet interval. |

An approach must end at a safe passing distance. If reaching the visitor would cross land or a blocked channel, the ray can acknowledge from its existing route or ignore the invitation. Habitat and clearance take priority over curiosity.

Recognize deliberate player invitations separately from ambient music, fauna calls and distant events. A call-and-reply exchange ends after one acknowledgment; it must not trigger a recursive chorus. Observation controls should leave the animals undisturbed until the player chooses to approach.

## First encounter to judge

A ray is making a low, broad crossing of a sheltered lake. The player reaches the shore and pauses. The ray continues for a moment, then changes its next curve. A soft invitation earns a shallow bank and one deliberate pass nearby, with a brief airy phrase and a restrained rim swell. If the player walks slowly along the bank, the ray shares that direction for a short stretch before returning across the water. Rushing toward it instead produces a firmer, silent departure.

Build this as a small behavior-and-voice study using the approved membrane before expanding world ecology. Include an independent visitor marker, manual movement and invitation controls, one repeatable encounter, a loose-pair preview, pause/reset/slow motion, and isolated versus in-game-background listening.

Judge whether attention is readable without a face, normal travel differs from approach and withdrawal, proximity feels intentional, and the voice has a distinct identity. Check full-span clearance, connected-water containment, eventual return to routine, bounded replies, deterministic reset, and behavior at different frame rates.

## In the game

Open [the in-world ray guide](../../index.html?seed=veil-lake&fauna=ray). Rays also stream into ordinary play without the guide. **Stand on the shore** uses a validated dry bank at normal eye height. Wait four seconds, then **Send a tone**; during ordinary exploration a short click away from a landmark offers the same invitation. Hold **Alt** with movement for a gentle six-unit-per-second walk. Sprinting nearby, crowding the membrane or three invitations within five seconds makes the ray retreat. A charged invitation has the same effect. **Next lake** visits another real habitat.

`VeilRayHabitat.js` chooses seeded pockets along generated freshwater lake shores. Many lakes remain empty. Each accepted pocket has 44 units of open-water radius, a dry observation bank and consistent lake identity/level; samples reject islands, roofed areas and turbulent water. One ray usually lives there, occasionally a loose pair. The active population is capped at five. Homes stream within 500 units and unload beyond 780; reloading preserves their identities. Streamed obstacles can reject a home but cannot change its seeded location.

`VeilRayWorld.js` runs through the existing fixed-step fauna model and renderer. Whole-membrane clearance constrains every cubic control point, and pairs occupy separate broad lanes. Newly streamed colliders trigger another checked route. Quiet observation, an accepted approach, one passing acknowledgment, up to ten seconds of accompaniment and eventual return use the real player position and speed. The revised voice uses the production fauna mixer; the rim follows accepted playback. Ambient notes cannot invite rays or start recursive replies. Strong wind, storms and heavy rain interrupt encounters for a slower drift; bright sun lowers crossing altitude. Leaving the surface cancels encounter sound and replies.

This integration uses conservative pockets inside real basins. It does not yet navigate the entire irregular shoreline, find a physically wind-sheltered refuge, migrate between waters, or populate river backwaters. The prototype retains the approved scale and membrane appearance.

## First behavior and voice study

Open [Veil rays · Character study](../../veil-ray-study.html) through the local server. **Play the encounter** runs a 62-second sequence: approach the shore, wait, offer a note, share a short walk, make a sudden move, and leave enough space for recovery. Manual controls use the same state transitions. The gold ring marks the visitor independently of the orbit camera; **Visitor view** watches from the normal eye height, and **Lake view** restores the overview.

The study reuses the current production membrane geometry, deformation and material. Long curves connect low passes, crossings and sheltered drifts. A quiet visitor can earn one approach and a shorter acknowledgment during the pass. Slow walking allows up to roughly ten seconds of accompaniment before the ray returns to its route. Leaving cancels an approach; nearby disturbance or three invitations within five seconds causes retreat and postpones another encounter. Ambient and animal voices cannot become player invitations.

**A loose pair** adds a second individual with separate pacing and occasional coordinated crossings. A contact call receives one reply seven seconds later. The fixture reserves separate broad lanes to prevent membrane collisions; this is a controlled social preview, not a general flocking or obstacle-navigation solution.

The revised auditions use a rounded harmonic voice: a 5.2-second contact with two sustained breath swells and a 2.6-second rising acknowledgment. A faster attack, audible fundamental and reduced reverb replace the faint, buzzy vowel. **Watch & hear the encounter** also plays the player's invitation from the visitor marker. Auditions compare the ray alone, wind/water, and the production game mixer with representative music/rain/water. The isolated voice audition listens beside the ray; the encounter listens from the marker. Overall listening level scales the entire mix. The ray has a foreground output independent of ambient volume. Accepted nearby calls briefly lower the background, while distance still reduces the voice. Timbre remains open for listening review.

Sound is opt-in. Stop, pause, slow motion, reset, population/background changes and leaving the page stop listening. A disturbance fades active ray sound over 80 ms and cancels pending replies. Only one ray phrase is admitted at a time. The rim's restrained swell uses the same envelope as the synthesized phrase; most travel is silent.

The habitat is a circular test lake. Cubic routes stay inside a convex region inset by the entire membrane radius, with enough vertical clearance for banked fin tips. This proves containment in this fixture; real lake shorelines, branches, weather shelter, site selection and world streaming remain future integration work. The world integration uses its own validated lake pockets and real-player inputs, while this fixture remains useful for repeatable auditions.

Validation: `node --test 25_Nowherelands_II/tests/world/VeilRayStudyTest.js 25_Nowherelands_II/tests/world/FaunaModelTest.js` passes 16 checks. Coverage includes the full encounter, manual invitations, early departure, repeated disturbance, ambient-note isolation, three-minute containment across three seeds with one/two rays, social timing, pause/reset and 30/60 Hz equivalence. [Ray audio checks](../../tests/veil-ray-audio.html) verify both phrases, distance falloff, mute, overlap rejection, retreat fade and finite busy mixes. [Shared fauna audio checks](../../tests/fauna-audio.html) retain the existing voices and lumen escape checks. The pure voice and study suite also passes 19 checks with `node --test 25_Nowherelands_II/tests/audio/*Test.js 25_Nowherelands_II/tests/world/VeilRayStudyTest.js`. Mix regressions compare the voice and background before compression, then check the complete output for clipping. Both phrases exceed the busy background by at least 3 dB at 15 units and 0 dB at 35 units in the seeded fixture; the measured contact margins are 3.18 and 1.65 dB. Water and busy mixed peaks remain below 0.95. These measurements cover representative backgrounds; subjective voice quality still needs listening review.

World validation: `node --test 25_Nowherelands_II/tests/world/VeilRayWorldTest.js` covers habitat rejection, deliberate invitations, accompaniment, disturbance, departure, weather/surface suppression, accepted-audio lighting, containment, pair spacing, bounded replies, deterministic reload and frame-rate equivalence. The combined world, fauna-guide and audio regression run passes 220 checks. The real-world guide was also checked in the browser with the `veil-lake` seed.
