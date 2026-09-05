// Wheel styling. Kept as one string so the whole surface reads in one place: the wheel is a
// single self-contained overlay and has no other stylable parts.
export const WHEEL_CSS = /* css */ `
#mapWheel {
  position: fixed;
  inset: 0;
  z-index: 3000;
  font-family: var(--sans-serif);
  user-select: none;
  -webkit-user-select: none;
}

/* the exact point that was clicked, since the wheel itself is clamped into the viewport */
#mapWheel .mw-origin {
  position: absolute;
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 50%;
  border: 1.5px solid var(--mw-ink);
  background: var(--mw-parchment);
  pointer-events: none;
  opacity: 0.9;
}

#mapWheel .mw-wheel {
  --mw-ink: #33291f;
  --mw-ink-soft: #6d6152;
  --mw-parchment: #f7f1e2;
  --mw-parchment-lit: #fffdf6;
  --mw-accent: #8a5a2b;
  position: absolute;
  width: var(--mw-size);
  height: var(--mw-size);
  translate: -50% -50%;
  animation: mw-in 140ms cubic-bezier(0.22, 0.9, 0.28, 1.06) both;
}

#mapWheel .mw-ring {
  position: absolute;
  inset: 0;
  outline: none;
}
#mapWheel .mw-ring.is-leaving {
  pointer-events: none;
}

/* swapping rings is a zoom: out to the list of subjects, back in to the one picked */
#mapWheel .mw-ring.is-entering-out { animation: mw-enter-out 180ms cubic-bezier(0.2, 0.85, 0.3, 1) both; }
#mapWheel .mw-ring.is-leaving-out { animation: mw-leave-out 180ms cubic-bezier(0.4, 0, 0.7, 0.4) both; }
#mapWheel .mw-ring.is-entering-in { animation: mw-enter-in 180ms cubic-bezier(0.2, 0.85, 0.3, 1) both; }
#mapWheel .mw-ring.is-leaving-in { animation: mw-leave-in 180ms cubic-bezier(0.4, 0, 0.7, 0.4) both; }

@keyframes mw-enter-out {
  from { scale: 0.88; opacity: 0; rotate: -4deg; }
  to { scale: 1; opacity: 1; rotate: 0deg; }
}
@keyframes mw-leave-out {
  from { scale: 1; opacity: 1; rotate: 0deg; }
  to { scale: 1.12; opacity: 0; rotate: 4deg; }
}
@keyframes mw-enter-in {
  from { scale: 1.12; opacity: 0; rotate: 4deg; }
  to { scale: 1; opacity: 1; rotate: 0deg; }
}
@keyframes mw-leave-in {
  from { scale: 1; opacity: 1; rotate: 0deg; }
  to { scale: 0.88; opacity: 0; rotate: -4deg; }
}

@media (prefers-reduced-motion: reduce) {
  #mapWheel .mw-wheel,
  #mapWheel .mw-ring {
    animation-duration: 1ms;
  }
  .mw-sector,
  .mw-item {
    transition: none;
  }
}
@keyframes mw-in {
  from { scale: 0.9; opacity: 0; rotate: -5deg; }
  to { scale: 1; opacity: 1; rotate: 0deg; }
}

#mapWheel svg {
  position: absolute;
  inset: 0;
  display: block;
  overflow: visible;
  filter: drop-shadow(0 5px 16px rgba(40, 30, 18, 0.32));
}

/* --- ring ---------------------------------------------------------------------------------- */

.mw-sector {
  fill: var(--mw-parchment);
  stroke: rgba(51, 41, 31, 0.3);
  stroke-width: 1;
  cursor: pointer;
  transition: fill 90ms ease, translate 110ms cubic-bezier(0.2, 0.8, 0.3, 1.2);
}
.mw-sector.is-hot {
  fill: var(--mw-ink);
  stroke: var(--mw-ink);
}
.mw-verb-tick {
  stroke: var(--mw-ink);
  stroke-width: 1.25;
  stroke-linecap: round;
  opacity: 0.5;
  pointer-events: none;
}
.mw-item {
  position: absolute;
  left: calc(50% + var(--x));
  top: calc(50% + var(--y));
  translate: -50% -50%;
  width: 86px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--mw-ink);
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  pointer-events: none;
  transition: color 90ms ease, translate 110ms cubic-bezier(0.2, 0.8, 0.3, 1.2);
}
.mw-item i {
  font-size: 18px;
  opacity: 0.85;
}
.mw-item.is-hot {
  color: var(--mw-parchment-lit);
}
.mw-item.is-hot i {
  opacity: 1;
}

/* --- hub ----------------------------------------------------------------------------------- */

.mw-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 0;
  border-radius: 50%;
  background: var(--mw-ink);
  color: var(--mw-parchment);
  font-family: inherit;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 253, 246, 0.18);
}
.mw-hub:hover, .mw-hub:focus-visible { background: var(--mw-accent); outline: none; }
.mw-hub-kind {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  opacity: 0.6;
}
.mw-hub-name {
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.15;
  max-height: 2.3em;
  overflow: hidden;
}
.mw-hub-detail {
  font-size: 8.5px;
  opacity: 0.62;
  line-height: 1.2;
  max-height: 2.4em;
  overflow: hidden;
}
.mw-hub-pips { display: flex; gap: 3px; margin-top: 3px; }
.mw-hub-pips span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.3;
}
.mw-hub-pips span.is-on { opacity: 0.95; }
`;
