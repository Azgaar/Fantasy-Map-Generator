# Style Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all layer styling from SVG DOM attributes into the typed, Zod-validated `style.layers` object, applied by one generic applier — the seam Azgaar's layer registry will call.

**Architecture:** Recursive `StyleNode = {presentation?, options?, children?}` keyed by layer `<g>` id. `presentation` is an open bag of raw SVG attribute names written to the DOM by a generic applier; `options` are typed per-layer knobs read by renderers (never written as attributes); `children` are styled child `<g>` sub-layers, same shape recursively. Presets become serialized Style objects; `data[48]` becomes authoritative; auto-update harvests old maps' DOM attributes.

**Tech Stack:** TypeScript (src/), classic JS (public/modules/ui/), Zod (new dep, sanctioned by Azgaar), vitest (node env, pure-core tests), Playwright e2e (`tests/e2e/`), Biome.

**Spec:** `docs/superpowers/specs/2026-08-14-style-migration-design.md` (copy it into the worktree at the same path in Task 1 — the plan argues from it).

## Global Constraints

- Base branch: `upstream/master` (Azgaar/Fantasy-Map-Generator) — NOT the fork's main. Merge `upstream/master` into the branch at every task boundary; Azgaar lands registry work in parallel.
- One complete branch/PR: every task must leave the app working (tsc 0, vitest green, e2e green, `npm run build` ok) — transitional invariant below.
- **Transitional invariant:** the applier writes `presentation` attrs to the DOM, so anything reading presentation attributes keeps working mid-branch. An `options`-backed attribute (e.g. `data-size`) may only be harvested/removed **in the same task** that migrates all its readers.
- A style change must never cause data regeneration (Azgaar's rule). Generation params (relief `density`) leave style for the global `options` object.
- `style` is a **script-scoped lexical global** (`public/main.js` top-level `let`), NOT `window.style`. TS reaches it via the ambient `declare var style: Style` in `src/types/global.ts:144`. Never write `window.style`.
- Upstream conventions: very few comments (why-not-how), Biome formatting (`npm run lint`), no AI attribution in commits or PR body, no Co-Authored-By lines.
- Unit tests run in vitest `environment: "node"` with stubbed `document` (`src/test-setup.ts`) — test pure cores, not DOM. DOM behavior is covered by Playwright e2e.
- Commit style: `feat:`/`fix:`/`refactor:`/`test:` prefixes, imperative, one logical change per commit.

## Layer tree (authoritative for all tasks)

`LayerId` = the `<g>` id the applier targets. Top-level layers and their styled `<g>` children:

| LayerId | children (`<g>` only) | options (typed) — replaces |
|---|---|---|
| `map` (the `<svg id="map">` root) | — | `background-color`, `data-filter` stay presentation on the root |
| `armies` | — | `fontSize` (`font-size`), `boxSize` (`box-size`) |
| `anchors` | dynamic burg groups | per-child `size` (`size` attr) |
| `biomes` | — | — |
| `borders` | `stateBorders`, `provinceBorders` | — |
| `burgIcons` | dynamic burg groups | per-child `size` (`size`) |
| `cells` | — | — |
| `coastline` | `sea_island`, `lake_island` | — |
| `compass` | — | `use` transform: `{x, y, scale}` (from `#compass > use` transform) |
| `coordinates` | — | `fontSize` (`data-size`+`font-size` pair collapses) |
| `cults` | — | — |
| `emblems` | `stateEmblems`, `provinceEmblems`, `burgEmblems` | per-child `size` (`data-size`) |
| `fogging` | — | — (opacity read moves to presentation read from store) |
| `goods` | `goodsCells`, `goodsIcons`, `goodsBurgs` | goodsIcons: `size` (`data-size`), `circle` (`data-circle`); goodsBurgs: `size` |
| `gridOverlay` | — | `type`, `scale`, `dx`, `dy` |
| `ice` | — | — |
| `labels` | `state`, `province`, `route`, `river`, `added` + dynamic burg groups | per-child `fontSize` (`data-size`/`font-size`), `dx`/`dy` (`data-dx`/`data-dy`) |
| `lakes` | `freshwater`, `salt`, `sinkhole`, `frozen`, `lava`, `dry` | — |
| `landmass` | — | — |
| `legend` | — | `fontSize` (`data-size`+`font-size`), `x` (`data-x`), `y` (`data-y`), `columns` (`data-columns`) |
| `markers` | — | `rescale` |
| `markets` | — | `size` (`data-size`), `fontSize` (`font-size`), `icon` (`data-icon`) |
| `oceanLayers` | — | `layers` (outline list e.g. `"-6,-3,-1"`), `baseFill` (`#oceanBase` fill), `pattern` `{href, opacity}` (`#oceanicPattern`) |
| `population` | `rural`, `urban` | — |
| `prec` | — | — |
| `provs` | — | — |
| `regions` | `statesBody`, `statesHalo` | statesHalo: `width` (`data-width`, read by zoom.ts) |
| `relig` | — | — |
| `rivers` | — | — (`data-basin` is transient UI state, NOT style — stays a DOM attr owned by rivers-overview) |
| `routes` | `roads`, `trails`, `searoutes` | — |
| `ruler` | — | `fontSize` (`data-size`+`font-size`) |
| `scaleBar` | — | `fontSize`, `barSize` (`data-bar-size`), `x`/`y` (`data-x`/`data-y`), `label` (`data-label`), `back` `{opacity, fill, stroke, strokeWidth, filter, top, right, bottom, left}` (`#scaleBarBack` rect + its `data-*`) |
| `temperature` | — | `fontSize` |
| `terrain` | — | `set`, `size` (relief; `density` moves to global options) |
| `terrs` | `landHeights`, `oceanHeights` | per-child `scheme`, `terracing`, `skip`, `relax`, `curve` |
| `texture` | — | `href` (`data-href`), `x` (`data-x`), `y` (`data-y`) — renderer builds the `<image>` |
| `tradeAnimation` | — | — |
| `vignette` | — | `rect` `{x, y, width, height, rx, ry, filter}` (`#vignette-rect`) |
| `zones` | — | — |

Non-`<g>` preset targets (`#vignette-rect`, `#scaleBarBack`, `#oceanBase`, `#oceanicPattern`, `#compass > use`, `#legendBox`) are **options on the parent layer** — `children` is strictly `<g>` sub-layers. Verify child nesting against the runtime SVG setup in `public/main.js` (the `<g>` tree is created there, not in index.html) before hardcoding a parent-child pair; if a listed child is actually a sibling at runtime, it becomes its own LayerId and the table above must be corrected in the same commit.

Presentation values are `string | number | null` — `null` means "remove the attribute" (matches current preset semantics; the applier calls `removeAttribute`).

---

### Task 1: Workspace, zod, and the parity-snapshot harness

**Files:**
- Create: worktree `~/dev/fmg-style-migration` on branch `style-migration` from `upstream/master`
- Create: `tests/e2e/style-parity.spec.ts`
- Create: `tests/fixtures/style-baseline.json` (generated at clean master — this is the regression net for the whole branch)
- Modify: `package.json` (+ `zod`)
- Copy in: `docs/superpowers/specs/2026-08-14-style-migration-design.md`, this plan

**Interfaces:**
- Produces: `collectStyleSnapshot()` page function inside the spec (per-layer map of styling attributes), baseline fixture consumed by every later task's verification.

- [ ] **Step 1: Create the worktree and branch**

```bash
cd ~/dev/Fantasy-Map-Generator
git fetch upstream
git worktree add ~/dev/fmg-style-migration -b style-migration upstream/master
cd ~/dev/fmg-style-migration
npm install   # NB: this machine normally uses the Nix develop flake; run inside it if npm is not on PATH
npx tsc --noEmit && npm test -- --run   # confirm clean baseline before any change
```

Expected: tsc 0 errors, all vitest tests pass.

- [ ] **Step 2: Copy the spec + plan into the worktree and commit**

```bash
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp ~/dev/Fantasy-Map-Generator/docs/superpowers/specs/2026-08-14-style-migration-design.md docs/superpowers/specs/
cp ~/dev/Fantasy-Map-Generator/docs/superpowers/plans/2026-08-14-style-migration.md docs/superpowers/plans/
git add docs && git commit -m "docs: style migration design and plan"
```

(Whether these docs stay in the final PR is Azgaar's call — keep them as separate commits so they can be dropped on rebase if he prefers.)

- [ ] **Step 3: Write the parity snapshot e2e spec**

`tests/e2e/style-parity.spec.ts`. It loads `tests/fixtures/demo.map`, waits for `mapId` (same pattern as `tests/e2e/load-map.spec.ts`), snapshots every styling attribute of every layer `<g>` and known styled child, and diffs against the committed baseline.

```ts
import {test, expect, type Page} from "@playwright/test";
import fs from "fs";
import path from "path";

const BASELINE_PATH = path.join(__dirname, "../fixtures/style-baseline.json");

// attributes that are styling (not content/geometry); id/class/transform-on-viewbox excluded
const STYLE_ATTRS = [
  "opacity", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
  "stroke-opacity", "filter", "mask", "font-size", "font-family", "letter-spacing", "shape-rendering",
  "data-size", "data-width", "data-x", "data-y", "data-columns", "data-href", "data-icon", "data-circle",
  "data-bar-size", "data-label", "data-top", "data-right", "data-bottom", "data-left", "data-filter",
  "set", "size", "density", "scheme", "terracing", "skip", "relax", "curve", "layers", "rescale",
  "type", "scale", "dx", "dy", "background-color", "box-size", "transform", "href", "x", "y",
  "width", "height", "rx", "ry", "style"
];

const TARGETS = [
  "#map", "#armies", "#anchors", "#biomes", "#borders", "#stateBorders", "#provinceBorders",
  "#burgIcons", "#cells", "#coastline", "#sea_island", "#lake_island", "#compass", "#coordinates",
  "#cults", "#emblems", "#stateEmblems", "#provinceEmblems", "#burgEmblems", "#fogging",
  "#goods", "#goodsCells", "#goodsIcons", "#goodsBurgs", "#gridOverlay", "#ice", "#labels",
  "#lakes", "#freshwater", "#salt", "#sinkhole", "#frozen", "#lava", "#dry", "#landmass",
  "#legend", "#markers", "#markets", "#oceanLayers", "#oceanBase", "#oceanicPattern",
  "#population", "#rural", "#urban", "#prec", "#provs", "#regions", "#statesBody", "#statesHalo",
  "#relig", "#rivers", "#routes", "#roads", "#trails", "#searoutes", "#ruler", "#scaleBar",
  "#scaleBarBack", "#temperature", "#terrain", "#terrs", "#landHeights", "#oceanHeights",
  "#texture", "#tradeAnimation", "#vignette", "#vignette-rect", "#zones"
];

function collectStyleSnapshot(page: Page) {
  return page.evaluate(
    ([targets, attrs]) => {
      const snapshot: Record<string, Record<string, string>> = {};
      for (const sel of targets) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const bag: Record<string, string> = {};
        for (const attr of attrs) {
          const value = el.getAttribute(attr);
          if (value !== null) bag[attr] = value;
        }
        snapshot[sel] = bag;
      }
      return snapshot;
    },
    [TARGETS, STYLE_ATTRS] as const
  );
}

test("styled attributes match the pre-migration baseline", async ({page}) => {
  await page.goto("/");
  await page.waitForSelector("#mapToLoad", {state: "attached"});
  await page.locator("#mapToLoad").setInputFiles(path.join(__dirname, "../fixtures/demo.map"));
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const snapshot = await collectStyleSnapshot(page);

  if (process.env.UPDATE_STYLE_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2));
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  // per-selector comparison => a failure names the exact layer and attribute
  for (const sel of Object.keys(baseline)) {
    expect.soft(snapshot[sel], sel).toEqual(baseline[sel]);
  }
});
```

- [ ] **Step 4: Generate the baseline at clean master and verify the test passes**

```bash
UPDATE_STYLE_BASELINE=1 npx playwright test tests/e2e/style-parity.spec.ts
npx playwright test tests/e2e/style-parity.spec.ts   # second run compares
```

Expected: baseline file written; second run PASSES.

**Baseline exception protocol:** later tasks that intentionally remove an options-backed attribute from the DOM (e.g. `data-size` after its reader migrates) must prune exactly those keys from `style-baseline.json` **in the same commit**, with the commit message naming them. The baseline shrinks; it never changes values.

- [ ] **Step 5: Add zod**

```bash
npm install zod
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/e2e/style-parity.spec.ts tests/fixtures/style-baseline.json
git commit -m "test: add style attribute parity baseline; add zod"
```

---

### Task 2: StyleNode schema and types

**Files:**
- Create: `src/services/styles/schema.ts`
- Create: `src/services/styles/schema.test.ts`
- Modify: `src/types/style.ts` (re-export inferred types; keep `ReliefStyle` alias until Task 12)

**Interfaces:**
- Produces:
  - `type PresentationValue = string | number | null`
  - `interface StyleNode { presentation?: Record<string, PresentationValue>; options?: Record<string, unknown>; children?: Record<string, StyleNode> }`
  - `type LayerId` — union of the 40 ids in the layer table
  - `interface Style { layers: Partial<Record<LayerId, StyleNode>> }`
  - `parseStyle(json: unknown): Style` — validates; strips invalid/unknown option keys with a `console.warn` naming layer+key; throws `ZodError` only if the top-level shape is not an object with `layers`
  - `layerOptionsSchemas: Partial<Record<LayerId, ZodType>>`
- Consumed by: every later task.

- [ ] **Step 1: Write failing tests**

`src/services/styles/schema.test.ts`:

```ts
import {describe, expect, test, vi} from "vitest";
import {parseStyle} from "./schema";

describe("parseStyle", () => {
  test("accepts a valid nested style and preserves unknown presentation keys", () => {
    const input = {
      layers: {
        routes: {
          presentation: {opacity: 0.9, mask: "url(#land)", "future-attr": "kept"},
          children: {roads: {presentation: {stroke: "#d06d5b", "stroke-width": 0.7}}}
        }
      }
    };
    const style = parseStyle(input);
    expect(style.layers.routes?.presentation?.["future-attr"]).toBe("kept");
    expect(style.layers.routes?.children?.roads.presentation?.stroke).toBe("#d06d5b");
  });

  test("presentation null means remove-attribute and survives parsing", () => {
    const style = parseStyle({layers: {rivers: {presentation: {filter: null}}}});
    expect(style.layers.rivers?.presentation?.filter).toBeNull();
  });

  test("strips an invalid typed option with a warning instead of failing the preset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const style = parseStyle({layers: {terrain: {options: {set: "colored", size: "not-a-number"}}}});
    expect(style.layers.terrain?.options).toEqual({set: "colored"});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("terrain"), expect.anything());
    warn.mockRestore();
  });

  test("drops unknown layer ids with a warning (outdated preset survives)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const style = parseStyle({layers: {notALayer: {presentation: {opacity: 1}}, cells: {}}});
    expect((style.layers as any).notALayer).toBeUndefined();
    expect(style.layers.cells).toEqual({});
    warn.mockRestore();
  });

  test("rejects a non-object", () => {
    expect(() => parseStyle("nope")).toThrow();
  });

  test("children recurse more than one level", () => {
    const style = parseStyle({
      layers: {labels: {children: {capital: {children: {inner: {presentation: {opacity: 1}}}}}}}
    });
    expect(style.layers.labels?.children?.capital.children?.inner.presentation?.opacity).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run services/styles/schema.test.ts`
Expected: FAIL — module `./schema` not found.

- [ ] **Step 3: Implement `src/services/styles/schema.ts`**

```ts
import {z} from "zod";

export type PresentationValue = string | number | null;

export interface StyleNode {
  presentation?: Record<string, PresentationValue>;
  options?: Record<string, unknown>;
  children?: Record<string, StyleNode>;
}

export const LAYER_IDS = [
  "map", "armies", "anchors", "biomes", "borders", "burgIcons", "cells", "coastline", "compass",
  "coordinates", "cults", "emblems", "fogging", "goods", "gridOverlay", "ice", "labels", "lakes",
  "landmass", "legend", "markers", "markets", "oceanLayers", "population", "prec", "provs",
  "regions", "relig", "rivers", "routes", "ruler", "scaleBar", "temperature", "terrain", "terrs",
  "texture", "tradeAnimation", "vignette", "zones"
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export interface Style {
  layers: Partial<Record<LayerId, StyleNode>>;
}

const presentationSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

const styleNodeSchema: z.ZodType<StyleNode> = z.lazy(() =>
  z.object({
    presentation: presentationSchema.optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    children: z.record(z.string(), styleNodeSchema).optional()
  })
);

// typed per-layer options; keys absent here mean the layer has no options
export const layerOptionsSchemas: Partial<Record<LayerId, z.ZodType>> = {
  armies: z.object({fontSize: z.number(), boxSize: z.number()}).partial(),
  compass: z.object({use: z.object({x: z.number(), y: z.number(), scale: z.number()}).partial()}).partial(),
  coordinates: z.object({fontSize: z.number()}).partial(),
  gridOverlay: z.object({type: z.string(), scale: z.number(), dx: z.number(), dy: z.number()}).partial(),
  legend: z.object({fontSize: z.number(), x: z.number(), y: z.number(), columns: z.number()}).partial(),
  markers: z.object({rescale: z.number()}).partial(),
  markets: z.object({size: z.number(), fontSize: z.number(), icon: z.string()}).partial(),
  oceanLayers: z
    .object({
      layers: z.string(),
      baseFill: z.string(),
      pattern: z.object({href: z.string(), opacity: z.number()}).partial()
    })
    .partial(),
  ruler: z.object({fontSize: z.number()}).partial(),
  scaleBar: z
    .object({
      fontSize: z.number(),
      barSize: z.number(),
      x: z.number(),
      y: z.number(),
      label: z.string(),
      back: z
        .object({
          opacity: z.number(),
          fill: z.string(),
          stroke: z.string(),
          strokeWidth: z.number(),
          filter: z.string().nullable(),
          top: z.number(),
          right: z.number(),
          bottom: z.number(),
          left: z.number()
        })
        .partial()
    })
    .partial(),
  temperature: z.object({fontSize: z.number()}).partial(),
  terrain: z.object({set: z.enum(["simple", "colored", "gray"]), size: z.number()}).partial(),
  texture: z.object({href: z.string(), x: z.number(), y: z.number()}).partial(),
  vignette: z
    .object({
      rect: z
        .object({
          x: z.string(),
          y: z.string(),
          width: z.string(),
          height: z.string(),
          rx: z.string(),
          ry: z.string(),
          filter: z.string().nullable()
        })
        .partial()
    })
    .partial()
};

// options living on a CHILD node (validated when parsing that child)
export const childOptionsSchemas: Record<string, z.ZodType> = {
  "emblems/stateEmblems": z.object({size: z.number()}).partial(),
  "emblems/provinceEmblems": z.object({size: z.number()}).partial(),
  "emblems/burgEmblems": z.object({size: z.number()}).partial(),
  "goods/goodsIcons": z.object({size: z.number(), circle: z.number()}).partial(),
  "goods/goodsBurgs": z.object({size: z.number()}).partial(),
  "regions/statesHalo": z.object({width: z.number()}).partial(),
  "terrs/landHeights": heightsOptions(),
  "terrs/oceanHeights": heightsOptions()
};

function heightsOptions() {
  return z
    .object({scheme: z.string(), terracing: z.number(), skip: z.number(), relax: z.number(), curve: z.string()})
    .partial();
}

const layersSchema = z.record(z.string(), styleNodeSchema);
const styleSchema = z.object({layers: layersSchema});

export function parseStyle(json: unknown): Style {
  const parsed = styleSchema.parse(json);
  const layers: Style["layers"] = {};

  for (const [key, node] of Object.entries(parsed.layers)) {
    if (!(LAYER_IDS as readonly string[]).includes(key)) {
      console.warn(`Style: dropping unknown layer "${key}"`, node);
      continue;
    }
    const layerId = key as LayerId;
    layers[layerId] = validateNodeOptions(node, layerId, layerOptionsSchemas[layerId]);
  }

  return {layers};
}

function validateNodeOptions(node: StyleNode, path: string, schema?: z.ZodType): StyleNode {
  const result: StyleNode = {...node};

  if (node.options) {
    if (!schema) {
      console.warn(`Style: dropping options on "${path}" (no options defined)`, node.options);
      delete result.options;
    } else {
      const options: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node.options)) {
        const check = schema.safeParse({[key]: value});
        if (check.success && key in (check.data as object)) options[key] = (check.data as Record<string, unknown>)[key];
        else console.warn(`Style: dropping invalid option "${path}.${key}"`, value);
      }
      result.options = options;
    }
  }

  if (node.children) {
    const children: Record<string, StyleNode> = {};
    for (const [childId, child] of Object.entries(node.children)) {
      children[childId] = validateNodeOptions(child, `${path}/${childId}`, childOptionsSchemas[`${path}/${childId}`]);
    }
    result.children = children;
  }

  return result;
}
```

(If the per-key `safeParse({[key]: value})` dance fights Zod's API in practice, an equivalent whole-object `schema.safeParse(node.options)` + manual diff of stripped keys is fine — the tested behavior is what's fixed, not the internals. Dynamic burg-group children under `labels`/`burgIcons`/`anchors` intentionally have no child schema — their options (`fontSize`, `dx`, `dy`, `size`) are validated when those layers are re-homed in Task 12; until then unknown child options on those layers must NOT warn-spam: add `labels/*`, `burgIcons/*`, `anchors/*` wildcard handling then, not now.)

- [ ] **Step 4: Wire types through `src/types/style.ts`**

Replace the hand-written interfaces with re-exports, keeping what current code still imports (`ReliefStyle`, `LabelGroupStyle`) until Task 12 removes their users:

```ts
export type {Style, StyleNode, LayerId, PresentationValue} from "@/services/styles/schema";
export {LAYER_IDS} from "@/services/styles/schema";

// legacy shapes, removed in the re-homing task
export interface ReliefStyle { set: "simple" | "colored" | "gray"; size: number; density: number }
export interface LabelGroupStyle { /* keep existing fields verbatim from current file */ }
```

**Important:** the current global `style` (main.js:174) does not yet have a `layers` key, and `declare var style: Style` in `global.ts` types it. To keep tsc green mid-branch, change `global.ts:144` to `var style: Style & LegacyStyle;` where `LegacyStyle` is the current interface (labels/burgIcons/anchors/relief), and add `layers: {}` to the literal in `public/main.js:174`. Both legacy halves die in Task 12.

- [ ] **Step 5: Run tests + tsc**

Run: `npx vitest run services/styles/schema.test.ts && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/styles/schema.ts src/services/styles/schema.test.ts src/types/style.ts src/types/global.ts public/main.js
git commit -m "feat: zod-validated recursive StyleNode schema for style.layers"
```

---

### Task 3: Generic applier

**Files:**
- Create: `src/services/styles/apply.ts`
- Create: `src/services/styles/apply.test.ts`

**Interfaces:**
- Consumes: `StyleNode`, `PresentationValue` from Task 2.
- Produces:
  - `interface AttributeOp { path: string[]; attr: string; value: string | null }` — `path` is the chain of child `<g>` ids below the layer root (empty = the root itself); numbers stringified.
  - `buildAttributeOps(node: StyleNode): AttributeOp[]` — pure, DOM-free.
  - `applyStyleNode(root: Element, node: StyleNode): void` — executes ops; creates a missing child `<g id=...>` (namespace `http://www.w3.org/2000/svg`) when a path segment doesn't exist; `value === null` → `removeAttribute`.
  - `applyLayerStyle(layerId: LayerId): void` — no-op if `document.getElementById(layerId)` is null (non-materialized layer picks its style up when it materializes — the registry seam).

- [ ] **Step 1: Write failing tests for the pure core**

`src/services/styles/apply.test.ts`:

```ts
import {describe, expect, test} from "vitest";
import {buildAttributeOps} from "./apply";

describe("buildAttributeOps", () => {
  test("flattens presentation and children into pathed ops, stringifying numbers", () => {
    const ops = buildAttributeOps({
      presentation: {opacity: 0.9, mask: "url(#land)"},
      children: {
        roads: {presentation: {"stroke-width": 0.7}},
        trails: {presentation: {filter: null}, children: {inner: {presentation: {stroke: "#fff"}}}}
      }
    });
    expect(ops).toEqual([
      {path: [], attr: "opacity", value: "0.9"},
      {path: [], attr: "mask", value: "url(#land)"},
      {path: ["roads"], attr: "stroke-width", value: "0.7"},
      {path: ["trails"], attr: "filter", value: null},
      {path: ["trails", "inner"], attr: "stroke", value: "#fff"}
    ]);
  });

  test("options never produce attribute ops", () => {
    expect(buildAttributeOps({options: {set: "simple", size: 2}})).toEqual([]);
  });

  test("empty node produces no ops", () => {
    expect(buildAttributeOps({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run services/styles/apply.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type {LayerId, StyleNode} from "./schema";

export interface AttributeOp {
  path: string[];
  attr: string;
  value: string | null;
}

export function buildAttributeOps(node: StyleNode, path: string[] = []): AttributeOp[] {
  const ops: AttributeOp[] = [];
  for (const [attr, raw] of Object.entries(node.presentation ?? {})) {
    ops.push({path, attr, value: raw === null ? null : String(raw)});
  }
  for (const [childId, child] of Object.entries(node.children ?? {})) {
    ops.push(...buildAttributeOps(child, [...path, childId]));
  }
  return ops;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function applyStyleNode(root: Element, node: StyleNode): void {
  for (const {path, attr, value} of buildAttributeOps(node)) {
    let el: Element = root;
    for (const childId of path) {
      let child = el.querySelector(`:scope > [id="${childId}"]`);
      if (!child) {
        child = document.createElementNS(SVG_NS, "g");
        child.setAttribute("id", childId);
        el.appendChild(child);
      }
      el = child;
    }
    if (value === null) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  }
}

export function applyLayerStyle(layerId: LayerId): void {
  const node = style.layers[layerId];
  const root = layerId === "map" ? document.getElementById("map") : document.getElementById(layerId);
  if (!node || !root) return;
  applyStyleNode(root, node);
}

window.applyLayerStyle = applyLayerStyle;
```

Add to `src/types/global.ts` window interface: `applyLayerStyle: typeof import("../services/styles/apply").applyLayerStyle;` (same pattern as `drawRelief` at global.ts:34).

- [ ] **Step 4: Run tests + tsc**

Run: `npx vitest run services/styles/apply.test.ts && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/styles/apply.ts src/services/styles/apply.test.ts src/types/global.ts
git commit -m "feat: generic style applier over StyleNode trees"
```

---

### Task 4: Store helpers

**Files:**
- Create: `src/services/styles/store.ts`
- Create: `src/services/styles/store.test.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 3 `applyLayerStyle`.
- Produces (all exposed on `window` for `public/modules/ui/*.js`):
  - `ensureStyleShape(input: Style): Style` — fills missing `layers` keys with `{}` so accessors never null-check the layer entry.
  - `getStyleNode(layerId: LayerId, ...childIds: string[]): StyleNode` — creates intermediate nodes on demand (write-through accessor for the editor).
  - `getLayerOptions<T extends object>(layerId: LayerId, ...childIds: string[]): T` — returns `options ?? {}` typed by the caller.
  - `setPresentation(target: {layerId: LayerId; childIds?: string[]}, attr: string, value: string | number | null): void` — writes the object, then `applyLayerStyle(layerId)`.
  - `setOptions(target: {layerId: LayerId; childIds?: string[]}, patch: Record<string, unknown>): void` — merges the patch; **never** touches the DOM (callers redraw what the option affects).

- [ ] **Step 1: Write failing tests**

```ts
import {beforeEach, describe, expect, test} from "vitest";
import {ensureStyleShape, getLayerOptions, getStyleNode, setOptions, setPresentation} from "./store";
import {LAYER_IDS} from "./schema";

beforeEach(() => {
  (globalThis as any).style = ensureStyleShape({layers: {}});
});

describe("style store", () => {
  test("ensureStyleShape fills every layer id", () => {
    expect(Object.keys(style.layers).sort()).toEqual([...LAYER_IDS].sort());
  });

  test("getStyleNode materializes child chain on demand", () => {
    const node = getStyleNode("routes", "roads");
    node.presentation = {stroke: "#000"};
    expect(style.layers.routes?.children?.roads.presentation?.stroke).toBe("#000");
  });

  test("setPresentation writes through to the object", () => {
    setPresentation({layerId: "rivers"}, "fill", "#5d97bb");
    expect(style.layers.rivers?.presentation?.fill).toBe("#5d97bb");
  });

  test("setOptions merges without clobbering siblings", () => {
    setOptions({layerId: "terrain"}, {set: "gray"});
    setOptions({layerId: "terrain"}, {size: 2});
    expect(getLayerOptions("terrain")).toEqual({set: "gray", size: 2});
  });
});
```

(`applyLayerStyle` inside `setPresentation` is a no-op under node env because `document.getElementById` is stubbed to `null` — exactly the non-materialized-layer path.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run services/styles/store.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import {applyLayerStyle} from "./apply";
import {LAYER_IDS, type LayerId, type PresentationValue, type Style, type StyleNode} from "./schema";

export function ensureStyleShape(input: Style): Style {
  const layers = {...input.layers};
  for (const id of LAYER_IDS) layers[id] ??= {};
  return {...input, layers};
}

export function getStyleNode(layerId: LayerId, ...childIds: string[]): StyleNode {
  let node = (style.layers[layerId] ??= {});
  for (const childId of childIds) {
    node.children ??= {};
    node = node.children[childId] ??= {};
  }
  return node;
}

export function getLayerOptions<T extends object>(layerId: LayerId, ...childIds: string[]): T {
  return (getStyleNode(layerId, ...childIds).options ?? {}) as T;
}

interface StyleTarget {
  layerId: LayerId;
  childIds?: string[];
}

export function setPresentation(target: StyleTarget, attr: string, value: PresentationValue): void {
  const node = getStyleNode(target.layerId, ...(target.childIds ?? []));
  node.presentation ??= {};
  if (value === null) node.presentation[attr] = null;
  else node.presentation[attr] = value;
  applyLayerStyle(target.layerId);
}

export function setOptions(target: StyleTarget, patch: Record<string, unknown>): void {
  const node = getStyleNode(target.layerId, ...(target.childIds ?? []));
  node.options = {...node.options, ...patch};
}

window.ensureStyleShape = ensureStyleShape;
window.getStyleNode = getStyleNode;
window.getLayerOptions = getLayerOptions;
window.setPresentation = setPresentation;
window.setOptions = setOptions;
```

Add the five `window.*` declarations to `src/types/global.ts` (same import-type pattern).

- [ ] **Step 4: Run** — `npx vitest run services/styles && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** — `git add src/services/styles src/types/global.ts && git commit -m "feat: style store accessors and write-through helpers"`

---

### Task 5: Legacy preset upgrader

**Files:**
- Create: `src/services/styles/legacy.ts`
- Create: `src/services/styles/legacy.test.ts`
- Create: `tools/convert-style-presets.mjs` (thin node wrapper; the mapping lives in `legacy.ts` and ships, because users upload old presets forever)

**Interfaces:**
- Consumes: Task 2 `parseStyle`.
- Produces:
  - `isLegacyPreset(json: object): boolean` — true when any top-level key starts with `#`.
  - `upgradeLegacyPreset(legacy: Record<string, Record<string, unknown>>): Style` — full selector→node mapping, output already `parseStyle`-validated.

**The mapping (single source of truth — implement exactly):**

Selector → node path (`layers.<id>` unless stated) + attribute routing. Attributes route to `options` per the layer table in the plan header (with renames listed there, e.g. `data-size`→`size`/`fontSize`, `data-width`→`width`, `data-href`→`href`); every other attribute lands in `presentation` verbatim; `id` is skipped; `null`/`"null"` becomes `null`.

| Legacy selector(s) | Node path |
|---|---|
| `#map` | `layers.map` |
| `#armies #biomes #cells #coastline #compass #coordinates #cults #emblems #fogging #gridOverlay #ice #labels #lakes #landmass #legend #markers #markets #population #prec #provs #relig #rivers #routes #ruler #scaleBar #temperature #terrain #terrs #texture #tradeAnimation #vignette #zones #oceanLayers #borders #burgIcons #anchors` | `layers.<id>` |
| `#stateBorders`, `#provinceBorders` | `layers.borders.children.<id>` |
| `#sea_island`, `#lake_island` | `layers.coastline.children.<id>` |
| `#freshwater #salt #sinkhole #frozen #lava #dry` | `layers.lakes.children.<id>` |
| `#rural`, `#urban` | `layers.population.children.<id>` |
| `#roads #trails #searoutes` | `layers.routes.children.<id>` |
| `#statesBody`, `#statesHalo` | `layers.regions.children.<id>` (halo `data-width` → child `options.width`) |
| `#goodsCells #goodsIcons #goodsBurgs` | `layers.goods.children.<id>` (`data-size`→`options.size`, `data-circle`→`options.circle`) |
| `#terrs > #landHeights`, `#terrs #landHeights` (both spellings exist) and ocean twin | `layers.terrs.children.<id>`; `scheme terracing skip relax curve` → child `options` |
| `#emblems > #stateEmblems` etc. | `layers.emblems.children.<id>`; `data-size` → `options.size` |
| `#labels > #<group>` | `layers.labels.children.<group>`; `data-size`→`options.fontSize` (dual `font-size` kept in presentation), `data-dx/data-dy`→`options.dx/dy` |
| `#burgIcons > g#<group>`, `#anchors > g#<group>` | `layers.<burgIcons\|anchors>.children.<group>`; `size`→`options.size` |
| `#compass > use` | `layers.compass.options.use` — parse `transform: "translate(x y) scale(s)"` into `{x, y, scale}` |
| `#vignette-rect` | `layers.vignette.options.rect` (`{x,y,width,height,rx,ry,filter}`) |
| `#scaleBarBack` | `layers.scaleBar.options.back` (`data-top`→`top` etc., `stroke-width`→`strokeWidth`) |
| `#oceanBase` | `layers.oceanLayers.options.baseFill` (from `fill`) |
| `#oceanicPattern` | `layers.oceanLayers.options.pattern` (`{href, opacity}`) |
| `#oceanLayers` `layers` attr | `layers.oceanLayers.options.layers` |
| `#terrain` `set/size` | `options.set/size`; **`density` → dropped here** (Task 12 routes it to global options during map auto-update; presets stop carrying it) |
| `#texture` `data-x/data-y/data-href` | `options.x/y/href` |
| `#legend` `data-x/data-y/data-columns/data-size` | `options.x/y/columns/fontSize` |
| `#legendBox` | `layers.legend.presentation` merge (it styles the same box; if demo data shows it distinct, `layers.legend.options.box`) |
| `#gridOverlay` `type/scale/dx/dy` | `options` |
| `#markers` `rescale` | `options.rescale` |
| `#markets` `data-size/data-icon/font-size` | `options.size/icon/fontSize` |
| `#ruler #coordinates #temperature` `data-size`+`font-size` | `options.fontSize` (single value; presentation `font-size` kept for now, removed when each reader migrates) |
| `#armies` `box-size/font-size` | `options.boxSize/fontSize` |
| `#scaleBar` `data-bar-size/data-x/data-y/data-label/font-size` | `options.barSize/x/y/label/fontSize` |

- [ ] **Step 1: Write failing golden tests** — feed the real `public/styles/default.json` (read with `fs` from the repo, vitest runs in node) plus focused cases:

```ts
import fs from "node:fs";
import path from "node:path";
import {describe, expect, test} from "vitest";
import {isLegacyPreset, upgradeLegacyPreset} from "./legacy";

const defaultPreset = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../../public/styles/default.json"), "utf8")
);

describe("upgradeLegacyPreset", () => {
  test("detects legacy format", () => {
    expect(isLegacyPreset(defaultPreset)).toBe(true);
    expect(isLegacyPreset({layers: {}})).toBe(false);
  });

  test("routes flat layer attributes to presentation", () => {
    const style = upgradeLegacyPreset(defaultPreset);
    expect(style.layers.fogging?.presentation).toMatchObject({opacity: 0.98, fill: "#30426f"});
  });

  test("routes nested groups to children", () => {
    const style = upgradeLegacyPreset(defaultPreset);
    expect(style.layers.routes?.children?.roads.presentation?.["stroke-width"]).toBeDefined();
    expect(style.layers.terrs?.children?.landHeights.options).toMatchObject({scheme: "bright"});
  });

  test("routes renderer knobs to options with renames", () => {
    const style = upgradeLegacyPreset(defaultPreset);
    expect(style.layers.emblems?.children?.stateEmblems.options).toEqual({size: 1});
    expect(style.layers.oceanLayers?.options).toMatchObject({layers: "-6,-3,-1", baseFill: "#466eab"});
    expect(style.layers.scaleBar?.options).toMatchObject({back: expect.objectContaining({top: 20})});
    expect(style.layers.terrain?.options).toEqual({set: "simple", size: 1}); // density dropped
    expect(style.layers.compass?.options).toEqual({use: {x: 80, y: 80, scale: 0.25}});
  });

  test("every selector in every system preset is consumed (no silent drops)", () => {
    const stylesDir = path.join(__dirname, "../../../public/styles");
    for (const file of fs.readdirSync(stylesDir)) {
      const preset = JSON.parse(fs.readFileSync(path.join(stylesDir, file), "utf8"));
      expect(() => upgradeLegacyPreset(preset)).not.toThrow();
    }
  });
});
```

Add to `upgradeLegacyPreset` a hard rule: an unrecognized selector throws (`Unknown legacy selector "X"`) — the 12-preset sweep test then proves the mapping is complete. (User-uploaded presets go through a `try/catch` at the call site in Task 6 that warns and skips the selector instead.) Export `upgradeLegacyPreset(legacy, {onUnknownSelector: "throw" | "skip"})` with `"throw"` default so both behaviors are testable.

- [ ] **Step 2: Run to verify failure** — FAIL, module not found.

- [ ] **Step 3: Implement `legacy.ts`** — table-driven: a `Record<string, (attrs) => void>` of exact-selector handlers over a shared `routeAttrs(node, attrs, optionRenames)` helper, plus prefix rules for `#labels > #…`, `#burgIcons > g#…`, `#anchors > g#…`, `#terrs…`, `#emblems > #…`. Finish with `return parseStyle({layers})` so the output is always validated. ~150 lines.

- [ ] **Step 4: Run tests** — `npx vitest run services/styles/legacy.test.ts` → PASS.

- [ ] **Step 5: Write `tools/convert-style-presets.mjs`**

```js
// one-off: node tools/convert-style-presets.mjs  (rerunnable; skips already-converted files)
import fs from "node:fs";
import path from "node:path";
const {isLegacyPreset, upgradeLegacyPreset} = await import("../src/services/styles/legacy.ts").catch(async () => {
  // vite-node fallback if plain node can't load TS
  throw new Error("run with: npx vite-node tools/convert-style-presets.mjs");
});

const dir = path.resolve("public/styles");
for (const file of fs.readdirSync(dir)) {
  const p = path.join(dir, file);
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!isLegacyPreset(json)) continue;
  fs.writeFileSync(p, JSON.stringify(upgradeLegacyPreset(json), null, 2) + "\n");
  console.log("converted", file);
}
```

(If the TS-import friction is real, invoke via `npx vite-node`; the wrapper stays 20 lines either way.)

- [ ] **Step 6: Commit**

```bash
git add src/services/styles/legacy.ts src/services/styles/legacy.test.ts tools/convert-style-presets.mjs
git commit -m "feat: legacy selector-keyed preset upgrader"
```

---

### Task 6: Convert system presets + rewire the preset pipeline

**Files:**
- Modify: all 12 `public/styles/*.json` (script-generated — commit as its own commit, reviewable diff)
- Modify: `public/modules/ui/style-presets.js` (`applyStylePreset`, `collectStyleData` path, localStorage read)
- Test: `src/services/styles/legacy.test.ts` gains a round-trip case; e2e parity from Task 1 is the DOM check

**Interfaces:**
- Consumes: `parseStyle`, `isLegacyPreset`, `upgradeLegacyPreset`, `ensureStyleShape`, `applyLayerStyle` via `window.*`.
- Produces: new-format presets on disk; `applyStylePreset(json)` accepting BOTH formats; `collectStyleData()` returning `JSON.stringify(style, null, 2)`.

- [ ] **Step 1: Convert the 12 files and eyeball one**

```bash
npx vite-node tools/convert-style-presets.mjs
git diff --stat public/styles
python3 -c "import json; d=json.load(open('public/styles/default.json')); print(list(d['layers'].keys())[:8])"
```

Expected: 12 files rewritten, top-level key `layers`.

- [ ] **Step 2: Add the schema round-trip test for converted files**

In `legacy.test.ts` (or a new `presets.test.ts`):

```ts
test("all converted system presets parse cleanly with zero warnings", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const stylesDir = path.join(__dirname, "../../../public/styles");
  for (const file of fs.readdirSync(stylesDir)) {
    parseStyle(JSON.parse(fs.readFileSync(path.join(stylesDir, file), "utf8")));
  }
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
```

(Write this test FIRST against the un-converted files → it fails → run the script → it passes. That is the TDD cycle for the conversion.)

- [ ] **Step 3: Rewire `applyStylePreset` in `public/modules/ui/style-presets.js`**

Replace the selector walk (lines ~72–158) with:

```js
function applyStylePreset(presetJson) {
  const upgraded = isLegacyPreset(presetJson)
    ? upgradeLegacyPreset(presetJson, {onUnknownSelector: "skip"})
    : parseStyle(presetJson);

  style = ensureStyleShape(upgraded);

  for (const layerId of Object.keys(style.layers)) applyLayerStyle(layerId);

  // options consumers that must re-render on preset change (grows as tasks migrate readers):
  if (layerIsOn("toggleRelief")) drawRelief();
}
```

Keep `applyStyleWithUiRefresh` (style-presets.js:185–204) calling this then refreshing editors/redraws exactly as today. Keep the existing label-group default fill-in behavior: after `ensureStyleShape`, for each label group present in the map but missing from the preset, copy the default group of its type (port of the current lines 146–155 — reuse its logic over `style.layers.labels.children`).

Preset READS from localStorage (`fmgStyle_*`) and file upload flow through this same function — legacy ones hit the upgrader path automatically. `style.relief`/`style.labels` legacy mirrors must keep working until Task 12: after `ensureStyleShape`, copy `layers.terrain.options` → `style.relief` (with existing `density` preserved) and leave the labels/burgIcons/anchors legacy objects untouched (their preset entries also still land in `style.layers`; dual-write is fine and dies in Task 12).

- [ ] **Step 4: Rewire `collectStyleData` (style-presets.js:215–466)**

The 170-line selector map becomes:

```js
function collectStyleData() {
  return JSON.stringify(style, null, 2);
}
```

…but ONLY once the live `style.layers` is actually populated from the DOM — which happens in Task 7's harvest. **Ordering rule:** implement Step 4 as a follow-up commit inside Task 7, not here. In this task, `addStylePreset` keeps the old collector. (This is the one deliberately-deferred edit in the plan; it is restated in Task 7 Step 5.)

- [ ] **Step 5: Verify in e2e**

```bash
npx tsc --noEmit && npx vitest run services/styles
npx playwright test tests/e2e/style-parity.spec.ts tests/e2e/load-map.spec.ts
```

Expected: all green. The parity test proves converted-preset apply ≡ old-preset apply on a fresh map load. (`applyStyleOnLoad` at main.js:302 now fetches a converted JSON and routes through the new path.)

- [ ] **Step 6: Commit (two commits)**

```bash
git add public/styles && git commit -m "feat: convert system style presets to style.layers format"
git add public/modules/ui/style-presets.js src/services/styles && git commit -m "feat: apply style presets through the style.layers pipeline"
```

---

### Task 7: Persistence — validated load, apply-on-load, presentation harvest

**Files:**
- Modify: `src/services/io/load.ts` (~487 and the layer-toggle reconstruction block ~495–545 stays untouched this task)
- Modify: `src/services/io/auto-update.ts` (new `isOlderThan` block at the end of `resolveVersionConflicts`)
- Modify: `public/modules/ui/style-presets.js` (`collectStyleData` — deferred Step from Task 6)
- Modify: `src/services/versioning.ts` (bump if the local convention requires a version constant; mirror what commit 41c7d455 did for 1.142.0)
- Test: `tests/e2e/load-map.spec.ts` (extend with the legacy-styles migration case)

**Interfaces:**
- Consumes: `parseStyle`, `ensureStyleShape`, `applyLayerStyle`, layer table.
- Produces: `harvestLegacyLayerStyles()` in auto-update.ts (not exported beyond the module); `data[48]` authoritative for presentation of every layer.

- [ ] **Step 1: Write the failing e2e test** — extend `tests/e2e/load-map.spec.ts` using its existing `buildLegacyReliefMap` pattern; the 1.139.4 fixture predates ALL of this, so loading it as-is must populate `style.layers` and strip nothing visible:

```ts
test("legacy map styles are harvested into style.layers", async ({page}) => {
  const fileInput = page.locator("#mapToLoad");
  await fileInput.setInputFiles(path.join(__dirname, "../fixtures/1.139.4.map"));
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const harvested = await page.evaluate(() => ({
    // style is script-scoped: read the lexical global, not window
    rivers: (style as any).layers.rivers,
    roads: (style as any).layers.routes?.children?.roads,
    haloWidth: (style as any).layers.regions?.children?.statesHalo?.options?.width,
    riversFillDom: document.getElementById("rivers")?.getAttribute("fill")
  }));

  expect(harvested.rivers.presentation.fill).toBeDefined();
  expect(harvested.roads.presentation.stroke).toBeDefined();
  expect(typeof harvested.haloWidth).toBe("number");
  // applier re-wrote the same value the SVG carried — parity, not deletion
  expect(harvested.riversFillDom).toBe(harvested.rivers.presentation.fill);
});
```

Run: `npx playwright test tests/e2e/load-map.spec.ts` → new test FAILS (`layers.rivers` undefined).

- [ ] **Step 2: Load-side validation in `load.ts`**

Replace `if (data[48]) style = JSON.parse(data[48]);` (load.ts:487) with:

```ts
if (data[48]) {
  const parsed = JSON.parse(data[48]);
  const legacyKeys = (({labels, burgIcons, anchors, relief}) => ({labels, burgIcons, anchors, relief}))(parsed);
  style = Object.assign(ensureStyleShape(parseStyle({layers: parsed.layers ?? {}})), legacyKeys);
} else {
  style = ensureStyleShape({layers: {}});
}
```

(Old maps have `parsed.layers === undefined` → empty shape, harvest fills it next. The legacy `labels/burgIcons/anchors/relief` keys ride along untyped until Task 12.)

- [ ] **Step 3: Harvest block in `auto-update.ts`**

Append to `resolveVersionConflicts` (template: the 1.142.0 block at auto-update.ts:1526–1550). Runs for every map older than the release version this ships in (use the next minor, e.g. `isOlderThan("1.143.0")` — confirm against `package.json` version at merge time):

```ts
if (isOlderThan("1.143.0")) {
  // styles moved from svg attributes to style.layers; harvest what the old file carried
  harvestLegacyLayerStyles();
}
```

`harvestLegacyLayerStyles()` (same file): reuse the legacy upgrader's brain — build a legacy-preset-shaped object from the DOM using the exact selector list from `legacy.ts` (export `LEGACY_SELECTOR_ATTRIBUTES: Record<string, string[]>` from legacy.ts — selector → attribute names, derived from the same table), then:

```ts
function harvestLegacyLayerStyles(): void {
  const legacy: Record<string, Record<string, unknown>> = {};
  for (const [selector, attributes] of Object.entries(LEGACY_SELECTOR_ATTRIBUTES)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const bag: Record<string, unknown> = {};
    for (const attr of attributes) {
      const value = el.getAttribute(attr);
      if (value !== null) bag[attr] = value;
    }
    if (Object.keys(bag).length) legacy[selector] = bag;
  }
  const harvested = upgradeLegacyPreset(legacy, {onUnknownSelector: "skip"});
  // harvested wins over nothing; existing style.layers (from data[48] of a mid-format map) wins over harvest
  style = ensureStyleShape({layers: deepMerge(harvested.layers, style.layers)});
}
```

`deepMerge(base, override)` — 15-line recursive object merge, lives in `store.ts`, unit-tested there (add the test in this task: override presentation keys win, children merge recursively). Numeric coercion: `upgradeLegacyPreset` already coerces numeric strings via the schema — verify the schema's presentation union tolerates numeric strings staying strings (they do; applier stringifies anyway; options schemas need `z.coerce.number()` — **switch the numeric option fields in Task 2's schemas to `z.coerce.number()` in this task if harvest feeds strings**, adding a schema test case).

**Do NOT removeAttribute anything here.** Presentation attrs stay on the DOM (applier will keep them in sync); options-backed attrs are removed later, per-reader, per the transitional invariant.

- [ ] **Step 4: Apply after load**

In `parseLoadedData`, after `resolveVersionConflicts` and near the existing draw calls (load.ts:816–822, where `drawRelief` was added by 41c7d455), add:

```ts
for (const layerId of Object.keys(style.layers)) applyLayerStyle(layerId as LayerId);
```

The object now wins over whatever the embedded SVG carried.

- [ ] **Step 5: `collectStyleData` becomes the serializer** (deferred from Task 6 Step 4) — now that a loaded/generated map always has a populated `style.layers` (fresh maps: `applyStyleOnLoad` populates via preset; loaded maps: data[48] or harvest):

```js
function collectStyleData() {
  return JSON.stringify(style, null, 2);
}
```

Delete the 170-line `attributes` map and the DOM `getAttribute` collection loop (style-presets.js:219–436), keeping `addStylePreset`'s dialog/UI shell.

- [ ] **Step 6: Verify everything**

```bash
npx tsc --noEmit && npx vitest run
npx playwright test tests/e2e/
```

Expected: new e2e test PASSES; parity spec PASSES (attribute values unchanged — harvest+apply is idempotent on the same values); `load-map.spec.ts` relief cases still pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/io/load.ts src/services/io/auto-update.ts src/services/styles public/modules/ui/style-presets.js tests/e2e/load-map.spec.ts
git commit -m "feat: harvest legacy svg styles into style.layers and make data[48] authoritative"
```

---

### Task 8: Style editor rewiring (generic presentation paths)

**Files:**
- Modify: `public/modules/ui/style.js` (reads: `selectStyleElement()` ~83–470; writes: the `getEl().attr(...)` handlers ~482–1251)
- Modify: `public/modules/ui/style.js` cache-bust token in `src/index.html` if one exists (check `?v=` — editor JS is cached; bump it, per fork lesson, applies upstream too)

**Interfaces:**
- Consumes: `getStyleNode`, `setPresentation`, `setOptions`, `getLayerOptions` via `window.*`.
- Produces: `styleTargetFromUI(): {layerId, childIds?}` — maps the two dropdowns (`styleElementSelect`, group select) to a store target; used by every handler.

The editor's element names mostly equal LayerIds already; exceptions map explicitly:

```js
// style.js — element select value → store target
const STYLE_ELEMENT_TARGETS = {
  ocean: {layerId: "oceanLayers"},
  regions: {layerId: "regions"},           // "statesBody"/"statesHalo" via group select → childIds
  terrain: {layerId: "terrain"},
  // grouped elements: group dropdown value becomes childIds[0]
  // anchors, borders, burgIcons, coastline, lakes, labels, routes, terrs
};
function styleTargetFromUI() {
  const element = styleElementSelect.value;
  const base = STYLE_ELEMENT_TARGETS[element] || {layerId: element};
  const group = styleGroupSelect?.value;
  const GROUPED = ["anchors", "borders", "burgIcons", "coastline", "lakes", "labels", "routes", "terrs"];
  return GROUPED.includes(element) && group ? {...base, childIds: [group]} : base;
}
```

- [ ] **Step 1: Rewire the write handlers** — every `getEl().attr("x", value)` becomes `setPresentation(styleTargetFromUI(), "x", value)`. Handlers that write options-backed attrs (`styleReliefSet/Size` already done by Azgaar; grid type/scale/dx/dy, legend, scaleBar, texture, halo width, markers rescale, emblem sizes, ocean layers) switch to `setOptions(...)` + the redraw call each already makes — **do these in the same task as their reader migration (Tasks 9–10) if the reader still gets the value from the DOM attr today**; in this task convert only handlers whose attribute is pure presentation (opacity, fill, stroke, stroke-width, dasharray, linecap, filter, mask, font-family, letter-spacing, shape-rendering, text-shadow/style).
- [ ] **Step 2: Rewire the reads** — in `selectStyleElement()`, each `el.attr("x")` for a presentation attr becomes `getStyleNode(target.layerId, ...(target.childIds ?? [])).presentation?.["x"]` with the same fallback defaults as today. Options-backed inputs keep DOM reads until their task (same rule as writes).
- [ ] **Step 3: Manual smoke via e2e** — no new spec; run the full e2e suite; then hand-verify in the dev server (user's own session per project convention — coordinate, don't start/stop it): open Style editor, change rivers fill, routes>roads stroke-width, labels group opacity → visible change + `style.layers` updated + reload of a saved map preserves it.
- [ ] **Step 4: Run the suites** — `npx tsc --noEmit && npx vitest run && npx playwright test tests/e2e/` → green.
- [ ] **Step 5: Commit** — `git commit -m "refactor: style editor reads and writes presentation via style.layers"`

---

### Task 9: Options migration A — scalar size/config knobs

Move each reader off the DOM, its editor input onto `setOptions`, its harvest attr out of the applied DOM, and prune the baseline keys — one layer per commit, transitional invariant holds per commit.

**Files (per layer, all Modify):**

| Layer | Reader → new read | Editor input(s) | DOM attr(s) removed at harvest |
|---|---|---|---|
| emblems | `src/renderers/draw-emblems.ts:52,59,66` `data-size` → `getLayerOptions("emblems", "<child>").size`; also `src/renderers/emblems/renderer.ts:318` | `styleEmblemsStateSizeInput` etc. → `setOptions({layerId:"emblems", childIds:[...]})` + existing redraw | `data-size` on 3 children |
| goods | `src/renderers/draw-goods.ts:92,114` | goods size inputs (style.js:384–404) | `data-size`, `data-circle` |
| markets | `src/renderers/draw-markets.ts:36–37` | markets inputs | `data-size`; `font-size` stays presentation? No — `fontSize` option per table; remove `data-size` + `data-icon` |
| legend | `src/renderers/draw-legend.ts:18` | legend inputs (style.js:317–327) | `data-size`, `data-x`, `data-y`, `data-columns` |
| ruler | `src/renderers/draw-measurers.ts:20` | ruler size input | `data-size` |
| coordinates | `public/modules/ui/layers.js:656` | coordinates size input | `data-size` |
| armies | reads in `battle-screen`/military renderer — locate with `git grep -n 'box-size\|armies.*font-size' src public` and migrate every hit | armies inputs (style.js:367–368) | `box-size` |
| scaleBar | scale bar renderer reads (`git grep -n 'data-bar-size\|scaleBarBack\|data-label' src public`) | scaleBar inputs (style.js:434–450) | `data-bar-size`, `data-x`, `data-y`, `data-label`, `data-top/right/bottom/left` on back |
| vignette | vignette preset buttons (style.js:1128–1180) write `options.rect`; a tiny `applyVignetteRect()` writes the `<rect>` from options | vignette inputs | attrs on `#vignette-rect` leave the baseline |
| compass | `#compass > use` transform built from `options.use` where the compass is drawn (grep `defs-compass-rose` usage) | compass transform handler (style.js:225 read) | none (transform derived) |

**Per-layer step cycle (repeat identically for each row):**

- [ ] Write/extend a unit test where the reader has a pure core (e.g. draw-emblems size selection) or lean on the parity/e2e net where it doesn't (renderer output attrs asserted in `tests/e2e/style-parity.spec.ts` targets).
- [ ] Change the reader(s) to `getLayerOptions(...)` with the legacy attr as fallback DELETED (harvest already populated options in Task 7 — confirm the harvest table includes the attr; it does, via `LEGACY_SELECTOR_ATTRIBUTES`).
- [ ] Change the editor input handler to `setOptions` + the redraw it already calls; change its read in `selectStyleElement` to `getLayerOptions`.
- [ ] Stop the applier writing it: it never did (options aren't ops) — instead delete the attr from the *harvested DOM* by adding it to a `REMOVE_AFTER_HARVEST` list consumed at the end of `harvestLegacyLayerStyles()` (`el.removeAttribute(attr)`), and prune the key from `tests/fixtures/style-baseline.json` in the same commit.
- [ ] `npx tsc --noEmit && npx vitest run && npx playwright test tests/e2e/` → green.
- [ ] Commit: `refactor: <layer> reads style options from style.layers`.

---

### Task 10: Options migration B — render-logic knobs

Same per-layer cycle as Task 9. The rows:

| Layer | Readers | Notes |
|---|---|---|
| terrs | `src/renderers/draw-heightmap.ts:121` (`scheme`), `src/services/io/export.ts:538` | schemes/terracing/skip/relax/curve per child from `getLayerOptions("terrs", "landHeights")` etc.; heightmap editor + style.js:199–206 inputs → `setOptions`; custom scheme registration hook (style-presets.js `#terrs` scheme branch) moves with it |
| oceanLayers | `src/renderers/ocean-layers.ts:68` (`layers`); base/pattern built from `options.baseFill`/`options.pattern` | style.js:332–335 ocean inputs |
| texture | `public/modules/ui/layers.js:760`, `src/services/io/load.ts:569` (`data-href`); renderer builds `<image>` from `options.{href,x,y}` | style.js texture handlers 565–594 lose the dual-write |
| gridOverlay | `public/modules/ui/layers.js:611–612` + grid drawing reads `type/scale/dx/dy` | style.js:216–219 |
| markers | `src/renderers/draw-markers.ts:90` + `src/components/zoom.ts:123` (`rescale`) | zoom.ts read becomes `getLayerOptions("markers").rescale` |
| statesHalo | `src/components/zoom.ts:118` (`data-width`) | `getLayerOptions("regions", "statesHalo").width`; style.js:252–256 |
| fogging | `src/renderers/overlays/fogging.ts:19` (opacity) | reads `getStyleNode("fogging").presentation?.opacity` — presentation read from store, fine |
| emblems zoom | `src/components/zoom.ts:106–109` (display + per-group font-size scan) | font-size per child from store; display check switches to `layerIsOn` |
| hatching | `src/services/io/export.ts:485` fill reads | export reads store instead of DOM |

Also in this task: delete the corresponding `REMOVE_AFTER_HARVEST` attrs + baseline keys per layer, per commit, same as Task 9.

---

### Task 11: Children layers end-to-end check + editor group navigation

**Files:**
- Modify: `public/modules/ui/style.js` (group dropdown population for the 8 group-aware elements — confirm each maps to `children` ids)
- Test: extend `tests/e2e/load-map.spec.ts`

The children layers (routes, borders, coastline, lakes, population, regions, terrs, emblems, labels/burgIcons/anchors dynamics) were migrated structurally by Tasks 5–7 (upgrader + harvest + applier). This task proves the editor path and preset path on children:

- [ ] **Step 1: e2e test** — apply a converted system preset (e.g. switch to `night.json` via `page.evaluate(() => applyStyleWithUiRefresh("night"))` — check the actual function used by the preset dropdown in style-presets.js:185), then assert a known child attr changed on BOTH the object and the DOM (`#roads` stroke differs from default, `style.layers.routes.children.roads.presentation.stroke` matches the DOM).
- [ ] **Step 2: run** → green. Fix whatever the test flushes out (typical: group dropdown values not matching child ids — e.g. editor group selects carry `#`-prefixed values; normalize in `styleTargetFromUI`).
- [ ] **Step 3: Commit** — `test: prove child-layer styling via presets and editor targets`.

---

### Task 12: Re-home the already-migrated layers; density → global options

**Files:**
- Modify: `src/renderers/labels/label-groups.ts:53–59` (`getGroupStyle` reads `style.layers.labels.children[name]`)
- Modify: `src/renderers/draw-burg-icons.ts:79–110` (DELETE `createIconGroups` harvest round-trip; groups created from `style.layers.burgIcons/anchors.children` via the applier)
- Modify: `src/generators/relief-generator.ts`, `src/renderers/draw-relief-icons.ts`, `public/modules/ui/style.js` relief branch (set/size from `getLayerOptions("terrain")`; `density` from global `options`)
- Modify: `public/main.js:174` (drop legacy keys: `let style = ensureStyleShape({layers: {}})` — confirm load order lets it call the window helper; otherwise keep a literal `{layers: {}}` and `ensureStyleShape` at first use)
- Modify: `src/services/io/auto-update.ts` (extend the Task 7 block: re-home `parsed.labels/burgIcons/anchors/relief` from old `data[48]` into `layers`; route `relief.density` → global `options.reliefDensity` — grep how `options` persists (`data[3]`? check `save.ts`/`load.ts` options handling) and add it there with default `0.4`)
- Modify: `src/controllers/submap-tool.ts:115–121` (reads `style.burgIcons[...]` → `style.layers.burgIcons.children[...]`)
- Modify: `src/types/global.ts` (drop `LegacyStyle` from the `style` declaration), `src/types/style.ts` (delete `ReliefStyle`/`LabelGroupStyle` legacy shapes; child-options schemas for `labels/*`, `burgIcons/*`, `anchors/*` added to `childOptionsSchemas` as wildcard entries)
- Modify: `public/modules/ui/style-presets.js` (delete the Task 6 dual-write mirrors)
- Test: extend `tests/e2e/load-map.spec.ts` legacy-relief cases (they already assert `style.relief` — update them to `style.layers.terrain.options` + density in global options; this is Azgaar's own test, keep its intent identical)

- [ ] **Step 1: Update the relief e2e expectations first** (failing), including `density` surfacing in global `options` and NOT in style.
- [ ] **Step 2: Migrate relief** (renderer + generator + editor + auto-update re-home + preset upgrader already drops density). Run relief e2e → PASS.
- [ ] **Step 3: Migrate labels `getGroupStyle`** — one function; label rendering e2e (`load-map.spec.ts` full-load case) stays green; parity spec label-group targets stay green.
- [ ] **Step 4: Migrate burgIcons/anchors** — delete the harvest round-trip; the applier + `style.layers` now create icon groups. Verify burg icon rendering in e2e demo-map load (`#burgIcons > g` children exist with expected attrs — add explicit assertions).
- [ ] **Step 5: Delete every legacy shape** — `grep -rn "style\.relief\|style\.labels\.groups\|style\.burgIcons\[\|style\.anchors\[" src public` must return zero hits outside auto-update's re-home block.
- [ ] **Step 6: Full suites + commit** — `refactor: re-home labels, burg icons, anchors and relief under style.layers`.

---

### Task 13: Final sweep, docs, PR

- [ ] **Step 1: Zero-DOM-read audit** — every command below returns no hits in renderer/logic code (auto-update harvest and the applier itself are the only allowed `getAttribute` sites for style attrs):

```bash
git grep -n 'attr("data-size")\|attr("scheme")\|attr("rescale")\|attr("layers")\|attr("data-width")\|attr("set")\|attr("density")\|attr("data-href")' src public
git grep -n 'getAttribute("data-size")\|getAttribute("scheme")' src public
```

- [ ] **Step 2: Update `docs/architecture/data_model.md`** — replace the relief-style paragraph's `style.relief` reference and document `style.layers` (shape, consumer split, children rule, preset format, data[48] authority, harvest migration) — mirror the tone of the Relief section Azgaar wrote in 41c7d455.
- [ ] **Step 3: Full verification** — `npx tsc --noEmit && npx vitest run && npx playwright test && npm run build && npm run lint` — all green; then a manual pass in the browser: new map, style editor across ~6 elements incl. one grouped, preset switch, save, reload, load a pre-1.142 map.
- [ ] **Step 4: Merge latest `upstream/master`** one final time; resolve; re-run everything.
- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin style-migration
gh pr create --repo Azgaar/Fantasy-Map-Generator --base master \
  --title "Store layer styles in style.layers instead of DOM attributes" \
  --body "<summary: the consumer-split model as agreed on Discord; new dep: zod (as discussed); preset format migration incl. legacy upgrader for user presets; old-map harvest in auto-update; parity-tested against pre-migration attribute baseline. No AI attribution.>"
```

(PR body: plain description, no AI attribution, no Co-Authored-By. Flag: `zod` new dependency; presets regenerated by `tools/convert-style-presets.mjs`; the baseline spec + fixture can be dropped post-merge if Azgaar doesn't want them permanently.)

---

## Self-review notes (already applied)

- Spec coverage: data model → Task 2; applier/seam → Task 3–4; presets+Zod+upgrader → Tasks 5–6; persistence+harvest → Task 7; editor → Task 8 (+9/10 for options inputs); options inventory → Tasks 9–10; children → Tasks 5–7+11; re-homing+density → Task 12; verification → Task 1 baseline + per-task suites + Task 13 audit; workspace → Task 1; non-goals respected (no TS conversion of style.js, no registry, no SVG stripping beyond options attrs).
- Type consistency: `parseStyle`/`ensureStyleShape`/`getStyleNode`/`getLayerOptions`/`setPresentation`/`setOptions`/`applyStyleNode`/`applyLayerStyle`/`buildAttributeOps`/`upgradeLegacyPreset(legacy, {onUnknownSelector})`/`isLegacyPreset`/`LEGACY_SELECTOR_ATTRIBUTES`/`deepMerge` — names used identically across tasks.
- Known judgment calls surfaced to the executor: `#legendBox` routing (Task 5 table), `z.coerce.number()` switch (Task 7), `collectStyleData` deferral (Task 6→7), group-select value normalization (Task 11), `options` persistence location for `reliefDensity` (Task 12 — grep before wiring).
