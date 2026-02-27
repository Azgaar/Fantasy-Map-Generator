"use strict";

function initGridSearch() {
    const input = document.getElementById("gridSearchInput");
    const button = document.getElementById("gridSearchButton");

    if (!input || !button) return;

    button.addEventListener("click", () => performGridSearch(input.value.trim()));
    input.addEventListener("keyup", (e) => {
        if (e.key === "Enter") performGridSearch(input.value.trim());
    });
}

function performGridSearch(gridQuery) {
    if (!gridQuery) {
        tip("Please enter a grid number", false, "error");
        return;
    }

    // Pad with zeroes
    const padQuery = String(gridQuery).padStart(4, '0');
    const results = [];

    const selectors = [
        { selector: "#markers > svg", type: "Marker" },
        { selector: "#burgIcons > circle, #burgIcons > use", type: "Burg" },
        { selector: "#armies > g > g", type: "Unit" }
    ];

    const processedIds = new Set();

    selectors.forEach(({ selector, type }) => {
        document.querySelectorAll(selector).forEach(el => {
            const id = el.id;
            if (!id || processedIds.has(id)) return;
            if (el.style.display === "none") return;

            let x = parseFloat(el.getAttribute("x") || el.getAttribute("cx") || 0);
            let y = parseFloat(el.getAttribute("y") || el.getAttribute("cy") || 0);

            // fallback to transform
            if (!x && !y) {
                const trans = el.getAttribute("transform");
                if (trans && trans.includes("translate")) {
                    const match = trans.match(/translate\(([-\d.]+)[, ]+([-\d.]+)\)/);
                    if (match) {
                        x = parseFloat(match[1]);
                        y = parseFloat(match[2]);
                    }
                }
            }

            // Special case for armies without explicit x, y (sometimes group just translates or uses its parent)
            if (!x && !y && type === "Unit") {
                const parentTrans = el.parentNode.getAttribute("transform");
                if (parentTrans && parentTrans.includes("translate")) {
                    const match = parentTrans.match(/translate\(([-\d.]+)[, ]+([-\d.]+)\)/);
                    if (match) {
                        x = parseFloat(match[1]);
                        y = parseFloat(match[2]);
                    }
                }
            }

            if (x && y) {
                const gridNum = getGridNumberFromMapCoords(x, y);
                if (gridNum === padQuery) {
                    processedIds.add(id);
                    const hasNote = notes.some(n => n.id === id);

                    let name = type + " " + id;
                    if (type === "Burg") {
                        const burgId = id.replace("burg", "");
                        if (pack.burgs[burgId]) name = pack.burgs[burgId].name;
                    } else if (type === "Marker") {
                        const markerId = id.replace("marker", "");
                        const tm = pack.markers.find(m => m.i == markerId);
                        if (tm && tm.type) name = tm.type;
                    } else if (type === "Unit") {
                        name = el.dataset.name || (el.parentNode.dataset.name + " Unit");
                    }

                    results.push({ id, type, name, hasNote, el, x, y });
                }
            }
        });
    });

    // Check all notes
    notes.forEach(n => {
        if (processedIds.has(n.id)) return;
        const el = document.getElementById(n.id);
        if (!el) return;

        let x = parseFloat(el.getAttribute("x") || el.getAttribute("cx") || 0);
        let y = parseFloat(el.getAttribute("y") || el.getAttribute("cy") || 0);
        if (!x && !y) {
            const trans = el.getAttribute("transform");
            if (trans && trans.includes("translate")) {
                const match = trans.match(/translate\(([-\d.]+)[, ]+([-\d.]+)\)/);
                if (match) {
                    x = parseFloat(match[1]);
                    y = parseFloat(match[2]);
                }
            }
        }
        if (x && y) {
            const gridNum = getGridNumberFromMapCoords(x, y);
            if (gridNum === padQuery) {
                processedIds.add(n.id);
                results.push({ id: n.id, type: "Note Element", name: n.name || n.id, hasNote: true, el, x, y });
            }
        }
    });

    displayGridSearchResults(padQuery, results);
}

function displayGridSearchResults(gridNum, results) {
    const dialog = $("#gridSearchDialog");
    const container = document.getElementById("gridSearchResults");

    if (results.length === 0) {
        container.innerHTML = `<p>No elements found in Grid ${gridNum}.</p>`;
    } else {
        let html = `<p>Found ${results.length} elements in Grid ${gridNum}:</p><ul style="list-style-type: none; padding-left: 0;">`;
        results.forEach(res => {
            const noteBadge = res.hasNote ? `<span style="background: #e85b46; color: white; padding: 2px 4px; border-radius: 4px; font-size: 0.8em; margin-left: 5px;">Has Note</span>` : '';
            html += `<li style="margin-bottom: 8px;">
        <button class="grid-result-btn options" data-id="${res.id}" style="width: 100%; text-align: left;">
          <strong>${res.name}</strong> ${noteBadge}
          <br><small style="opacity: 0.8">${res.type}</small>
        </button>
      </li>`;
        });
        html += `</ul>`;
        container.innerHTML = html;

        container.querySelectorAll('.grid-result-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const id = this.dataset.id;
                const el = document.getElementById(id);
                if (el) {
                    // check if we can open notes directly if requested, else trigger a standard click
                    const hasNote = notes.some(n => n.id === id);

                    // Always pan to element!
                    const item = results.find(r => r.id === id);
                    if (item && item.x && item.y) {
                        const transform = d3.zoomIdentity.translate(svgWidth / 2 - item.x * scale, svgHeight / 2 - item.y * scale).scale(scale);
                        d3.select("svg").transition().duration(750).call(zoom.transform, transform);
                    }

                    if (hasNote) {
                        editNotes(id, id);
                    } else {
                        const evt = new MouseEvent("click", {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        el.dispatchEvent(evt);
                    }
                } else {
                    tip("Element not found on map", false, "error");
                }
            });
        });
    }

    // Open Dialog
    dialog.dialog({
        title: `Grid ${gridNum} Search`,
        width: 300,
        maxHeight: 400,
        position: { my: "right top", at: "right-20 top+20", of: "svg", collision: "fit" }
    });
}

// Initialize on load
setTimeout(initGridSearch, 2000);
