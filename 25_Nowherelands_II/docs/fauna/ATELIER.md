# Fauna atelier

Open **fauna atelier ↗** on the game’s entrance screen or in the corner menu
(press Escape to release the mouse). The species selector connects seven studies:
Lumens, Pebble hoppers, Reed walkers, Roundtails, Longtails, Crowncrests and
Fireflies. World links preserve the seed supplied by the game.

The Reed walker study remains its dedicated, approved family diorama. The other
studies share `fauna-atelier.html`, the same paper-and-sage visual language and
Form / Voice / Home / Traits panels. Each supports orbiting, alternate views,
individuals or groups, new specimens, lighting and pause controls.

## Shared behavior

`AtelierCatalog.js` owns species descriptions and navigation.
`AtelierFauna.js` adapts the production renderers and motion:

- Lumens use FaunaMeshes with the existing centered motion-study poses. Rest,
  swim and escape show velocity-driven deformation without leaving the camera.
- Pebble hoppers run FaunaModel on a flat stone patch. A simulated visitor
  approaches or retreats; real colony state transitions drive the response.
- Birds use BirdEncounter and BirdMesh, including foraging, takeoff, landing,
  three anatomies and three plumage palettes. A flight request made during a
  hop waits until the feet are ready. The camera follows an individual.
- Fireflies use the production point shader, with bounded study drift and
  enlarged points so their light can be inspected. Sound response is a visual
  preview of the shader’s audio response, not a new animal vocalization.

The dioramas illustrate habitat; they do not generate the full world. The Home
panels describe current game placement. Birds and Fireflies have no dedicated
voices assigned in the game yet, and their Voice panels state this explicitly.

## Listening

Lumen and hopper previews use FaunaAudio and the shared production mixer fixture
also used by Reed walkers. The user chooses creature only, river or busy
backgrounds. Playback starts on a sound button, supports volume and Stop, and
stops when leaving or hiding the page. Reed walkers retain their full listening
and mix-check panel.

## Verification

Browser smoke checks cover all seven species, group and plumage changes, a
hopper escape, a bird branch landing, pause, Lumen and hopper voice playback,
and navigation through the Reed study. Check the entrance and corner links
when changing HUD navigation. The integration commit separately verifies Reed
families on generated terrain and their full feeding and walking cycles.
