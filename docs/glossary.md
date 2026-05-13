# Fantasy Map Generator: Glossary

This glossary covers core terminology, data structures, and concepts used throughout the Fantasy Map Generator project. It is intended as a reference for contributors, users, and developers.

---

## General Concepts

- **Map**: The generated world, including all terrain, features, and data layers.
- **Cell**: The smallest unit of the map voronoi grid, representing a piece of land or water.
- **Grid**: The underlying voronoi structure of cells that make up the map.
- **Pack**: The main data object containing all world data (cells, burgs, states, cultures, etc.).
- **Layer**: A visual or logical overlay on the map (e.g., rivers, biomes, elevation).
- **SVG Layer**: A named group of SVG elements for a specific map feature.

## Separation of Concerns

- **Generator**: A module that creates or simulates world data (e.g., heightmap-generator, cultures-generator).
- **Controller**: A UI tool module used for user-driven changes to world data (e.g., coastline-editor, namesbase-editor).
- **Renderer**: The system that visualizes world data as SVG or WebGL graphics.

## World Data & State

- **Burg**: A settlement or city on the map, with population, inventory, and production.
- **State**: A political entity (country, kingdom, etc.) grouping multiple burgs.
- **Culture**: A group of cells and burgs sharing cultural traits and modifiers.
- **Biome**: A type of environment (e.g., desert, forest, tundra) assigned to cells.
- **Heightmap**: A grid of elevation values used to generate terrain.
- **Feature**: A special map object (ocean, lake, mountain, etc.).
- **Good**: A resource or product (e.g., wood, iron, bread) with properties like value, demand, and recipes.
- **Market**: A regional economic hub where goods are bought and sold.
- **Trade**: The system for moving goods between markets and burgs, including redistribution and pricing.
- **Deal**: A record of a transaction in the trade system.

## UI & User Interaction

- **Editor Tool**: Any interactive UI for editing map features (e.g., rivers-editor, provinces-editor).
- **Overview Tool**: A summary UI for a particular system (e.g., production-overview, market-overview).
- **Configurator**: A UI for setting up world generation parameters.

## Miscellaneous

- **Icon**: A small graphic representing a good, biome, or feature.
- **Color Scheme**: The palette used for map rendering and UI.
- **Seed**: The value used for random number generation (reproducibility).

---

_This glossary is a living document. Please update as new features and terminology are added to the project._
