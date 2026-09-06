import { LABEL } from "./geometry";

/** every label length follows the app's uiSize, which the renderer publishes as --mw-ui */
const ui = (px: number): string => `calc(${px}px * var(--mw-ui, 1))`;

export const WHEEL_CSS = `
/* Colours follow the app's live theme, but ONLY through the \`--mw-*\` properties palette.ts sets on
   .mw-wheel: the app's own \`--bg-light\` / \`--bg-lighter\` carry FMG's alpha already, and while the
   ring computed an alpha of its own, half the wheel followed the transparency slider and half of it
   did not. Every surface below is opaque at transparency 0 and takes ONE alpha, applied in
   palette.ts, after it. The fallbacks are the design handoff's parchment, opaque for the same
   reason. */
/* The host spans the viewport so the ring can be centred anywhere in it, so it must be transparent
   to pointers: the parts that are actually interactive opt back in below. Without this every click
   in the app lands on the overlay, and index.ts's "outside pointerdown" dismissal can never fire. */
#mapWheel {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}

#mapWheel .mw-origin {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  /* the chosen fill rather than a half-transparent --dark-solid: this dot sits on the map like
     every other part of the wheel, so it takes the user's alpha and no other */
  background: var(--mw-fill-chosen, #4a3a22);
}

/* --mw-ui (the clamped uiSize), --mw-box and --mw-drawer-offset are set on this element by
   index.ts: the dial follows the app's sizing control, so its box is no longer a constant. */
#mapWheel .mw-wheel {
  position: absolute;
  transform: translate(-50%, -50%);
  width: var(--mw-box, 516px);
  height: var(--mw-box, 516px);
}

#mapWheel .mw-svg {
  display: block;
  overflow: visible;
  filter: drop-shadow(0 10px 26px rgba(38,28,12,.35));
}

#mapWheel .mw-sector {
  pointer-events: auto;
  cursor: pointer;
  stroke-width: 1;
  transition: fill 120ms;
}

#mapWheel .mw-spine {
  stroke: var(--mw-fill-chosen, #4a3a22);
  stroke-width: 3;
  stroke-linecap: round;
}

#mapWheel .mw-labels { position: absolute; inset: 0; pointer-events: none; }

/* Every length here comes from LABEL in geometry.ts, which is also what the band table is sized
   against - the label's widest text line has to fit the band's DEPTH at a sector pointing sideways,
   and the whole stack has to fit it at a sector pointing up. Editing a size here without moving
   LABEL is exactly the drift that put ink outside the sectors, so there is nothing to edit here. */
#mapWheel .mw-label {
  position: absolute;
  transform: translate(-50%, -50%);
  width: ${ui(LABEL.width)};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${ui(LABEL.gap)};
  font-size: ${ui(LABEL.deep.font)};
  line-height: ${LABEL.lineHeight};
  text-align: center;
  pointer-events: none;
}

#mapWheel .mw-label--root { font-size: ${ui(LABEL.root.font)}; }
#mapWheel .mw-label i { font-size: ${ui(LABEL.deep.icon)}; line-height: 1; }
#mapWheel .mw-label--root i { font-size: ${ui(LABEL.root.icon)}; }
/* The note is the ink furthest from the band's mid-radius, so its WIDTH is what decides how far a
   label's bottom corner reaches at a diagonal sector. Bounded here, and by the same fraction the
   band table was sized against. */
#mapWheel .mw-note {
  font-size: ${ui(LABEL.note)};
  opacity: .68;
  letter-spacing: .05em;
  max-width: ${Math.round(LABEL.noteWidth * 100)}%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The bound on the ink, and the reason the fit can be asserted rather than hoped for: a word longer
   than the label breaks instead of spilling out of the sector, and the text stops at LABEL.lines
   however long an entity's name turns out to be. Without both, a single long name would put ink
   outside its band no matter how the radii are tuned. */
#mapWheel .mw-label span:not(.mw-note) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: ${LABEL.lines};
  line-clamp: ${LABEL.lines};
  overflow: hidden;
  overflow-wrap: anywhere;
  hyphens: auto;
  max-width: 100%;
}

/* Marks a sector as a parent. It used to be a "▸" note line, which cost every parent label a whole
   line of the band's depth; in the SVG it costs none. */
#mapWheel .mw-mark { pointer-events: none; }

#mapWheel .mw-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: calc(104px * var(--mw-ui, 1));
  height: calc(104px * var(--mw-ui, 1));
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(90,74,48,.4), 0 6px 16px rgba(20,14,4,.35);
}

#mapWheel .mw-tab {
  flex: 1;
  border: 0;
  cursor: pointer;
  pointer-events: auto;
  font: 600 calc(10px * var(--mw-ui, 1)) "IBM Plex Sans", system-ui, sans-serif;
  letter-spacing: .1em;
  text-transform: uppercase;
  background: var(--mw-fill-base, #fbf7ec);
  color: var(--mw-ink-accent, #6b5535);
  transition: background 120ms;
}

#mapWheel .mw-tab.is-active { background: var(--mw-fill-hot, #6b5535); color: var(--mw-ink-light, #fffdf7); }

/* left/top are set by the renderer: the bar sits just above the OUTERMOST OPEN ring, centred on the
   wheel's centre, and is nudged back into the viewport if a deep drill would push it off the top. */
#mapWheel .mw-crumbs {
  position: absolute;
  transform: translate(-50%, -100%);
  white-space: nowrap;
  display: flex;
  align-items: center;
  font-size: 11px;
  letter-spacing: .04em;
  color: var(--mw-ink-accent, #6b5535);
  background: var(--mw-fill-base, #fbf7ec);
  padding: 6px 11px;
  border-radius: 3px;
  border: 1px solid var(--mw-edge, rgb(194,187,171));
}

#mapWheel .mw-crumb { cursor: pointer; pointer-events: auto; color: var(--mw-ink-accent, #8a7248); }
#mapWheel .mw-crumb.is-last { color: var(--mw-ink-base, #3b3226); font-weight: 600; }
#mapWheel .mw-crumb-sep { opacity: .45; margin: 0 5px; }

/* Child of .mw-wheel, not of the host: the percentages below have to resolve against the wheel
   box, or the drawer lands beside the middle of the viewport instead of beside the ring. The
   drawer hosts the app's real forms, so unlike the ring it keeps a fixed width and height. */
#mapWheelDrawer {
  position: absolute;
  pointer-events: auto;
  top: 50%;
  transform: translateY(-50%);
  width: 340px;
  max-height: min(532px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  background: var(--mw-fill-base, #fbf7ec);
  border: 1px solid var(--mw-fill-chosen, #4a3a22);
  border-radius: 4px;
  box-shadow: 0 10px 26px rgba(38,28,12,.35);
  overflow: hidden;
}

#mapWheelDrawer[data-side="right"] { left: calc(50% + var(--mw-drawer-offset, 260px)); }
#mapWheelDrawer[data-side="left"] { right: calc(50% + var(--mw-drawer-offset, 260px)); }

#mapWheelDrawer .mw-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  /* the dimmed fill: the head is a recessed band, and recession is a colour here, not an alpha */
  background: var(--mw-fill-dim, rgb(207,200,186));
  border-bottom: 1px solid var(--mw-edge-dim, rgb(186,177,162));
}

#mapWheelDrawer .mw-drawer-title {
  font: 600 12px "IBM Plex Sans", system-ui, sans-serif;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--mw-ink-accent, #6b5535);
}

#mapWheelDrawer .mw-drawer-close {
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--mw-ink-accent, #6b5535);
  font-size: 13px;
  line-height: 1;
}

#mapWheelDrawer .mw-drawer-body { overflow-y: auto; scrollbar-width: thin; padding: 4px 14px 14px; }

/* --- the skin: FMG's real controls, restyled in place ------------------------------------- */
#mapWheelDrawer .tabcontent { display: block; }
#mapWheelDrawer table, #mapWheelDrawer tbody {
  display: block;
  width: 100%;
}
/* The rows are FMG's own <tr>s of three or four <td>s - an affordance (a lock, a restore arrow, or
   nothing), a label, the control, and sometimes a numeric readout - laid out for a wide top-bar
   panel with COLUMN widths: "#optionsContent table td:nth-of-type(1) {width: 3%}", nth-of-type(2)
   40%, nth-of-type(4) 6%, "#styleContent table td:nth-of-type(1) {width: 34.2%}".

   Declaring the cells "display: block" put every one of them on a line of its own, which is how a
   lock mark came to float above each label and how "Cultures number" ended up with its slider on one
   line and its readout on the next, rendered 17px wide - 6% of a 340px drawer, a column width
   applied to a whole line. So the row is a flex line-box instead, and the cells are placed by WHAT
   THEY CONTAIN, never by id: the rules below need no width of their own, because a flex-basis beats
   the "width" an author gave a flex item and a min-width raises the used size whatever the
   percentage says. "#styleContent table tr" (1,0,2, with "display: table") is why this selector
   carries a tbody: it has to match at equal specificity and win on document order. */
#mapWheelDrawer tbody tr {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 8px;
  row-gap: 4px;
  padding: 9px 0;
  border-bottom: 1px solid var(--mw-edge-dim, rgb(186,177,162));
}
#mapWheelDrawer tr:last-child { border-bottom: 0; }
#mapWheelDrawer td { display: block; padding: 0; width: 100%; }
/* A cell with no form control is the lock affordance or the label, and those share the first line.
   The floor is a hit target: the lock cell's own 3% is 8.6px in this drawer, narrower than the glyph
   it holds. */
#mapWheelDrawer td:not(:has(input, select, textarea, button, slider-input)) {
  flex: 0 1 auto;
  min-width: 18px;
}
/* A cell holding only compact controls is a readout for the control beside it: it keeps its natural
   size and gains a floor wide enough to read a number in. */
#mapWheelDrawer td:has(input[type="number"], input[type="color"], output) {
  flex: 0 1 auto;
  min-width: 64px;
}
/* an <output> is a readout too, and inline, so it would not take the cell the rule above sized */
#mapWheelDrawer td > output { display: block; text-align: right; font-size: 12px; }
/* The control itself. 70% is what forces the wrap and what holds the pair together: 3% + 40% + 70%
   is over a line, so the control always starts a new one, and 70% + 6% is under one, so its readout
   follows it onto THAT line rather than onto a third. The percentages make the first half hold at
   any width; the second half needs the readout's 64px floor to fit too, so it holds while the
   content box is at least 240px (0.7W + 8 + 64 <= W). The drawer is a fixed 340px wide by design -
   it hosts the app's real forms and does not scale - which leaves a 288px content box.

   ORDER IS LOAD-BEARING HERE. A slider-input cell and a .paired cell match this selector AND the
   compact-readout selector above at the same (1,1,2), because slider-input's light DOM holds a
   number input and .paired cells are number inputs; only document order picks the control rule.
   Moving these two blocks past each other re-breaks the layout, and no test names the order. */
#mapWheelDrawer td:has(input[type="range"], input[type="text"], input.paired, input[type="checkbox"], select, textarea, button, slider-input) {
  flex: 1 1 70%;
  min-width: 0;
}
/* FMG puts two number boxes in one cell and marks them .paired - the canvas width and height, the
   year and its era, the zoom extent's min and max. They are one control, so they share one line;
   stacked, each one reads as a setting of its own. The basis beats the inline widths two of them
   carry for the top bar's much wider panel. */
#mapWheelDrawer td:has(input.paired) {
  display: flex;
  align-items: center;
  gap: 4px;
}
#mapWheelDrawer input.paired { flex: 1 1 0; min-width: 0; }
/* the tip is the row's last line, never the tail of the control's */
#mapWheelDrawer tr::after { flex: 0 0 100%; }
/* Every <i> in a row is a click target - the lock, the restore arrow, the regenerate arrow - and at
   the form's inherited size its glyph box is 8px across, which is not a target. */
#mapWheelDrawer td > i[class*="icon-"] {
  display: inline-block;
  min-width: 16px;
  font-size: 13px;
  line-height: 1;
  text-align: center;
  cursor: pointer;
}
/* The block overrides above are author rules, so they beat the UA stylesheet's [hidden]{display:none}
   and the drawer's row filter would render every row it had just hidden. !important is the only way
   a single rule can restore hiding for all of them; it must stay after the overrides. */
#mapWheelDrawer [hidden] { display: none !important; }
#mapWheelDrawer > .mw-drawer-body p {
  font: 600 11px "IBM Plex Sans", system-ui, sans-serif;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--mw-ink-accent, #8a7248);
  margin: 14px 0 4px;
}
#mapWheelDrawer tr::after {
  content: attr(data-tip);
  display: block;
  font-size: 10.5px;
  line-height: 1.35;
  opacity: .68;
  color: var(--mw-ink-base, #3b3226);
  margin-top: 3px;
}
#mapWheelDrawer input[type="range"] {
  width: 100%;
  appearance: none;
  height: 3px;
  border-radius: 2px;
  background: var(--mw-edge, rgb(194,187,171));
}
#mapWheelDrawer input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--mw-fill-hot, #6b5535);
  cursor: pointer;
}
#mapWheelDrawer input[type="range"]::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 0;
  border-radius: 50%;
  background: var(--mw-fill-hot, #6b5535);
  cursor: pointer;
}
/* The height below is load-bearing, not tidiness. public/index.css gives every select
   "height: 1.6em; padding: 0" under "box-sizing: border-box"; at the 12px type below, that is a
   19.2px box which has to contain our 8px of padding, 1px of border AND the 12px line, leaving about
   10px of content box - so the glyphs were cut across the bottom ("Show" in #azgaarAssistant, which
   is how the user found it). Letting padding and line-height size the control fixes it. No
   !important needed: "#mapWheelDrawer select" is (1,0,1) against FMG's bare "select" (0,0,1). */
#mapWheelDrawer select,
#mapWheelDrawer input[type="number"],
#mapWheelDrawer input[type="text"] {
  width: 100%;
  height: auto;
  font-size: 12px;
  padding: 4px 6px;
  color: var(--mw-ink-base, #3b3226);
  background: var(--mw-fill-base, #fbf7ec);
  border: 1px solid var(--mw-edge, rgb(194,187,171));
  border-radius: 3px;
}
/* FMG sizes several SELECTS with an INLINE width for the top bar's wide panel - #stylePreset 45%,
   #styleElementSelect 42%, #styleHeightmapScheme and #styleTextureInput 86%, #styleSelectFont 85%.
   An inline style beats the rule above, so in a 340px drawer they render short and clip their own
   option text, which is the one thing a select cannot afford. !important is the only thing that can
   beat an inline style, the same justification the [hidden] rule above carries; src/index.html is
   not this feature's to edit.

   Selects only. The inline widths on INPUTS are pairs meant to sit side by side - #yearInput with
   #eraInput, the vignette and scale-bar x/y boxes - and nothing in them is clipped, so they keep
   the width their author gave them and the pair keeps reading as a pair. */
#mapWheelDrawer select { width: 100% !important; }
#mapWheelDrawer input[type="color"] {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--mw-edge, rgb(194,187,171));
  border-radius: 3px;
}
/* FMG hides raw checkboxes app-wide and styles the label instead - do not un-hide them here */
#mapWheelDrawer .checkbox-label { font-size: 12px; color: var(--mw-ink-base, #3b3226); cursor: pointer; }

@keyframes mw-fan {
  from { opacity: 0; transform: scale(.86); }
  to   { opacity: 1; transform: none; }
}

#mapWheel .mw-svg { animation: mw-fan 140ms ease-out both; transform-origin: center; }

@keyframes mw-slide-right {
  from { opacity: 0; transform: translateY(-50%) translateX(-16px); }
  to   { opacity: 1; transform: translateY(-50%); }
}
@keyframes mw-slide-left {
  from { opacity: 0; transform: translateY(-50%) translateX(16px); }
  to   { opacity: 1; transform: translateY(-50%); }
}
#mapWheelDrawer[data-side="right"] { animation: mw-slide-right 140ms ease-out both; }
#mapWheelDrawer[data-side="left"] { animation: mw-slide-left 140ms ease-out both; }

@media (prefers-reduced-motion: reduce) {
  #mapWheel .mw-svg,
  #mapWheelDrawer { animation: none; }
}
`;
