# Fantasy Map Generator (Unified Mod Fork)

> An enhanced fork of [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) unifying procedural world generation with retroactive historical chronicles, science-fiction star sector mapping, and turn-based grand strategy campaigns.

---

## What This Fork Is

Azgaar's *Fantasy Map Generator* is the premier open-source tool for procedural cartography and worldbuilding. This fork unifies three major creative expansions directly into the core application, delivering a seamless experience without external panels or fragile patches:

1. **[History Generator & Legends Browser](docs/history/README.md)** *(Shipped)*  
   Retroactively reconstructs the chronological history of generated worlds. Dates state foundings, wars, migrations, and schisms, seeds the ruins and battlefields of fallen empires, and provides an interactive in-app chronicle browser.

2. **[Astral Cartographer](docs/astral/README.md)** *(Content Integrated)*  
   Reimagines the procedural engine for science-fiction star sector cartography. Ships 12 sci-fi name bases and 3 culture sets (AstralTrek, AstralJammer, Grimdark) in core data, with upcoming stellar traits, celestial classifications, and space-map rendering.

3. **[OpenConquest: Atlas Invictus](docs/openconquest/README.md)** *(Integrated)*  
   Turns any generated map into an interactive, turn-based grand strategy campaign. Features strategic regions, settlement infrastructure, army recruitment, and deterministic battle mechanics running in a background Web Worker. Campaigns persist in the browser, keyed to the map.

---

## Architecture & Upstream Discipline

This fork follows FMG's native architectural layers:
- **State**: World data remains pure state, backward-compatible with stock `.map` files.
- **Generators**: New generation pipelines integrate as clean, deterministic steps.
- **Controllers & UI**: In-app tools (such as the Legends Browser and Conquest rail) register as native controllers.
- **Conquest Vertical**: The strategic campaign engine lives cleanly in `src/conquest/` as a self-contained vertical.

All modifications to stock files are designed to be append-only and minimally invasive. For upstream merge instructions and touch-point tracking, see **[`MERGING.md`](MERGING.md)**.

---

## Quickstart

### Prerequisites
- [Bun](https://bun.sh) (recommended) or [Node.js](https://nodejs.org) ≥ 20

### Development
```sh
# Install dependencies
bun install

# Start local development server
bun dev

# Run unit tests
bun test --preload ./src/test-setup.ts
```

### Production Build
```sh
bun run build
```

---

## Credits & Upstream

- Original project by [Azgaar](https://github.com/Azgaar): [Azgaar's Fantasy Map Generator](https://azgaar.github.io/Fantasy-Map-Generator)
- Official community: [Discord](https://discordapp.com/invite/X7E84HU) | [Reddit](https://www.reddit.com/r/FantasyMapGenerator) | [Patreon](https://www.patreon.com/azgaar)
- License: [MIT](LICENSE)
