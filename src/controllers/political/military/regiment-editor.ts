import { type D3DragEvent, drag, easeSinInOut, select, transition } from "d3";
import { Controllers } from "@/controllers";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import type { Regiment } from "@/model/political/military-generator";
import { Military } from "@/model/political/military-generator";
import { Tags } from "@/model/tags";
import {
  drawRegiment,
  getRegimentWidth,
  moveRegiment,
  regimentIconBox,
  updateRegimentIcon
} from "@/renderers/draw-military";
import { Layers } from "@/renderers/layers";
import { speak } from "@/services/speech";
import { Dialog } from "@/ui/dialog/dialog";
import { noteButton, refreshEditors } from "@/ui/dialog/dialog-helpers";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { clearMainTip, tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { capitalize } from "@/utils/string-utils";

let selectedRegiment: SVGGElement | null = null;

function editRegiment(selector: string): void {
  if (options.app.mode) return;
  Dialog.closeAll(".stable");
  Layers.show("military");

  bindRegiments();
  selectedRegiment = document.querySelector<SVGGElement>(selector);
  if (!selectedRegiment) return;
  if (!pack.states[+selectedRegiment.dataset.state!]) return;
  const regiment = getRegiment();
  if (!regiment) return;

  renderDialog();
  updateRegimentData(regiment);
  drawBase();
  drawRotationControl();

  Dialog.open("regimentEditor", {
    title: t("Edit Regiment"),
    onClose: closeEditor,
    position: { my: "left top", at: "left+10 top+10", of: "#map" }
  });
}

function bindRegiments(): void {
  const armies = select<SVGGElement, unknown>("#armies");
  armies.selectAll(":scope > g").classed("draggable", true);
  armies.selectAll<SVGGElement, unknown>(":scope > g > g").call(drag<SVGGElement, unknown>().on("drag", dragRegiment));
}

function renderDialog(): void {
  Dialog.destroy("regimentEditor");
  const editorHtml = /* html */ `<div id="regimentEditor" class="dialog">
    <div id="regimentBody" style="padding-bottom: 0.3em">
      <div style="padding-bottom: 0.2em">
        <button id="regimentType" data-tip="${sentences(t("Regiment type (land or naval)"), t("Click to change"))}"></button>
        <input
          id="regimentName"
          data-tip="${t("Type to rename")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 13em"
        />
        <span
          id="regimentNameSpeak"
          data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}"
          class="speaker"
          >🔊</span
        >
        <i id="regimentNameRestore" data-tip="${t("Reset to default")}" class="icon-ccw pointer"></i>
      </div>
      <div data-tip="${t("Regiment icon")}" style="display: flex; align-items: center">
        <div class="label">${t("Icon")}:</div>
        <div id="regimentIcon" translate="no" style="font-size: 1.5em; width: 3.7em; display: flex"></div>
        <button id="regimentIconChange" style="padding: 0; width: 4.5em">${t("Change")}</button>
      </div>
      <div data-tip="${t("Regiment tags (comma-separated)")}">
        <div class="label">${t("Tags")}:</div>
        <input
          id="regimentTags"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 13em"
        />
      </div>
      <div id="regimentComposition" class="table"></div>
    </div>
    <div id="regimentBottom">
      <button id="regimentAttack" data-tip="${t("Attack foreign regiment")}" class="icon-button-melee"></button>
      <button id="regimentAdd" data-tip="${t("Create a new regiment or fleet")}" class="icon-user-plus"></button>
      <button id="regimentSplit" data-tip="${t("Split regiment into 2 separate ones")}" class="icon-half"></button>
      <button
        id="regimentAttach"
        data-tip="${t("Attach regiment to another one (include this regiment to another one)")}"
        class="icon-attach"
      ></button>
      <button id="regimentToggleVisibility" data-tip="${t("Toggle regiment visibility on the map")}" class="icon-eye"></button>
      <button id="regimentRegenerateLegend" data-tip="${t("Regenerate legend for this regiment")}" class="icon-retweet"></button>
      ${noteButton("regimentLegend", t("Edit free text notes (legend)"))}
      <button
        id="regimentRemove"
        data-tip="${t("Remove")}"
        data-shortcut="Delete"
        class="icon-trash fastDelete"
      ></button>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("regimentNameRestore").addEventListener("click", restoreName);
  ensureEl("regimentNameSpeak").addEventListener("click", () =>
    speak(ensureEl<HTMLInputElement>("regimentName").value)
  );
  ensureEl("regimentType").addEventListener("click", changeType);
  ensureEl("regimentName").addEventListener("change", changeName);
  ensureEl("regimentIconChange").addEventListener("click", changeIcon);
  ensureEl("regimentTags").addEventListener("change", changeTags);
  ensureEl("regimentAttack").addEventListener("click", toggleAttack);
  ensureEl("regimentToggleVisibility").addEventListener("click", toggleVisibility);
  ensureEl("regimentRegenerateLegend").addEventListener("click", regenerateLegend);
  ensureEl("regimentLegend").addEventListener("click", editLegend);
  ensureEl("regimentSplit").addEventListener("click", splitRegiment);
  ensureEl("regimentAdd").addEventListener("click", toggleAdd);
  ensureEl("regimentAttach").addEventListener("click", toggleAttach);
  ensureEl("regimentRemove").addEventListener("click", removeRegiment);
}

function getRegiment(): Regiment | undefined {
  if (!selectedRegiment) return undefined;
  return pack.states[+selectedRegiment.dataset.state!]?.military?.find(r => r.i === +selectedRegiment!.dataset.id!);
}

function updateRegimentData(regiment: Regiment): void {
  ensureEl("regimentType").className = regiment.n ? "icon-anchor" : "icon-users";
  ensureEl<HTMLInputElement>("regimentName").value = regiment.name;
  ensureEl("regimentIcon").innerHTML = Icons.html(regiment.icon ?? "");
  ensureEl<HTMLInputElement>("regimentTags").value = Tags.format(regiment.tags);
  ensureEl("regimentToggleVisibility").className = regiment.hidden ? "icon-eye-off" : "icon-eye";

  const state = pack.states[regiment.state];
  const roster = state ? Military.getRoster(state) : undefined;
  const allUnitTypes = Military.getUnitTypes();

  // Collect candidate unit ids: recruitable units + units currently in regiment
  const unitIds = new Set<string>();
  if (regiment.n) {
    unitIds.add("fleet");
  } else {
    if (roster?.recruitable) {
      for (const uid of roster.recruitable) unitIds.add(uid);
    }
  }
  for (const uid of Object.keys(regiment.u ?? {})) {
    if ((regiment.u[uid] ?? 0) > 0) unitIds.add(uid);
  }
  for (const slot of regiment.units ?? []) {
    unitIds.add(slot.type);
  }
  if (unitIds.size === 0) {
    for (const u of options.map.military.units) unitIds.add(u.name);
  }

  const totalSlots = regiment.units?.length ?? 0;
  const composition = ensureEl("regimentComposition");
let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.9em; opacity:0.85">
    <span>${t("Army Units")}</span>
    <span>${t("Slots")}: <b>${totalSlots} / 20</b></span>
  </div>`;

  for (const uid of unitIds) {
    const ut = roster?.units?.[uid] ?? allUnitTypes[uid];
    const legacy = options.map.military.units.find(u => u.name === uid);
    const name = ut?.name ?? capitalize(uid);
    const cat = ut?.category ?? Military.getCategory(uid);
    const catColor: Record<string, string> = {
      spellcaster: "#8e44ad",
      monster: "#d35400",
      cavalry: "#d4ac0d",
      ranged: "#27ae60",
      artillery: "#c0392b",
      naval: "#2980b9",
      melee: "#34495e"
    };
    const badgeBg = catColor[cat] ?? "#444";
    const menPerBlock = ut?.men ?? (legacy?.crew ? legacy.crew * 100 : 100);
    const count = regiment.u?.[uid] || 0;
    const blocks = regiment.units
      ? regiment.units.filter(s => s.type === uid).length
      : Math.ceil(count / (menPerBlock || 100));

    const powersStr = ut?.powers
      ? `&#10;${t("Powers")}: ${Object.entries(ut.powers)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}`
      : "";
    const resistStr = ut?.resistArcane ? `&#10;${t("Resist Arcane")}: ${Math.round(ut.resistArcane * 100)}%` : "";

    const statTip = ut
      ? `${ut.name} [${cat}]&#10;Men/Block: ${ut.men}&#10;Attack: ${ut.attack} | Defense: ${ut.defense}&#10;Charge: ${ut.charge} | Missile: ${ut.missile}${powersStr}${resistStr}`
      : `${name} [${cat}]&#10;Men: ${count}`;

    html += `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;" data-tip="${statTip}">
      <div style="flex:1; display:flex; align-items:center; gap:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        <span style="font-size:0.75em; padding:1px 5px; border-radius:3px; background:${badgeBg}; color:#fff;">${cat}</span>
        <span style="font-weight:500;">${name}</span>
      </div>
      <div style="display:flex; align-items:center; gap:3px;">
        <button class="stepBlockBtn" data-u="${uid}" data-dir="-1" title="${t("Remove 1 block")}" style="padding:0 5px; line-height:1.2;">-</button>
        <span style="min-width:1.8em; text-align:center; font-size:0.85em;">${blocks}b</span>
        <button class="stepBlockBtn" data-u="${uid}" data-dir="1" title="${t("Add 1 block")}" style="padding:0 5px; line-height:1.2;">+</button>
        <input data-u="${uid}" type="number" min="0" step="1" value="${count}" style="width:4.2em; text-align:right;" />
      </div>
    </div>`;
  }

  composition.innerHTML = html;

  composition.querySelectorAll("input").forEach(el => {
    el.addEventListener("change", changeUnit);
  });
  composition.querySelectorAll(".stepBlockBtn").forEach(btn => {
    btn.addEventListener("click", stepBlock);
  });
}

function toggleVisibility(): void {
  const reg = getRegiment();
  if (!reg) return;
  reg.hidden = !reg.hidden;
  ensureEl("regimentToggleVisibility").className = reg.hidden ? "icon-eye-off" : "icon-eye";
  Layers.draw("military");
  bindRegiments(); // the redraw replaced the regiment nodes
  selectedRegiment = findEl<SVGGElement>(selectedRegiment!.id) ?? selectedRegiment; // a hidden one is not drawn
  refreshEditors();
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
    .on("mouseenter", () => tip(t("Regiment base. Drag to re-base the regiment"), true))
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
  const w = getRegimentWidth(reg);
  const x1 = rn(reg.x - w / 2, 2);

  select<SVGGElement, unknown>("#debug")
    .append("circle")
    .attr("id", "rotationControl")
    .attr("cx", x1 + w)
    .attr("cy", reg.y)
    .attr("r", 1)
    .attr("opacity", 1)
    .attr("fill", "yellow")
    .attr("stroke-width", 0.3)
    .attr("stroke", "black")
    .attr("cursor", "alias")
    .attr("transform", `rotate(${reg.angle || 0})`)
    .attr("transform-origin", `${reg.x}px ${reg.y}px`)
    .on("mouseenter", () => tip(t("Drag to rotate the regiment"), true))
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
    Military.rotate(reg.state, reg.i, angle);
  });
}

