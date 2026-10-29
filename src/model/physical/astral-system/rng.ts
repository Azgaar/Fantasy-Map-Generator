// Moved to src/utils/rng.ts so layers outside the Astral generator (culture traits) can roll
// reproducible dice as well. Kept as a re-export so every Astral module and test stays put.
export type { Rng } from "@/utils/rng";
export { createRng } from "@/utils/rng";
