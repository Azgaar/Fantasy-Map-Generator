# Lazy-Loading Pattern for Rarely-Used TS Modules

Some legacy modules (Patreon supporters list, PWA install prompt, minimap dialog,
JSON export, culture/religion hierarchy tree, ...) are opened by a tiny fraction of
sessions. Today they live in `public/modules/`, which Vite never processes
(`publicDir` is copied to `dist/` as-is). Loading them via a raw runtime
`import("/modules/dynamic/x.js?v=...")` therefore costs nothing in the main
bundle — the file is just a separate static request, fetched only when needed.

When such a module is migrated to TypeScript in `src/`, it enters Vite's module
graph. If anything in that graph **statically** imports it (directly, or
transitively through `modules/index.ts`, `controllers/index.ts`, etc.), Rollup
bundles it into the main chunk and it ships to every visitor on every load. For
a feature used by almost nobody, that's a regression. The fix is to keep the
module reachable only through a **dynamic** `import()`, which Rollup always
splits into its own chunk, fetched on demand.

## The pattern: a thin lazy-loader bridge

1. **Write the module normally.** Plain `.ts` file under `src/controllers/`
   (or wherever it belongs by layer), named exports, fully typed. No special
   casing inside the module itself.

2. **Never import it statically.** It must not appear in any `import "./x"`
   line reachable from `controllers/index.ts` / `modules/index.ts` /
   `renderers/index.ts` — that eager graph is what ends up in the main chunk.

3. **Register a one-line lazy loader** in `src/controllers/lazy-loaders.ts`
   (itself imported eagerly from `controllers/index.ts` — its only job is to
   hold these loader functions, so its eager cost is a few bytes, not the
   module bodies):

   ```ts
   // src/controllers/lazy-loaders.ts
   window.loadSupporters = () => import("./supporters");
   ```

   Rollup sees the string literal inside the `import()` call and emits
   `supporters-<hash>.js` as an independent chunk — it is not pulled into the
   main bundle just because `lazy-loaders.ts` is eager.

4. **Type the bridge** in `src/types/global.ts`:

   ```ts
   var loadSupporters: () => Promise<typeof import("../controllers/supporters")>;
   ```

5. **Update the call site.** Call sites are almost always still-legacy
   `public/modules/**/*.js` files. Replace the old raw dynamic import of a
   static file with a call to the bridge:

   ```diff
   - const { supporters } = await import("../dynamic/supporters.js?v=1.123.0");
   + const { supporters } = await window.loadSupporters();
   ```

   This is a one-line change per call site — the legacy file otherwise stays
   untouched.

6. **Delete the old `.js` file** from `public/modules/` once ported. Don't
   leave a duplicate copy around.

## Rules

- Named exports only — no module-level `window.X = new Thing()`
  self-registration for lazy modules (that pattern is for eagerly-loaded
  generators like `markets-generator.ts`; doing it here would still only run
  on first access, but there's no reason to reach for `window` inside the
  module when the bridge in `lazy-loaders.ts` already owns that job).
- `lazy-loaders.ts` may only contain `window.loadX = () => import(...)`
  lines — no logic, no other imports. The moment it imports something else
  statically, that something else stops being lazy.
- If a lazy module needs another not-yet-declared global (e.g. a DOM input
  bound in `main.js`), add it to `src/types/global.ts` under the existing
  `// Global variables defined in main.js` convention — don't `as any` your
  way around it.
- If a module needs D3's old event-based selection API (`d3.event`, used by
  pre-v6 drag/zoom handlers), reference `(window as any).d3` — the page loads
  a legacy D3 build via `<script src="libs/d3.min.js">` for exactly this
  reason. Importing the `d3` npm package (v7) here will not have `.event`.
  See `src/controllers/markets-overview.ts` for the existing precedent.

## Verifying a module is actually lazy

```sh
npm run build
ls dist/assets | grep supporters   # expect supporters-<hash>.js as its own file
```

If the module's code shows up inside the main entry chunk instead of its own
file, something in the eager graph is importing it statically — check
`controllers/index.ts` / `modules/index.ts` and anything they pull in.
