import { Controllers } from "@/controllers";
import { CULTURE_TYPES } from "../generators/cultures-generator";
import type { DemandCategory, Good } from "../generators/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY } from "../generators/goods-generator";
import { ensureEl, getRandomColor, unique } from "../utils";

function open(editedGood?: Good, onUpdate?: () => void) {
  const icons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const demandCoverageState: Partial<Record<DemandCategory, number>> = { ...(editedGood?.demandCoverage || {}) };
  const biomeOutputState: Partial<Record<number, number>> = { ...(editedGood?.biomeOutput || {}) };

  const demandCoverageSummary = (): string => {
    const entries = DEMAND_PRIORITY.map(cat => [cat, demandCoverageState[cat] ?? 0] as const).filter(([, v]) => v > 0);
    if (!entries.length) return "none";
    return entries.map(([cat, v]) => `${DEMAND_CATEGORY_ICONS[cat]} ${capitalize(cat)}: ${v}`).join(", ");
  };

  const biomeOutputSummary = (): string => {
    const entries = Object.entries(biomeOutputState).filter(([, v]) => (v ?? 0) > 0);
    if (!entries.length) return "none";
    return entries.map(([id, v]) => `${biomesData.name[Number(id)]}: ${v}`).join(", ");
  };

  const multipliers: { [K in MultiplierDimKey]?: Partial<Record<string, number>> } = {
    cultureType: { ...(editedGood?.multipliers?.cultureType ?? {}) },
    culture: { ...(editedGood?.multipliers?.culture ?? {}) },
    state: { ...(editedGood?.multipliers?.state ?? {}) },
    religion: { ...(editedGood?.multipliers?.religion ?? {}) },
    biome: { ...(editedGood?.multipliers?.biome ?? {}) },
    zone: { ...(editedGood?.multipliers?.zone ?? {}) }
  };

  const multiplierSummary = (dim: MultiplierDimKey): string => {
    const vals = multipliers[dim] ?? {};
    const entries = Object.entries(vals).filter(([, v]) => v !== 1);
    if (!entries.length) return "none";
    return entries.map(([id, v]) => `${getMultiplierEntityName(dim, id)} ×${rn(v!, 2)}`).join(", ");
  };

  const renderMultiplierRow = (dim: MultiplierDimKey, label: string) => /*html*/ `
      <label data-tip="Production multiplier by ${label.toLowerCase()}. 1 = no effect, 0 = fully suppressed.">${label}</label>
      <div class="ge-edit-row">
        <span id="mSummary_${dim}">${multiplierSummary(dim)}</span>
        <button class="mEdit icon-pencil ge-edit" data-dim="${dim}" data-tip="Edit ${label} multipliers"></button>
      </div>`;

  const dialog = ensureEl("goodEditor");
  dialog.innerHTML = /*html*/ `
    <style>
      .ge                 { display:flex; width: auto !important; flex-direction:column; gap:9px; max-height:72vh; overflow-y:auto; padding-right:2px; }
      .ge-section-title   { display:flex; align-items:center; justify-content:space-between; font-weight:bold; text-transform:uppercase; font-size:.8em; letter-spacing:.06em; margin-bottom:7px; padding-bottom:4px; border-bottom:1px solid #666; }
      .ge-grid            { display:grid; grid-template-columns:9em minmax(0, 1fr); gap:.2em; align-items:center; }
      .ge-grid--top       { align-items:start; }
      .ge-grid > *        { min-width:0; }
      .ge-grid > label    { color:#555; }
      .ge-field           { width:100%; }
      input.ge-num        { width:6em; }
      .ge-inline          { display:flex; align-items:center; gap:.4em; }
      .ge-icon-select     { flex:1; min-width:0; }
      .ge-icon-preview    { flex-shrink:0; }
      .ge-color           { width:2.4em; height:1.4em; padding:0; border:none; flex-shrink:0; }
      .ge-edit-row        { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; }
      .ge-edit-row > span { flex:1; min-width:0; }
      .ge-edit            { flex-shrink:0; }
      .ge-dist            { flex:1; min-width:0; color:#555; font-size:.9em; font-family:var(--monospace); word-break:break-all; }
      .ge-note            { color:#777; font-style:italic; font-size:.9em; }
      .ge-error           { color:#b20000; min-height:1.2em; }
      .ge-recipe-list     { display:flex; flex-direction:column; gap:.45em; }
      .ge-recipe          { border:1px solid #ccc; border-radius:3px; }
      .ge-recipe-head     { display:flex; align-items:center; justify-content:space-between; padding:.2em .3em; }
      .ge-recipe-actions  { display:flex; gap:.3em; }
      .ge-recipe-ings     { display:flex; flex-direction:column; gap:.2em; padding:.3em .4em; }
      .ge-recipe-ing      { display:grid; grid-template-columns:1fr 5em 1.5em; gap:.25em; align-items:center; }
    </style>

    <div class="ge">
      <div>
        <div class="ge-section-title">General</div>
        <div class="ge-grid">
          <label for="newGoodName">Name*</label>
          <input id="newGoodName" class="ge-field" value="${editedGood?.name || ""}" />

          <label for="newGoodTags">Tags</label>
          <input id="newGoodTags" class="ge-field" value="${editedGood?.tags.join(", ") || ""}" placeholder="comma separated" />

          <label for="newGoodValue">Base Price*</label>
          <span class="ge-inline"><input id="newGoodValue" class="ge-num" type="number" min="0" step="1" value="${editedGood?.value ?? 1}" /> 🟡</span>

          <label for="newGoodChance">Chance</label>
          <input id="newGoodChance" class="ge-num" type="number" min="0" max="100" step="0.1" value="${editedGood?.chance ?? 1}" />

          <label for="newGoodUnit">Unit</label>
          <input id="newGoodUnit" class="ge-field" placeholder="e.g. wagon, barrel" value="${editedGood?.unit || ""}" />

          <label for="newGoodIcon">Icon*</label>
          <div class="ge-inline">
            <select id="newGoodIcon" class="ge-icon-select">${icons.map(icon => `<option value="${icon}" ${editedGood?.icon === icon ? "selected" : ""}>${icon}</option>`).join("")}</select>
            <svg class="ge-icon-preview" width="2em" height="2em">
              <circle id="newGoodIconCircle" cx="50%" cy="50%" r="42%" fill="${editedGood?.color || "#ff5959"}" stroke="${Goods.getStroke(editedGood?.color || "#ff5959")}"/>
              <use id="newGoodIconPreview" href="#${editedGood?.icon || "good-unknown"}" x="10%" y="10%" width="80%" height="80%"/>
            </svg>
            <button id="newGoodUploadIconRaster" class="icon-upload" data-tip="Upload raster icon"></button>
            <button id="newGoodUploadIconVector" class="icon-upload-cloud" data-tip="Upload vector (SVG) icon"></button>
            <input id="newGoodColor" class="ge-color" type="color" data-tip="Set a stroke color" value="${editedGood?.color || "#ff5959"}" />
          </div>

          <label data-tip="How much of each demand category this good satisfies. Click the pencil icon to edit.">Demand Coverage</label>
          <div class="ge-edit-row">
            <span id="demandCoverageSummary" >${demandCoverageSummary()}</span>
            <button class="dcEdit icon-pencil ge-edit" data-tip="Edit demand coverage"></button>
          </div>
        </div>
      </div>

      <div>
        <div class="ge-section-title">Raw Production</div>
        <div class="ge-grid ge-grid--top">
          <label data-tip="For raw resources: sets the baseline production per biome">Rural production</label>
          <div class="ge-edit-row">
            <span id="biomeProductionSummary">${biomeOutputSummary()}</span>
            <button class="bpEdit icon-pencil ge-edit" data-tip="Edit biome baseline production"></button>
          </div>

          <label data-tip="For raw resources: controls where and how this good is produced directly from the environment (e.g. biome, elevation, temperature)">Bonus distribution</label>
          <div class="ge-edit-row">
            <div id="newGoodDistribution" class="ge-dist">${editedGood?.distribution || ""}</div>
            <button id="newGoodDistributionEditor" class="icon-pencil ge-edit" data-tip="Open the Distribution visual editor"></button>
          </div>
        </div>
        <div id="newGoodRawNote" class="ge-note"></div>
      </div>

      <div>
        <div class="ge-section-title">
          <span data-tip="For manufactured goods: recipes define which other goods are required to produce this good">Recipes</span>
          <button id="newGoodAddRecipe" class="icon-plus" data-tip="Add a recipe"></button>
        </div>
        <div id="newGoodRecipeList" class="ge-recipe-list"></div>
        <div id="newGoodRecipeNote" class="ge-note"></div>
      </div>

      <div>
        <div class="ge-section-title">
          <span data-tip="Per-dimension production multipliers. 1 = no effect, 0 = fully suppressed.">Multipliers</span>
        </div>
        <div class="ge-grid ge-grid--top">
          ${renderMultiplierRow("cultureType", "Culture Type")}
          ${renderMultiplierRow("culture", "Culture")}
          ${renderMultiplierRow("state", "State")}
          ${renderMultiplierRow("religion", "Religion")}
          ${renderMultiplierRow("biome", "Biome")}
          ${renderMultiplierRow("zone", "Zone")}
        </div>
      </div>

      <div id="newGoodError" class="ge-error"></div>
    </div>
  `;

  const recipes: Record<number, number>[] = editedGood?.recipes || [];
  const recipeList = ensureEl("newGoodRecipeList");

  const defaultGoodId = pack.goods[0]?.i ?? 0;
  const sortedGoods = [...pack.goods].sort((a, b) => a.name.localeCompare(b.name));

  const isRawProductionEmpty = () =>
    !Object.values(biomeOutputState).some(v => (v ?? 0) > 0) &&
    !document.getElementById("newGoodDistribution")?.textContent?.trim();

  // a good is either gathered (raw) or made from recipes (manufactured)
  const updateTypeNotes = () => {
    const rawEmpty = isRawProductionEmpty();
    const recipesEmpty = recipes.length === 0;

    const recipeNote = ensureEl("newGoodRecipeNote");
    recipeNote.textContent = "This good is raw-only: gathered from the environment.";
    recipeNote.style.display = recipesEmpty && !rawEmpty ? "" : "none";

    const rawNote = ensureEl("newGoodRawNote");
    rawNote.textContent = "This good is manufactured-only: made from recipes in burgs.";
    rawNote.style.display = rawEmpty && !recipesEmpty ? "" : "none";
  };

  const renderRecipes = () => {
    recipeList.innerHTML = recipes
      .map(
        (recipe, recipeIndex) => /*html*/ `
          <div class="recipeOption ge-recipe" data-recipe-index="${recipeIndex}" >
            <div class="ge-recipe-head">
              <span>Recipe ${recipeIndex + 1}</span>
              <div class="ge-recipe-actions">
                <span class="recipeAddIngredient icon-plus pointer" data-recipe-index="${recipeIndex}" data-tip="Add ingredient"></span>
                <span class="recipeRemoveOption icon-trash-empty pointer" data-recipe-index="${recipeIndex}" data-tip="Remove recipe"></span>
              </div>
            </div>
            <div class="recipeIngredients ge-recipe-ings">
              ${Object.entries(recipe)
                .map(
                  ([ingredientId, amount], ingredientIndex) => /*html*/ `
                    <div class="ge-recipe-ing" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">
                      <select class="recipeGoodSelect" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">${sortedGoods.map(good => `<option value="${good.i}" ${good.i === Number(ingredientId) ? "selected" : ""}>${good.name}</option>`).join("")}</select>
                      <input class="recipeAmountInput" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" type="number" min="1" step="1" value="${amount}" />
                      <span class="recipeRemoveIngredient icon-trash-empty pointer" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" data-tip="Remove ingredient" />
                    </div>`
                )
                .join("")}
            </div>
          </div>
        `
      )
      .join("");

    recipeList.querySelectorAll<HTMLSelectElement>(".recipeGoodSelect").forEach(select => {
      select.onchange = () => {
        const selectedGoodId = +select.value;
        const recipeIndex = +select.dataset.recipeIndex!;
        const ingredientIndex = +select.dataset.ingredientIndex!;
        const recipe = recipes[recipeIndex];

        const oldAmount = recipe[ingredientIndex] || 0;
        delete recipe[ingredientIndex];
        recipe[selectedGoodId] = oldAmount;
        renderRecipes();
      };
    });

    recipeList.querySelectorAll<HTMLInputElement>(".recipeAmountInput").forEach(input => {
      input.onchange = () => {
        const recipeIndex = +input.dataset.recipeIndex!;
        const ingredientIndex = +input.dataset.ingredientIndex!;
        const recipe = recipes[recipeIndex];
        const ingredientId = Number(Object.keys(recipe)[ingredientIndex]);
        recipe[ingredientId] = +input.value;
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeAddIngredient").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        const recipe = recipes[recipeIndex];
        const newIngredientId = Object.keys(recipe).length
          ? Math.max(...Object.keys(recipe).map(id => +id)) + 1
          : defaultGoodId;
        recipe[newIngredientId] = 1;
        renderRecipes();
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveIngredient").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        const ingredientIndex = +button.dataset.ingredientIndex!;
        const recipe = recipes[recipeIndex];
        if (Object.keys(recipe).length > 1) {
          const ingredientId = Number(Object.keys(recipe)[ingredientIndex]);
          delete recipe[ingredientId];
          renderRecipes();
        }
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveOption").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        recipes.splice(recipeIndex, 1);
        renderRecipes();
      };
    });

    updateTypeNotes();
  };
  renderRecipes();

  dialog.querySelectorAll<HTMLButtonElement>(".mEdit").forEach(btn => {
    btn.addEventListener("click", () => {
      const dim = btn.dataset.dim as MultiplierDimKey;
      openMultiplierPopup(dim, multipliers[dim] ?? {}, values => {
        multipliers[dim] = values;
        const summaryEl = document.getElementById(`mSummary_${dim}`);
        if (summaryEl) summaryEl.textContent = multiplierSummary(dim);
      });
    });
  });

  dialog.querySelector<HTMLButtonElement>(".dcEdit")!.addEventListener("click", () => {
    openDemandCoveragePopup({ ...demandCoverageState }, values => {
      (Object.keys(demandCoverageState) as DemandCategory[]).forEach(k => void delete demandCoverageState[k]);
      Object.assign(demandCoverageState, values);
      const summaryEl = document.getElementById("demandCoverageSummary");
      if (summaryEl) summaryEl.textContent = demandCoverageSummary();
    });
  });

  dialog.querySelector<HTMLButtonElement>(".bpEdit")!.addEventListener("click", () => {
    openBiomeProductionPopup({ ...biomeOutputState }, values => {
      Object.keys(biomeOutputState).forEach(k => void delete biomeOutputState[+k]);
      Object.assign(biomeOutputState, values);
      const summaryEl = document.getElementById("biomeProductionSummary");
      if (summaryEl) summaryEl.textContent = biomeOutputSummary();
      updateTypeNotes();
    });
  });

  ensureEl("newGoodAddRecipe").on("click", event => {
    event.preventDefault();
    recipes.push({ [defaultGoodId]: 1 });
    renderRecipes();
  });

  ensureEl("newGoodDistributionEditor").on("click", () => {
    const distEl = ensureEl("newGoodDistribution");
    Controllers.DistributionEditor.open((dist: string) => {
      distEl.textContent = dist;
      updateTypeNotes();
    }, distEl.textContent?.trim() ?? "");
  });

  const iconSelect = ensureEl<HTMLSelectElement>("newGoodIcon");
  iconSelect.onchange = () => ensureEl("newGoodIconPreview").setAttribute("href", `#${iconSelect.value}`);

  const colorInput = ensureEl<HTMLInputElement>("newGoodColor");
  colorInput.oninput = () => {
    const circle = ensureEl("newGoodIconCircle");
    circle.setAttribute("fill", colorInput.value);
    circle.setAttribute("stroke", Goods.getStroke(colorInput.value));
  };

  const onIconUpload = (_type: string, id: string) => {
    ensureEl("newGoodIconPreview").setAttribute("href", `#${id}`);
    iconSelect.innerHTML += `<option value="${id}">${id}</option>`;
    iconSelect.value = id;
  };
  ensureEl("newGoodUploadIconRaster").onclick = () => (ensureEl("imageToLoad") as HTMLInputElement).click();
  ensureEl("newGoodUploadIconVector").onclick = () => (ensureEl("svgToLoad") as HTMLInputElement).click();
  ensureEl("imageToLoad").onchange = () => uploadImage("image", onIconUpload);
  ensureEl("svgToLoad").onchange = () => uploadImage("svg", onIconUpload);

  $(dialog).dialog({
    width: "30em",
    resizable: false,
    title: editedGood ? "Edit good" : "Add new good",
    open: function (this: HTMLElement) {
      if (!editedGood) return; // only edits can recompute the economy
      const pane = this.parentElement?.querySelector(".ui-dialog-buttonpane");
      pane?.insertAdjacentHTML(
        "afterbegin",
        /*html*/ `<div class="dontAsk" data-tip="Re-place this good and recompute production, trade and taxes. Uncheck to update the good only, without disturbing the current economy.">
          <input id="goodRegenerateEconomy" class="checkbox" type="checkbox" checked />
          <label for="goodRegenerateEconomy" class="checkbox-label"><i>regenerate economy on apply</i></label>
        </div>`
      );
    },
    close: () => {
      $(dialog).dialog("destroy");
      dialog.innerHTML = "";
    },
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      [editedGood ? "Apply" : "Add"]: () => {
        const errors: string[] = [];

        const name = ensureEl<HTMLInputElement>("newGoodName").value.trim();
        const tagsInput = ensureEl<HTMLInputElement>("newGoodTags").value.trim();
        const tags = unique(tagsInput.split(",").map(tag => tag.trim().toLocaleLowerCase()));
        const value = +ensureEl<HTMLInputElement>("newGoodValue").value;
        const chance = +ensureEl<HTMLInputElement>("newGoodChance").value;
        const unit = ensureEl<HTMLInputElement>("newGoodUnit").value.trim();
        const icon = ensureEl<HTMLSelectElement>("newGoodIcon").value;
        const color = ensureEl<HTMLInputElement>("newGoodColor").value;
        const distribution = ensureEl("newGoodDistribution").textContent?.trim() ?? "";

        if (!name) errors.push("Name is required");
        if (!Number.isFinite(value) || value < 0) errors.push("Value must be a valid non-negative number");
        if (!Number.isFinite(chance) || chance < 0 || chance > 100) errors.push("Chance must be between 0 and 100");

        if (distribution) {
          try {
            const methods = Goods.getMethods();
            const allMethods = `{${Object.keys(methods).join(", ")}}`;
            new Function(allMethods, `return ${distribution}`)(methods);
          } catch (err) {
            errors.push(`Distribution function is invalid: ${(err as Error).message || err}`);
          }
        }

        for (const recipe of recipes) {
          for (const [ingredientId, ingredientAmount] of Object.entries(recipe)) {
            const id = Number(ingredientId);
            const good = Goods.get(id);
            if (!good) errors.push(`Recipe references unknown good id: ${id}`);
            const amount = Number(ingredientAmount);
            if (Number.isNaN(amount) || !Number.isFinite(amount) || amount <= 0)
              errors.push(`Invalid recipe amount for good ${good?.name}`);
          }

          if (!Object.keys(recipe).length) errors.push("Each recipe must have at least one ingredient");
        }

        ensureEl("newGoodError").textContent = errors.join(". ");
        if (errors.length) return;

        function buildFinalMultipliers(): Good["multipliers"] {
          const result: Good["multipliers"] = {};
          for (const [dimKey, vals] of Object.entries(multipliers) as [
            MultiplierDimKey,
            Partial<Record<string, number>>
          ][]) {
            const nonDefault = Object.fromEntries(
              Object.entries(vals ?? {}).filter(([, v]) => v !== undefined && v !== 1)
            );
            if (Object.keys(nonDefault).length) (result as any)[dimKey] = nonDefault;
          }
          return Object.keys(result).length ? result : undefined;
        }

        if (editedGood) {
          editedGood.name = name;
          editedGood.tags = tags;
          editedGood.icon = icon;
          editedGood.color = color;
          editedGood.value = value;
          editedGood.chance = chance;
          editedGood.unit = unit;
          editedGood.demandCoverage = demandCoverageState;
          editedGood.multipliers = buildFinalMultipliers();
          editedGood.distribution = distribution || undefined;
          editedGood.biomeOutput = Object.keys(biomeOutputState).length ? biomeOutputState : undefined;
          editedGood.recipes = recipes.length ? recipes : undefined;

          // opt-out: by default re-place the good and recompute the economy to reflect the change
          if (ensureEl<HTMLInputElement>("goodRegenerateEconomy").checked) {
            Goods.regeneratePlacement(editedGood.i);
            regenerateEconomy();
          } else {
            Goods.sync();
          }
        } else {
          const getNextId = () => {
            let nextId = pack.goods?.at(-1)?.i ?? 1;
            while (Goods.get(nextId)) nextId++;
            return nextId;
          };

          pack.goods.push({
            i: getNextId(),
            name,
            tags,
            icon,
            color,
            value,
            chance,
            unit,
            demandCoverage: demandCoverageState,
            multipliers: buildFinalMultipliers(),
            distribution: distribution || undefined,
            biomeOutput: Object.keys(biomeOutputState).length ? biomeOutputState : undefined,
            recipes: recipes.length ? recipes : undefined
          });
          Goods.sync();
        }

        tip(editedGood ? "Good is updated" : "Good is added", false, "success", 5000);
        onUpdate?.();
        $(dialog).dialog("close");
      }
    }
  });
}

