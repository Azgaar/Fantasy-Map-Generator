// PROTOTYPE — Variant D: not a wheel at all. The control condition.
// A rectangular card anchored at the cursor: entity breadcrumb, grouped list, type-to-filter,
// keyboard navigation. If a wheel can't beat this, the wheel isn't worth building.
import type { WheelAction, WheelContext, WheelTarget } from "./context";
import type { Variant } from "./overlay";
import { clampToViewport } from "./overlay";

interface Row {
  target: WheelTarget;
  action: WheelAction;
  node: HTMLButtonElement;
}

function render(ctx: WheelContext, host: HTMLElement, close: () => void): void {
  const card = document.createElement("div");
  card.className = "mw-card mw-pop";
  host.append(card);

  const header = document.createElement("div");
  header.className = "mw-card-head";
  header.innerHTML = `<b>${ctx.targets[0].name}</b><span>${ctx.targets[0].subtitle}</span>`;
  card.append(header);

  const filter = document.createElement("input");
  filter.className = "mw-card-filter";
  filter.type = "search";
  filter.placeholder = "Filter actions…";
  card.append(filter);

  const crumbs = document.createElement("div");
  crumbs.className = "mw-card-crumbs";
  card.append(crumbs);

  const list = document.createElement("div");
  list.className = "mw-card-list";
  card.append(list);

  const foot = document.createElement("div");
  foot.className = "mw-card-foot";
  foot.innerHTML = `<span>Cell ${ctx.cellId}</span><span>${ctx.targets.length} entities here</span>`;
  card.append(foot);

  // "all" plus one chip per entity — the whole stack is visible without drilling
  let scope: WheelTarget | null = null;
  const chips: HTMLButtonElement[] = [];

  const makeChip = (label: string, icon: string, target: WheelTarget | null): void => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "mw-card-crumb";
    chip.innerHTML = `<i class="${icon}"></i>${label}`;
    chip.addEventListener("click", () => {
      scope = target;
      chips.forEach(other => {
        other.classList.toggle("is-active", other === chip);
      });
      paint();
    });
    crumbs.append(chip);
    chips.push(chip);
  };

  makeChip("All", "icon-th-list", null);
  for (const target of ctx.targets) makeChip(target.kind, target.icon, target);
  chips[0].classList.add("is-active");

  let rows: Row[] = [];
  let cursor = 0;

  const paint = (): void => {
    list.replaceChildren();
    rows = [];
    const query = filter.value.trim().toLowerCase();
    const targets = scope ? [scope] : ctx.targets;

    for (const target of targets) {
      const matching = target.actions.filter(action => action.label.toLowerCase().includes(query));
      if (!matching.length) continue;

      const group = document.createElement("div");
      group.className = "mw-card-group";
      group.innerHTML = `<i class="${target.icon}"></i><b>${target.name}</b><span>${target.kind}</span>`;
      list.append(group);

      for (const action of matching) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = `mw-card-row${action.danger ? " is-danger" : ""}`;
        node.innerHTML = `<i class="${action.icon}"></i><span>${action.label}</span>`;
        node.addEventListener("mouseenter", () => setCursor(rows.findIndex(row => row.node === node)));
        node.addEventListener("click", () => {
          close();
          action.run();
        });
        list.append(node);
        rows.push({ target, action, node });
      }
    }

    if (!rows.length) list.innerHTML = `<div class="mw-card-empty">no matching action</div>`;
    cursor = 0;
    setCursor(0);
  };

  const setCursor = (index: number): void => {
    if (index < 0) return;
    cursor = index;
    rows.forEach((row, i) => {
      row.node.classList.toggle("is-cursor", i === cursor);
    });
    rows[cursor]?.node.scrollIntoView({ block: "nearest" });
  };

  filter.addEventListener("input", paint);
  filter.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") setCursor((cursor + 1) % rows.length);
    else if (event.key === "ArrowUp") setCursor((cursor - 1 + rows.length) % rows.length);
    else if (event.key === "Enter" && rows[cursor]) {
      const { action } = rows[cursor];
      close();
      action.run();
    } else return;
    event.preventDefault();
    event.stopPropagation();
  });

  paint();
  clampToViewport(card, ctx.screen);
  filter.focus();
}

const css = /* css */ `
.mw-card {
  position: absolute;
  width: 244px;
  max-height: min(460px, 78vh);
  display: flex;
  flex-direction: column;
  background: #fdfbf6;
  border: 1px solid rgba(70, 58, 40, 0.28);
  border-radius: 7px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  color: #2f2a23;
  overflow: hidden;
}
.mw-card-head { padding: 8px 10px 6px; background: #4a4336; color: #fdfbf6; }
.mw-card-head b { display: block; font-size: 12.5px; }
.mw-card-head span { display: block; font-size: 9.5px; opacity: 0.72; margin-top: 1px; }
.mw-card-filter {
  margin: 7px 8px 4px;
  padding: 4px 7px;
  font-size: 11px;
  border: 1px solid #d6d0c4;
  border-radius: 4px;
  background: #fff;
}
.mw-card-crumbs { display: flex; flex-wrap: wrap; gap: 3px; padding: 2px 8px 6px; }
.mw-card-crumb {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 6px; font-size: 9.5px; cursor: pointer;
  border: 1px solid #ddd6c8; border-radius: 9px; background: #fff; color: #5c5344;
}
.mw-card-crumb i { font-size: 10px; }
.mw-card-crumb.is-active { background: #4a4336; border-color: #4a4336; color: #fdfbf6; }
.mw-card-list { overflow-y: auto; padding-bottom: 4px; }
.mw-card-group {
  display: flex; align-items: baseline; gap: 5px;
  padding: 6px 10px 3px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8172;
}
.mw-card-group b { font-size: 9.5px; text-transform: none; letter-spacing: 0; color: #514936; }
.mw-card-group span { margin-left: auto; opacity: 0.7; }
.mw-card-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 5px 10px; border: 0; background: none; cursor: pointer;
  font-size: 11.5px; color: #2f2a23; text-align: left;
}
.mw-card-row i { font-size: 13px; width: 15px; opacity: 0.8; }
.mw-card-row.is-danger { color: #8d2f24; }
.mw-card-row.is-cursor { background: #4a4336; color: #fdfbf6; }
.mw-card-row.is-cursor.is-danger { background: #a33a2e; color: #fff; }
.mw-card-empty { padding: 12px 10px; font-size: 11px; color: #8a8172; }
.mw-card-foot {
  display: flex; justify-content: space-between;
  padding: 5px 10px; border-top: 1px solid #e7e1d5;
  font-size: 9px; color: #8a8172; background: #f6f2e9;
}
`;

export const variantPanel: Variant = { key: "D", name: "Anchored card", css, render };
