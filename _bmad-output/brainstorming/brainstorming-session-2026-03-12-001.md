---
stepsCompleted: [1, 2]
inputDocuments:
  - "_bmad-output/planning-artifacts/research/technical-WebGL-SVG-layered-rendering-research-2026-03-12.md"
session_topic: "WebGL + SVG Layered Rendering Architecture for Relief Icons"
session_goals: "Explore all viable approaches for achieving correct layer ordering when mixing WebGL (Three.js) and SVG rendering for the relief icons layer; specifically evaluate and expand on the multi-SVG/multi-DOM-element architecture; surface edge cases, risks, and non-obvious possibilities"
selected_approach: "Progressive Technique Flow"
techniques_used: []
ideas_generated: []
context_file: "_bmad-output/planning-artifacts/research/technical-WebGL-SVG-layered-rendering-research-2026-03-12.md"
---

# Brainstorming Session — WebGL Relief Icons Rendering Architecture

**User:** Azgaar
**Date:** 2026-03-12
**Project:** Fantasy-Map-Generator

---

## Session Overview

**Topic:** WebGL + SVG Layered Rendering Architecture — Relief Icons

**Goals:**

- Explore all viable approaches for mixing WebGL (Three.js) and SVG while preserving correct layer ordering
- Thoroughly evaluate the "split into multiple DOM elements, one per layer" proposal
- Surface edge cases, risks, performance characteristics, and non-obvious alternatives
- Push the idea space far past the obvious before organizing

### Core Problem Statement

The relief icons layer is currently SVG. The proposed change renders it via Three.js WebGL for performance. Three approaches have been considered:

1. **Canvas beside the SVG** — loses all layer interleaving (layers can't be placed between each other)
2. **WebGL inside `<foreignObject>`** — correct layering, but catastrophically slow (FBO composite on every frame)
3. **Split SVG into multiple DOM elements (1 per layer)** — some layers canvas/WebGL, some SVG, each independently moveable in the DOM to reconstruct layer order

The user needs to explore Option 3 deeply and discover any other viable approaches.

---
