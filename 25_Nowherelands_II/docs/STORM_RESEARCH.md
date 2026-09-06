# Strong coastal storms: exploration

6 September 2026. Research and code audit following ocean commit `3cae344`; the ideas below are not implemented storm behavior.

## Recommended experience

A passing squall over an already rough ocean is the strongest first prototype. The approaching front darkens part of the horizon, gusts lean vegetation and drive rain across the view, the downpour hides distant land, and breaking crests shed foam and spray downwind. Rain eventually clears while long swell continues. This preserves readable geography, the existing low-poly water, and the dramatic red/violet sky palette.

The [NWS thunderstorm guide](https://www.weather.gov/spotterguide/types) describes organized storm outflows and gust fronts. It provides a basis for coordinating a moving wind surge and rain region. It does not imply that all storms share an identical sequence.

The [Met Office Beaufort reference](https://weather.metoffice.gov.uk/guides/coast-and-sea/beaufort-scale) places storm-force mean winds at 25–28 m/s and hurricane force at 33 m/s or more. Its wave-height guidance explicitly concerns developed open-sea wind waves and notes a lag between rising wind and sea response. The existing 38 m/s preset is already extreme by those wind labels. Increasing that number is not the main missing ingredient.

## What currently limits the effect

| System | Code evidence | Implication |
| --- | --- | --- |
| Storm controls | `WeatherModel.js`: wind 38, gust 0.8, rain 1, storm 1. | The preset already asks for very strong conditions. |
| Rain | `Precipitation.js`: 8,500 desktop ribbons; fade between 75 and 140 units from the camera; vertical speed 95. | High wind has less visible slant than its numerical value suggests. At horizontal speed 38 and vertical speed 95, the unvaried velocity is about 22 degrees from vertical. Audit world scale before treating these visual velocities as calibrated physical measurements. |
| Distant rain | `RainCurtains.js`: up to 64 broad slabs, opacity factor 0.17. | The distant downpour is visually restrained and does not form a convincing moving wall of rain by itself. |
| Visibility | `FogGlsl.js` and `main.js`: weather thickens valley haze and long-distance fog. | Height-based haze weakens above valleys. Rain and spray need their own visibility treatment, especially from mountain viewpoints. |
| Vegetation | `Vegetation.js`: every uniform set receives wind sampled at the player. | Distant forests cannot reveal a gust moving through the landscape; geographically separate stands largely respond together. |
| Ocean | `SeaShader.js`: six fixed component wavelengths, 4.3–64 m. `Weather.js`: one smoothed swell multiplier. | Storms amplify the same basic wave pattern. Long storm swell, short wind sea, breaking coverage and shelter do not evolve independently. |
| Sound | `Wind.js` / `RainLayer.js`: existing filtered noise and rain patter respond to intensity, with partly independent modulation. | Shared gust timing could make the visible bending, rain slant and wind roar feel like the same event. |

The existing coastal rollers still use the approximation documented in [OCEAN_RESEARCH.md](OCEAN_RESEARCH.md). Stronger storm settings will not resolve its uniform coastline behavior.

## Three possible approaches

| Approach | What changes | Tradeoff |
| --- | --- | --- |
| Presentation pass | Stronger rain layering, wet-weather visibility, coherent gust response, storm lighting and sound. | Fastest route to a more intense atmosphere; does not solve ocean propagation. |
| Coupled storm and sea state — recommended | Presentation pass plus separate swell/chop energy, evolving whitecaps and geographically varied coastal response. | Addresses all three requested elements while preserving the renderer; needs staged validation. |
| Full fluid/volumetric overhaul | Broad replacement of water and atmospheric simulation/rendering. | Highest implementation and performance risk, especially after the previous low-FPS regression. Not justified as the first experiment. |

## Implementation sequence to prototype

1. **One coherent storm event.** Extend the existing moving weather cells with a gust-front envelope. Sample the same world-space gust direction and strength for vegetation, rain, spray and sound. Preserve local shelter; do not let the viewer's position determine the storm over the entire island.
2. **Make heavy rain occupy the scene.** Retain nearby directional ribbons, add a restrained middle-distance sheet treatment, and connect it to the existing distant shafts. Introduce rain/spray extinction separately from valley fog. Allow lightning to reveal the rain volume briefly without making the whole frame permanently pale. Start with current particle counts; measure transparent overdraw before adding more.
3. **Give the ocean a storm state.** Separate long swell from short wind-driven waves and let their energy grow/decay at different rates. Evaluate a wider wavelength distribution within the existing wave budget first. Derive crest breaking, downwind foam streaks and limited crest spray from wave state. Keep the horizontal steepness bound and wavelength-aware mesh/detail limits.
4. **Carry that energy into varied shores.** Use the bathymetry/propagation prototype from the ocean research: an exposed headland, sandbar and sheltered bay must respond differently under identical offshore forcing. A short local squall may arrive over an existing swell; it must not instantly create a mature giant sea everywhere.
5. **Tune the overall event by watching it.** Use an approaching front, peak downpour and gradual recovery. Maintain dark troughs, readable wave faces and brief bright breaking crests. Let rough water persist after local rain ends. Preserve the established facet shading and reflection material.

[ECMWF's wave-model explanation](https://www.ecmwf.int/en/about/media-centre/focus/2026/ocean-wave-forecasting) describes energy distributed across frequencies and directions, with wind input, interaction, dissipation and propagation. A small game-oriented set of wave bands can borrow this separation of processes; it would not reproduce the forecast model's accuracy.

## Validation before adopting the prototype

- Repeatable coastal-gale fixture, viewed at sea level, from the cliff overlook, from a mountain and through a cave mouth. Include a sheltered bay under the same event.
- Record motion and audition sound. The gust should be legible in vegetation, rain direction and audio together. Heavy precipitation should obscure the distant scene while retaining nearby depth cues.
- Compare approach, peak and recovery. Check that rough swell outlives the local rain, and that breaking intensity varies with exposure and depth.
- Recheck snow/rain partitioning at altitude, dry cave interiors, reflection-camera precipitation, and finite wave displacement during transitions.
- Measure frame times while moving as well as stationary; inspect GPU work/overdraw, draw calls, texture memory and worker cost. Existing desktop observations were vsync-limited, so they are not evidence of unlimited headroom. Keep expensive spray and mist restricted to nearby active breaking regions.

The first deliverable should be one convincing, reproducible storm scene that demonstrates the sequence and its cost. Expanding the natural weather lifecycle comes after that scene passes visual and performance review.
