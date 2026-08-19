// The folder's only public surface: everything else under src/styles/ is private to it.
export { isLegacyPreset, upgradeLegacyPreset } from "./legacy";
export type { Attrs, ChildId, ChildOptions, LayerOptions, StyleData, StyleLayerId } from "./schema";
export { applyMapStyle, getMapStyle, hasMapStyle, Style, setMapStyle } from "./style";
