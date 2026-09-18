# Vegetation — current design direction

Updated 18 September 2026, after review of the [second concept study](exploration-v2/README.md).

**Implementation update:** the user approved starting with an atelier before adding plants to the game. The first [interactive vegetation study](ATELIER.md) now implements open-husk reed variations, all three willow foliage forms, reed responses and optional mirror pendants. The sections below preserve the design rationale; world placement and mirror relocation remain future work.

## Selected by the user

- Bell reeds use **C / Open husk** as the species identity. Develop variation within that form.
- Veil willows retain **all three foliage forms**: long ribbons, folded sprays and broken veils. Treat them as variations of one species.

The user also proposed player interaction, particularly for bell reeds, and suggested turning existing scattered mirrors into pendants on willow branches. Those ideas now have an atelier prototype for review; their final tuning and integration into the world remain open.

## Species variation proposal

**Bell reeds:** preserve the broad downward-facing open husk, thin curved neck, dark stems and recessed warm interior across the population. Compare a compact young-looking clump with three short stems, a mature open clump with five to seven uneven stems, and a weathered leaning clump with fewer intact husks. These are persistent form variations, not a proposed simulated growth cycle. Vary mouth width, droop, stem curvature, husk size and subdued mauve/ash/rose tint within narrow bounds. Keep age/exposure-related features coherent instead of independently randomizing every parameter. Avoid making closed needle husks a common alternative, since C was explicitly chosen.

**Veil willows:** share trunk character, hanging attachments, leaf folds and palette. Give each tree a dominant foliage form, with occasional intermediate proportions; avoid attaching all three extremes indiscriminately to one crown. Ribbon length, leaf grouping and gaps can connect the three forms. Moist sheltered sites could favor long ribbons or fuller sprays; exposed sites could favor shorter interrupted veils. This habitat association is a proposal, not a statement about existing placement. Size, trunk lean and crown asymmetry provide variation within each foliage form.

## Bell reed interaction proposal

Treat the plant as a living resonator, with grounded mechanical motion, rather than an animal that turns to look at the player.

1. **Pass close:** stems bend gently away within a small local reach, husks lag then settle, and a quiet dry rustle accompanies actual disturbance. Simply entering a large radius should not start a musical response.
2. **Offer a note:** reuse the player's existing click/N action. One nearby husk nods and briefly warms inside; a few neighboring husks answer with a short, staggered resonant phrase. A woody, hollow, breathy timbre would distinguish them from glassy fauna and metallic mirror sounds. Larger husks could favor lower notes drawn from the current musical scale.
3. **Offer a stronger note:** a short response travels through a little more of the nearby patch, with bounded volume, duration and number of answering husks. Do not activate a whole shoreline at once.
4. **Let it settle:** stems and light return to rest. Repeated notes should not continually restart responses or stack sound indefinitely. Do not make reeds routinely answer fauna replies or their own notes, which would create feedback loops.

Prefer a clear visual response with sparse sound. Most husks stay dark. No harvesting, resource meter, new button or dialogue is proposed. A prototype should test reeds alone and alongside fauna to judge masking and response density.

## Willow pendant proposal

Keep ordinary willows as quiet wind-driven plants. A small number of exceptional **mirror-bearing willows** could become discoverable places, carrying two or three small circular or diamond mirror pendants from exposed branches. Retain the mirrors' recognizable silhouette and subdued edge accent. Thin flexible hangers could read as vines or cords; their ambiguous origin is a visual question to explore, not established lore.

Pendulums sway and twist with wind. On approach, one could turn a little toward the player within the limits of its attachment. Deliberately touching/clicking it could add a small swing, a brief edge flash and one clear resonant tone. Its glints should come from changing orientation; the tree and foliage need not glow.

Recommendation: first explore a mirror-bearing willow as a replacement *presentation* for an existing mirror encounter, preserving the landmark's discovery and interaction role. Do not distribute pendants across every willow or add more always-playing chimes. Moving all existing mirrors is still undecided. Include an accessible pendant near the player's reach; overhead scenery alone is a poor interaction target.

## Existing systems to preserve when prototyping

- `js/landmarks/Mirrors.js`: mirrors already slowly face the player, ring/flash/ripple when pressed, and use true reflections only for the two nearest within range. A hanging adaptation needs attachment-constrained motion and a bounded reflection budget.
- `js/landmarks/Landmarks.js`: seven mirrors are placed near the starting region, most at water edges. They participate in proximity discovery and gaze/press interaction. A relocation must preserve a reachable encounter and update interaction/collider positions appropriately.
- `js/audio/Conductor.js`: mirror discovery sets a reverb gain target, and `mirrorTouch` plays a quantized bell. Preserve the discovery intention when reconsidering the encounter; do not assume the current reverb increase is permanent, since environmental updates also set that gain.
- `js/player/PlayerNotes.js` and `js/main.js`: player notes already provide a shared interaction vocabulary for fauna and pulse vegetation. New reed responses should build on this explicit player action and coexist with aimed landmark interactions.

## Next visual study

Compare three related open-husk reed clumps; show one in resting, brushed and note-response poses. Render one mirror-bearing willow with readable attachment, reachable pendant, and restrained reflections. These would resolve the main open design questions before a 3D motion/sound audition. User feedback on the interaction and pendant proposals may change this next step.
