# AI Agent & Gemini Development Guildlines: FMG Rebuild

Welcome! You are working on the high-performance full-stack rebuild of the Fantasy Map Generator (FMG). Your primary goal is to ensure exact feature replication, high performance, and extreme modularity.

## Core Architectural Rules

1. **Strict Separation of Simulation & View:**
   * **Simulation Modules** (e.g. heightmaps, hydrology, biomes) MUST be pure functions. They take states/inputs and return computed data. They must NEVER manipulate the DOM, SVG, canvas, or import any UI-related state.
   * **The Renderer** (WebGL/Canvas) is a read-only visualizer of the current State. It must NEVER mutate map data.
2. **Centralized Data Store:**
   * All shared states live in a single centralized store (e.g., Zustand or custom state store).
   * UI components and the renderer subscribe to specific state slices to avoid unnecessary re-renders.
3. **Backwards Compatibility:**
   * Any change to data structures must maintain support for serialization/deserialization of existing FMG `.map` files.
4. **Performance Targets:**
   * Re-rendering should maintain 60 FPS during zoom/pan operations.
   * Large compute pipelines (e.g. generating a 50k point map) must run asynchronously (in Web Workers or on the backend) to prevent UI thread blocking.

## Guardrails for Code Changes
* Do not introduce heavy runtime dependencies unless approved.
* Always prioritize array-based data layouts (Structure of Arrays) over object-oriented graphs for coordinate simulation logic to optimize CPU caches.
* Double quotes and semicolons are required in TS/JS files.
