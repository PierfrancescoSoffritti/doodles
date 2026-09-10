# Lantern mites — small, cautious lights

Working character direction: cautious curiosity. The encounter and voice study now shares its behavior, bodies and calls with the first world integration. The broader ecology below remains a design proposal where it exceeds the implemented woodland encounter.

## Starting point

The saved fauna reference notes describe one tiny rounded light seed, shown enlarged, without insect anatomy. Dormant and calling states share the same geometry; glow surrounds an underlying solid form. Absolute scale remains undecided.

Those reference sheets are preserved in the stash named `Before lantern mite characteristics — 2026-09-09`. The first world integration coexists with ambient Fireflies; their longer-term relationship remains open.

## Character

Cautious, inquisitive and easily overwhelmed. A mite wants to investigate a quiet disturbance but keeps the safety of its colony nearby. Patience lets the player witness its curiosity. Sudden movement sends it back to shelter.

Its attention is expressed through pauses, distance, orientation and light. It does not need a face or added insect limbs to communicate intent. It is harmless and nonterritorial.

## Home and daily life

Small, scattered colonies inhabit damp, sheltered woodland hollows: mossy root pockets, the underside of fallen wood and shallow rock recesses. Humid cave mouths are a possible secondary habitat; deep caves are not assumed to be part of this first direction.

Each colony has a particular refuge and nearby feeding surfaces. Mites browse a fine film of growth on damp bark, moss and stone. Feeding is an ecological explanation for their movements, not a resource-management system.

In brighter conditions they settle against these surfaces and become dim, seedlike specks. In darkness they emerge for short excursions close to their home. Exposed ridges, surf, open water and strong wind are unsuitable. Heavy rain or gusts bring them back under cover; shelter matters more than simply being outdoors at night.

## Movement and social life

They move in short hovering journeys between feeding stops, with changing headings and brief pauses to inspect before approaching or settling. In their active hours, the colony is visibly busy. Surface rests are short and individually timed; longer dormancy belongs to daylight or bad weather.

A colony is a loose neighborhood, with distinct resting spots and individual rhythms. Mites occasionally drift over to a neighbor, hover together for a contact pulse and delayed reply, then resume separate journeys. One mite may investigate the player while others continue browsing close to home. The whole group does not flash continuously in unison.

Individuals differ mainly in boldness, pacing and pulse rhythm. Family roles, sexes and age-specific anatomy can wait until the shared character is convincing.

## Light and voice

Light is their primary social signal. Resting light is faint; an investigating mite slowly brightens; a contact pulse rises and fades softly. A startled mite dims quickly and retreats, then gradually becomes visible again after settling. Brightness should retain enough shape to read as a small animal.

The voice candidate is an occasional tiny, rounded hollow tick with a soft breathy tail, like a very small resonant seed shell. A contact call contains two uneven notes followed by silence. Nearby mites answer with a single note after different delays. Body size and identity subtly vary pitch and timing.

Sound belongs to an observable social moment and is audible mainly at close range. Avoid a constant swarm buzz or a continuous bell melody. A startled retreat is silent: the conversation stops as the light dims. The Voice controls now let us compare this timbre before accepting it. A possible dry settling tick remains future work.

## Meeting the player

- **Passing at a distance:** the colony continues feeding and exchanging occasional pulses.
- **Approaching slowly:** nearby mites pause and attend to the player, holding a little farther from exposed resting places.
- **Remaining still:** the colony gets used to the player's presence and resumes feeding trips and neighbor visits. One bolder individual may approach, stop short, pulse and wait. Others can answer from near the roots without stopping their own routines indefinitely.
- **Making a soft sound:** an attentive individual may reply with a delayed light pulse and faint contact note. This is occasional curiosity, not a guaranteed response to every musical event.
- **Rushing through or making a sudden loud sound:** exposed mites dim and take short, separate routes into their familiar refuge. They emerge again gradually after quiet returns.
- **Leaving:** an investigating mite returns to its colony. Any brief following ends near its home.

The reward is a small voluntary encounter. They do not attack, guide the player to objectives or become permanent companions. Touching, catching and perching on the player are outside this initial proposal.

## First encounter to judge together

At dusk, a few lights move among the roots of a tree, stopping to browse and occasionally meeting a neighbor. The player's approach briefly stills them. As the player waits, most resume their business; one brightens and drifts closer. A light and faint contact note answer from the roots. A sudden step sends the colony into shelter and cuts off its conversation; after another quiet pause, the lights begin to emerge separately.

This encounter should establish a recognizable creature with a home, its own routine and a choice about proximity. Refinement should follow agreement on that character.

## Decisions still open

- Whether cautious curiosity is the right disposition, or they should feel more indifferent or sociable.
- Whether woodland refuges are their defining home, and whether cave-mouth colonies belong in the first version.
- Whether the contact-and-reply voice candidate has the right warmth, scale and presence.
- Their readable size and colony density at the normal player viewpoint.
- Their relationship to the existing ambient Fireflies.

