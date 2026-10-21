/**
 * index.ts — the engine's public surface, and the one import the mod makes.
 *
 * Everything re-exported here is pure: no filesystem, no `Bun.*`, no DOM, no
 * `Math.random()`. That is what lets the same code run in the browser bundle, in
 * a Worker, on the dev server and under `bun test` without a single conditional —
 * and it is the property the whole pivot rests on (MOD-PLAN §1.1).
 *
 * Note what is *not* here: `src/compiler/{batch,cli}.ts` (filesystem batch
 * compilation) and `src/server/settings.ts` (YAML on disk). Those are the
 * harness's, and Phase D removes the second one entirely.
 */

export * from "./common/content";
export * from "./common/prng";
export * from "./common/sha256";
export * from "./common/types";
export * from "./compiler/azgaar";
export * from "./compiler/index";
export * from "./game/index";
