# Pixi renderer prototype (historical)

This document records the former opt-in experiment. The prototype mode ended with the 2026-08-20 hard-cutover
decision. The current implementation boots Pixi unconditionally and does not support an SVG renderer opt-out.

The active roadmap and current status are in [pixi-renderer-migration.md](pixi-renderer-migration.md).

Removed prototype mechanisms:

- `?renderer=pixi`, `?renderer=svg`, and `?pixiTheme=...` startup behavior;
- separate state/biome renderer themes;
- `window.PixiMapPrototype` and its enable/disable/rebuild console API;
- lazy SVG fallback materialization during save/export;
- runtime SVG/Pixi comparison ownership switches.

The production renderer retains the useful prototype foundations: viewport-sized canvas rendering, shared typed camera,
retained cell geometry, renderer-neutral scenes, granular invalidation, bounded resolution, resource accounting, and
context recovery. Migrated layers are always Pixi-owned. SVG/HTML may remain temporarily only for layers and active
interaction overlays that have not been migrated yet.
