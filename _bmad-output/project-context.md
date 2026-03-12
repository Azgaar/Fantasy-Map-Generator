---
project_name: "Fantasy-Map-Generator"
user_name: "Azgaar"
date: "2026-03-12"
sections_completed:
  ["technology_stack", "architecture", "language_rules", "framework_rules", "testing_rules", "code_quality", "workflow"]
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in this project. Focuses on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology | Version  | Role                                            |
| ---------- | -------- | ----------------------------------------------- |
| TypeScript | ^5.9.3   | Source language for `src/`                      |
| Vite       | ^7.3.1   | Build tool & dev server                         |
| Biome      | 2.3.13   | Linter & formatter (replaces ESLint + Prettier) |
| Vitest     | ^4.0.18  | Unit & browser unit tests                       |
| Playwright | ^1.57.0  | E2E tests                                       |
| D3         | ^7.9.0   | SVG rendering & data manipulation               |
| Delaunator | ^5.0.1   | Voronoi/Delaunay triangulation                  |
| Three.js   | ^0.183.2 | 3D globe view                                   |
| Polylabel  | ^2.0.1   | Polygon label placement                         |
| Node.js    | >=24.0.0 | Runtime requirement                             |

---

## Architecture Overview

**Hybrid codebase**: New code lives in `src/` (TypeScript, bundled by Vite). Legacy code lives in `public/modules/` (plain JavaScript, loaded as-is). The two halves communicate through `window` globals.

**Vite config quirk**: `root` is `./src`, `publicDir` is `../public`. All paths in config files must be relative to `src/`.

---

## Critical Implementation Rules

### Global Module Pattern (MOST IMPORTANT)

Every TypeScript generator module follows this mandatory pattern:

1. **Define type and declare global** at the top of the file:

   ```ts
   declare global {
     var ModuleName: ModuleClass;
   }
   ```

2. **Implement as a class**:

   ```ts
   class ModuleClass {
     // methods
   }
   ```

3. **Register on `window` at the bottom of the file** (last line):

   ```ts
   window.ModuleName = new ModuleClass();
   ```

4. **Import the module** in `src/modules/index.ts` (side-effect import):
   ```ts
   import "./module-name";
   ```

**Utility functions used by legacy JS** must also be attached to `window` via `src/utils/index.ts`.

### Global Variables

Key globals declared in `src/types/global.ts` — always use these directly, never redeclare:

- `pack` (`PackedGraph`) — main data structure with all cell/feature data
- `grid` — raw grid data before packing
- `graphWidth`, `graphHeight` — map canvas dimensions
- `svgWidth`, `svgHeight` — SVG element dimensions
- `TIME` / `WARN` / `ERROR` / `DEBUG` — logging flags
- `seed` — current map seed string

D3 selection globals (for SVG manipulation): `svg`, `viewbox`, `rivers`, `labels`, `burgLabels`, `burgIcons`, `markers`, `defs`, `coastline`, `lakes`, `terrs`, `routes`, etc.

### Data Structures & Typed Arrays

The `PackedGraph.cells` object stores most data in **typed arrays** for performance. Always use the utility functions:

```ts
import {createTypedArray, getTypedArray} from "../utils";

// Create typed array (auto-selects Uint8/Uint16/Uint32 based on maxValue)
createTypedArray({maxValue: cells.i.length, length: n});

// Get constructor only
getTypedArray(maxValue);
```

**Never use plain JS arrays for numeric cell data** — always use typed arrays.

### Land Height Threshold

Land cells have height `>= 20`. Water/ocean cells have height `< 20`. This threshold is a project-wide constant:

```ts
const isLand = (cellId: number) => cells.h[cellId] >= 20;
```

Use exactly `>= 20` — no magic numbers, no alternative thresholds.

### Language-Specific Rules

- **TypeScript strict mode** is on: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all enabled.
- **`noEmit: true`** — TypeScript is typechecking only; Vite handles transpilation.
- **`isolatedModules: true`** — each file must be independently compilable; avoid type-only exports without `type` keyword.
- **Module resolution**: `bundler` mode with `allowImportingTsExtensions` — use `.ts` extensions in imports within `src/`.
- **`noExplicitAny`** is disabled — `any` is permitted where needed (legacy interop).
- **`noNonNullAssertion`** is disabled — `!` non-null assertions are allowed.
- **Always use `Number.isNaN()`** — never `isNaN()` (Biome `noGlobalIsNan` rule is an error).
- **Always provide radix to `parseInt()`** — `parseInt(str, 10)` (Biome `useParseIntRadix` rule).
- **Use template literals** over string concatenation (Biome `useTemplate` warning).
- Import `rn` from `"../utils"` for rounding — `rn(value, decimals)`.