function updateRegimentElement(reg: Regiment, el: SVGGElement): void {
  const size = styles.military.options.boxSize;
  const showNames = styles.military.options.showNames;
  const w = getRegimentWidth(reg);
  const h = size * 2;
  const x = rn(reg.x - w / 2, 2);
  const y = rn(reg.y - size, 2);
  const rects = el.querySelectorAll("rect");
  const baseRect = rects[0];
  const iconRect = rects[1];
  const totalText = el.querySelector<SVGTextElement>("text.regimentTotal") || el.querySelectorAll("text")[0];
  const use = el.querySelector<SVGUseElement>(".regimentIcon")!;

  baseRect.setAttribute("x", String(x));
  baseRect.setAttribute("y", String(y));
  baseRect.setAttribute("width", String(w));
  baseRect.setAttribute("height", String(h));

  if (totalText) {
    totalText.setAttribute("x", String(reg.x));
    totalText.setAttribute("y", String(reg.y));
    totalText.textContent = String(Military.getTotal(reg));
  }

  iconRect.setAttribute("x", String(x - h));
  iconRect.setAttribute("y", String(y));
  iconRect.setAttribute("width", String(h));
  iconRect.setAttribute("height", String(h));

  updateRegimentIcon(use, reg);

  let nameText = el.querySelector<SVGTextElement>("text.regimentName");
  if (!showNames) {
    nameText?.remove();
  } else {
    if (!nameText) {
      nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      nameText.setAttribute("class", "regimentName");
      nameText.setAttribute("text-rendering", "optimizeSpeed");
      el.appendChild(nameText);
    }
    nameText.setAttribute("x", String(rn(reg.x - size, 2)));
    nameText.setAttribute("y", String(rn(reg.y + size * 2.3, 2)));
    nameText.setAttribute("font-size", `${rn(size * 1.6, 2)}px`);
    nameText.textContent = reg.name;
  }

  const rotationControl = select<SVGGElement, unknown>("#debug").select("#rotationControl");
  if (rotationControl.size()) {
    rotationControl.attr("cx", x + w).attr("cy", reg.y);
  }
}

