# coa-renderer_render.md

Removed Rendering/UI Logic from coa-renderer.js

The following code blocks, responsible for direct DOM manipulation, I/O, and UI-layer logic, were removed from coa-renderer.js. This logic must now be handled by the Viewer application.

1. Direct SVG Injection into the DOM
Original Code (in draw function):

```javascript
// insert coa svg to defs
document.getElementById("coas").insertAdjacentHTML("beforeend", svg);
return true;
```
Reason for Removal: Direct DOM manipulation. The engine must not know about or interact with the DOM. The refactored render function now returns the complete SVG string.

2. File Fetching and Parsing (I/O)
Original Code:

```javascript
async function fetchCharge(charge, id) {
  const fetched = fetch(PATH + charge + ".svg")
    .then(res => {
      if (res.ok) return res.text();
      else throw new Error("Cannot fetch charge");
    })
    .then(text => {
      const html = document.createElement("html");
      html.innerHTML = text;
      const g = html.querySelector("g");
      g.setAttribute("id", charge + "_" + id);
      return g.outerHTML;
    })
    .catch(err => {
      ERROR && console.error(err);
    });
  return fetched;
}
```

Reason for Removal: Contains environment-specific I/O (fetch) and DOM parsing (document.createElement, innerHTML, querySelector). This entire responsibility is now shifted to the Viewer, which must provide the charge data to the engine.

3. UI Triggering Logic
Original Code:

```javascript
const trigger = async function (id, coa) {
  if (!coa) return console.warn(`Emblem ${id} is undefined`);
  if (coa.custom) return console.warn("Cannot render custom emblem", coa);
  if (!document.getElementById(id)) return draw(id, coa);
};
```

Reason for Removal: Checks for the existence of an element in the DOM (document.getElementById) to decide whether to render. This is UI-level conditional logic.

4. Emblem Placement on Map
Original Code:

```javascript
const add = function (type, i, coa, x, y) {
  const id = type + "COA" + i;
  const g = document.getElementById(type + "Emblems");

  if (emblems.selectAll("use").size()) {
    const size = +g.getAttribute("font-size") || 50;
    const use = `<use data-i="${i}" x="${x - size / 2}" y="${y - size / 2}" width="1em" height="1em" href="#${id}"/>`;
    g.insertAdjacentHTML("beforeend", use);
  }
  if (layerIsOn("toggleEmblems")) trigger(id, coa);
};
```

Reason for Removal: This function is entirely for rendering/UI. It finds a specific SVG group on the map (#burgEmblems, #stateEmblems), reads its attributes, creates a <use> element referencing the generated CoA, and inserts it. It also depends on another UI function (layerIsOn). This is quintessential Viewer logic.

