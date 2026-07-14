import { drag, type Selection, select } from "d3";
import { ensureEl } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

// Custom app prompt shadows the DOM built-in (same pattern as burg-editor / route-groups-editor).
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

type ScaleBarSelection = Selection<SVGGElement, unknown, HTMLElement, unknown>;

// The #unitsEditor inputs (distanceUnitInput, heightUnit, temperatureScale, …) are app-wide
// settings cached as globals at load and read across the codebase, so this module does NOT
// own that markup — it stays in index.html. Listeners are wired once behind this flag.
let initialized = false; // TODO: refactor to eliminate initialization arc

function open(): void {
  closeDialogs("#unitsEditor, .stable");

  $("#unitsEditor").dialog({
    title: "Units Editor",
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  if (initialized) return;
  initialized = true;

  ensureEl("distanceUnitInput").on("change", changeDistanceUnit);
  ensureEl("distanceScaleInput").on("change", changeDistanceScale);
  ensureEl("heightUnit").on("change", changeHeightUnit);
  ensureEl("heightExponentInput").on("input", changeHeightExponent);
  ensureEl("temperatureScale").on("change", changeTemperatureScale);

  ensureEl("populationRateInput").on("change", changePopulationRate);
  ensureEl("urbanizationInput").on("change", changeUrbanizationRate);
  ensureEl("urbanDensityInput").on("change", changeUrbanDensity);

  ensureEl("addLinearRuler").on("click", addRuler);
  ensureEl("addOpisometer").on("click", toggleOpisometerMode);
  ensureEl("addRouteOpisometer").on("click", toggleRouteOpisometerMode);
  ensureEl("addPlanimeter").on("click", togglePlanimeterMode);
  ensureEl("removeRulers").on("click", removeAllRulers);
  ensureEl("unitsRestore").on("click", restoreDefaultUnits);
}

function renderScaleBar(): void {
  const bar = scaleBar as unknown as ScaleBarSelection;
  drawScaleBar(bar, scale);
  fitScaleBar(bar, svgWidth, svgHeight);
}

function changeDistanceUnit(this: HTMLSelectElement): void {
  if (this.value === "custom_name") {
    prompt("Provide a custom name for a distance unit", { default: "" }, custom => {
      this.options.add(new Option(String(custom), String(custom), false, true));
      lock("distanceUnit");
      renderScaleBar();
      calculateFriendlyGridSize();
    });
    return;
  }

  renderScaleBar();
  calculateFriendlyGridSize();
}

function changeDistanceScale(this: HTMLInputElement): void {
  distanceScale = +this.value;
  renderScaleBar();
  calculateFriendlyGridSize();
}

function changeHeightUnit(this: HTMLSelectElement): void {
  if (this.value !== "custom_name") return;

  prompt("Provide a custom name for a height unit", { default: "" }, custom => {
    this.options.add(new Option(String(custom), String(custom), false, true));
    lock("heightUnit");
  });
}

function changeHeightExponent(): void {
  calculateTemperatures();
  if (layerIsOn("toggleTemperature")) drawTemperature();
}

function changeTemperatureScale(): void {
  if (layerIsOn("toggleTemperature")) drawTemperature();
}

function changePopulationRate(this: HTMLInputElement): void {
  populationRate = +this.value;
}

function changeUrbanizationRate(this: HTMLInputElement): void {
  urbanization = +this.value;
}

function changeUrbanDensity(this: HTMLInputElement): void {
  urbanDensity = +this.value;
}

function restoreDefaultUnits(): void {
  distanceScale = 3;
  ensureEl<HTMLInputElement>("distanceScaleInput").value = String(distanceScale);
  unlock("distanceScale");

  // units
  const US = navigator.language === "en-US";
  const UK = navigator.language === "en-GB";
  distanceUnitInput.value = US || UK ? "mi" : "km";
  heightUnit.value = US || UK ? "ft" : "m";
  temperatureScale.value = US ? "°F" : "°C";
  areaUnit.value = "square";
  localStorage.removeItem("distanceUnit");
  localStorage.removeItem("heightUnit");
  localStorage.removeItem("temperatureScale");
  localStorage.removeItem("areaUnit");
  calculateFriendlyGridSize();

  // height exponent
  heightExponentInput.value = "1.8";
  localStorage.removeItem("heightExponent");
  calculateTemperatures();

  renderScaleBar();

  // population
  populationRate = 1000;
  ensureEl<HTMLInputElement>("populationRateInput").value = String(populationRate);
  urbanization = 1;
  ensureEl<HTMLInputElement>("urbanizationInput").value = String(urbanization);
  urbanDensity = 10;
  ensureEl<HTMLInputElement>("urbanDensityInput").value = String(urbanDensity);
  localStorage.removeItem("populationRate");
  localStorage.removeItem("urbanization");
  localStorage.removeItem("urbanDensity");
}

function addRuler(): void {
  if (!layerIsOn("toggleRulers")) toggleRulers();

  const width = Math.min(graphWidth, svgWidth);
  const height = Math.min(graphHeight, svgHeight);
  const svg = ensureEl<HTMLElement>("map") as unknown as SVGSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = width / 2;
  pt.y = height / 4;
  const p = pt.matrixTransform((viewbox.node() as SVGGraphicsElement).getScreenCTM()!.inverse());

  const dx = width / 4 / scale;
  const dy = (rulers.data.length * 40) % (height / 2);
  const from = [(p.x - dx) | 0, (p.y + dy) | 0];
  const to = [(p.x + dx) | 0, (p.y + dy) | 0];
  rulers.create(Ruler, [from, to]).draw();
}

function toggleOpisometerMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    restoreDefaultEvents();
    clearMainTip();
    this.classList.remove("pressed");
    return;
  }

  if (!layerIsOn("toggleRulers")) toggleRulers();
  tip("Draw a curve to measure length. Hold Shift to disallow path optimization", true);
  ensureEl("unitsBottom")
    .querySelectorAll(".pressed")
    .forEach(button => {
      button.classList.remove("pressed");
    });
  this.classList.add("pressed");

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(
      drag<SVGElement, unknown>().on("start", (event: any) => {
        const point: [number, number] = [event.x, event.y];
        const opisometer = rulers.create(Opisometer, [point]).draw();

        event.on("drag", (dragEvent: any) => {
          opisometer.addPoint([dragEvent.x, dragEvent.y]);
        });

        event.on("end", (endEvent: any) => {
          restoreDefaultEvents();
          clearMainTip();
          ensureEl("addOpisometer").classList.remove("pressed");
          if (opisometer.points.length < 2) rulers.remove(opisometer.id);
          else if (!endEvent.sourceEvent.shiftKey) opisometer.optimize();
        });
      })
    );
}

function toggleRouteOpisometerMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    restoreDefaultEvents();
    clearMainTip();
    this.classList.remove("pressed");
    return;
  }

  if (!layerIsOn("toggleRulers")) toggleRulers();
  tip("Draw a curve along routes to measure length. Hold Shift to measure away from roads.", true);
  ensureEl("unitsBottom")
    .querySelectorAll(".pressed")
    .forEach(button => {
      button.classList.remove("pressed");
    });
  this.classList.add("pressed");

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(
      drag<SVGElement, unknown>().on("start", (event: any) => {
        const { cells, burgs } = pack;
        const c = findCell(event.x, event.y)!;

        if (Routes.isConnected(c) || event.sourceEvent.shiftKey) {
          const b = cells.burg[c];
          const x = b ? burgs[b].x : cells.p[c][0];
          const y = b ? burgs[b].y : cells.p[c][1];
          const routeOpisometer = rulers.create(RouteOpisometer, [[x, y]]).draw();

          event.on("drag", (dragEvent: any) => {
            const cell = findCell(dragEvent.x, dragEvent.y)!;
            if (Routes.isConnected(cell) || dragEvent.sourceEvent.shiftKey) {
              routeOpisometer.trackCell(cell, true);
            }
          });

          event.on("end", () => {
            restoreDefaultEvents();
            clearMainTip();
            ensureEl("addRouteOpisometer").classList.remove("pressed");
            if (routeOpisometer.points.length < 2) rulers.remove(routeOpisometer.id);
          });
        } else {
          restoreDefaultEvents();
          clearMainTip();
          ensureEl("addRouteOpisometer").classList.remove("pressed");
          tip("Must start in a cell with a route in it", false, "error");
        }
      })
    );
}

function togglePlanimeterMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    restoreDefaultEvents();
    clearMainTip();
    this.classList.remove("pressed");
    return;
  }

  if (!layerIsOn("toggleRulers")) toggleRulers();
  tip("Draw a curve to measure its area. Hold Shift to disallow path optimization", true);
  ensureEl("unitsBottom")
    .querySelectorAll(".pressed")
    .forEach(button => {
      button.classList.remove("pressed");
    });
  this.classList.add("pressed");

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(
      drag<SVGElement, unknown>().on("start", (event: any) => {
        const point: [number, number] = [event.x, event.y];
        const planimeter = rulers.create(Planimeter, [point]).draw();

        event.on("drag", (dragEvent: any) => {
          planimeter.addPoint([dragEvent.x, dragEvent.y]);
        });

        event.on("end", (endEvent: any) => {
          restoreDefaultEvents();
          clearMainTip();
          ensureEl("addPlanimeter").classList.remove("pressed");
          if (planimeter.points.length < 3) rulers.remove(planimeter.id);
          else if (!endEvent.sourceEvent.shiftKey) planimeter.optimize();
        });
      })
    );
}

function removeAllRulers(): void {
  if (!rulers.data.length) return;
  alertMessage.innerHTML = /* html */ ` Are you sure you want to remove all placed rulers?
    <br />If you just want to hide rulers, toggle the Rulers layer off in Menu`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove all rulers",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        rulers.undraw();
        rulers = new Rulers();
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

export const UnitsEditor = { open };