function changeType(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  Military.setNaval(reg.state, reg.i, !reg.n);
  ensureEl("regimentType").className = reg.n ? "icon-anchor" : "icon-users";
updateRegimentElement(reg, selectedRegiment);
}

function changeName(this: HTMLInputElement): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  if (!this.value.trim()) return;
  Military.rename(reg.state, reg.i, this.value);
  selectedRegiment.dataset.name = reg.name;
  updateRegimentElement(reg, selectedRegiment);
}

function changeTags(this: HTMLInputElement): void {
  const reg = getRegiment();
  if (!reg) return;
  Tags.set(reg, this.value);
  this.value = Tags.format(reg.tags);
}

function restoreName(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const regs = pack.states[+selectedRegiment.dataset.state!].military!;
  Military.rename(reg.state, reg.i, Military.getName(reg, regs));
  selectedRegiment.dataset.name = ensureEl<HTMLInputElement>("regimentName").value = reg.name;
  updateRegimentElement(reg, selectedRegiment);
}

function changeIcon(): void {
  const regiment = getRegiment();
  if (!regiment || !selectedRegiment) return;

  Controllers.IconPicker.open({
    current: regiment.icon ?? "",
    live: true,
    onPick: icon => {
      if (icon) Military.setIcon(regiment.state, regiment.i, icon);
      else regiment.icon = icon; // cancelling restores a regiment that had no icon
      ensureEl("regimentIcon").innerHTML = Icons.html(icon);
      updateRegimentIcon(selectedRegiment!.querySelector<SVGUseElement>(".regimentIcon")!, regiment);
    }
  });
}

