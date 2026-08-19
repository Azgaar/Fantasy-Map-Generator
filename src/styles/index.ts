// The folder's only public surface: everything else under src/styles/ is private to it. The
// legacy upgrader ships permanently (users upload old presets forever) but privately, behind
// Style.fromJSON - the one entry point that also supplies the static defaults an upgraded
// document needs. Exporting it would let a caller build a half-converted style.
export type { Attrs, ChildId, ChildOptions, LayerOptions, StyleData, StyleLayerId } from "./schema";
export { applyMapStyle, getMapStyle, Style, setMapStyle } from "./style";
