appendStyleSheet();
insertHtml();
addListeners();

const MARGINS = {top: 10, right: 10, bottom: -5, left: 10};

const handleZoom = () => viewbox.attr("transform", d3.event.transform);
const zoom = d3.zoom().scaleExtent([0.2, 1.5]).on("zoom", handleZoom);

// store old root for transitions
let oldRoot;

// define svg elements
const svg = d3.select("#hierarchyTree > svg").call(zoom);
const viewbox = svg.select("g#hierarchyTree_viewbox");
const primaryLinks = viewbox.select("g#hierarchyTree_linksPrimary");
const secondaryLinks = viewbox.select("g#hierarchyTree_linksSecondary");
const nodes = viewbox.select("g#hierarchyTree_nodes");
const dragLine = viewbox.select("path#hierarchyTree_dragLine");

// properties
let dataElements; // {i, name, type, origins}[], e.g. path.religions
let validElements; // not-removed dataElements
let onNodeEnter; // d3Data => void
let onNodeLeave; // d3Data => void
let getDescription; // dataElement => string
let getShape; // dataElement => string;

export function open(props) {
  closeDialogs(".stable");

  dataElements = props.data;
  dataElements[0].origins = [null];
  validElements = dataElements.filter(r => !r.removed);
  if (validElements.length < 3) return tip(`Not enough ${props.type} to show hierarchy`, false, "error");

  onNodeEnter = props.onNodeEnter;
  onNodeLeave = props.onNodeLeave;
  getDescription = props.getDescription;
  getShape = props.getShape;

  const root = getRoot();
  const treeWidth = root.leaves().length * 50;
  const treeHeight = root.height * 50;

  const w = treeWidth - MARGINS.left - MARGINS.right;
  const h = treeHeight + 30 - MARGINS.top - MARGINS.bottom;
  const treeLayout = d3.tree().size([w, h]);

  const width = minmax(treeWidth, 300, innerWidth * 0.75);
  const height = minmax(treeHeight, 200, innerHeight * 0.75);

  zoom.extent([Array(2).fill(0), [width, height]]);
  svg.attr("viewBox", `0, 0, ${width}, ${height}`);

  $("#hierarchyTree").dialog({
    title: `${capitalize(props.type)} tree`,
    position: {my: "left center", at: "left+10 center", of: "svg"},
    width
  });

  renderTree(root, treeLayout);
}

function appendStyleSheet() {
  const styles = /* css */ `

    #hierarchyTree {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    #hierarchyTree > svg {
      height: 100%;
    }

    #hierarchyTree_selectedOrigins > button {
      margin: 0 2px;
    }

    .hierarchyTree_selectedButton {
      border: 1px solid #aaa;
      background: none;
      padding: 1px 4px;
    }

    .hierarchyTree_selectedButton:hover {
      border: 1px solid #333;
    }

    .hierarchyTree_selectedOrigin::after {
      content: "✕";
      margin-left: 8px;
      color: #999;
    }

    .hierarchyTree_selectedOrigin:hover:after {
      color: #333;
    }

    #hierarchyTree_originSelector {
      display: none;
    }

    #hierarchyTree_originSelector > form > div {
      padding: 0.3em;
      margin: 1px 0;
      border-radius: 1em;
    }

    #hierarchyTree_originSelector > form > div:hover {
      background-color: #ddd;
    }

    #hierarchyTree_originSelector > form > div[checked] {
      background-color: #c6d6d6;
    }

    #hierarchyTree_nodes > g > text {
      pointer-events: none;
      stroke: none;
      font-size: 11px;
    }

    #hierarchyTree_nodes > g.selected {
      stroke: #c13119;
      stroke-width: 1;
      cursor: move;
    }

    #hierarchyTree_dragLine {
      marker-end: url(#end-arrow);
      stroke: #333333;
      stroke-dasharray: 5;
      stroke-dashoffset: 1000;
      animation: dash 80s linear backwards;
    }
  `;

  const style = document.createElement("style");
  style.appendChild(document.createTextNode(styles));
  document.head.appendChild(style);
}

