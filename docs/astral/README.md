# Astral Cartographer

> **Science fiction star-sector cartography and interstellar worldbuilding for Azgaar's Fantasy Map Generator.**

---

## Overview

**Astral Cartographer** reimagines Azgaar's Fantasy Map Generator as a procedural science-fiction star sector map tool. Rather than replacing FMG's proven generator and editing workflows, Astral Cartographer maps the core domain into interstellar space:

| Fantasy Map Generator | Astral Cartographer |
|---|---|
| Landmass & coastlines | Galactic plane, core, and void rifts |
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

## In-Tree Roadmap

As detailed in [`docs/plans/mod-merge-plan.md`](../plans/mod-merge-plan.md):
- **Phase A (Shipped)**: Core name bases, culture sets, and schema validation.
- **Phase D (Upcoming)**:
  - Custom star system, sector, and polity naming generators (`src/generators/astral-naming.ts`).
  - Stellar classification (spectral types, stellar remnants) and celestial traits derived from world data.
  - Nebula rendering, stellar density heatmaps, and sci-fi cartographic visual styles.

---
*For upstream merge tracking, see [MERGING.md](../../MERGING.md).*
