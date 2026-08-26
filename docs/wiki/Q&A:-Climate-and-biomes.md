Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Climate and biomes

### How do I make my world colder / put ice caps on both poles?
Options → Configure World → lower the pole temperatures, then Tools → regenerate Ice. Temperature is an annual average and applies to the whole world — per-biome temperature is not supported.

### How do I make my map more (or less) desert-like?
Adjust Precipitation in Options → Configure World: 0 gives a mostly unlivable desert, around 100 gives an Earth-like wet world. Wind direction also matters — the defaults already mimic Earth.

### How do I paint biomes exactly where I want them?
Tools → Biomes → click the brush button, choose a biome, and paint cells. This overrides the climate-based assignment. Biome data can't be imported, but names, colors and habitability are fully configurable in the Biomes editor.

### How do I change habitability?
Habitability comes from biomes. In Tools → Biomes you can change each biome's habitability percentage.

### Why are there no burgs or states in an area?
The area either has no culture assigned or its biome is uninhabitable (habitability 0, e.g. Glacier). Assign a culture and/or raise the biome's habitability, then regenerate or place burgs manually.

### Can I move where ice caps start without changing my biomes?
No — ice placement follows temperature, and changing temperature affects biomes. This isn't possible without code changes.
