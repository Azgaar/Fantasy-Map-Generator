export const WHEEL_CSS = `
/* Colours follow the app's live theme. \`--bg-light\` / \`--bg-lighter\` / \`--light-solid\` /
   \`--dark-solid\` are written onto <html> by changeDialogsTheme(); the \`--mw-*\` properties are the
   same theme after palette.ts has held every ink to 4.5:1 over the ground it is painted on, set on
   .mw-wheel by the renderer. Both carry the design handoff's parchment as their fallback. */
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
  background: var(--dark-solid, #4a3a22);
  opacity: .5;
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

#mapWheel .mw-label {
  position: absolute;
  transform: translate(-50%, -50%);
  width: calc(66px * var(--mw-ui, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(2px * var(--mw-ui, 1));
  font-size: calc(9.5px * var(--mw-ui, 1));
  line-height: 1.15;
  text-align: center;
  pointer-events: none;
}

#mapWheel .mw-label--root { width: calc(74px * var(--mw-ui, 1)); font-size: calc(10.5px * var(--mw-ui, 1)); }
#mapWheel .mw-label i { font-size: calc(16px * var(--mw-ui, 1)); line-height: 1; }
#mapWheel .mw-label--root i { font-size: calc(19px * var(--mw-ui, 1)); }
#mapWheel .mw-note { font-size: calc(8.5px * var(--mw-ui, 1)); opacity: .68; letter-spacing: .05em; }

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
  background: var(--mw-fill-base, rgba(251,247,236,.94));
  color: var(--mw-ink-accent, #6b5535);
  transition: background 120ms;
}

#mapWheel .mw-tab.is-active { background: var(--mw-fill-hot, #6b5535); color: var(--mw-ink-light, #fffdf7); }

#mapWheel .mw-crumbs {
  position: absolute;
  left: 18px;
  top: 16px;
  display: flex;
  align-items: center;
  font-size: 11px;
  letter-spacing: .04em;
  color: var(--mw-ink-accent, #6b5535);
  background: var(--bg-lighter, rgba(251,247,236,.86));
  padding: 6px 11px;
  border-radius: 3px;
  border: 1px solid var(--mw-edge, rgba(90,74,48,.25));
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
  background: var(--bg-light, rgba(251,247,236,.97));
  border: 1px solid var(--dark-solid, rgba(90,74,48,.32));
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
  background: var(--bg-lighter, rgba(251,247,236,.86));
  border-bottom: 1px solid var(--mw-edge-dim, rgba(90,74,48,.16));
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
#mapWheelDrawer table, #mapWheelDrawer tbody, #mapWheelDrawer tr, #mapWheelDrawer td {
  display: block;
  width: 100%;
}
#mapWheelDrawer tr {
  padding: 9px 0;
  border-bottom: 1px solid var(--mw-edge-dim, rgba(90,74,48,.16));
}
#mapWheelDrawer tr:last-child { border-bottom: 0; }
#mapWheelDrawer td { padding: 0; }
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
  background: var(--mw-edge, rgba(90,74,48,.22));
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
#mapWheelDrawer select,
#mapWheelDrawer input[type="number"],
#mapWheelDrawer input[type="text"] {
  width: 100%;
  font-size: 12px;
  padding: 4px 6px;
  color: var(--mw-ink-base, #3b3226);
  background: var(--light-solid, rgba(251,247,236,.97));
  border: 1px solid var(--mw-edge, rgba(90,74,48,.32));
  border-radius: 3px;
}
#mapWheelDrawer input[type="color"] {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--mw-edge, rgba(90,74,48,.32));
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
