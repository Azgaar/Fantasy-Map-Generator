# OpenConquest: Atlas Invictus

> **An open-source grand-strategy campaign game running directly inside Azgaar's Fantasy Map Generator.**

---

## Overview

**OpenConquest: Atlas Invictus** transforms any world generated in FMG into an interactive, turn-based grand strategy campaign map:

- **Provinces become Regions**: Strategic territories with tax yields, food output, recruitment capacities, and loyalty.
- **Burgs become Settlements**: Castles, ports, trade hubs, and fortress bastions with expandable infrastructure.
- **Regiments become Armies**: Strategic formations maneuvered across the map terrain, contesting borders, laying sieges, and engaging in tactical field battles.
- **Any World is Playable**: Play on any existing or newly generated `.map` file—no separate scenario editor or external tools required.

## Architecture

OpenConquest is designed as a clean, self-contained vertical in the FMG ecosystem:

- **Deterministic Rules Engine**:
  - Pure, deterministic simulation compiling a map pack and ruleset into an actionable game state.
  - Runs in a background **Web Worker**, so a large world never freezes the map. The worker is a Blob that imports the engine's own module URL, which keeps the engine out of the main bundle; if the browser refuses the worker (a strict CSP, for instance) the compile falls back to the main thread rather than failing.
- **Native UI & Layer Integration**:
  - Integrated into FMG's native Layers registry (`armies`, `regions`, `settlements`, `move-paths`, `selection`), so every layer appears in the _Layers_ tab with its own toggle and hotkey.
  - The **⚔ OpenConquest** button installs itself in the generator's top bar, and the campaign actions register themselves in the omnibar's command list — no separate panel to keep in sync.
- **Persistence**:
  - Campaigns persist locally in IndexedDB keyed by map ID.
  - Campaign archives can be exported and imported as JSON sessions without mutating the base `.map` file.

## In-Tree Roadmap

As outlined in [`docs/plans/mod-merge-plan.md`](../plans/mod-merge-plan.md):
- **Phase B**: Core transplant of engine, host compiler, rulesets, and UI components into `src/conquest/`.
- **Phase C**: Full Tools menu integration, layer restoration, and end-to-end test suites.

---
*For design specifications, see [docs/plans/mod-merge-plan.md](../plans/mod-merge-plan.md).*
