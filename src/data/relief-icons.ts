import type { ReliefSet, ReliefSetDefinition, ReliefTypeIcons } from "@/types/relief";

export const RELIEF_SETS: Record<ReliefSet, ReliefSetDefinition> = {
  simple: { name: "Simple", base: "simple", suffix: "" },
  colored: { name: "Colored", base: "colored", suffix: "" },
  gray: { name: "Gray", base: "colored", suffix: "-bw" }
};

export const RELIEF_ICONS: ReliefTypeIcons[] = [
  { set: "simple", type: "mount", variants: [1] },
  { set: "simple", type: "hill", variants: [1] },
  { set: "simple", type: "deciduous", variants: [1], zoom: 1.5 },
  { set: "simple", type: "conifer", variants: [1], zoom: 1.5 },
  { set: "simple", type: "palm", variants: [1], zoom: 1.5 },
  { set: "simple", type: "acacia", variants: [1], zoom: 1.5 },
  { set: "simple", type: "swamp", variants: [1], zoom: 2 },
  { set: "simple", type: "grass", variants: [1], zoom: 3, scale: 1.2 },
  { set: "simple", type: "dune", variants: [1], zoom: 1.5 },

  { set: "colored", type: "mount", variants: [2, 3, 4, 5, 6, 7] },
  { set: "colored", type: "mountSnow", variants: [1, 2, 3, 4, 5, 6], fallback: "mount" },
  { set: "colored", type: "vulcan", variants: [1, 2, 3], fallback: "mount" },
  { set: "colored", type: "hill", variants: [2, 3, 4, 5] },
  { set: "colored", type: "dune", variants: [2] },
  { set: "colored", type: "deciduous", variants: [2, 3], zoom: 1.5 },
  { set: "colored", type: "conifer", variants: [2], zoom: 1.5 },
  { set: "colored", type: "coniferSnow", variants: [1], zoom: 1.5, fallback: "conifer" },
  { set: "colored", type: "acacia", variants: [2], zoom: 1.5 },
  { set: "colored", type: "palm", variants: [2], zoom: 1.5 },
  { set: "colored", type: "grass", variants: [2], zoom: 1.5 },
  { set: "colored", type: "swamp", variants: [2, 3], zoom: 1.5 },
  { set: "colored", type: "cactus", variants: [1, 2, 3], zoom: 1.5, fallback: "dune" },
  { set: "colored", type: "deadTree", variants: [1, 2], zoom: 1.5, fallback: "dune" }
];
