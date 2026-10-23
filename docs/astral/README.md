# Astral Cartographer

> **Science fiction star-sector cartography and interstellar worldbuilding for Azgaar's Fantasy Map Generator.**

---

## Overview

**Astral Cartographer** reimagines Azgaar's Fantasy Map Generator as a procedural science-fiction star sector map tool. Rather than replacing FMG's proven generator and editing workflows, Astral Cartographer maps the core domain into interstellar space:

| Fantasy Map Generator | Astral Cartographer |
|---|---|
| Landmass & coastlines | Sector dust, starfields, and void rifts |
| Elevation & mountains | Star density, nebulae, and stellar hazards |
| Rivers & routes | Hyperspace lanes, trade corridors, and warp gates |
| Burgs | **Star systems** |
| States & polities | Interstellar empires, federations, and syndicates |
| Cultures & religions | Species, civilizations, and philosophical creeds |
| Provinces | Galactic sectors |
| Relief & parchment styles | Star charts, sensor scans, and astrophysics overlays |

## Integrated Content

### Name Bases
12 science-fiction name bases built directly into core data (`src/data/name-bases.ts`):
- **AstralTrek**: `Trek Core`, `Trek Terran`, `Trek Continental`, `Trek Synthetic`
- **AstralJammer**: `Jammer Deep`, `Jammer Ethereal`, `Jammer Stoneborn`, `Jammer Wild`
- **Grimdark**: `Grimdark Core`, `Grimdark Gothic`, `Grimdark Iron`, `Grimdark Machine`

Each base provides rich pools of star system designations, planetary bodies, and polity names.

### Culture Sets
Three dedicated culture sets available directly from the Cultures generator dropdown:
- **AstralTrek** (`astralTrek`): Space-opera civilizations, high-tech federations, and exploratory fleets.
- **AstralJammer** (`astralJammer`): Planar voyagers, void sailors, and spell-jammer astral factions.
- **Grimdark** (`grimdark`): Feudal hive-worlds, gothic crusaders, iron legions, and machine cults.

Each set generates 8 distinct cultures with habitat scoring callbacks mapped to star-map preferences (`temperate`, `harsh`, `remote`, `any`). All three sets are fully supported by options schema validation and persistent option pinning.

## The mapping — polities, sectors and star systems

The content is only half the mapping. The other half is what FMG's own words become on a star map, and it is applied **on demand**, not during generation: a world stays a fantasy world until the author asks for it.

### Applying the naming

_Options_ → _Tools_ → **Astral Names** (or the "Apply Astral Naming" command in the omnibar) does three things:

- **the polities get their words** — a state's word comes from the `polities` group of its own culture's base, so a Trek state becomes a "United Federation" and a Grimdark one a "Compact". A state whose culture names from a stock base keeps FMG's own word, so a mixed map keeps each people's register.
- **the polities are named by the system that holds them** — a state takes the name of its capital, with no fantasy suffix. "Gant", not "Gantia".
- **the provinces become sectors** — "Gant Sector", "Yaxford Reach", "Aulacurus Belt".

The words are picked by a hash of the name, so a polity keeps its word between regenerations, and applying the naming twice changes nothing the second time.

### The star classes

A burg is a star system: a star with a class, a population, and the installations that make it what it is. The class follows the population, and the ladder runs from the comfortable to the exotic as the population falls:

| People | Class | Star |
|---|---|---|
| over 1 000 000 | G | yellow dwarf — the Sun-like homeworld, the most habitable there is |
| under 1 000 000 | F | white-yellow star — bright and comfortable |
| under 250 000 | K | orange dwarf — hardy, long-lived |
| under 50 000 | A | white star — hot and brilliant |
| under 10 000 | B | blue giant — spectacular, and short-lived |
| under 2 000 | M | red dwarf — flare-lit, tidal-locked, nobody's idea of a home |

The big worlds sit on the comfortable stars; the small ones on the exotic, harsh fringe. The rare, spectacular types belong to the smaller worlds, because they are spectacular, not comfortable.

The installations become the system's own: a port is a **shipyard**, a citadel a **bastion**, a plaza a **civic core**, a shanty a **drift**, a temple a **shrine**, walls are **shielding**.

### The Star Systems overview

_Options_ → _Tools_ → **Star Systems** lists every system on the map with its class, its people and its traits; clicking a row zooms to it. In the browser console, `Astral.systems()` returns the same list as data.

## The Astral view

_Options_ → _Layers_ → **View mode** → **Astral** turns the map into a star chart of one chosen
sector. The fantasy layer buttons are replaced by the Astral list — Sector Dust, Nebulae, Star
Density, Systems, Empires, Sectors, Borders, Hyperlanes, Anomalies and Labels — and the map takes the
Astral style: the void becomes deep space, the land becomes a starry dust sheet, nebulae and a
stellar-density heatmap appear, and every burg is drawn as a class-coloured star. There is no
galactic core or spiral arm. Leaving the mode restores the previous layers and style.

The full design is in [`docs/plans/astral-ui-overhaul.md`](../plans/astral-ui-overhaul.md).

## In-Tree Roadmap

As detailed in [`docs/plans/mod-merge-plan.md`](../plans/mod-merge-plan.md):
- **Phase A (Shipped)**: Core name bases, culture sets, and schema validation.
- **Phase D (Shipped)**: The mapping — polity and sector naming, the star classes and traits, and the Star Systems overview.
- **Shipped (Phase 1)**: The Astral view button, the mode-aware layer list and presets, the
  `options.map.astral` mode flag, and the three Astral layer slots.
- **Shipped (Phase 2)**: The `astral` style preset, the sector-dust and void starfields, and the
  nebula/density/system style sections.
- **Shipped (Phase 3)**: The nebula renderer (seeded cloud clusters) and the stellar-density
  heatmap (a population-weighted kernel over the burgs, banded on the cell graph).
- **Shipped (Phase 4)**: The star systems drawn as class-coloured markers on the chart, with the
  tooltip, click-to-edit, reveal and highlight seams, capital rings and port orbit ticks.
- **Planned**: Polish and docs — e2e coverage, README/wiki updates and the merge checklist.
  Planned in [`docs/plans/astral-ui-overhaul.md`](../plans/astral-ui-overhaul.md).

---
*For upstream merge tracking, see [MERGING.md](../../MERGING.md).*
