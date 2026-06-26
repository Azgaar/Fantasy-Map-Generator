# Lazy-Loading Pattern

Keep rarely-used modules reachable only through a **dynamic** `import()`, which Rollup always
splits into its own chunk, fetched on demand.

## The pattern: a thin lazy-loader bridge

1. **Write the module normally.** Plain `.ts` file under `src/controllers/`
   (or wherever it belongs by layer), named exports, fully typed. No special
   casing inside the module itself.

2. **Never import it statically.** It must not appear in any `import "./x"`
   line reachable from `controllers/index.ts` / `generators/index.ts` /
   `renderers/index.ts` — that eager graph is what ends up in the main chunk.

3. **Add one line to the registry** in `src/lazy-loaders.ts` — a top-level,
   **layer-agnostic** file (lazy modules span layers: `data/`, `services/`,
   `io/`, `controllers/`, so the registry belongs to none of them). It is
   loaded eagerly via its own `<script type="module" src="lazy-loaders.ts">`
   in `index.html`; its only job is to hold these loader thunks, so its eager
   cost is a few bytes, not the module bodies. All loaders live in a single
   object exposed as `window.lazy`:

   ```ts
   // src/lazy-loaders.ts
   export const lazy = {
     supporters: () => import("@/data/supporters")
     // ...add your module here, pointing at whatever layer it lives in
   };

   window.lazy = lazy;

   declare global {
     var lazy: Record<string, () => Promise<any>>;
   }
   ```

   Rollup sees the string literal inside each `import()` and emits
   `supporters-<hash>.js` as an independent chunk — it is not pulled into the
   main bundle just because `lazy-loaders.ts` is eager. Adding a module is one
   line. Migrated TS gets each loader's exact return type
   (`Promise<typeof import("./supporters")>`) from the exported `lazy` const;
   the loosely-typed `window.lazy` global is only there for the legacy JS.

4. **Update the call site**, and which handle you use depends on the caller's
   layer:

   - **Migrated TS** (`src/**/*.ts`) imports the registry directly — no global:

     ```ts
     import { lazy } from "@/lazy-loaders";
     const { supporters } = await lazy.supporters();
     ```

   - **Legacy `public/modules/**/*.js`** can't import the bundle, so it reaches
     the same registry through the `window.lazy` global, which exists only for
     this compatibility:

     ```diff
     - const { supporters } = await import("../dynamic/supporters.js?v=1.123.0");
     + const { supporters } = await window.lazy.supporters();
     ```

   Either way it's a one-line change per call site — the legacy file otherwise
   stays untouched.

5. **Delete the old `.js` file** from `public/modules/` once ported. Don't
   leave a duplicate copy around.

## Rules

- Named exports only — no module-level `window.X = new Thing()`
  self-registration for lazy modules (that pattern is for eagerly-loaded
  generators like `markets-generator.ts`; doing it here would still only run
  on first access, but there's no reason to reach for `window` inside the
  module when the bridge in `lazy-loaders.ts` already owns that job).
- `lazy-loaders.ts` may only contain the `lazyLoaders` registry of
  `() => import(...)` thunks (plus its `declare global` / `window.lazy`
  wiring) — no logic, no other imports. The moment it imports something else
  statically, that something else stops being lazy.
- If a lazy module needs another not-yet-declared global (e.g. a DOM input
  bound in `main.js`), add it to `src/types/global.ts` under the existing
  `// Global variables defined in main.js` convention — don't `as any` your
  way around it.
- Use **d3 v7 via named imports** (`import { select } from "d3"`), not the
  `window.d3` global. Old drag/zoom code that read `d3.event` should be
  migrated to v7's event-arg style rather than reaching for the global. See
  [migration_guide.md](./migration_guide.md#d3-v7-named-imports-only).

## Verifying a module is actually lazy

```sh
npm run build
ls dist/assets | grep supporters   # expect supporters-<hash>.js as its own file
```

If the module's code shows up inside the main entry chunk instead of its own
file, something in the eager graph is importing it statically — check
`controllers/index.ts` / `generators/index.ts` and anything they pull in.