## First behavior study

Open [Lantern mites · Character study](../../lantern-study.html) through the local server. Five simple, rounded seed bodies inhabit a small root-hollow diorama. Their scale and habitat geometry are provisional.

**Play the encounter** runs a 35-second sequence: approach, wait for one curious mite and a delayed answer, make a sudden step, then give space. Manual controls move a visitor marker independently of the orbit camera. Stand still stops the visitor at its current position; curiosity requires several quiet seconds within the colony's attention range. Pause, slow motion, reset and orbit controls support inspection.

The bolder mite approaches and pauses short of the visitor; neighbors continue their journeys near home once the approach has stopped. Contact pulses can receive one delayed reply, without a cascading chorus. A sudden nearby step cancels pending replies, dims the colony and sends each mite to its own refuge. Repeated disturbances postpone recovery. Individuals emerge at different times, and an investigating mite returns home when the visitor leaves.

This is a bounded character and voice fixture. It does not implement terrain navigation, world populations, weather or daylight behavior, food resources or player touch. It does not replace ambient Fireflies. Assess whether patience, curiosity and retreat read clearly before developing those systems or refining the form.

Run `node --test 25_Nowherelands_II/tests/world/LanternMiteStudyTest.js` from the repository root for encounter, manual-control, delayed-reply, repeated-alarm, movement-continuity and reset checks. Browser inspection is also needed for the actual light, silhouettes and controls.

Initial validation: all six behavior tests pass, including three minutes of repeated encounters across three seeds. Browser inspection covered the five resting silhouettes, contact/reply events, a manual startle, pause stability and narrow-screen framing, without console errors or warnings. The visitor ring is an inspection marker drawn above scenery so it stays visible among the moss.

## More active colony

The first version felt too static: most individuals could remain in the notice state indefinitely near a player. Notice now ends after roughly one to one-and-a-half quiet seconds. Individuals resume short feeding circuits with two different airborne stops, changing directions, brief hovering pauses and 0.65–1.7-second rests. The first departures begin almost immediately when the study opens. Travel is faster and covers more of the air in front of the roots.

Every seven to ten seconds, an available mite can visit a nearby neighbor. The neighbor rises to meet it, the caller approaches to a small gap, and a light pulse receives one delayed reply. Both return to independent activity. Visits rotate among available individuals; a nearby visitor reserves the bolder mite for player curiosity. An approach can interrupt a visit, and a startle cancels its pending answer.

All eight behavior tests pass. The new activity regression measures actual displacement across three seeds, both with a distant visitor and one standing quietly nearby: at least two mites move during more than 75% of sampled frames, every individual travels, and each still takes brief rests. Neighbor checks require travel before a call, different initiating individuals and bounded delayed answers. Existing retreat, recovery, continuity and repeatability checks still pass.

## Contact-and-reply audition

The Voice controls offer **Hear contact & reply**, **Listen to the colony**, and **Background alone**, with five calling individuals, listening level, and Stop. Sound is opt-in. The exchange button resets a close encounter, plays one double call and its single delayed answer, then stops after 3.5 simulation seconds. Colony mode uses natural social and player-contact events; the visitor marker controls listening distance. The isolated audition listens from a fixed close position beside the hollow, independently of the orbit camera.

`LanternMiteVoice.js` generates repeatable PCM from a soft fundamental, short inharmonic resonances and filtered air. Notes last 0.2–0.3 seconds; the second contact note begins 0.225–0.271 seconds after the first. Size and identity vary pitch. The same note timing drives two light swells for a call and one for an answer. Natural conversation cadence remains controlled by behavior, rather than an independent audio timer. Flight and settling are still silent.

The voices use spatial attenuation and a three-voice cap. A nearby call briefly lowers the ambient layer bus, then releases it; distant mites do not dip the background. Startling silences active voices and cancels pending answers while the surrounding background continues. Stop, pause, reset, slow motion and leaving the page close the listening session. Starting an audition returns to normal playback speed so the notes and light stay together. Background or voice changes stop the previous session, avoiding overlapping previews.

Background comparisons reuse `createReedAudioScene`, with production AudioEngine, Conductor layers and WatersideAmbience: mites alone, wind/water, or music/rain/water. This is a representative mixer fixture, not a simulated woodland soundscape. **Background alone** plays eight seconds without the mites or their ambient dips.

Validation commands: `node --test 25_Nowherelands_II/tests/audio/LanternMiteVoiceTest.js 25_Nowherelands_II/tests/world/LanternMiteStudyTest.js` (eleven tests). Open `tests/lantern-audio.html` through the local server for offline stereo mix checks, mute, distance falloff and overlapping voices. The checks retain full-band margins and also screen 650–1800 Hz, covering the small voice's main pitches. These separate component renders are useful mix checks, not a guarantee of perceived audibility over every musical transient or on every speaker.

