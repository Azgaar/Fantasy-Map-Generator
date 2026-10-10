import { t } from "@/utils/i18n";
// Pre-created heightmaps: each key matches a grayscale image in public/heightmaps/<key>.png

export type PrecreatedHeightmap = {
  id: number;
  name: string;
};

export const precreatedHeightmaps: Record<string, PrecreatedHeightmap> = {
  "africa-centric": { id: 0, name: t("Africa Centric") },
  arabia: { id: 1, name: t("Arabia") },
  atlantics: { id: 2, name: t("Atlantics") },
  britain: { id: 3, name: t("Britain") },
  caribbean: { id: 4, name: t("Caribbean") },
  "east-asia": { id: 5, name: t("East Asia") },
  eurasia: { id: 6, name: t("Eurasia") },
  europe: { id: 7, name: t("Europe") },
  "europe-accented": { id: 8, name: t("Europe Accented") },
  "europe-and-central-asia": { id: 9, name: t("Europe and Central Asia") },
  "europe-central": { id: 10, name: t("Europe Central") },
  "europe-north": { id: 11, name: t("Europe North") },
  greenland: { id: 12, name: t("Greenland") },
  hellenica: { id: 13, name: t("Hellenica") },
  iceland: { id: 14, name: t("Iceland") },
  "indian-ocean": { id: 15, name: t("Indian Ocean") },
  "mediterranean-sea": { id: 16, name: t("Mediterranean Sea") },
  "middle-east": { id: 17, name: t("Middle East") },
  "north-america": { id: 18, name: t("North America") },
  "us-centric": { id: 19, name: t("US-centric") },
  "us-mainland": { id: 20, name: t("US Mainland") },
  world: { id: 21, name: t("World") },
  "world-from-pacific": { id: 22, name: t("World from Pacific") }
};

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var precreatedHeightmaps: Record<string, PrecreatedHeightmap>;
}

// temp legacy compatibility
window.precreatedHeightmaps = precreatedHeightmaps;
