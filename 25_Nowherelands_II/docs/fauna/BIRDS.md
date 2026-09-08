# Ground to branch — first bird study

Open `http://127.0.0.1:8089/25_Nowherelands_II/bird-study.html`.

The foldwing study has a main colorful bird and three foraging companions in a clearing.
Startle it to see attention, crouch, takeoff, powered flight, a banked glide,
braking, foot contact, wing folding and perched rest. **Return to ground** runs
the second journey. Replay restarts the first. Drag the timeline to pause at any
moment; use quarter speed, the following camera or side/front/overhead views.
Dragging the scene orbits the camera; scrolling zooms. Space toggles playback,
and R replays when a form control is not focused.

This page remains an isolated animation prototype; both bird types now also
run in the living world (see World integration below). Its routes are choreographed Hermite curves with continuous velocity,
not obstacle-aware navigation or an aerodynamic simulation. The tree has one
explicit perch. Judging the silhouette and the whole encounter comes before
flocking, procedural perch selection, streaming, sound or distant sprite LOD.
The existing fauna experiment remains in the September 8 Git stash.

## Implementation

- `BirdJourney.js`: rendering-independent, seekable 2.25-second encounter;
  fixed phase clock, flight/glide effort, velocity-derived heading and bank,
  landing flare and head compensation, then contact-preserving settling.
- `BirdMesh.js`: one 394-triangle geometry drawn as an `InstancedMesh`, with
  per-instance wing, body/head and foot poses. Wings have shoulder and wrist
  articulation and a separate folded shape. The body is rigid; the head and
  tail articulate separately. The production shader also deforms shadows.
  The bird requires one colour draw and an additional shadow draw. This is
  mesh-based particle-style rendering; no sprite or skeletal asset is loaded.
- `bird-study.js`: the small clearing, explicit branch perch and study controls.
  Three.js r185 `OrbitControls.js` was added to the existing vendored r185
  library from its official tagged source.

The study uses its own metres. World sky birds render at 4× scale; the 3D
birds use 2.8× body scale and routes fitted to actual ground/branch contacts.

## Validation

`node --test 25_Nowherelands_II/tests/world/BirdJourneyTest.js`

Checks cover repeated outward/return trips, complete state transitions, stable
rest, bounded continuous movement, slowing to contact, settled support height,
frame-rate independence and backward timeline inspection.

Open the study with `?check=1` for actual WebGL 2 transform-feedback checks of
the production deformation. The result is in `document.body.dataset.birdChecks`.
Checks cover finite vertices, extended versus folded wing span, and rendered
foot positions during crouching/settling. The initial validation measured
376 sampled poses and less than 0.000001 study units of contact drift.
These checks establish mechanics, not the subjective quality of the animation.

## Research informing the experiment

