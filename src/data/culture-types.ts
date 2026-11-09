export const CULTURE_TYPES = ["Generic", "Hunting", "Highland", "River", "Lake", "Naval", "Nomadic"] as const;
export type CultureType = (typeof CULTURE_TYPES)[number];
export const DEFAULT_CULTURE_TYPE: CultureType = "Generic";
