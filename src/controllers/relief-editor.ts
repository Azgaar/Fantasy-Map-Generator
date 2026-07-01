import { drag, pointer, quadtree, range, select } from "d3";
import { ensureEl, findAllInQuadtree, rn } from "../utils";

// The #reliefEditor markup (including the large static icon palette) is authored in
// index.html and only queried here, so this module does not own it. Listeners are wired
// once behind this flag.
let initialized = false;

const terrainSel = () => select<SVGGElement, unknown>(terrain.node()!);

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRelief")) toggleRelief();

  terrainSel()
    .selectAll<SVGUseElement, unknown>("use")
    .call(drag<SVGUseElement, unknown>().on("drag", dragReliefIcon))
    .classed("draggable", true);
  elSelected = select<SVGElement, unknown>(element) as unknown as typeof elSelected;

  restoreEditMode();
  updateReliefIconSelected();
  updateReliefSizeInput();

  $("#reliefEditor").dialog({
    title: "Edit Relief Icons",
    resizable: false,
    width: "27em",
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeReliefEditor
  });

  if (initialized) return;
  initialized = true;

  ensureEl("reliefIndividual").on("click", enterIndividualMode);
  ensureEl("reliefBulkAdd").on("click", enterBulkAddMode);
  ensureEl("reliefBulkRemove").on("click", enterBulkRemoveMode);

  ensureEl("reliefSize").on("input", changeIconSize);
  ensureEl("reliefSizeNumber").on("input", changeIconSize);
  ensureEl("reliefEditorSet").on("change", changeIconsSet);
  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg")
    .forEach(el => {
      el.addEventListener("click", changeIcon);
    });

  ensureEl("reliefEditStyle").on("click", () => editStyle("terrain"));
  ensureEl("reliefCopy").on("click", copyIcon);
  ensureEl("reliefMoveFront").on("click", () => elSelected.raise());
  ensureEl("reliefMoveBack").on("click", () => elSelected.lower());
  ensureEl("reliefRemove").on("click", removeIcon);
}

function dragReliefIcon(this: SVGUseElement, event: any): void {
  const dx = +this.getAttribute("x")! - event.x;
  const dy = +this.getAttribute("y")! - event.y;

  event.on("drag", function (this: SVGUseElement, dragEvent: any) {
    this.setAttribute("x", String(dx + dragEvent.x));
    this.setAttribute("y", String(dy + dragEvent.y));
  });
}

function restoreEditMode(): void {
  if (!ensureEl("reliefTools").querySelector("button.pressed")) enterIndividualMode();
  else if (ensureEl("reliefBulkAdd").classList.contains("pressed")) enterBulkAddMode();
  else if (ensureEl("reliefBulkRemove").classList.contains("pressed")) enterBulkRemoveMode();
}

function updateReliefIconSelected(): void {
  const type = elSelected.attr("href") || elSelected.attr("data-type");
  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const button = reliefIconsDiv.querySelector(`svg[data-type='${type}']`);
  if (!button) return;

  reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => {
    b.classList.remove("pressed");
  });
  button.classList.add("pressed");
  reliefIconsDiv.querySelectorAll<HTMLElement>("div").forEach(b => {
    b.style.display = "none";
  });
  const parent = button.parentNode as HTMLElement;
  parent.style.display = "block";
  ensureEl<HTMLSelectElement>("reliefEditorSet").value = parent.dataset.type!;
}

function updateReliefSizeInput(): void {
  const size = +elSelected.attr("width");
  ensureEl<HTMLInputElement>("reliefSize").value = ensureEl<HTMLInputElement>("reliefSizeNumber").value = String(
    rn(size)
  );
}

function enterIndividualMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefIndividual").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "block";
  ensureEl("reliefRadiusDiv").style.display = "none";
  ensureEl("reliefSpacingDiv").style.display = "none";
  ensureEl("reliefIconsSeletionAny").style.display = "none";

  removeCircle();
  updateReliefSizeInput();
  restoreDefaultEvents();
  clearMainTip();
}

function enterBulkAddMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkAdd").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "block";
  ensureEl("reliefRadiusDiv").style.display = "block";
  ensureEl("reliefSpacingDiv").style.display = "block";
  ensureEl("reliefIconsSeletionAny").style.display = "none";

  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const pressedType = reliefIconsDiv.querySelector("svg.pressed");
  if (pressedType?.id === "reliefIconsSeletionAny") {
    // if "any" is pressed, select first type
    ensureEl("reliefIconsSeletionAny").classList.remove("pressed");
    reliefIconsDiv.querySelector("svg")?.classList.add("pressed");
  }

  select(viewbox.node()!)
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToAdd))
    .on("touchmove mousemove", moveBrush);
  tip("Drag to place relief icons within radius", true);
}

function moveBrush(this: SVGElement, event: any): void {
  showMainTip();
  const point = pointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  moveCircle(point[0], point[1], radius);
}

