import { CULTURE_TYPES } from "../modules/cultures-generator";
import type { DemandCategory, Good } from "../modules/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY } from "../modules/goods-generator";
import { ensureEl, getRandomColor, unique } from "../utils";
import { DistributionEditor } from "./goods-distribution-editor";

export function goodEditor(editedGood?: Good, onUpdate?: () => void) {
  const icons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const renderIconOption = (icon: string) =>
    /*html*/ `<option value="${icon}" ${editedGood?.icon === icon ? "selected" : ""}>${icon}</option>`;

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
    biome: { ...(editedGood?.multipliers?.biome ?? {}) }
  };

  const multiplierSummary = (dim: MultiplierDimKey): string => {
    const vals = multipliers[dim] ?? {};
    const entries = Object.entries(vals).filter(([, v]) => v !== 1);
    if (!entries.length) return "none";
    return entries.map(([id, v]) => `${getMultiplierEntityName(dim, id)} ×${rn(v!, 2)}`).join(", ");
  };

  const renderMultiplierRow = (
    dim: MultiplierDimKey,
    label: string
  ) => /*html*/ `<div style="display: grid; grid-template-columns: 1fr 2fr auto; align-items: self-start; column-gap: 0.4em;">
      ${label}
      <span id="mSummary_${dim}">${multiplierSummary(dim)}</span>
      <button class="mEdit icon-pencil" data-dim="${dim}" data-tip="${label} multipliers"></button>
    </div>`;

  alertMessage.innerHTML = /*html*/ `
    <div style="display:grid; grid-template-columns: 7em 1fr; align-items:center;">
      <label for="newGoodName">Name*</label>
      <input id="newGoodName" value="${editedGood?.name || ""}" />

      <label for="newGoodTags">Tags</label>
      <input id="newGoodTags" value="${editedGood?.tags.join(", ") || ""}" placeholder="comma separated" />

      <label for="newGoodValue">Base Price*</label>
      <span><input id="newGoodValue" type="number" min="0" step="1" value="${editedGood?.value ?? 1}" /> 🟡</span>

      <label for="newGoodChance">Chance</label>
      <input id="newGoodChance" type="number" min="0" max="100" step="0.1" value="${editedGood?.chance ?? 1}" />

      <label for="newGoodUnit">Unit</label>
      <input id="newGoodUnit" placeholder="e.g. wagon, barrel" value="${editedGood?.unit || ""}" />

      <label for="newGoodIcon">Icon*</label>
      <div style="display:flex; align-items:center; gap:.4em;">
        <select id="newGoodIcon" style="width: 8em;">${icons.map(renderIconOption).join("")}</select>
        <svg width="20" height="20" viewBox="0 0 200 200" style="flex-shrink:0"><use id="newGoodIconPreview" href="#${editedGood?.icon || "good-unknown"}"/></svg>
        <button id="newGoodUploadIconRaster" class="icon-upload" data-tip="Upload raster icon"></button>
        <button id="newGoodUploadIconVector" class="icon-upload-cloud" data-tip="Upload vector (SVG) icon"></button>
        <input id="newGoodColor" type="color" data-tip="Set a stroke color" style="width:3em; height:14px; padding:0; border:none;" value="${editedGood?.color || "#ff5959"}" />
      </div>

      <label style="align-self:start;" data-tip="How much of each demand category this good satisfies. Click the pencil icon to edit.">Demand Coverage</label>
      <div style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:.4em;">
        <span id="demandCoverageSummary">${demandCoverageSummary()}</span>
        <button class="dcEdit icon-pencil" data-tip="Edit demand coverage"></button>
      </div>

      <label style="align-self:start;" data-tip="Per-dimension production multipliers. 1 = no effect, 0 = fully suppressed. Click the pencil icon to edit each dimension.">Multipliers</label>
      <div style="display:flex;flex-direction:column;">
        ${renderMultiplierRow("cultureType", "CultureType")}
        ${renderMultiplierRow("culture", "Culture")}
        ${renderMultiplierRow("state", "State")}
        ${renderMultiplierRow("religion", "Religion")}
        ${renderMultiplierRow("biome", "Biome")}
      </div>

      <label data-tip="For raw resources: sets the baseline production per biome" style="align-self:start;">Rural cell production:</label>
      <div style="display:flex; justify-content: space-between; align-items: flex-start;">
        <span id="biomeProductionSummary">${biomeOutputSummary()}</span>
        <button class="bpEdit icon-pencil" data-tip="Edit biome baseline production"></button>
      </div>

      <label data-tip="For raw resources: controls where and how this good is produced directly from the environment (e.g. biome, elevation, temperature)">Distribution:</label>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div id="newGoodDistribution" style="color:#555; font-size:.9em; font-family:monospace;">${editedGood?.distribution || ""}</div>
        <button id="newGoodDistributionEditor" class="icon-pencil" data-tip="Open the Distribution visual editor"></button>
      </div>
    </div>

    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.4em;">
        <label data-tip="For manufactured goods: recipes define which other goods are required to produce this good">Recipes</label>
        <button id="newGoodAddRecipe" class="icon-plus"></button>
      </div>
      <div id="newGoodRecipeList" style="display:flex; flex-direction:column; gap:.45em;"></div>
    </div>

    <div id="newGoodError" style="color:#b20000; min-height:1.2em"></div>
  `;

  const recipes: Record<number, number>[] = editedGood?.recipes || [];
  const recipeList = ensureEl("newGoodRecipeList");

  const defaultGoodId = pack.goods[0]?.i ?? 0;
  const sortedGoods = [...pack.goods].sort((a, b) => a.name.localeCompare(b.name));

  const renderRecipes = () => {
    recipeList.innerHTML = recipes
      .map(
        (recipe, recipeIndex) => /*html*/ `
          <div class="recipeOption" style="border: 1px solid #ccc;" data-recipe-index="${recipeIndex}" >
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 0.2em;">
              <span>Recipe ${recipeIndex + 1}</span>
              <div style="display:flex; gap:.3em;">
                <span class="recipeAddIngredient icon-plus pointer" data-recipe-index="${recipeIndex}"></span>
                <span class="recipeRemoveOption icon-trash-empty pointer" data-recipe-index="${recipeIndex}"></span>
              </div>
            </div>
            <div class="recipeIngredients" style="display:flex; flex-direction:column; gap:.2em;">
              ${Object.entries(recipe)
                .map(
                  ([ingredientId, amount], ingredientIndex) => /*html*/ `
                    <div style="display:grid; grid-template-columns: 1fr 5em 1.5em; gap:.25em; align-items: center;" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">
                      <select class="recipeGoodSelect" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">${sortedGoods.map(good => `<option value="${good.i}" ${good.i === Number(ingredientId) ? "selected" : ""}>${good.name}</option>`).join("")}</select>
                      <input class="recipeAmountInput" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" type="number" min="1" step="1" value="${amount}" />
                      <span class="recipeRemoveIngredient icon-trash-empty pointer" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" />
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
  };
  renderRecipes();

  alertMessage.querySelectorAll<HTMLButtonElement>(".mEdit").forEach(btn => {
    btn.addEventListener("click", () => {
      const dim = btn.dataset.dim as MultiplierDimKey;
      openMultiplierPopup(dim, multipliers[dim] ?? {}, values => {
        multipliers[dim] = values;
        const summaryEl = document.getElementById(`mSummary_${dim}`);
        if (summaryEl) summaryEl.textContent = multiplierSummary(dim);
      });
    });
  });

  alertMessage.querySelector<HTMLButtonElement>(".dcEdit")!.addEventListener("click", () => {
    openDemandCoveragePopup({ ...demandCoverageState }, values => {
      (Object.keys(demandCoverageState) as DemandCategory[]).forEach(k => void delete demandCoverageState[k]);
      Object.assign(demandCoverageState, values);
      const summaryEl = document.getElementById("demandCoverageSummary");
      if (summaryEl) summaryEl.textContent = demandCoverageSummary();
    });
  });

  alertMessage.querySelector<HTMLButtonElement>(".bpEdit")!.addEventListener("click", () => {
    openBiomeProductionPopup({ ...biomeOutputState }, values => {
      Object.keys(biomeOutputState).forEach(k => void delete biomeOutputState[+k]);
      Object.assign(biomeOutputState, values);
      const summaryEl = document.getElementById("biomeProductionSummary");
      if (summaryEl) summaryEl.textContent = biomeOutputSummary();
    });
  });

  ensureEl("newGoodAddRecipe").on("click", event => {
    event.preventDefault();
    recipes.push({ [defaultGoodId]: 1 });
    renderRecipes();
  });

  ensureEl("newGoodDistributionEditor").on("click", () => {
    const distEl = ensureEl("newGoodDistribution");
    DistributionEditor.open(dist => {
      distEl.textContent = dist;
    }, distEl.textContent?.trim() ?? "");
  });

  const iconSelect = ensureEl<HTMLSelectElement>("newGoodIcon");
  iconSelect.onchange = () => ensureEl("newGoodIconPreview").setAttribute("href", `#${iconSelect.value}`);

  const onIconUpload = (_type: string, id: string) => {
    ensureEl("newGoodIconPreview").setAttribute("href", `#${id}`);
    iconSelect.innerHTML += `<option value="${id}">${id}</option>`;
    iconSelect.value = id;
  };
  ensureEl("newGoodUploadIconRaster").onclick = () => (ensureEl("imageToLoad") as HTMLInputElement).click();
  ensureEl("newGoodUploadIconVector").onclick = () => (ensureEl("svgToLoad") as HTMLInputElement).click();
  ensureEl("imageToLoad").onchange = () => uploadImage("image", onIconUpload);
  ensureEl("svgToLoad").onchange = () => uploadImage("svg", onIconUpload);

  $("#alert").dialog({
    width: "30em",
    resizable: false,
    title: editedGood ? "Edit good" : "Add new good",
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
          if (distribution) editedGood.distribution = distribution;
          if (Object.keys(biomeOutputState).length) editedGood.biomeOutput = biomeOutputState;
          if (recipes.length) editedGood.recipes = recipes;
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
        $("#alert").dialog("close");
      }
    }
  });
}

type MultiplierDimKey = "cultureType" | "culture" | "state" | "religion" | "biome";

function getMultiplierEntityName(dim: MultiplierDimKey, id: string): string {
  if (dim === "cultureType") return id;
  if (dim === "culture") return pack.cultures[+id]?.name ?? `Culture ${id}`;
  if (dim === "state") return pack.states[+id]?.name ?? `State ${id}`;
  if (dim === "religion") return pack.religions[+id]?.name ?? `Religion ${id}`;
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
  }

  const rows = entities.map(entity => {
    const val = currentValues[entity.id] ?? 1;
    const dot = `<span style="display:inline-block; width:.85em; height:.85em; border-radius:50%; background:${entity.color || getRandomColor()}; flex-shrink:0;"></span>`;
    return `${dot}<span>${entity.name}</span><input type="number" class="mPopupInput" data-id="${entity.id}" min="0" step="0.1" style="width:5em;" value="${val}" />`;
  });

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `
    <div style="max-height:320px; overflow-y:auto; padding:.2em;">
      <div style="display:grid; grid-template-columns:auto 1fr 5em; gap:.3em .5em; align-items:center;">${rows.join("")}</div>
    </div>
  `;

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