- [Particle birds with branch destinations](https://forums.unrealengine.com/t/using-particle-effects-and-vertex-animation-to-simulate-large-groups-of-animated-meshes/143300): animation states coordinated with movement and selected landing surfaces.
- [Chris McCole: ambient birds in Howloween Hero](https://www.chrismccole.com/blog/creating-ambient-birds-in-unreal-with-niagara-and-vertex-animations-continued-advanced): complete idle-to-flight-to-landing sequences rendered with mesh particles and baked animation. This prototype uses procedural pose parameters instead of baked textures.
- [Three.js minimal GPU birds](https://threejs.org/examples/webgl_gpgpu_birds.html): minimal geometry and batched rendering; not used as the locomotion model.
- [Oxford: mechanics and control of perching flight](https://ora.ox.ac.uk/objects/uuid%3Aa439bd30-3916-4fe9-ba06-c65fd1547048): braking and body pitch during targeted landing. Our trajectory and pose values are artistic approximations.

## Faster flight and the sprite-only alternative

The mesh study now crosses to the perch in 1.65 seconds, with .28 seconds of
attention/preparation and .32 seconds of settling. The former 4.8-second flight
loop is replaced by a direct route. The glide descends; most slowing happens in
the final .35 seconds. The wingbeat is 6.8 Hz. This remains authored kinematics,
not an aerodynamic simulation. Tests additionally reject rising glides or
loss of forward speed through the main flight.

## Sky-only silhouettes

Open `http://127.0.0.1:8089/25_Nowherelands_II/bird-sprites.html`. The comparison
links connect both studies. There are small passing flocks and no ground or perching sprites. Site selection, landing, fleeing, resting textures and texture
transitions have been removed from this experiment.

Each bird is still one textured quad, rendered in a single instanced batch.
The quad lies in the bird's forward/span plane in world space. Its heading,
pitch and bank come from its velocity and turning; the camera cannot rotate,
mirror or select a view for it. A flat card naturally narrows when viewed
edge-on. It does not acquire 3D body thickness.

Three fixed flight silhouettes each supply sixteen animation frames in
separate texture array layers. A bird keeps its silhouette for its entire life. Each layer has its own mip chain, preventing neighboring frame
bleed at small sizes. There are no frontal/side/rest texture blends. Powered
bouts finish at the extended-wing frame before entering a glide; the phase is
held there and resumes continuously when flapping restarts.

The birds cross reserved parallel corridors in groups of ten to fifteen, with
local separation and smooth persistent wandering. A new flock arrives every
10–17 seconds; individuals fade in and out at corridor ends. Several groups can be present, each in its own reserved lane. Walking affects future arrivals, never existing routes. Turn acceleration
is bounded and bank follows curvature. Powered bouts climb; glides descend
and gain some forward speed. They use separate behavior and wingbeat clocks.
The flight model is a visual approximation, not a full aerodynamic simulation.
Walking and looking around remain available for inspecting perspective.

## Resting 3D bird

The mesh bird makes three brief pecks, looks around, stretches its wings and
ruffles its feathers in a 5.6-second resting sequence.
Its torso lowers, head reaches down, and small body rolls/head turns give it
resting movement. The feet remain in place through shader contact compensation.
Perched rest has weight shifts and glances, but no ground pecks. Starting a
journey during a peck blends back to the alert pose before departure.

Validation: nine Node tests across `BirdJourneyTest.js` and
`SpriteBirdsTest.js`. They cover complete mesh journeys, contact, idle behavior,
continuous flight, descending glides, sustained forward speed, curved sky
trajectories, continuous wingbeat handoffs and camera-independent card axes.
The production mesh shader also receives idle poses in the GPU check: it
measures planted feet and the actual beak tip's approach to ground level.
The studies remain available alongside the integrated game.


## World integration

Open `http://127.0.0.1:8089/25_Nowherelands_II/?seed=umbra&birds=1` for
optional field notes. Both populations also run during ordinary play without
that parameter. Enter the game, then choose **Watch sky passages** or
**Find a 3D bird**. **Approach the bird** walks toward it; **Give it space**
retreats so it can eventually return to feeding. **Explore here** resumes play.

- `BirdPassages.js` reuses the accepted flap/glide clock with directed routes.
  Route corridors are sampled against terrain before admission. The route
  stays fixed after spawning; there is no player-following orbit. Population
  stays at or below 64 sprites. Cards remain world-oriented and sky-only.
- `Vegetation.js` exports landing anchors from the actual branch geometry and
  instance transforms. Birds only use mature, loaded trees. A CPU counterpart
  of the tree shader's wind displacement keeps planted birds on swaying limbs.
- `BirdEncounter.js` fits the approved pose sequence to a ground/branch pair.
  Extra climb happens before the outward glide; body size stays uniform.
- `WorldBirds.js` streams at most 28 nearby encounters. Surface and flight
  samples reject water, steep feeding sites, hills and giant-trunk collisions.
  Birds hop between feeding spots and take an independent short flight every
  7–14 seconds, or sooner when approached within 25 world units. After a 4–10 second rest they can visit neighboring trees, then return to
  feeding when the observer is more than 40 units away. Each bird's idle phase is independent. Both renderer batches are
  excluded from the environment-map capture and hidden deep underground.

The 3D flight remains authored kinematics fitted to local endpoints, not a
complete obstacle planner: route samples don't test every twig or leaf.
The distant flock layer and nearby encounters are independent populations;
there is no sprite-to-mesh handoff or new bird audio in this iteration.

Validation adds `tests/world/WorldBirdsTest.js`: ten simulated minutes of
arrivals/departures and bounded population, terrain clearance, forward
progress, descending glides, routes invariant to observer movement, and
world-space contact/continuity in both journey directions. Run it with the
other two bird test files. The in-game field-note panel exposes population,
route and encounter diagnostics in `data-birds` for browser verification.


### Visibility in the game

The game uses a 5.3-unit card at 4× world scale (twice the first integrated
wingspan), with crossings centered closer to the observer and a slightly lower
terrain-clearance band. Muted blue-grey moonlit plumage and a later fog blend
keep the silhouettes legible against the dark sky without bloom. This is a
fixed physical size: there is no screen-size scaling or camera-facing rotation.
The brighter stand-alone clearing retains its darker ink and smaller card.
A headless game render verified the updated sky batch with no runtime errors.


### More life and color

Sky groups now contain 10–15 birds, arriving every 10–17 seconds, with a hard
64-bird limit shared by the renderer and simulation. The standalone sky study
uses a slightly farther corridor to keep the larger flocks in its initial view.

3D birds have three instanced plumage palettes: teal/copper, violet/gold, and
blue/peach, with pale wing tips and beaks. Nearby groups have separate branch
contacts and feeding spots. `BirdForage.js` adds short ballistic hops within a
bounded feeding patch; terrain/water/collision checks reject unsafe targets.
Takeoff waits for a hop to land. Each bird has its own resting phase, hop timer,
and spontaneous flight timer, so the group keeps moving without player input.
The 3D study now includes three colorful foraging companions around the main
seekable encounter. The study's timeline still controls the main bird's flight.

`BirdForageTest.js` verifies sustained hopping, grounded contacts, unsafe-site
rejection, landing before takeoff, and the expanded resting repertoire. The
population test verifies a sustained larger sky population within capacity.


### Slower wingbeats, variation and distant circles

Wingbeats now run at 1.3–2.4 Hz, depending on profile and individual variation.
Broad wings, long tapered wings and swept wings with a forked tail have distinct
silhouettes, size ranges, tints, powered-bout lengths and glide durations.
Gliding holds the extended-wing frame; it never swaps to a different shape.

All groups share a stable travel bearing and use separate 128-unit-wide lane
spacing. Each lane is reserved until its last bird leaves, including when the
player walks across the world. A distant group occasionally makes one or two
complete circles (38-unit radius) inside its reserved lane, with tangent entry
and exit, then continues on its journey. These are temporary visits to a
circling area, not a permanent orbit around the observer. The entire corridor,
including the circle, is checked against terrain before the group is admitted.

`BirdPassagesTest.js` checks the slower phase clock, fixed per-bird appearance,
all three profiles, exclusive lanes while walking, actual completed turns,
smooth entry/exit and eventual departure. The ten-minute population test also
checks that every bird remains safely inside its lane throughout the flight.


### Shared trees and visits between branches

Mature trees expose up to six separated perch spots taken from their actual
branch geometry. Initial groups can assign up to three birds to one tree,
leaving room for visitors. Each occupied spot, including both endpoints of an
active flight, is reserved so two birds cannot choose the same branch contact.

After resting, birds choose a free spot on a neighboring tree, favoring trees
they have not visited and trees already hosting companions. They usually make
two tree visits before returning to their feeding patch. Routes are checked
against terrain and giant trunks before takeoff; both endpoints follow branch
sway. Perched birds look around, stretch and ruffle without ground pecking.
The standalone 3D study keeps its seekable single-tree choreography; the shared
tree behavior runs in the game.

The chained-flight test checks ground → three branches → ground, continuous
position and heading at takeoff, exact foot contacts, appropriate resting
behavior and the ability to start another trip. Field-note diagnostics include
perch slots, visited trees and the number of transfers for live verification.