Initial voice validation: all eleven Node tests and the offline mix checks pass. The busy fixture measured +13.2 dB for the call and +11.0 dB for the reply within the voice band; full-band margins were −2.8 and −6.0 dB, respectively. The maximum three-voice mix peak was −0.95 dBFS, the 2-to-8-unit call attenuation was 11.9 dB, and muted output was zero. Browser checks verified a completed two-event audition and automatic stop, natural colony calls, startle silencing, pause and Stop, without console errors or warnings. Final timbre remains for listening review.

## First world integration

Open [the live woodland encounter](../../?seed=umbra&mites=1). Colonies also stream during ordinary exploration; the query adds a field guide with Find/Next colony, Approach slowly, Wait here, Step away and Explore here. Observation leaves the colony undisturbed; approaching enables its response to the player. Enter the game to enable audio.

Five mites inhabit a root-and-stone hollow beside an existing forest giant. Three structural families—arched root, forked root and stone cradle—vary by seed in handedness, proportions, branches, stone counts and mossy resting spots. Roots join the host tree, with a low irregular earth apron fitted to the ground. Sites use the actual tree geometry and transform to find space outside the bark; terrain, water, cave openings and nearby obstacles constrain the full home and its approach. The current provisional scale follows trunk size and is viewed from the player's normal eye height.

The shared study behavior drives feeding circuits, neighbor visits, individual light pulses and one curious visitor encounter. Each home supplies its own stone perches and sheltered retreat spots. Real player position and speed drive attention and nearby rushing triggers retreat. The root cover permits daytime activity; severe storms suppress it. Calls and answers use world positions in the production mixer, with close attenuation, the existing master peak guard and at most three concurrent voices. Retreat, cave entry, fauna mute and hiding the page silence them.

At most three nearby colonies (15 bodies) are active. Their meshes unload with the trees or when left behind; the same home regenerates when revisited. Each house uses five merged solid material batches and one bramble line batch. Root ends and side stones have player collision, and grass in the central flight space is cleared while the home is loaded, then restored on removal. The fringe retains surrounding vegetation. One local light supplies illumination near the player. Ambient Fireflies continue separately. Detached fallen-wood homes, physical touch, food resources and deeper ecology remain future work.

The first houses looked too separate from the landscape. The current experiment uses the actual terrain shader for earth and moss, including the shared habitat colours, contour/grid lines, weather and fog. Stones use the game's boulder shader; roots use the giant trees' dark violet bark palette. Longer tapering roots spread out into the soil, and sparse branching brambles share the wire grasses' wind and hue at a lower brightness. Broken moss pockets and a wider, uneven transition replace the closed moss ring. Peripheral growth is omitted on unsuitable wet or steep ground.

The fully matched palette lost the hollow's focal point. Muted greens, warm earth and brown bark now return inside an elliptical, softly fading region. The exterior keeps the native palette. A small amber light pool reaches the inner root faces and stones in both the standard and custom terrain materials. Its position stays still; smoothed call brightness gently raises its level, while retreat and storm shelter lower it. The world lighting, weather, fog and ground contours continue through the colour transition.

Integration validation: all 207 tests in the world/audio/UI/weather selection pass, including habitat, bark clearance, player response, shelter and world-event checks. Home tests cover repeatable variation, terrain fitting, grass restoration and actual root/rock/earth triangles during movement and retreat, including the renderer's hover motion. Browser inspection covers different tree sites, moving bodies, the guided approach and live audio events. The game bloom gives the glow more presence than the study, which remains a visual tuning decision for review.

## Exploring the home and answering the player

World colonies now alternate longer journeys along the root arch and between the side rocks, with short browsing stops and faster connecting flights. Targets follow each home's generated geometry. A bounded flight grid, conservative body clearance and checked connecting segments route around the actual roots and stones, including during interrupted visits and retreat. The original isolated study retains its smaller encounter routes.

Use **Play a soft note** in the field guide, or click near a colony during exploration when no landmark is targeted. Holding the click produces a stronger note. Nearby player notes at monoliths and octahedrons can also be heard; background music, sequencer playback and footsteps do not trigger conversations. Simultaneous layers of the same note are counted once.

A soft note briefly draws one available mite's attention. It approaches a safe position toward the source and gives one delayed single-note answer, then resumes exploring. Responders rotate; the rest of the colony continues its routines. Three notes within three seconds, or a strongly charged note, trigger retreat and cancel pending answers. Storm shelter and distance suppress responses. These are first interaction rules for playtesting, not a rhythm puzzle or guaranteed chorus.

The expanded geometry checks exercise ten generated homes with longer journeys, a player note and storm retreat. Dedicated note checks cover one delayed answer, travel, source filtering, duplicate layers, repeated-note interruption and shelter suppression.
