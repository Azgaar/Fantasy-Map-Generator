// The formats the string style attrs are pinned to. The store never sees a half-written string: a control
// that knows a format parses it into parts and composes it back (see style-editor/controls.ts)

const FILTER_FUNCTION =
  "(blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|opacity|saturate|sepia)\\([^)]*\\)";

export const FORMATS = {
  /** `none`, a defs filter `url(#id)`, or a CSS filter-function list (cinderwood ships `sepia(0.6)`) */
  filter: new RegExp(`^(none|url\\(#[\\w-]+\\)|${FILTER_FUNCTION}( |$))+$`),
  /** the halo and vignette blur: `blur(5px)` */
  blurFilter: /^blur\(\d+(\.\d+)?px\)$/,
  /** a defs mask: `url(#fog)`, `url(#land)` */
  mask: /^url\(#[\w-]+\)$/,
  /** `none` or space-separated lengths: `5`, `.5 1`, `0 4 10 4` */
  strokeDasharray: /^(none|\d*\.?\d+( \d*\.?\d+)*)$/,
  /** a label group's font size, relative to the labels layer: `22%` */
  fontSize: /^\d+(\.\d+)?%$/,
  /** an absolute font size: `8px` */
  fontSizePx: /^\d+(\.\d+)?px$/,
  percentage: /^-?\d+(\.\d+)?%$/,
  /** the compass rose placement: `translate(80 80) scale(0.25)` */
  compassTransform: /^translate\(-?\d*\.?\d+ -?\d*\.?\d+\) scale\(\d*\.?\d+\)$/,
  /** one cssText declaration a label group may carry: shadow, letter case, small caps, the em shift */
  labelStyleDeclaration:
    /^(text-shadow\s*:\s*[^;]+|text-transform\s*:\s*(none|uppercase|lowercase|capitalize)|font-variant\s*:\s*[^;]+|transform\s*:\s*translate\(\s*-?\d*\.?\d+em\s*,\s*-?\d*\.?\d+em\s*\))$/
};

/** A label group's `style` attr: every declaration in it is one the format allows */
export const isLabelStyle = (style: string): boolean =>
  style
    .split(";")
    .map(declaration => declaration.trim())
    .filter(Boolean)
    .every(declaration => FORMATS.labelStyleDeclaration.test(declaration));