function stepBlock(this: HTMLElement): void {
  const u = this.dataset.u!;
  const dir = +(this.dataset.dir || 0);
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const unitTypes = Military.getUnitTypes();
  const ut = unitTypes[u];
  const blockSize = ut?.men || 100;

  reg.units ??= [];
  if (dir > 0) {
    if (reg.units.length >= 20) {
      tip("Army cannot exceed 20 unit slots", false, "error");
      return;
    }
    reg.units.push({ type: u, count: blockSize, exp: 0 });
  } else if (dir < 0) {
    const idx = reg.units.map(s => s.type).lastIndexOf(u);
    if (idx >= 0) {
      reg.units.splice(idx, 1);
    } else {
      return;
    }
  }
  Military.setUnitSlots(reg.state, reg.i, reg.units);
  updateRegimentData(reg);
  selectedRegiment.querySelector("text")!.innerHTML = String(Military.getTotal(reg));
  refreshEditors();
}

function changeUnit(this: HTMLInputElement): void {
  const u = this.dataset.u!;
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const count = (value: number) => Math.max(0, Math.round(value || 0)); // older maps may hold fractional troops
  const units = Object.fromEntries(Object.entries(reg.u).map(([name, value]) => [name, count(value)]));
  Military.setUnits(reg.state, reg.i, { ...units, [u]: count(+this.value) });
updateRegimentElement(reg, selectedRegiment);

  refreshEditors();
}