### Code Organization

- `src/modules/` — generator classes (one domain per file, kebab-case filename)
- `src/renderers/` — SVG draw functions (prefixed `draw-`, registered as `window.drawX`)
- `src/utils/` — pure utility functions exported as named exports
- `src/types/` — TypeScript type declarations (`PackedGraph.ts`, `global.ts`)
- `src/config/` — static configuration data
- `public/modules/` — legacy JavaScript (do not add TypeScript here)

### Naming Conventions

| Item              | Convention                         | Example                                 |
| ----------------- | ---------------------------------- | --------------------------------------- |
| Files             | kebab-case                         | `burgs-generator.ts`, `draw-borders.ts` |
| Classes           | PascalCase + domain suffix         | `BurgModule`, `BiomesModule`            |
| Window globals    | PascalCase                         | `window.Burgs`, `window.Biomes`         |
| Utility functions | camelCase                          | `rn`, `minmax`, `createTypedArray`      |
| Constants         | SCREAMING_SNAKE_CASE               | `TYPED_ARRAY_MAX_VALUES`                |
| Unit test files   | `*.test.ts` (co-located in `src/`) | `commonUtils.test.ts`                   |
| E2E test files    | `*.spec.ts` (in `tests/e2e/`)      | `burgs.spec.ts`                         |

---

## Testing Rules

### Unit Tests (Vitest)

- Co-locate `*.test.ts` files alongside source files in `src/utils/`
- Use `describe` / `it` / `expect` from `"vitest"`
- Default `vitest` command runs these (no browser needed)
- `vitest --config=vitest.browser.config.ts` for browser-context unit tests

### E2E Tests (Playwright)

- Files go in `tests/e2e/` with `.spec.ts` extension
- Always clear cookies and storage in `beforeEach`:
  ```ts
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  ```
- Use seed parameter for deterministic maps: `page.goto("/?seed=test-NAME&width=1280&height=720")`
- **Wait for map generation** before asserting:
  ```ts
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  ```
- Fixed viewport for consistent rendering: 1280×720 (set in `playwright.config.ts`)
- Access global state via `page.evaluate(() => (window as any).pack)`
- Only Chromium is tested (single browser project in CI)

---

## Code Quality & Style (Biome)

- **Scope**: Biome only lints/formats `src/**/*.ts` — not `public/` legacy JS
- **Formatter**: spaces (not tabs), double quotes for JS strings
- **Organize imports** is auto-applied on save
- Run `npm run lint` to check+fix, `npm run format` to format only
- Rules to always follow:
  - `Number.isNaN()` not `isNaN()`
  - `parseInt(x, 10)` always with radix
  - Template literals over concatenation
  - No unused variables or imports (error level)

---

## Development Workflow

- **Dev server**: `npm run dev` (Vite, port 5173)
- **Build**: `npm run build` (tsc typecheck + Vite bundle → `dist/`)
- **E2E in dev**: requires dev server running; CI builds first then previews on port 4173
- **Netlify deploy**: `base` URL switches to `/` when `NETLIFY` env var is set
- **No vitest config file at root** — default Vitest config is inlined in `package.json` scripts; browser config is in `vitest.browser.config.ts`

---

## Common Anti-Patterns to Avoid

- **Do NOT** use plain `Array` for cell data in `pack.cells` — use typed arrays
- **Do NOT** define `var` in modules without `declare global` — all globals must be typed in `src/types/global.ts`
- **Do NOT** add new modules to `public/modules/` — new code goes in `src/modules/` as TypeScript
- **Do NOT** call `isNaN()` — use `Number.isNaN()`
- **Do NOT** call `parseInt()` without a radix
- **Do NOT** skip the `window.ModuleName = new ModuleClass()` registration at the bottom of module files
- **Do NOT** import modules in `src/modules/index.ts` with anything other than a bare side-effect import (`import "./module-name"`)
- **Do NOT** hardcode the land height threshold — use `>= 20` and reference the convention
