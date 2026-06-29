import { type D3DragEvent, drag, easeSinInOut, pointer, select, sum, transition } from "d3";
import { Controllers } from "@/controllers";
import type { Regiment } from "../generators/military-generator";
import { capitalize, ensureEl, last, rn } from "../utils";

let isInitialized = false;
let selectedRegiment: SVGGElement | null = null;

function editRegiment(selector: string): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleMilitary")) toggleMilitary();

  const armies = select<SVGGElement, unknown>("#armies");
  armies.selectAll(":scope > g").classed("draggable", true);
  armies.selectAll<SVGGElement, unknown>(":scope > g > g").call(drag<SVGGElement, unknown>().on("drag", dragRegiment));
  selectedRegiment = document.querySelector<SVGGElement>(selector);
  if (!selectedRegiment) return;
  if (!pack.states[+selectedRegiment.dataset.state!]) return;
  const regiment = getRegiment();
  if (!regiment) return;

  updateRegimentData(regiment);
  drawBase();
  drawRotationControl();

  $("#regimentEditor").dialog({
    title: "Edit Regiment",
    resizable: false,
    close: closeEditor,
    position: { my: "left top", at: "left+10 top+10", of: "#map" }
  });

  if (!isInitialized) {
    ensureEl("regimentNameRestore").addEventListener("click", restoreName);
    ensureEl("regimentType").addEventListener("click", changeType);
    ensureEl("regimentName").addEventListener("change", changeName);
    ensureEl("regimentEmblemChange").addEventListener("click", changeEmblem);
    ensureEl("regimentAttack").addEventListener("click", toggleAttack);
    ensureEl("regimentRegenerateLegend").addEventListener("click", regenerateLegend);
    ensureEl("regimentLegend").addEventListener("click", editLegend);
    ensureEl("regimentSplit").addEventListener("click", splitRegiment);
    ensureEl("regimentAdd").addEventListener("click", toggleAdd);
    ensureEl("regimentAttach").addEventListener("click", toggleAttach);
    ensureEl("regimentRemove").addEventListener("click", removeRegiment);
    isInitialized = true;
  }
}

// get regiment data element
function getRegiment(): Regiment | undefined {
  if (!selectedRegiment) return undefined;
  return pack.states[+selectedRegiment.dataset.state!]?.military?.find(r => r.i === +selectedRegiment!.dataset.id!);
}

function updateRegimentData(regiment: Regiment): void {
  ensureEl("regimentType").className = regiment.n ? "icon-anchor" : "icon-users";
  ensureEl<HTMLInputElement>("regimentName").value = regiment.name;
  ensureEl("regimentEmblem").innerHTML =
    regiment.icon!.startsWith("http") || regiment.icon!.startsWith("data:image")
      ? `<img src="${regiment.icon}" style="width: 1em; height: 1em;">`
      : regiment.icon!;

  const composition = ensureEl("regimentComposition");
  composition.innerHTML = options.military
    .map(u => {
      return `<div data-tip="${capitalize(u.name)} number. Input to change">
        <div class="label">${capitalize(u.name)}:</div>
        <input data-u="${u.name}" type="number" min=0 step=1 value="${regiment.u[u.name] || 0}">
        <i>${u.type}</i></div>`;
    })
    .join("");

  composition.querySelectorAll("input").forEach(el => {
    el.addEventListener("change", changeUnit);
  });
}

function drawBase(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const clr = pack.states[+selectedRegiment.dataset.state!].color;
  const base = select<SVGGElement, unknown>("#viewbox")
    .insert("g", "g#armies")
    .attr("id", "regimentBase")
    .attr("stroke-width", 0.3)
    .attr("stroke", "#000")
    .attr("cursor", "move")
    .on("mouseenter", () => tip("Regiment base. Drag to re-base the regiment", true))
    .on("mouseleave", () => tip("", true));

  base
    .append("line")
    .attr("x1", reg.bx)
    .attr("y1", reg.by)
    .attr("x2", reg.x)
    .attr("y2", reg.y)
    .attr("class", "regimentDragLine");
  base
    .append("circle")
    .attr("cx", reg.bx)
    .attr("cy", reg.by)
    .attr("r", 2)
    .attr("fill", clr ?? null)
    .call(drag<SVGCircleElement, unknown>().on("drag", dragBase));
}

