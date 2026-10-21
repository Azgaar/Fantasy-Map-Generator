# History Generator & Legends Browser

> **Deep, dated world history and interactive chronicle browsing for Azgaar's Fantasy Map Generator.**

---

## Overview

Stock FMG generates a rich snapshot of a world at a single target year. Cultures expand, religions branch, and nations stand with standing armies and diplomatic treaties—but until now, that world lacked a past.

The **History Generator** brings retroactive chronological depth to the map using the **Archaeologist** model: rather than executing an expensive, fragile forward simulation, it inspects the fully generated world and plausibly reconstructs the timeline of events that produced it.

## Key Features

- **Chronological Event Log (`pack.history.events`)**:
  - Automatically dates state foundings, wars, battles, independence movements, golden ages, plagues, migrations, and religious schisms.
  - Links events directly to entities (`states`, `cultures`, `religions`, `burgs`, and fallen `realms`).
  - Associates events with map coordinates (`loc`), enabling jump-to-location navigation.
- **Fallen Realms ("Ghost Empires")**:
  - Procedurally generates footprints of 1–3 fallen empires whose historical borders, collapse, and remnants explain modern national boundaries and enclaves.
  - Generates custom historical heraldry, capital ruins, and successor relations.
- **Physical Map Echoes**:
  - Grounds world landmarks in history: ruins and battlefield markers are placed from actual historical conflicts rather than scattered at random.
  - Sacked burgs and successor states gain contextual lore notes.
- **The Legends Browser**:
  - An interactive in-app chronicle UI (accessible via **Tools > Overviews > Legends**).
  - Chronological timeline grouped by eras with rich filtering (by entity, event type, or keyword).
  - Dedicated entity pages displaying an entity's complete historical narrative and relationships.
  - Click-to-zoom map integration.

## Architecture & Data Model

- **Layering**: Follows FMG's clean architecture:
  - `src/types/history.ts`: Core data structures (`HistoryEvent`, `Realm`, `HistRef`, `HistoryOverview`).
  - `src/generators/history-generator.ts`: Deterministic history generation pipeline running as the final stage of world generation.
  - `src/data/history-events.ts`: Event narrative templates, era markers, and historical text generation.
  - `src/controllers/history-overview.ts`: Native UI controller for the Legends Browser.
- **Persistence**: Saved directly in `.map` files under `pack.history`. Fully backwards-compatible with maps lacking history data.

---
*For development notes and architecture details, see [docs/plans/history-generation.md](../plans/history-generation.md).*
