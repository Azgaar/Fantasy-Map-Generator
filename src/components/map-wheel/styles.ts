export const WHEEL_CSS = `
#mapWheel {
  position: fixed;
  inset: 0;
  z-index: 1000;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}

#mapWheel .mw-origin {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: #4a3a22;
  opacity: .5;
}

#mapWheel .mw-wheel {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 516px;
  height: 516px;
}

#mapWheel .mw-svg {
  display: block;
  overflow: visible;
  filter: drop-shadow(0 10px 26px rgba(38,28,12,.35));
}

#mapWheel .mw-sector {
  cursor: pointer;
  stroke-width: 1;
  transition: fill 120ms;
}

#mapWheel .mw-spine {
  stroke: #4a3a22;
  stroke-width: 3;
  stroke-linecap: round;
}

#mapWheel .mw-labels { position: absolute; inset: 0; pointer-events: none; }

#mapWheel .mw-label {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 66px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 9.5px;
  line-height: 1.15;
  text-align: center;
  pointer-events: none;
}

#mapWheel .mw-label--root { width: 74px; font-size: 10.5px; }
#mapWheel .mw-label i { font-size: 16px; line-height: 1; }
#mapWheel .mw-label--root i { font-size: 19px; }
#mapWheel .mw-note { font-size: 8.5px; opacity: .68; letter-spacing: .05em; }

#mapWheel .mw-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 104px;
  height: 104px;
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
  font: 600 10px "IBM Plex Sans", system-ui, sans-serif;
  letter-spacing: .1em;
  text-transform: uppercase;
  background: rgba(251,247,236,.94);
  color: #6b5535;
  transition: background 120ms;
}

#mapWheel .mw-tab.is-active { background: #6b5535; color: #fffdf7; }

#mapWheel .mw-crumbs {
  position: absolute;
  left: 18px;
  top: 16px;
  display: flex;
  align-items: center;
  font-size: 11px;
  letter-spacing: .04em;
  color: #6b5535;
  background: rgba(251,247,236,.86);
  padding: 6px 11px;
  border-radius: 3px;
  border: 1px solid rgba(90,74,48,.25);
}

#mapWheel .mw-crumb { cursor: pointer; pointer-events: auto; color: #8a7248; }
#mapWheel .mw-crumb.is-last { color: #3b3226; font-weight: 600; }
#mapWheel .mw-crumb-sep { opacity: .45; margin: 0 5px; }
`;