function drawRotationControl(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const { x, width, y, height } = selectedRegiment.getBBox();

  select<SVGGElement, unknown>("#debug")
    .append("circle")
    .attr("id", "rotationControl")
    .attr("cx", x + width)
    .attr("cy", y + height / 2)
    .attr("r", 1)
    .attr("opacity", 1)
    .attr("fill", "yellow")
    .attr("stroke-width", 0.3)
    .attr("stroke", "black")
    .attr("cursor", "alias")
    .attr("transform", `rotate(${reg.angle || 0})`)
    .attr("transform-origin", `${reg.x}px ${reg.y}px`)
    .on("mouseenter", () => tip("Drag to rotate the regiment", true))
    .on("mouseleave", () => tip("", true))
    .call(drag<SVGCircleElement, unknown>().on("start", rotateRegiment));
}

function rotateRegiment(this: SVGCircleElement, event: D3DragEvent<SVGCircleElement, unknown, unknown>): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;

  event.on("drag", function (this: SVGCircleElement, dragEvent: D3DragEvent<SVGCircleElement, unknown, unknown>) {
    const { x, y } = dragEvent;
    const angle = rn(Math.atan2(y - reg.y, x - reg.x) * (180 / Math.PI), 2);
    selectedRegiment!.setAttribute("transform", `rotate(${angle})`);
    this.setAttribute("transform", `rotate(${angle})`);
    reg.angle = rn(angle, 2);
  });
}

function changeType(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  reg.n = +!reg.n;
  ensureEl("regimentType").className = reg.n ? "icon-anchor" : "icon-users";

  const size = +select<SVGGElement, unknown>("#armies").attr("box-size");
  const baseRect = selectedRegiment.querySelectorAll("rect")[0];
  const iconRect = selectedRegiment.querySelectorAll("rect")[1];
  const icon = selectedRegiment.querySelector(".regimentIcon")!;
  const x = reg.n ? reg.x - size * 2 : reg.x - size * 3;
  baseRect.setAttribute("x", String(x));
  baseRect.setAttribute("width", String(reg.n ? size * 4 : size * 6));
  iconRect.setAttribute("x", String(x - size * 2));
  icon.setAttribute("x", String(x - size));
  selectedRegiment.querySelector("text")!.innerHTML = String(Military.getTotal(reg));
}

function changeName(this: HTMLInputElement): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  selectedRegiment.dataset.name = reg.name = this.value;
}

function restoreName(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const regs = pack.states[+selectedRegiment.dataset.state!].military!;
  const name = Military.getName(reg, regs);
  selectedRegiment.dataset.name = reg.name = ensureEl<HTMLInputElement>("regimentName").value = name;
}

function changeEmblem(): void {
  const regiment = getRegiment();
  if (!regiment || !selectedRegiment) return;

  selectIcon(regiment.icon ?? "", value => {
    regiment.icon = value;
    const isExternal = value.startsWith("http") || value.startsWith("data:image");
    ensureEl("regimentEmblem").innerHTML = isExternal ? `<img src="${value}" style="width: 1em; height: 1em;">` : value;
    selectedRegiment!.querySelector(".regimentIcon")!.innerHTML = isExternal ? "" : value;
    selectedRegiment!.querySelector(".regimentImage")!.setAttribute("href", isExternal ? value : "");
  });
}

function changeUnit(this: HTMLInputElement): void {
  const u = this.dataset.u!;
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  reg.u[u] = +this.value || 0;
  reg.a = sum(Object.values(reg.u));
  selectedRegiment.querySelector("text")!.innerHTML = String(Military.getTotal(reg));

  refreshMilitaryOverviewIfOpen();
  refreshRegimentsOverviewIfOpen();
}

