# Fantasy Map Generator (Unified Mod Fork)

> An enhanced fork of [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) unifying procedural world generation with dynamic seasonal simulation (Living World), science-fiction star sector cartography (Astral Cartographer), and chronological history (Legends Browser).

---

## What This Fork Is

Azgaar's *Fantasy Map Generator* is the premier open-source tool for procedural cartography and worldbuilding. This fork unifies major creative expansions directly into the core application, delivering a seamless experience without external panels or fragile patches:

1. **[Living World](docs/wiki/Living-World.md)** *(Integrated)*  
   Transforms static fantasy maps into an active, evolving living world. Advances time season by season across the native map: states draw and spend capacity pools (Military, Wealth, Stability, Culture), pursue ruler-weighted agendas, muster standing regiments, develop provinces, and fight wars. Provinces grapple with procedural **Troubles** and entrenched **Lairs** that launch seasonal raids against vulnerable settlements, while strained realms risk succession crises, rebellions, and secessionist breakaways. Features an interactive draggable HUD, live news ticker, detailed diorama inspector cards, and sandbox God-Mode controls.

2. **[Astral Cartographer](docs/astral/README.md)** *(Integrated)*  
   Reimagines the procedural engine for science-fiction star sector cartography. Ships 12 sci-fi name bases and 3 culture sets (AstralTrek, AstralJammer, Grimdark) in core data, on-demand polity/sector naming and star classes, and an **Astral view** that turns any map into an immersive star-sector chart — featuring nebulae, a stellar-density heatmap, and class-coloured star systems in place of burgs.

3. **[History Generator & Legends Browser](docs/history/README.md)** *(Shipped)*  
   Retroactively reconstructs the chronological history of generated worlds. Dates state foundings, wars, migrations, and schisms, seeds the ruins and battlefields of fallen empires, and provides an interactive in-app chronicle browser with time-slider epochs.

---

## Architecture & Upstream Discipline

This fork follows FMG's native architectural layers:
- **State**: World data remains pure state, backward-compatible with stock `.map` files.
- **Generators**: Simulation and history pipelines integrate as clean, deterministic steps (`src/generators/living-generator.ts`, `src/generators/history-generator.ts`).
- **Controllers & UI**: In-app tools (such as the Living World HUD and Legends Browser) register as native controllers.
- **Living World Engine**: The seasonal simulation advances the world directly in-canvas across native FMG layers (states, provinces, burgs, military, markers, history).

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

### What's next
The plans for ongoing and future work live in [`docs/plans`](docs/plans):

| Plan | What it covers |
|---|---|
| [`living-world.md`](docs/plans/living-world.md) | **Living World** — dynamic seasonal simulation, capacity pools, provincial troubles, lairs & raids, military muster, agendas, unrest, and ruler lifespans (shipped) |
| [`astral-ui-overhaul.md`](docs/plans/astral-ui-overhaul.md) | the **Astral view** — the star chart, nebulae, density and systems (shipped) |
| [`history-generation.md`](docs/plans/history-generation.md) | the shipped chronicle: events, fallen realms, the Legends browser |
| [`history-epochs.md`](docs/plans/history-epochs.md) | **epochs** — the political layer regenerated K times, so the past is causal and the borders can be scrubbed through time |
| [`mod-seams-proposal.md`](docs/plans/mod-seams-proposal.md) | the three upstream seams a mod needs to run on stock FMG (proposed upstream) |
| [`namebase-ids.md`](docs/plans/namebase-ids.md) | name bases keyed by stable five-letter ids instead of array position (done) |
| [`rpg-fantasy-cultures.md`](docs/plans/rpg-fantasy-cultures.md) | **RPG Fantasy** — the kitchen-sink culture set: 43 defined / 24 placed, 11 new namebases, faction titles (done) |

---

## Credits & Upstream

- Original project by [Azgaar](https://github.com/Azgaar): [Azgaar's Fantasy Map Generator](https://azgaar.github.io/Fantasy-Map-Generator)
- Official community: [Discord](https://discordapp.com/invite/X7E84HU) | [Reddit](https://www.reddit.com/r/FantasyMapGenerator) | [Patreon](https://www.patreon.com/azgaar)
- License: [MIT](LICENSE)