function insertHtml() {
  const html = /* html */ `<div id="hierarchyTree" style="overflow: hidden;">
    <svg>
      <g id="hierarchyTree_viewbox" style="text-anchor: middle; dominant-baseline: central">
        <g transform="translate(10, -45)">
          <g id="hierarchyTree_links" fill="none" stroke="#aaa">
            <g id="hierarchyTree_linksPrimary"></g>
            <g id="hierarchyTree_linksSecondary" stroke-dasharray="1"></g>
          </g>
          <g id="hierarchyTree_nodes"></g>
          <path id="hierarchyTree_dragLine" path='' />
        </g>
      </g>
    </svg>

    <div id="hierarchyTree_details" class='chartInfo'>
      <div id='hierarchyTree_infoLine' style="display: block">&#8205;</div>
      <div id='hierarchyTree_selected' style="display: none">
        <span><span id='hierarchyTree_selectedName'></span>. </span>
        <span data-name="Type short name (abbreviation)">Abbreviation: <input id='hierarchyTree_selectedCode' type='text' maxlength='3' size='3' /></span>
        <span>Origins: <span id='hierarchyTree_selectedOrigins'></span></span>
        <button data-tip='Add origin' class="hierarchyTree_selectedButton" id='hierarchyTree_selectedSelectButton'>Select</button>
        <button data-tip='Exit edit mode' class="hierarchyTree_selectedButton" id='hierarchyTree_selectedCloseButton'>Exit</button>
      </div>
    </div>
    <div id="hierarchyTree_originSelector"></div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", html);
}

function addListeners() {}

function getRoot() {
  const root = d3
    .stratify()
    .id(d => d.i)
    .parentId(d => d.origins[0])(validElements);

  oldRoot = root;
  return root;
}

function getLinkKey(d) {
  return `${d.source.id}-${d.target.id}`;
}

function getNodeKey(d) {
  return d.id;
}

function getLinkPath(d) {
  const {
    source: {x: sx, y: sy},
    target: {x: tx, y: ty}
  } = d;
  return `M${sx},${sy} C${sx},${(sy * 3 + ty) / 4} ${tx},${(sy * 2 + ty) / 3} ${tx},${ty}`;
}

function getSecondaryLinks(root) {
  const nodes = root.descendants();
  const links = [];

  for (const node of nodes) {
    const origins = node.data.origins;

    for (let i = 1; i < origins.length; i++) {
      const source = nodes.find(n => n.data.i === origins[i]);
      if (source) links.push({source, target: node});
    }
  }

  return links;
}

const shapesMap = {
  undefined: "M5,0A5,5,0,1,1,-5,0A5,5,0,1,1,5,0", // small circle
  circle: "M11.3,0A11.3,11.3,0,1,1,-11.3,0A11.3,11.3,0,1,1,11.3,0",
  square: "M-11,-11h22v22h-22Z",
  hexagon: "M-6.5,-11.26l13,0l6.5,11.26l-6.5,11.26l-13,0l-6.5,-11.26Z",
  diamond: "M0,-14L14,0L0,14L-14,0Z",
  concave: "M-11,-11l11,2l11,-2l-2,11l2,11l-11,-2l-11,2l2,-11Z",
  octagon: "M-4.97,-12.01 l9.95,0 l7.04,7.04 l0,9.95 l-7.04,7.04 l-9.95,0 l-7.04,-7.04 l0,-9.95Z",
  pentagon: "M0,-14l14,11l-6,14h-16l-6,-14Z"
};

const getSortIndex = node => {
  const descendants = node.descendants();
  const secondaryOrigins = descendants.map(({data}) => data.origins.slice(1)).flat();

  if (secondaryOrigins.length === 0) return node.data.i;
  return d3.mean(secondaryOrigins);
};

function renderTree(root, treeLayout) {
  treeLayout(root.sort((a, b) => getSortIndex(a) - getSortIndex(b)));

  primaryLinks.selectAll("path").data(root.links(), getLinkKey).join("path").attr("d", getLinkPath);
  secondaryLinks.selectAll("path").data(getSecondaryLinks(root), getLinkKey).join("path").attr("d", getLinkPath);

  const node = nodes
    .selectAll("g")
    .data(root.descendants(), getNodeKey)
    .join("g")
    .attr("data-id", d => d.data.i)
    .attr("stroke", "#333")
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .on("mouseenter", handleNoteEnter)
    .on("mouseleave", handleNodeExit)
    .on("click", selectElement)
    .call(d3.drag().on("start", dragToReorigin));

  node
    .append("path")
    .attr("d", ({data}) => shapesMap[getShape(data)])
    .attr("fill", d => d.data.color || "#ffffff")
    .attr("stroke-dasharray", d => (d.data.cells ? "none" : "1"));

  node.append("text").text(d => d.data.code || "");
}

function mapCoords(newRoot, prevRoot) {
  newRoot.x = prevRoot.x;
  newRoot.y = prevRoot.y;

  for (const node of newRoot.descendants()) {
    const prevNode = prevRoot.descendants().find(n => n.data.i === node.data.i);
    if (prevNode) {
      node.x = prevNode.x;
      node.y = prevNode.y;
    }
  }
}

function updateTree() {
  const prevRoot = oldRoot;
  const root = getRoot();
  mapCoords(root, prevRoot);

  const linksUpdateDuration = 50;
  const moveDuration = 1000;

  // old layout: update links at old nodes positions
  const linkEnter = enter =>
    enter
      .append("path")
      .attr("d", getLinkPath)
      .attr("opacity", 0)
      .call(enter => enter.transition().duration(linksUpdateDuration).attr("opacity", 1));

  const linkUpdate = update =>
    update.call(update => update.transition().duration(linksUpdateDuration).attr("d", getLinkPath));

  const linkExit = exit =>
    exit.call(exit => exit.transition().duration(linksUpdateDuration).attr("opacity", 0).remove());

  primaryLinks.selectAll("path").data(root.links(), getLinkKey).join(linkEnter, linkUpdate, linkExit);
  secondaryLinks.selectAll("path").data(getSecondaryLinks(root), getLinkKey).join(linkEnter, linkUpdate, linkExit);

  // new layout: move nodes with links to new positions
  const treeWidth = root.leaves().length * 50;
  const treeHeight = root.height * 50;

  const w = treeWidth - MARGINS.left - MARGINS.right;
  const h = treeHeight + 30 - MARGINS.top - MARGINS.bottom;

  const treeLayout = d3.tree().size([w, h]);
  treeLayout(root.sort((a, b) => getSortIndex(a) - getSortIndex(b)));

  primaryLinks
    .selectAll("path")
    .data(root.links(), getLinkKey)
    .transition()
    .duration(moveDuration)
    .delay(linksUpdateDuration)
    .attr("d", getLinkPath);

  secondaryLinks
    .selectAll("path")
    .data(getSecondaryLinks(root), getLinkKey)
    .transition()
    .duration(moveDuration)
    .delay(linksUpdateDuration)
    .attr("d", getLinkPath);

  nodes
    .selectAll("g")
    .data(root.descendants(), getNodeKey)
    .transition()
    .delay(linksUpdateDuration)
    .duration(moveDuration)
    .attr("transform", d => `translate(${d.x},${d.y})`);
}

function selectElement(d) {
  const dataElement = d.data;

  const node = nodes.select(`g[data-id="${d.id}"]`);
  nodes.selectAll("g").style("outline", "none");
  node.style("outline", "1px solid #c13119");

  byId("hierarchyTree_selected").style.display = "block";
  byId("hierarchyTree_infoLine").style.display = "none";

  byId("hierarchyTree_selectedName").innerText = dataElement.name;
  byId("hierarchyTree_selectedCode").value = dataElement.code;

  byId("hierarchyTree_selectedCode").onchange = function () {
    if (this.value.length > 3) return tip("Abbreviation must be 3 characters or less", false, "error", 3000);
    if (!this.value.length) return tip("Abbreviation cannot be empty", false, "error", 3000);

    node.select("text").text(this.value);
    dataElement.code = this.value;
  };

  const createOriginButtons = () => {
    byId("hierarchyTree_selectedOrigins").innerHTML = dataElement.origins
      .filter(origin => origin)
      .map((origin, index) => {
        const {name, code} = validElements.find(r => r.i === origin) || {};
        const type = index ? "Secondary" : "Primary";
        const tip = `${type} origin: ${name}. Click to remove link to that origin`;
        return `<button data-id="${origin}" class="hierarchyTree_selectedButton hierarchyTree_selectedOrigin" data-tip="${tip}">${code}</button>`;
      })
      .join("");

    byId("hierarchyTree_selectedOrigins").onclick = event => {
      const target = event.target;
      if (target.tagName !== "BUTTON") return;
      const origin = Number(target.dataset.id);
      const filtered = dataElement.origins.filter(elementOrigin => elementOrigin !== origin);
      dataElement.origins = filtered.length ? filtered : [0];
      target.remove();
      updateTree();
    };
  };

  createOriginButtons();

  byId("hierarchyTree_selectedSelectButton").onclick = () => {
    const origins = dataElement.origins;

    const descendants = d.descendants().map(d => d.data.i);
    const selectableElements = validElements.filter(({i}) => !descendants.includes(i));

    const selectableElementsHtml = selectableElements.map(({i, name, code, color}) => {
      const isPrimary = origins[0] === i ? "checked" : "";
      const isChecked = origins.includes(i) ? "checked" : "";

      if (i === 0) {
        return /*html*/ `
        <div ${isChecked}>
          <input data-tip="Set as primary origin" type="radio" name="primary" value="${i}" ${isPrimary} />
          Top level
        </div>
      `;
      }

      return /*html*/ `
        <div ${isChecked}>
          <input data-tip="Set as primary origin" type="radio" name="primary" value="${i}" ${isPrimary} />
          <input data-id="${i}" id="selectElementOrigin${i}" class="checkbox" type="checkbox" ${isChecked} />
          <label data-tip="Check to set as a secondary origin" for="selectElementOrigin${i}" class="checkbox-label">
            <fill-box fill="${color}" size=".8em" disabled></fill-box>
            ${code}: ${name}
          </label>
        </div>
      `;
    });

    byId("hierarchyTree_originSelector").innerHTML = /*html*/ `
      <form style="max-height: 35vh">
        ${selectableElementsHtml.join("")}
      </form>
    `;

    $("#hierarchyTree_originSelector").dialog({
      title: "Select origins",
      position: {my: "center", at: "center", of: "svg"},
      buttons: {
        Select: () => {
          $("#hierarchyTree_originSelector").dialog("close");
          const $selector = byId("hierarchyTree_originSelector");
          const selectedRadio = $selector.querySelector("input[type='radio']:checked");
          const selectedCheckboxes = $selector.querySelectorAll("input[type='checkbox']:checked");

          const primary = selectedRadio ? Number(selectedRadio.value) : 0;
          const secondary = Array.from(selectedCheckboxes)
            .map(input => Number(input.dataset.id))
            .filter(origin => origin !== primary);

          dataElement.origins = [primary, ...secondary];

          updateTree();
          createOriginButtons();
        },
        Cancel: () => {
          $("#hierarchyTree_originSelector").dialog("close");
        }
      }
    });
  };

  byId("hierarchyTree_selectedCloseButton").onclick = () => {
    node.style("outline", "none");
    byId("hierarchyTree_selected").style.display = "none";
    byId("hierarchyTree_infoLine").style.display = "block";
  };
}

function handleNoteEnter(d) {
  if (d.depth === 0) return;

  this.classList.add("selected");
  onNodeEnter(d);

  byId("hierarchyTree_infoLine").innerText = getDescription(d.data);
  tip("Drag to other node to add parent, click to edit");
}

function handleNodeExit(d) {
  this.classList.remove("selected");
  onNodeLeave(d);

  byId("hierarchyTree_infoLine").innerHTML = "&#8205;";
  tip("");
}

function dragToReorigin(from) {
  dragLine.attr("d", `M${from.x},${from.y}L${from.x},${from.y}`);

  d3.event.on("drag", () => {
    dragLine.attr("d", `M${from.x},${from.y}L${d3.event.x},${d3.event.y}`);
  });

  d3.event.on("end", function () {
    dragLine.attr("d", "");
    const selected = nodes.select("g.selected");
    if (!selected.size()) return;

    const elementId = from.data.i;
    const newOrigin = selected.datum().data.i;
    if (elementId === newOrigin) return; // dragged to itself
    if (from.data.origins.includes(newOrigin)) return; // already a child of the selected node
    if (from.descendants().some(node => node.data.i === newOrigin)) return; // cannot be a child of its own child

    const element = dataElements.find(({i}) => i === elementId);
    if (!element) return;

    if (element.origins[0] === 0) element.origins = [];
    element.origins.push(newOrigin);

    selectElement(from);
    updateTree();
  });
}