function splitRegiment(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const u1 = reg.u;
  const state = +selectedRegiment.dataset.state!;
  const military = pack.states[state].military!;
  const i = last(military).i + 1;
  const u2 = { ...u1 };

  Object.keys(u2).forEach(u => {
    u2[u] = Math.floor(u2[u] / 2);
  }); // halved new reg
  const a = sum(Object.values(u2)); // new reg total
  if (!a) {
    tip("Not enough forces to split", false, "error");
    return;
  }

  // update old regiment
  Object.keys(u1).forEach(u => {
    u1[u] = Math.ceil(u1[u] / 2);
  }); // halved old reg
  reg.a = sum(Object.values(u1)); // old reg total
  ensureEl("regimentComposition")
    .querySelectorAll<HTMLInputElement>("input")
    .forEach(el => {
      el.value = String(reg.u[el.dataset.u!] || 0);
    });
  selectedRegiment.querySelector("text")!.innerHTML = String(Military.getTotal(reg));

  // create new regiment
  const shift = +select<SVGGElement, unknown>("#armies").attr("box-size") * 2;
  const findY = (x: number, startY: number): number => {
    let y = startY;
    do {
      y += shift;
    } while (military.find(r => r.x === x && r.y === y));
    return y;
  };
  const newReg: Regiment = {
    a,
    cell: reg.cell,
    i,
    n: reg.n,
    u: u2,
    x: reg.x,
    y: findY(reg.x, reg.y),
    bx: reg.bx,
    by: reg.by,
    state,
    icon: reg.icon,
    name: "",
    t: 0,
    s: 0,
    type: reg.type
  };
  newReg.name = Military.getName(newReg, military);
  military.push(newReg);
  Military.generateNote(newReg, pack.states[state]); // add legend
  drawRegiment(newReg, state); // draw new reg below

  refreshRegimentsOverviewIfOpen();
}

function toggleAdd(): void {
  const button = ensureEl("regimentAdd");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addRegimentOnClick);
    tip("Click on map to create new regiment or fleet", true);
  } else {
    clearMainTip();
    // `clicked` is unported classic code that reads the legacy `d3.event` global, so this one
    // rebind must go through the classic v5 `viewbox` selection, not a fresh v7 one
    viewbox.on("click", clicked).style("cursor", "default");
  }
}

function addRegimentOnClick(this: SVGGElement, event: MouseEvent): void {
  if (!selectedRegiment) return;
  const point = pointer(event, this);
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;
  const [x, y] = pack.cells.p[cell];
  const state = +selectedRegiment.dataset.state!;
  const military = pack.states[state].military!;
  const i = military.length ? last(military).i + 1 : 0;
  const n = +(pack.cells.h[cell] < 20); // naval or land
  const reg: Regiment = {
    a: 0,
    cell,
    i,
    n,
    u: {},
    x,
    y,
    bx: x,
    by: y,
    state,
    icon: "🛡️",
    name: "",
    t: 0,
    s: 0,
    type: ""
  };
  reg.name = Military.getName(reg, military);
  military.push(reg);
  Military.generateNote(reg, pack.states[state]); // add legend
  drawRegiment(reg, state);

  refreshRegimentsOverviewIfOpen();
  toggleAdd();
}

function toggleAttack(): void {
  const button = ensureEl("regimentAttack");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", attackRegimentOnClick);
    tip("Click on another regiment to initiate battle", true);
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", false);
  } else {
    clearMainTip();
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", true);
    // `clicked` is unported classic code that reads the legacy `d3.event` global, so this one
    // rebind must go through the classic v5 `viewbox` selection, not a fresh v7 one
    viewbox.on("click", clicked).style("cursor", "default");
  }
}