function splitRegiment(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  const state = +selectedRegiment.dataset.state!;
  let newId: number;
  try {
    newId = Military.split(state, reg.i);
  } catch {
    tip(t("Not enough forces to split"), false, "error");
    return;
  }

ensureEl("regimentComposition")
    .querySelectorAll<HTMLInputElement>("input")
    .forEach(el => {
      el.value = String(reg.u[el.dataset.u!] || 0);
    });
  updateRegimentElement(reg, selectedRegiment);
  drawRegiment(pack.states[state].military!.find(r => r.i === newId)!, state); // draw new reg below

  refreshEditors();
}

function toggleAdd(): void {
  const button = ensureEl("regimentAdd");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addRegimentOnClick);
    tip(t("Click on map to create new regiment or fleet"), true);
  } else {
    clearMainTip();
    applyDefaultViewboxEvents();
  }
}

function addRegimentOnClick(this: SVGGElement, event: MouseEvent): void {
  if (!selectedRegiment) return;
  const [x, y] = getPointer(event, this);
  if (Pack.findCell(x, y) === undefined) return;
  const state = +selectedRegiment.dataset.state!;
  const i = Military.add(state, x, y);
  drawRegiment(pack.states[state].military!.find(r => r.i === i)!, state);

  refreshEditors();
  toggleAdd();
}

function toggleAttack(): void {
  const button = ensureEl("regimentAttack");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", attackRegimentOnClick);
    tip(t("Click on another regiment to initiate battle"), true);
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", false);
  } else {
    clearMainTip();
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", true);
    applyDefaultViewboxEvents();
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
    tip(t("Please click on a regiment to attack"), false, "error");
    return;
  }
  if ((regSelected as Node) === (selectedRegiment as Node)) {
    tip(t("Regiment cannot attack itself"), false, "error");
    return;
  }
  if (oldState === newState) {
    tip(t("Cannot attack fraternal regiment"), false, "error");
    return;
  }

  const attacker = getRegiment();
  const defender = pack.states[+regSelected.dataset.state!].military!.find(r => r.i === +regSelected.dataset.id!);
  if (!attacker || !defender || !attacker.a || !defender.a) {
    tip(t("Regiment has no troops to battle"), false, "error");
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
  Dialog.close("regimentEditor");
}

function toggleAttach(): void {
  const button = ensureEl("regimentAttach");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", attachRegimentOnClick);
    tip(t("Click on another regiment to unite both regiments. The current regiment will be removed"), true);
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", false);
  } else {
    clearMainTip();
    select<SVGGElement, unknown>("#armies").selectAll(":scope > g").classed("draggable", true);
    applyDefaultViewboxEvents();
  }
}

function attachRegimentOnClick(this: SVGGElement, event: MouseEvent): void {
  if (!selectedRegiment) return;
  const target = event.target as HTMLElement;
  const regSelected = target.parentElement!;
  const army = regSelected.parentElement;
  const newState = +regSelected.dataset.state!;

  if (army?.parentElement?.id !== "armies") {
    tip(t("Please click on a regiment"), false, "error");
    return;
  }
  if ((regSelected as Node) === (selectedRegiment as Node)) {
    tip(t("Cannot attach regiment to itself. Please click on another regiment"), false, "error");
    return;
  }

  const reg = getRegiment(); // reg to be attached
  if (!reg) return;
  const sel = pack.states[newState].military!.find(r => r.i === +regSelected.dataset.id!);
  if (!sel) return;

  Military.attach(+selectedRegiment.dataset.state!, reg.i, newState, sel.i);
  regSelected.querySelector("text")!.innerHTML = String(Military.getTotal(sel)); // update selected reg total text
  selectedRegiment.remove();

  refreshEditors();
  Dialog.close("regimentEditor");
  Controllers.RegimentEditor.open(`#${regSelected.id}`);
}

