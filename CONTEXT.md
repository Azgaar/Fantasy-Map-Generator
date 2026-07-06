# Project Overview

- **Purpose**: Procedural generation, editing, and visualization of fantasy maps for writers, game masters, and cartographers.
- **Main Technologies**: Vanilla JS/TS, SVG for rendering, Vite for bundling, Biome for linting/formatting.
- **Architecture**: Moving toward FMG 2.0. The system is divided into four major layers:
  1. **State**: The world data (`grid` and `pack` objects).
  2. **Generators**: Procedural simulation logic (Model).
  3. **Editors**: User-driven map mutations (Controllers).
  4. **Renderers**: Visualization into DOM/SVG (View).

# Repository Structure

- `src/generators/`: Generators containing simulation logic (e.g., `heightmap-generator.ts`, `cultures-generator.ts`).
- `src/controllers/`: The UI layer — editors and tools that mutate state, plus read-only overviews/dialogs that present it.
- `src/renderers/`: Code responsible for transforming world data into SVG overlays.
- `src/io/`: Serialization and persistence — save, load, export (legacy `public/modules/io/`).
- `src/services/`: App-shell & platform lifecycle, unrelated to map state (e.g., PWA installation, auto-update).
- `src/data/`: Static content / reference data (e.g., supporters list, heightmap templates).
- `src/types/`: Shared TypeScript interfaces and domain models.
- `src/utils/`: Generic helper functions.
- `public/`: Static assets and NON-MIGRATED JS Code in `public/modules`. `public/libs/` holds vendored third-party scripts for legacy code only — new `src/` code imports deps from npm (no `src/libs/`).
- `docs/`: Domain and architectural documentation. See `docs/architecture/architecture.md` "Project Structure" for the full layout and a "where does my file go?" guide.
- `src/index.html`: **CAUTION**: Currently a 9K-line monolith containing the entire UI structure, SVG `<defs>`, and CSS filters.
- `tests/e2e/`: Playwright end-to-end tests. Never automatically run Playwright tests when developing.

# FMG 2.0 Architecture Rules

- **Layering Constraint**: Generators MUST NOT directly manipulate SVG or DOM elements.
- **Data Flow**: Generators and Editors mutate the World Data (State). The Renderer reacts to State updates.
- **Idempotency**: Renderers SHOULD be stateless and idempotent.
- **Separation of Concerns**: UI logic and simulation logic MUST remain separate.
- **Serialization**: The entire world state must remain serializable into a single JSON object for `.map` saving and loading.

# Coding Conventions

- **Language**: TypeScript is mandatory for all new files.
- **Linting and formatting**: Enforced via Biome (`biome.json`).
- **Style**: Double quotes, no trailing commas, 120 line width, semicolons required.
- **Typing**: Use explicit TypeScript interfaces for all shared domain objects. `any` should be avoided.
- **Imports**: `@/*` aliases `src/*` (set in `vite.config.ts` + `tsconfig.json`). Prefer it over deep `../../` relative paths; keep sibling imports relative.

# Workflow Rules

- **Run Locally**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Unit Tests**: `npm run test` (Vitest)
- **E2E Tests**: `npm run test:e2e` (Playwright)
- **CI/CD**: GitHub Actions enforce linting, building, and playwright tests on PRs.

# AI Agent Instructions

- **Entry Points**: Start by inspecting `docs/architecture.md` and `docs/glossary.md` to align with the domain model.
- **Refactoring Constraints**: The project is in a gradual JS -> TS migration. Focus on incremental type safety and extracting logic.
- **File Limits**: `src/index.html` is excessively large. DO NOT try to perform large structural changes to it in a single pass.
- **Dependencies**: DO NOT introduce new production dependencies without explicit permission. Keep the bundle lightweight.

# Domain Knowledge

- **Grid**: The underlying Voronoi structure.
- **Pack**: The aggregate world state (contains `burgs`, `states`, `cultures`, etc.).
- **Cell**: The smallest indivisible unit of the map.
- **Burg**: A settlement. Grouped into `States`.
- **Treasury & Taxes**: States hold `state.treasury` accumulated by `States.collectTaxes()` from per-deal `deal.tax` (sales tax) plus `state.pollTax × (rural + urban)`. Rates are seeded from `state.form` and jittered per state. Neutrals collect nothing. Details in `docs/domain/taxes.md`.
- **Invariants**: Saving a `.map` file MUST preserve the exact world state so it can be reloaded identically.

# Known Sharp Edges

- **Legacy Globals**: The codebase heavily relies on implicit global state (`pack` and `grid` on the `window`). Be extremely cautious when refactoring these to explicit parameters.
- **`index.html`**: A massive monolith serving as the primary UI template. It can easily break if structural tags are accidentally nested incorrectly.

# Important Files

- `docs/glossary.md`: Domain vocabulary definitions.
- `docs/architecture.md`: The guiding blueprint for FMG 2.0.

# Code Style Rules

- Use concise and descriptive variable names, don't use unusual abbreviations.
- Prefer laconic but clear code.
- Save space, I like my code to be compact.
- Avoid over-engineering, keep it simple and vertically readable.