async function attackRegimentOnClick(this: SVGGElement, event: MouseEvent): Promise<void> {
  if (!selectedRegiment) return;
  const target = event.target as HTMLElement;
  const regSelected = target.parentElement!;
  const army = regSelected.parentElement;
  const oldState = +selectedRegiment.dataset.state!;
  const newState = +regSelected.dataset.state!;

  if (army?.parentElement?.id !== "armies") {
    tip("Please click on a regiment to attack", false, "error");
    return;
  }
  if ((regSelected as Node) === (selectedRegiment as Node)) {
    tip("Regiment cannot attack itself", false, "error");
    return;
  }
  if (oldState === newState) {
    tip("Cannot attack fraternal regiment", false, "error");
    return;
  }

  const attacker = getRegiment();
  const defender = pack.states[+regSelected.dataset.state!].military!.find(r => r.i === +regSelected.dataset.id!);
  if (!attacker || !defender || !attacker.a || !defender.a) {
    tip("Regiment has no troops to battle", false, "error");
    return;
  }

  // save initial position to temp attribute
  attacker.px = attacker.x;
  attacker.py = attacker.y;
  defender.px = defender.x;
  defender.py = defender.y;

  // move attacker to defender
  moveRegiment(attacker, defender.x, defender.y - 8);

  // draw battle icon
  const attackTransition = transition().delay(300).duration(700).ease(easeSinInOut);
  select<SVGSVGElement, unknown>("#map")
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", window.innerWidth / 2)
    .attr("y", window.innerHeight / 2)
    .text("⚔️")
    .attr("font-size", 0)
    .attr("opacity", 1)
    .style("dominant-baseline", "central")
    .style("text-anchor", "middle")
    .transition(attackTransition)
    .attr("font-size", 1000)
    .attr("opacity", 0.2)
    .on("end", () => Controllers.BattleScreen.open(attacker, defender))
    .remove();

  clearMainTip();
  $("#regimentEditor").dialog("close");
}

function toggleAttach(): void {
  const button = ensureEl("regimentAttach");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", attachRegimentOnClick);
    tip("Click on another regiment to unite both regiments. The current regiment will be removed", true);
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", false);
  } else {
    clearMainTip();
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", true);
    // `clicked` is unported classic code that reads the legacy `d3.event` global, so this one
    // rebind must go through the classic v5 `viewbox` selection, not a fresh v7 one
    viewbox.on("click", clicked).style("cursor", "default");
  }
}

function attachRegimentOnClick(this: SVGGElement, event: MouseEvent): void {
  if (!selectedRegiment) return;
  const target = event.target as HTMLElement;
  const regSelected = target.parentElement!;
  const army = regSelected.parentElement;
  const newState = +regSelected.dataset.state!;

  if (army?.parentElement?.id !== "armies") {
    tip("Please click on a regiment", false, "error");
    return;
  }
  if ((regSelected as Node) === (selectedRegiment as Node)) {
    tip("Cannot attach regiment to itself. Please click on another regiment", false, "error");
    return;
  }

  const reg = getRegiment(); // reg to be attached
  if (!reg) return;
  const sel = pack.states[newState].military!.find(r => r.i === +regSelected.dataset.id!);
  if (!sel) return;

  for (const unit of options.military) {
    const u = unit.name;
    if (reg.u[u]) sel.u[u] = sel.u[u] ? sel.u[u] + reg.u[u] : reg.u[u];
  }
  sel.a = sum(Object.values(sel.u)); // reg total
  regSelected.querySelector("text")!.innerHTML = String(Military.getTotal(sel)); // update selected reg total text

  // remove attached regiment
  const oldState = +selectedRegiment.dataset.state!;
  const military = pack.states[oldState].military!;
  military.splice(military.indexOf(reg), 1);
  const index = notes.findIndex(n => n.id === selectedRegiment!.id);
  if (index !== -1) notes.splice(index, 1);
  selectedRegiment.remove();

  refreshRegimentsOverviewIfOpen();
  $("#regimentEditor").dialog("close");
  Controllers.RegimentEditor.open(`#${regSelected.id}`);
}

function regenerateLegend(): void {
  if (!selectedRegiment) return;
  const index = notes.findIndex(n => n.id === selectedRegiment!.id);
  if (index !== -1) notes.splice(index, 1);

  const s = pack.states[+selectedRegiment.dataset.state!];
  const reg = getRegiment();
  if (reg) Military.generateNote(reg, s);
}

function editLegend(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  editNotes(selectedRegiment.id, reg.name);
}

