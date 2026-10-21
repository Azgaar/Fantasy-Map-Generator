# Merging Upstream — Touch-Points Checklist

This document tracks all intentional touch-points where this fork modifies stock FMG files.
When rebasing or merging `upstream/master`, consult this checklist to ensure fork-specific additions remain intact and upstream changes integrate smoothly.

## Touch-Points by Feature

### Phase A: Astral Cartographer Content in Core (Bases + Culture Sets)

- **`src/data/name-bases.ts`**
  - **Interface extension**: `NameBase` interface includes optional `groups?: Record<string, string[]>`.
  - **Appended array entries**: Appended 12 Astral name bases (indices 43..54) at the end of `getDefaultNameBases()`.
    - AstralTrek (Trek Core, Trek Terran, Trek Continental, Trek Synthetic)
    - AstralJammer (Jammer Deep, Jammer Ethereal, Jammer Stoneborn, Jammer Wild)
    - Grimdark (Grimdark Core, Grimdark Gothic, Grimdark Iron, Grimdark Machine)
  - *Conflict resolution strategy*: If upstream adds new name bases, ensure Astral bases remain appended after upstream bases and culture generator base lookups continue resolving by name.

- **`src/generators/cultures-generator.ts`**
  - **`CULTURE_SETS` additions**: Appended `astralTrek`, `astralJammer`, and `grimdark` to `CULTURE_SETS` with `max: 8`.
  - **`CulturesGenerator.getDefault()`**: Added `case "astralTrek"`, `case "astralJammer"`, and `case "grimdark"` branches returning each set's 8 cultures with habitat scoring callbacks.
  - *Conflict resolution strategy*: Preserve these three case branches and `CULTURE_SETS` entries.

- **`src/components/options-schema.ts`**
  - Uses dynamic enumeration from `Object.keys(CULTURE_SETS)`. No direct stock modifications needed; automatically validates and pins the Astral sets.

- **`src/components/configuration-schema.test.ts`**
  - Added unit test: validates astral culture-set ids and accepts them in schema and pins.

- **`src/data/name-bases.test.ts`**
  - Dedicated test suite for content rules, culture set generation, placement scoring, and Phase A acceptance.

### Toolchain & Windows Environment Compatibility

- **`package.json`**:
  - Replaced upstream `vite: ^8.0.16` (which requires native Rolldown `.node` bindings blocked by Windows security policies in user directories) with `vite: ^6.0.0`.
  - Added package overrides mapping `rollup` to `@rollup/wasm-node` and `esbuild` to `esbuild-wasm` (pure WebAssembly, zero native C++ DLL bindings).
  - Added `scripts/patch-esbuild.mjs` running on `postinstall` to adapt Go WASM runtime process spawning for Windows `cmd.exe`.
  - Provided `dev.cmd` and `dev.ps1` dev server launchers.
