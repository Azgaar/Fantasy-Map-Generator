# Fantasy Map Generator: Glossary

This glossary covers core terminology, data structures, and concepts used throughout the Fantasy Map Generator project. It is intended as a reference for contributors, users, and developers. This glossary is a living document, update it as new features and terminology are added to the project.

## General Concepts

- **Map**: The generated world, including all terrain, features, and data layers.
- **Cell**: The smallest unit of the map grid, representing a piece of land or water. Voronoi cell.
- **Grid**: The underlying voronoi structure of cells that make up the map.
- **Pack**: The main data object containing all world data (cells, burgs, states, cultures, etc.), created after 'repacking' the grid to discard most of ocean cells and add more cells along the coasts.
- **Layer**: A visual or logical overlay on the map (e.g., rivers, biomes, elevation).
- **SVG Layer**: A named group of SVG elements for a specific map feature.
- **Seed**: The value used for random number generation (reproducibility).

## Separation of Concerns

- **Generator**: A module that creates or simulates world data (e.g., heightmap-generator, cultures-generator). Lives in `src/generators/`.
- **Controller**: The UI / interaction layer (`src/controllers/`). Broader than the textbook MVC "controller": it covers **editors** (user-driven mutations of world data, e.g. coastline-editor, namesbase-editor), **tools**, and read-only **overviews** (e.g. market-overview, charts-overview). The unifying rule: UI that wraps the map and either routes user interaction or presents map state in a dialog/panel. Does **not** hold static data, app-shell services, or serialization.
- **Editor**: A Controller that mutates world data (e.g., coastline-editor, states-editor). The "C" of the conceptual MVC model.
- **Overview**: A read-only Controller that presents world data without mutating it (e.g., production-overview, market-overview, charts-overview).
- **Renderer**: The system that visualizes world data as SVG or WebGL graphics (`src/renderers/`).
- **Service**: App-shell / platform & asset infrastructure, unrelated to map domain state (e.g., PWA installation, auto-update, the font catalog & loading). Cross-cutting (may be consumed by IO, UI, and rendering alike) but owns no world data. Lives in `src/services/`.
- **IO**: Serialization and persistence — save, load, export, cloud storage (`src/io/`, legacy `public/modules/io/`).

## World Data & State

- **Culture**: A group of cells sharing cultural traits and modifiers.
- **Burg**: A settlement or city on the map, with population, culture, production, and so on.
- **State**: A political entity (country, kingdom, etc.) grouping multiple burgs.
- **Province**: A political or administrative subdivision of a State.
- **Religion**: A belief system and organization spreading across cells and burgs.
- **Biome**: A type of environment (e.g., desert, forest, tundra) assigned to cells.
- **Heightmap**: A grid of elevation values used to generate terrain.
- **Feature**: A special map object (ocean, island, lake, etc.).
- **River**: A water flow starting from a source cell and following the heightmap down to a lake or ocean.
- **Lake**: A fresh or salt water body contained entirely within land cells.
- **Route**: A road, trail, or sea lane connecting burgs.
- **Marker**: A specific point of interest placed on the map (e.g., volcano, battlefield, ruin).
- **Zone**: An arbitrary highlighted area of the map defined for custom purposes (e.g., danger zone, magic zone).
- **Diplomacy**: The system of political relationships (allies, enemies, neutral, vassals) between different States.
- **Regiment / Military**: The armed forces belonging to States or Burgs, represented by units.
- **Good**: A resource or product (e.g., wood, iron, grain) with properties like value, demand, and recipes. Raw goods have a `distribution`; manufactured goods have `recipes`.
- **Biome Output**: The baseline production *amount* of a good per unit of rural population in a given biome (stored as `good.biomeOutput`). Distinct from a Good Multiplier. _Avoid_: biome production, biome yield.
- **Good Multiplier**: A per-dimension scalar (number) that modifies a good's production when a cell matches a specific cultureType, culture id, state id, religion id, or biome id. Absent or 1 means no effect; 0 means no production. Multiple active multipliers combine multiplicatively. _Avoid_: production modifier, culture modifier.
- **Market**: A regional economic hub anchored at a burg. Owns per-good stock and price, mediates all flows between rural cells, burgs, and other markets.
- **Deal**: A record of a single transaction in the trade/markets system (`{seller, sellerType, buyer, buyerType, good, units, price, tax?}`). Stored in `pack.deals` and consumed by the trade animation and trade details UI. The optional `tax` field carries the sales-tax amount in currency units credited to the seller's state treasury.
- **Treasury**: Per-state accumulated balance in currency units. Fed each cycle by [[Sales Tax]] on deals where the seller belongs to the state and by [[Poll Tax]] on the state's population. Stored as `state.treasury`. Neutrals (state 0) keep treasury at 0.
- **Sales Tax**: Per-state rate (`state.salesTax`, `0–1`) applied to deals where the state is the seller. For local sales (burg → market) it is deducted from burg revenue. For global trade (market → market) it is added to the importer's landed cost, so high-tax exporters become less competitive. Base rate per [[State Form]]: Monarchy 0.15, Theocracy 0.25, Union 0.07, Republic 0.05, Anarchy 0.
- **Poll Tax**: Per-state flat fee (`state.pollTax`) levied per population point (rural + urban) once per cycle. Not deducted from any burg — it simply credits the state treasury, matching the frozen-cycle economy. Base rate per [[State Form]]: Monarchy 0.20, Theocracy 0.10, Union 0.13, Republic 0.15, Anarchy 0.
- **Trade Batch**: All deals sharing the same ordered `(seller burg, buyer burg)` endpoints, animated as one flow on the map.
- **Demand Category**: One of `food | utilities | construction | military | luxury`, evaluated in `DEMAND_PRIORITY` order during production and demand fill.
- **Namesbase**: A collection of linguistic rules, prefixes, and suffixes used to procedurally generate names for map entities.
- **Emblem**: A heraldic shield or flag representing a State, Province, or Burg.
- **Note**: User-defined text attached to a specific map entity (cell, burg, state) containing custom lore or description.
- **Icon**: A small graphic representing a good, biome, or feature.

## UI & User Interaction

- **Editor Tool**: Any interactive UI for editing map features (e.g., rivers-editor, provinces-editor).
- **Overview Tool**: A summary UI for a particular system (e.g., production-overview, market-overview).
- **Configurator**: A UI for setting up world generation parameters.
- **Submap**: A tool to generate a new, more detailed map strictly from a selected area of the current map.