function removeRegiment(): void {
  ensureEl("alertMessage").innerHTML = "Are you sure you want to remove the regiment?";
  $("#alert").dialog({
    resizable: false,
    title: "Remove regiment",
    buttons: {
      Remove: function () {
        $(this).dialog("close");
        if (!selectedRegiment) return;
        const military = pack.states[+selectedRegiment.dataset.state!].military!;
        const reg = getRegiment();
        const regIndex = reg ? military.indexOf(reg) : -1;
        if (regIndex === -1) return;
        military.splice(regIndex, 1);

        const index = notes.findIndex(n => n.id === selectedRegiment!.id);
        if (index !== -1) notes.splice(index, 1);
        selectedRegiment.remove();

        refreshMilitaryOverviewIfOpen();
        refreshRegimentsOverviewIfOpen();
        $("#regimentEditor").dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function dragRegiment(this: SVGGElement, event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  select(this).raise();
  select(this.parentNode as Element).raise();

  const reg = pack.states[+this.dataset.state!].military!.find(r => r.i === +this.dataset.id!);
  if (!reg) return;
  const size = +select<SVGGElement, unknown>("#armies").attr("box-size");
  const w = reg.n ? size * 4 : size * 6;
  const h = size * 2;

  const baseRect = this.querySelector("rect")!;
  const text = this.querySelector("text")!;
  const iconRect = this.querySelectorAll("rect")[1];
  const icon = this.querySelector(".regimentIcon")!;
  const image = this.querySelector(".regimentImage")!;

  const self = selectedRegiment === this;
  const baseLine = select<SVGGElement, unknown>("#viewbox").select("g#regimentBase > line");
  const rotationControl = select<SVGGElement, unknown>("#debug").select("#rotationControl");

  event.on("drag", function (this: SVGGElement, dragEvent: D3DragEvent<SVGGElement, unknown, unknown>) {
    const { x, y } = dragEvent;
    reg.x = x;
    reg.y = y;
    const x1 = rn(x - w / 2, 2);
    const y1 = rn(y - size, 2);

    this.setAttribute("transform-origin", `${x}px ${y}px`);
    baseRect.setAttribute("x", String(x1));
    baseRect.setAttribute("y", String(y1));
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    iconRect.setAttribute("x", String(x1 - h));
    iconRect.setAttribute("y", String(y1));
    icon.setAttribute("x", String(x1 - size));
    icon.setAttribute("y", String(y));
    image.setAttribute("x", String(x1 - h));
    image.setAttribute("y", String(y1));
    if (self) {
      baseLine.attr("x2", x).attr("y2", y);
      rotationControl
        .attr("cx", x1 + w)
        .attr("cy", y)
        .attr("transform-origin", `${x}px ${y}px`);
    }
  });
}

function dragBase(this: SVGCircleElement, event: D3DragEvent<SVGCircleElement, unknown, unknown>): void {
  const baseLine = select<SVGGElement, unknown>("#viewbox").select("g#regimentBase > line");
  const reg = getRegiment();
  if (!reg) return;

  event.on("drag", function (this: SVGCircleElement, dragEvent: D3DragEvent<SVGCircleElement, unknown, unknown>) {
    this.setAttribute("cx", String(dragEvent.x));
    this.setAttribute("cy", String(dragEvent.y));
    baseLine.attr("x1", String(dragEvent.x)).attr("y1", String(dragEvent.y));
  });

  event.on("end", (dragEvent: D3DragEvent<SVGCircleElement, unknown, unknown>) => {
    reg.bx = dragEvent.x;
    reg.by = dragEvent.y;
  });
}

function closeEditor(): void {
  select<SVGGElement, unknown>("#debug").selectAll("*").remove();
  select<SVGGElement, unknown>("#viewbox").selectAll("g#regimentBase").remove();
  const armiesSel = select<SVGGElement, unknown>("#armies");
  armiesSel.selectAll(":scope > g").classed("draggable", false);
  armiesSel.selectAll<SVGGElement, unknown>("g>g").call(drag<SVGGElement, unknown>().on("drag", null));
  ensureEl("regimentAdd").classList.remove("pressed");
  ensureEl("regimentAttack").classList.remove("pressed");
  ensureEl("regimentAttach").classList.remove("pressed");
  restoreDefaultEvents();
  selectedRegiment = null;
}

async function refreshMilitaryOverviewIfOpen(): Promise<void> {
  if (!ensureEl("militaryOverview").offsetParent) return;
  Controllers.MilitaryOverview.refresh();
}

async function refreshRegimentsOverviewIfOpen(): Promise<void> {
  if (!ensureEl("regimentsOverview").offsetParent) return;
  Controllers.RegimentsOverview.refresh();
}

export const RegimentEditor = { open: editRegiment };