function regenerateLegend(): void {
  if (!selectedRegiment) return;
  const s = pack.states[+selectedRegiment.dataset.state!];
  const reg = getRegiment();
  if (reg) Military.generateNote(reg, s);
}

function editLegend(): void {
  const reg = getRegiment();
  if (!reg || !selectedRegiment) return;
  void Controllers.NotesEditor.open({ type: "regiment", id: reg.state, sub: reg.i });
}

function removeRegiment(): void {
  Dialog.confirm({
    title: t("Remove"),
    message: t("Are you sure you want to remove the regiment?"),
    confirm: t("Remove"),
    onConfirm: () => {
      if (!selectedRegiment) return;
      const reg = getRegiment();
      if (!reg) return;
      Military.remove(+selectedRegiment.dataset.state!, reg.i);
      selectedRegiment.remove();

      refreshEditors();
      Dialog.close("regimentEditor");
    }
  });
}

function dragRegiment(this: SVGGElement, event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  select(this).raise();
  select(this.parentNode as Element).raise();

  const reg = pack.states[+this.dataset.state!].military!.find(r => r.i === +this.dataset.id!);
  if (!reg) return;
  const size = styles.military.options.boxSize;
  const w = getRegimentWidth(reg);
  const h = size * 2;

  const baseRect = this.querySelector("rect")!;
  const text = this.querySelector<SVGTextElement>("text.regimentTotal") || this.querySelector("text")!;
  const nameText = this.querySelector<SVGTextElement>("text.regimentName");
  const iconRect = this.querySelectorAll("rect")[1];
  const icon = this.querySelector(".regimentIcon")!;

  const self = selectedRegiment === this;
  const baseLine = select<SVGGElement, unknown>("#viewbox").select("g#regimentBase > line");
  const rotationControl = select<SVGGElement, unknown>("#debug").select("#rotationControl");

  event.on("drag", function (this: SVGGElement, dragEvent: D3DragEvent<SVGGElement, unknown, unknown>) {
    const { x, y } = dragEvent;
    if (!isInMap(x, y)) return;
    Military.move(reg.state, reg.i, x, y);
    const x1 = rn(x - w / 2, 2);
    const y1 = rn(y - size, 2);

    this.setAttribute("transform-origin", `${x}px ${y}px`);
    baseRect.setAttribute("x", String(x1));
    baseRect.setAttribute("y", String(y1));
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    if (nameText) {
      nameText.setAttribute("x", String(rn(x - size, 2)));
      nameText.setAttribute("y", String(rn(y + size * 2.3, 2)));
    }
    iconRect.setAttribute("x", String(x1 - h));
    iconRect.setAttribute("y", String(y1));
    const box = regimentIconBox(x1, y1, h, reg.icon);
    icon.setAttribute("x", String(box.x));
    icon.setAttribute("y", String(box.y));
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
    if (isInMap(dragEvent.x, dragEvent.y)) Military.setBase(reg.state, reg.i, dragEvent.x, dragEvent.y);
  });
}

const isInMap = (x: number, y: number) =>
  x >= 0 && y >= 0 && x <= options.map.graph.width && y <= options.map.graph.height;

function closeEditor(): void {
  select<SVGGElement, unknown>("#debug").selectAll("*").remove();
  select<SVGGElement, unknown>("#viewbox").selectAll("g#regimentBase").remove();
  const armiesSel = select<SVGGElement, unknown>("#armies");
  armiesSel.selectAll(":scope > g").classed("draggable", false);
  armiesSel.selectAll<SVGGElement, unknown>("g>g").call(drag<SVGGElement, unknown>().on("drag", null));
  ensureEl("regimentAdd").classList.remove("pressed");
  ensureEl("regimentAttack").classList.remove("pressed");
  ensureEl("regimentAttach").classList.remove("pressed");
  applyDefaultViewboxEvents();
  selectedRegiment = null;
  Dialog.destroy("regimentEditor");
}

export const RegimentEditor = { open: editRegiment };
