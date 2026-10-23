# Project Overview

- **Purpose**: Procedural generation, editing, and visualization of fantasy maps for writers, game masters, and cartographers.
- **Entry Points**: Start by inspecting `docs/architecture.md` to align with the domain model.
- **Main Technologies**: Typescript, SVG/WebGL for rendering, Vite for bundling, Biome for linting/formatting.
- **Architecture**: Moving toward FMG 2.0. The system is divided into four major layers:
  1. **State**: The world data (`grid` and `pack` objects).
  2. **Generators**: Procedural simulation logic (Model).
  3. **Editors**: User-driven map mutations (Controllers).
  4. **Renderers**: Visualization into DOM/SVG (View).

# Repository Structure

- `src/generators/`: Generators containing simulation logic.
- `src/controllers/`: The UI layer — editors, overviews and tools that present and mutate state.
- `src/renderers/`: Code responsible for transforming world data into SVG layers.
- `src/services/io/`: Serialization and persistence — save, load, export, and `auto-update.ts`.
- `src/services/`: App-shell & platform lifecycle, unrelated to map state.
- `src/data/`: Static content / reference data.
- `src/locales/`: Interface strings per language.
- `src/types/`: Shared TypeScript interfaces and domain models.
- `src/utils/`: Generic helper functions.
- `public/`: Static assets.
- `electron/`: Main process, preload script and self-update of the desktop app.
- `docs/`: Domain, architectural documentation and user-facing wiki.
- `src/index.html`: The shared page template contains the map structure and app shell.
- `tests/e2e/`: Playwright end-to-end tests.

# FMG 2.0 Architecture Rules

- **Layering Constraint**: Generators MUST NOT directly manipulate SVG or DOM elements.
- **Data Flow**: Generators and Editors mutate the World Data (State). The Renderer reacts to State updates.
- **Idempotency**: Renderers SHOULD be stateless and idempotent.
- **Separation of Concerns**: UI logic and simulation logic MUST remain separate.
- **Serialization**: The entire world state must remain serializable into a single JSON object for `.map` saving and loading.
- **Map Migrations**: Upgrading older `.map` files lives only in `src/services/io/auto-update.ts`, run once on load. Never back-fill or guard for old data in `load.ts`, generators, renderers or editors: they assume the current shape.

# Coding Conventions

- **Language**: TypeScript is mandatory for all code files.
- **Typing**: Explicit TypeScript interfaces for all shared domain objects, `any` is prohibited.
- **Linting and formatting**: Enforced via Biome (`biome.json`).
- **Style**: Double quotes, no trailing commas, 120 line width, semicolons required.
- **Comments**: Don't repeat information that is in docs. Prefer one-liners or no comments.
- **Imports**: Mandatory `@/*` aliases `src/*` over deep `../../` relative paths; keep sibling imports relative.
- **DOM lookups**: No `getElementById`, utils `ensureEl` when the element must exist, `findEl` when it may be missing.
- **Order**: Files MUST be readable from top to bottom.
- **Variables**: Concise and descriptive variable names, don't use unusual abbreviations.
- **Save space**: Prefer laconic but clear code. Save space, I like my code to be compact.
- **Keep it simple**: Avoid over-engineering.
- **Dependencies**: Don't introduce new production dependencies without explicit permission. Keep the bundle lightweight.
- **Export**: Export only what another module imports. Types, helpers and constants used within one module stay unexported.

# Workflow Rules

- **Run Locally**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Unit Tests**: `npm run test` (Vitest); `npm run test:scenarios` runs the slow real-map `*.scenarios.test.ts` suites
- **E2E Tests**: `npm run test:e2e` (Playwright; never run without asking)
- **Desktop App**: `npm run electron`, `npm run electron dist`
- **CI/CD**: GitHub Actions enforce linting, building, and playwright tests on PRs.

# Domain Knowledge

- **Grid**: The underlying Voronoi structure.
- **Pack**: The aggregate world state (contains `burgs`, `states`, `cultures`, etc.).
- **Cell**: The smallest indivisible unit of the map.
- **Burg**: A settlement. Grouped into `States`.
- **Feature**: An island, lake or ocean.
- **Label**: Text attached to a State, Burg, or user-defined path.
- **Invariants**: Saving a `.map` file MUST preserve the exact world state so it can be reloaded identically.

# Sharp Edges

- **Legacy Globals**: The codebase heavily relies on implicit global state (`pack` and `grid` on the `window`). Be extremely cautious when refactoring these to explicit parameters.
- **`index.html`**: The shared app-shell and map SVG template. It can easily break if structural tags are accidentally nested incorrectly.
- **Playwright**: Never automatically run Playwright tests when developing, they are too slow and cause PC freezes.