type MultiplierDimKey = "cultureType" | "culture" | "state" | "religion" | "biome" | "zone";

function getMultiplierEntityName(dim: MultiplierDimKey, id: string): string {
  if (dim === "cultureType") return id;
  if (dim === "culture") return pack.cultures[+id]?.name ?? `Culture ${id}`;
  if (dim === "state") return pack.states[+id]?.name ?? `State ${id}`;
  if (dim === "religion") return pack.religions[+id]?.name ?? `Religion ${id}`;
  if (dim === "zone") return pack.zones.find(z => z.i === +id)?.name ?? `Zone ${id}`;
  return biomesData.name[+id] ?? `Biome ${id}`;
}

function uploadImage(type: "image" | "svg", callback: (type: string, id: string) => void) {
  const input = ensureEl<HTMLInputElement>(type === "image" ? "imageToLoad" : "svgToLoad");
  const file = input.files![0];
  input.value = "";

  if (file.size > 200000) {
    tip(
      `File is too big, please optimize file size up to 200kB and re-upload. Recommended size is 48x48 px and up to 10kB`,
      true,
      "error",
      5000
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = readerEvent => {
    const target = readerEvent.target;
    if (!target) return;

    const result = target.result as string;
    const id = `good-custom-${Math.random().toString(36).slice(-6)}`;
    const goodIcons = ensureEl("good-icons");

    if (type === "image") {
      const svg = /*html*/ `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><image x="0" y="0" width="200" height="200" href="${result}"/></svg>`;
      goodIcons.insertAdjacentHTML("beforeend", svg);
    } else {
      const el = document.createElement("html");
      el.innerHTML = result;

      el.querySelectorAll("*").forEach(el => {
        const attributes = el.getAttributeNames();
        attributes.forEach(attr => {
          if (attr.includes("inkscape") || attr.includes("sodipodi")) el.removeAttribute(attr);
        });
      });

      if (result.includes("from the Noun Project")) el.querySelectorAll("text").forEach(textEl => void textEl.remove());

      const svg = el.querySelector("svg");
      if (!svg)
        return void tip(
          "The file should be prepared for load to FMG. If you don't know why it's happening, try to upload raster image",
          false,
          "error"
        );

      const icon = goodIcons.appendChild(svg);
      icon.id = id;
      icon.setAttribute("width", "200");
      icon.setAttribute("height", "200");
    }

    callback(type, id);
  };

  if (type === "image") reader.readAsDataURL(file);
  else reader.readAsText(file);
}

function openMultiplierPopup(
  dim: MultiplierDimKey,
  currentValues: Partial<Record<string, number>>,
  onApply: (values: Partial<Record<string, number>>) => void
) {
  type Entity = { id: string; name: string; color?: string };

  let entities: Entity[];
  let label: string;

  switch (dim) {
    case "cultureType":
      entities = CULTURE_TYPES.map(ct => ({ id: ct, name: ct }));
      label = "Culture Type";
      break;
    case "culture":
      entities = pack.cultures
        .filter(c => c.i && !c.removed)
        .map(c => ({ id: String(c.i), name: c.name, color: c.color }));
      label = "Culture";
      break;
    case "state":
      entities = pack.states
        .filter(s => s.i && !s.removed)
        .map(s => ({ id: String(s.i), name: s.fullName || s.name, color: s.color }));
      label = "State";
      break;
    case "religion":
      entities = pack.religions
        .filter(r => r.i && !r.removed)
        .map(r => ({ id: String(r.i), name: r.name, color: r.color }));
      label = "Religion";
      break;
    case "biome":
      entities = biomesData.i.map(id => ({ id: String(id), name: biomesData.name[id], color: biomesData.color[id] }));
      label = "Biome";
      break;
    case "zone":
      // zone colors are hatch pattern refs (url(#...)); fill-box renders them, a plain dot can't
      entities = pack.zones.map(z => ({ id: String(z.i), name: z.name, color: z.color }));
      label = "Zone";
      break;
  }

  const rows = entities.map(entity => {
    const val = currentValues[entity.id] ?? 1;
    const box = `<fill-box fill="${entity.color || getRandomColor()}" size="1em" disabled data-tip="${entity.name}"></fill-box>`;
    return `${box}<span>${entity.name}</span><input type="number" class="mPopupInput" data-id="${entity.id}" min="0" step="0.1" style="width:5em;" value="${val}" />`;
  });

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  const body = rows.length
    ? `<div style="display:grid; grid-template-columns:auto 1fr 5em; gap:.3em .5em; align-items:center;">${rows.join("")}</div>`
    : `<div style="color:#777; font-style:italic;">No ${label.toLowerCase()}s available</div>`;
  popupEl.innerHTML = `<div style="max-height:320px; overflow-y:auto; padding:.2em;">${body}</div>`;

  $(popupEl).dialog({
    title: `${label} multipliers`,
    width: "22em",
    resizable: false,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const inputs = Array.from(popupEl.querySelectorAll<HTMLInputElement>(".mPopupInput"));
        const result: Partial<Record<string, number>> = {};
        for (const input of inputs) {
          const id = input.dataset.id!;
          const v = Number(input.value);
          if (Number.isFinite(v) && v >= 0 && v !== 1) result[id] = v;
        }
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function openDemandCoveragePopup(
  currentValues: Partial<Record<DemandCategory, number>>,
  onApply: (values: Partial<Record<DemandCategory, number>>) => void
) {
  const rows = DEMAND_PRIORITY.map(cat => {
    const val = currentValues[cat] ?? 0;
    return `<span>${DEMAND_CATEGORY_ICONS[cat]} ${capitalize(cat)}</span><input type="number" class="dcPopupInput" data-cat="${cat}" min="0" step="0.05" style="width:5em;" value="${val}" />`;
  }).join("");

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 5em;gap:.3em .5em;align-items:center;padding:.2em;">${rows}</div>`;

  $(popupEl).dialog({
    title: "Demand Coverage",
    width: "18em",
    resizable: false,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const result: Partial<Record<DemandCategory, number>> = {};
        popupEl.querySelectorAll<HTMLInputElement>(".dcPopupInput").forEach(input => {
          const cat = input.dataset.cat as DemandCategory;
          const v = Number(input.value);
          if (Number.isFinite(v) && v > 0) result[cat] = v;
        });
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function openBiomeProductionPopup(
  currentValues: Partial<Record<number, number>>,
  onApply: (values: Partial<Record<number, number>>) => void
) {
  const rows = (biomesData.i as number[])
    .map(id => {
      const val = currentValues[id] ?? 0;
      return `<span>${biomesData.name[id] ?? `Biome ${id}`}</span><input type="number" class="bpPopupInput" data-id="${id}" min="0" step="0.01" style="width:5em;" value="${val}" />`;
    })
    .join("");

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `<div style="max-height:320px;overflow-y:auto;padding:.2em;"><div style="display:grid;grid-template-columns:1fr 5em;gap:.3em .5em;align-items:center;">${rows}</div></div>`;

  $(popupEl).dialog({
    title: "Biome Baseline Production",
    width: "22em",
    resizable: false,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const result: Partial<Record<number, number>> = {};
        popupEl.querySelectorAll<HTMLInputElement>(".bpPopupInput").forEach(input => {
          const id = Number(input.dataset.id!);
          const v = Number(input.value);
          if (Number.isFinite(v) && v > 0) result[id] = v;
        });
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

export const GoodEditor = { open };