function dragToAdd(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("Please select an icon", false, "error");
    return;
  }

  const type = pressed.dataset.type!;
  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const spacing = +ensureEl<HTMLInputElement>("reliefSpacingNumber").value;
  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;

  // build a quadtree
  const tree = quadtree<[number, number, number?]>();
  const positions: number[] = [];
  terrainSel()
    .selectAll<SVGUseElement, unknown>("use")
    .each(function () {
      const x = +this.getAttribute("x")! + +this.getAttribute("width")! / 2;
      const y = +this.getAttribute("y")! + +this.getAttribute("height")! / 2;
      tree.add([x, y, x]);
      const box = this.getBBox();
      positions.push(box.y + box.height);
    });

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const p = pointer(dragEvent, this);
    moveCircle(p[0], p[1], r);

    range(Math.ceil(r / 10)).forEach(() => {
      const a = Math.PI * 2 * Math.random();
      const rad = r * Math.random();
      const cx = p[0] + rad * Math.cos(a);
      const cy = p[1] + rad * Math.sin(a);

      if (tree.find(cx, cy, spacing)) return; // too close to existing icon
      if (pack.cells.h[findCell(cx, cy)!] < 20) return; // on water cell

      const h = rn((size / 2) * (Math.random() * 0.4 + 0.8), 2);
      const x = rn(cx - h, 2);
      const y = rn(cy - h, 2);
      const z = y + h * 2;
      const s = rn(h * 2, 2);

      let nth = 1;
      while (positions[nth] && z > positions[nth]) {
        nth++;
      }

      tree.add([cx, cy]);
      positions.push(z);
      terrainSel()
        .insert("use", `:nth-child(${nth})`)
        .attr("href", type)
        .attr("x", x)
        .attr("y", y)
        .attr("width", s)
        .attr("height", s);
    });
  });
}

function enterBulkRemoveMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkRemove").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "none";
  ensureEl("reliefRadiusDiv").style.display = "block";
  ensureEl("reliefSpacingDiv").style.display = "none";
  ensureEl("reliefIconsSeletionAny").style.display = "inline-block";

  select(viewbox.node()!)
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToRemove))
    .on("touchmove mousemove", moveBrush);
  tip("Drag to remove relief icons in radius", true);
}

function dragToRemove(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("Please select an icon", false, "error");
    return;
  }

  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const type = pressed.dataset.type;
  const icons = type
    ? terrainSel().selectAll<SVGUseElement, unknown>(`use[href='${type}']`)
    : terrainSel().selectAll<SVGUseElement, unknown>("use");
  const tree = quadtree<[number, number, SVGUseElement]>();
  icons.each(function () {
    const x = +this.getAttribute("x")! + +this.getAttribute("width")! / 2;
    const y = +this.getAttribute("y")! + +this.getAttribute("height")! / 2;
    tree.add([x, y, this]);
  });

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const p = pointer(dragEvent, this);
    moveCircle(p[0], p[1], r);
    findAllInQuadtree(p[0], p[1], r, tree).forEach((f: any) => {
      f[2].remove();
    });
  });
}

function changeIconSize(): void {
  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;
  if (!ensureEl("reliefIndividual").classList.contains("pressed")) return;

  const shift = (size - +elSelected.attr("width")) / 2;
  elSelected.attr("width", size).attr("height", size);
  const x = +elSelected.attr("x");
  const y = +elSelected.attr("y");
  elSelected.attr("x", x - shift).attr("y", y - shift);
}

function changeIconsSet(): void {
  const set = ensureEl<HTMLSelectElement>("reliefEditorSet").value;
  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  reliefIconsDiv.querySelectorAll<HTMLElement>("div").forEach(b => {
    b.style.display = "none";
  });
  reliefIconsDiv.querySelector<HTMLElement>(`div[data-type='${set}']`)!.style.display = "block";
}

function changeIcon(this: SVGElement): void {
  if (this.classList.contains("pressed")) return;

  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  this.classList.add("pressed");

  if (ensureEl("reliefIndividual").classList.contains("pressed")) {
    const type = this.dataset.type!;
    elSelected.attr("href", type);
  }
}

function copyIcon(): void {
  const node = elSelected.node()!;
  const parent = node.parentNode as SVGGElement;
  const copy = node.cloneNode(true) as SVGElement;

  let x = +elSelected.attr("x") - 3;
  let y = +elSelected.attr("y") - 3;
  while (parent.querySelector(`[x='${x}']`)) {
    x -= 3;
    y -= 3;
  }

  copy.setAttribute("x", String(x));
  copy.setAttribute("y", String(y));
  parent.insertBefore(copy, null);
}

function removeIcon(): void {
  let selection: typeof elSelected | null = null;
  const pressed = ensureEl("reliefTools").querySelector("button.pressed");
  if (pressed?.id === "reliefIndividual") {
    alertMessage.innerHTML = "Are you sure you want to remove the icon?";
    selection = elSelected;
  } else {
    const type = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed")?.dataset.type;
    selection = (type
      ? terrainSel().selectAll(`use[href='${type}']`)
      : terrainSel().selectAll("use")) as unknown as typeof elSelected;
    const size = selection.size();
    alertMessage.innerHTML = type
      ? `Are you sure you want to remove all ${type} icons (${size})?`
      : `Are you sure you want to remove all icons (${size})?`;
  }

  $("#alert").dialog({
    resizable: false,
    title: "Remove relief icons",
    buttons: {
      Remove: function (this: HTMLElement) {
        if (selection) selection.remove();
        $(this).dialog("close");
        $("#reliefEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function closeReliefEditor(): void {
  terrainSel()
    .selectAll<SVGUseElement, unknown>("use")
    .call(drag<SVGUseElement, unknown>().on("drag", null))
    .classed("draggable", false);
  removeCircle();
  unselect();
  clearMainTip();
}

export const ReliefEditor = { open };
