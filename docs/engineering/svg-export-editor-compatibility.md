# SVG export compatibility (issue #1922)

Reproduced from `Storfi 2026-09-17-15-41.map`, attached to
https://github.com/Azgaar/Fantasy-Map-Generator/issues/1922, using upstream
1.153.1, the Ink preset, and Show all labels. Tested with Chromium and Inkscape
1.4.4; Illustrator is unavailable in this environment.

## Confirmed defects and changes

- Inkscape continues the second line of a multiline `textPath` along the first
  line, despite the `tspan x="0"` reset that browsers honor. This shifts and clips
  label text. SVG export now emits one editable text element per line, grouped
  under the original label ID. Each line retains its path and start offset;
  baseline offsets accumulate from the original `dy` values.
- Inkscape ignores CSS `text-transform`. Uppercase/lowercase label text is
  materialized in the export clone so the Ink preset keeps its displayed case.
- `filter="blur(20px)"` produces Inkscape's malformed-filter warning. Standalone
  CSS blurs become SVG Gaussian filters with sRGB interpolation and explicit
  bounds expanded by three standard deviations. Compound filters and relative
  units remain unchanged. Default filter regions caused missing-glyph artifacts
  in one intermediate Inkscape render; the explicit bounds produced three
  identical complete renders of the final file.
- Definition pruning previously considered only exact presentation attributes.
  It now also retains definitions referenced in quoted inline CSS URLs.
- Ocean and texture embedding now accepts legacy `xlink:href` references. The
  final pass writes matching SVG 2 `href` and namespaced SVG 1.1 `xlink:href`
  after all definitions have been copied. Empty references are removed: adding
  an empty xlink reference produces broken-image tiles in Inkscape.
- Embedded font stylesheet elements now use the SVG namespace, not XHTML.

The label/blur/link conversions run only for SVG export. The changes operate
on the export clone and do not change saved map data or the live map.

## Validation

- All 1,202 unit tests passed, including eight new compatibility cases.
- TypeScript and the production build passed; Biome passed for changed files.
- Exported the reporter's map and rendered the original and updated exports in
  Chromium and Inkscape. Browser appearance was visually preserved; Inkscape's
  multiline layout and casing now agree with the browser. Three final Inkscape
  renders were byte-identical. The malformed-blur warning is gone.
- A separate browser check replaced the live ocean image's modern href with a
  legacy xlink reference. Export embedded an image data URI under both names;
  the live image retained its original relative reference.

## Remaining limits

This is not a guarantee of Illustrator compatibility: it may still flatten
text-on-path, and its filter/font import needs direct testing. Inkscape still
warns about CSS features such as `mask-image` and `text-shadow`; this change does
not remove effects merely to silence warnings. Some names in this fixture also
extend beyond their path in Chromium before export; correcting the label-fitting
algorithm is separate from the editor-only multiline corruption fixed here.
