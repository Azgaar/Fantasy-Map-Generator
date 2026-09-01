// Update an old map file to the current version
import { color, min, select } from "d3";
import { type LayerId, Layers, type LayersState } from "@/components/layers";
import { RELIEF_SETS } from "@/data/relief-icons";
import { defaultOptions } from "@/data/view-3d-options";
import { Emblems } from "@/generators/emblems-generator";
import type { GraphOverrides } from "@/generators/graph-override";
import { type Label, type LabelNameMode, Labels as LabelsGenerator } from "@/generators/labels-generator";
import type { Measurer, MeasurerType } from "@/generators/measurers-generator";

import { labelGroupFromLegacy, migrateStyles, restoreStrippedLayerStyles } from "@/generators/styles-legacy";
import type { Point } from "@/generators/voronoi";
import { getGroupStyle } from "@/renderers/labels/label-groups";
import { unfog } from "@/renderers/overlays/fogging";
import { compareVersions } from "@/services/versioning";
import type { ReliefSet } from "@/types/relief";
import { ensureEl, findEl, minmax, P, parseTransform, rand, rn, rw, safeParseJSON, unique } from "@/utils";
import { parsePathPoints } from "@/utils/pathUtils";

export async function resolveVersionConflicts(mapVersion: string, data: string[]): Promise<void> {
  const isOlderThan = (tagVersion: string) => compareVersions(mapVersion, tagVersion).isOlder;

  if (isOlderThan("1.139.0")) {
    // v1.139.0 moved biomes data from the legacy pipe-delimited format to pack.biomes.
    // This must run before older migrations that consume biome data.
    const [colorData = "", habitabilityData = "", nameData = ""] = data[3].split("|");
    const colors = colorData.split(",");
    const habitability = habitabilityData.split(",").map(Number);
    const names = nameData.split(",");
    const defaults = Biomes.getDefault();
    const biomesCount = Math.max(defaults.length, colors.length, habitability.length, names.length);

    pack.biomes = Array.from({ length: biomesCount }, (_, i) => {
      const defaultBiome = defaults[i];
      const name = names[i] || defaultBiome?.name || "Custom";
      return {
        i,
        name,
        color: colors[i] || defaultBiome?.color || "#999999",
        habitability: habitability[i] ?? defaultBiome?.habitability ?? 50,
        iconsDensity: defaultBiome?.iconsDensity ?? 0,
        icons: defaultBiome?.icons ?? [],
        cost: defaultBiome?.cost ?? 50,
        ...(name === "removed" && { removed: true })
      };
    });
  }

  if (isOlderThan("1.142.0")) {
    // v1.142 still has issue with missing shoreline
    for (const f of pack.features) {
      if (f?.type === "lake" && !f.shoreline) f.shoreline = Lakes.defineShoreline(f);
    }
  }

  if (isOlderThan("1.0.0")) {
    // v1.0 added a new religions layer
    select("#viewbox").insert("g", "#terrain").attr("id", "relig");
    Religions.generate();

    // v1.0 added a legend box
    select("#map").append("g").attr("id", "legend");
    select("#legend")
      .attr("font-family", "Almendra SC")
      .attr("font-size", 13)
      .attr("data-size", 13)
      .attr("data-x", 99)
      .attr("data-y", 93)
      .attr("stroke-width", 2.5)
      .attr("stroke", "#812929")
      .attr("stroke-dasharray", "0 4 10 4")
      .attr("stroke-linecap", "round");

    // v1.0 separated drawBorders fron drawStates()
    select("#borders").append("g").attr("id", "stateBorders");
    select("#borders").append("g").attr("id", "provinceBorders");
    select("#borders")
      .attr("opacity", null)
      .attr("stroke", null)
      .attr("stroke-width", null)
      .attr("stroke-dasharray", null)
      .attr("stroke-linecap", null)
      .attr("filter", null);
    select("#stateBorders")
      .attr("opacity", 0.8)
      .attr("stroke", "#56566d")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2")
      .attr("stroke-linecap", "butt");
    select("#provinceBorders")
      .attr("opacity", 0.8)
      .attr("stroke", "#56566d")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "1")
      .attr("stroke-linecap", "butt");

    // v1.0 added state relations, provinces, forms and full names
    select("#viewbox").insert("g", "#borders").attr("id", "provs").attr("opacity", 0.6);
    States.collectStatistics();
    States.generateCampaigns();
    States.generateDiplomacy();
    States.defineStateForms();
    Provinces.generate();
    Provinces.getPoles();

    // v1.0 added zones layer
    select("#viewbox").insert("g", "#borders").attr("id", "zones").attr("display", "none");
    select("#zones")
      .attr("opacity", 0.6)
      .attr("stroke", null)
      .attr("stroke-width", 0)
      .attr("stroke-dasharray", null)
      .attr("stroke-linecap", "butt");
    Zones.generate();
    if (!select("#markers").selectAll("*").size()) Markers.generate();

    // v1.0 add fogging layer (state focus)
    select("#viewbox")
      .insert("g", "#ruler")
      .attr("id", "fogging-cont")
      .attr("mask", "url(#fog)")
      .append("g")
      .attr("id", "fogging")
      .style("display", "none");
    select("#fogging").append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
    select("#deftemp")
      .append("mask")
      .attr("id", "fog")
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "white");

    // v1.0 changes states opacity bask to regions level
    if (select("#statesBody").attr("opacity")) {
      select("#regions").attr("opacity", select("#statesBody").attr("opacity"));
      select("#statesBody").attr("opacity", null);
    }

    // v1.0 changed labels to multi-lined
    select("#labels")
      .selectAll<SVGTextPathElement, unknown>("textPath")
      .each(function () {
        const text = this.textContent;
        const shift = this.getComputedTextLength() / -1.5;
        this.innerHTML = /* html */ `<tspan x="${shift}">${text}</tspan>`;
      });
  }

  if (isOlderThan("1.1.0")) {
    // v1.0 code had a bug with religion layer id
    if (!select("#relig").size()) select("#viewbox").insert("g", "#terrain").attr("id", "relig");

    // v1.0 had Sympathy status then relaced with Friendly
    for (const s of pack.states) {
      if (!s.diplomacy) continue;
      s.diplomacy = s.diplomacy.map(r => (r === "Sympathy" ? "Friendly" : r));
    }

    // labels should be toggled via style attribute, so remove display attribute
    select("#labels").attr("display", null);

    // v1.0 added religions heirarchy tree
    if (pack.religions[1] && !pack.religions[1].code) {
      pack.religions
        .filter(r => r.i)
        .forEach(r => {
          (r as typeof r & { origin?: number }).origin = 0;
          r.code = r.name.slice(0, 2);
        });
    }

    if (!document.getElementById("freshwater")) {
      select("#lakes").append("g").attr("id", "freshwater");
      select("#lakes")
        .select("#freshwater")
        .attr("opacity", 0.5)
        .attr("fill", "#a6c1fd")
        .attr("stroke", "#5f799d")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
    }

    if (!document.getElementById("salt")) {
      select("#lakes").append("g").attr("id", "salt");
      select("#lakes")
        .select("#salt")
        .attr("opacity", 0.5)
        .attr("fill", "#409b8a")
        .attr("stroke", "#388985")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
    }

    // v1.1 added new lake and coast groups
    if (!document.getElementById("sinkhole")) {
      select("#lakes").append("g").attr("id", "sinkhole");
      select("#lakes").append("g").attr("id", "frozen");
      select("#lakes").append("g").attr("id", "lava");
      select("#lakes")
        .select("#sinkhole")
        .attr("opacity", 1)
        .attr("fill", "#5bc9fd")
        .attr("stroke", "#53a3b0")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
      select("#lakes")
        .select("#frozen")
        .attr("opacity", 0.95)
        .attr("fill", "#cdd4e7")
        .attr("stroke", "#cfe0eb")
        .attr("stroke-width", 0)
        .attr("filter", null);
      select("#lakes")
        .select("#lava")
        .attr("opacity", 0.7)
        .attr("fill", "#90270d")
        .attr("stroke", "#f93e0c")
        .attr("stroke-width", 2)
        .attr("filter", "url(#crumpled)");

      select("#coastline").append("g").attr("id", "sea_island");
      select("#coastline").append("g").attr("id", "lake_island");
      select("#coastline")
        .select("#sea_island")
        .attr("opacity", 0.5)
        .attr("stroke", "#1f3846")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
      select("#coastline")
        .select("#lake_island")
        .attr("opacity", 1)
        .attr("stroke", "#7c8eaf")
        .attr("stroke-width", 0.35)
        .attr("filter", null);
    }

    // v1.1 features stores more data
    select("#deftemp").select("#land").selectAll("path").remove();
    select("#deftemp").select("#water").selectAll("path").remove();
    select("#coastline").selectAll("path").remove();
    select("#lakes").selectAll("path").remove();

    Features.markupPack();
    Measurers.createDefaultRuler();
  }

  if (isOlderThan("1.11.0")) {
    // v1.11 added new attributes
    select("#terrs").attr("scheme", "bright").attr("terracing", 0).attr("skip", 5).attr("relax", 0).attr("curve", 0);
    select("#map").select("#oceanic > *").attr("id", "oceanicPattern");
    select("#oceanLayers").attr("layers", "-6,-3,-1");
    select("#gridOverlay").attr("type", "pointyHex").attr("size", 10);

    // v1.11 added cultures heirarchy tree
    if (pack.cultures[1] && !pack.cultures[1].code) {
      pack.cultures
        .filter(c => c.i)
        .forEach(c => {
          (c as typeof c & { origin?: number }).origin = 0;
          c.code = c.name.slice(0, 2);
        });
    }

    // v1.11 had an issue with fogging being displayed on load
    select("#fog").selectAll("path").remove();

    // v1.2 added new terrain attributes
    const terrain = select("#terrain");
    if (!terrain.attr("set")) terrain.attr("set", "simple");
    if (!terrain.attr("size")) terrain.attr("size", 1);
    if (!terrain.attr("density")) terrain.attr("density", 0.4);
  }

  if (isOlderThan("1.21.0")) {
    // v1.11 replaced "display" attribute by "display" style. Only "none" hid the element: layers
    // that were on carry "block" (compass, prec, fogging), so those just lose the attribute
    select("#viewbox")
      .selectAll<SVGGraphicsElement, unknown>("[display]")
      .each(function () {
        if (this.getAttribute("display") === "none") this.style.display = "none";
        this.removeAttribute("display");
      });

    // v1.21 added rivers data to pack
    pack.rivers = []; // rivers data
    select("#rivers")
      .selectAll<SVGPathElement, unknown>("path")
      .each(function () {
        const i = +this.id.slice(5);
        const length = this.getTotalLength() / 2;
        if (!length) return;

        const s = this.getPointAtLength(length);
        const e = this.getPointAtLength(0);
        const source = Pack.findCell(s.x, s.y)!;
        const mouth = Pack.findCell(e.x, e.y)!;
        const name = Rivers.getName(mouth);
        const type = length < 25 ? rw({ Creek: 9, River: 3, Brook: 3, Stream: 1 }) : "River";
        pack.rivers.push({ i, parent: 0, length, source, mouth, basin: i, name, type } as (typeof pack.rivers)[number]);
      });
  }

  if (isOlderThan("1.22.0")) {
    // v1.22 changed state neighbors from Set object to array
    States.collectStatistics();
  }

  if (isOlderThan("1.3.0")) {
    // v1.3 added global options object
    const winds = (options as unknown as number[]).slice(); // previostly wind was saved in settings[19]
    const year = rand(100, 2000);
    const era = `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
    const eraShort = `${era[0]}E`;
    const military = Military.getDefaultOptions();
    options = { winds, year, era, eraShort, military } as typeof options;

    // v1.3 added campaings data for all states
    States.generateCampaigns();

    // v1.3 added militry layer
    select("#viewbox")
      .insert("g", "#icons")
      .attr("id", "armies")
      .attr("opacity", 1)
      .attr("fill-opacity", 1)
      .attr("font-size", 6)
      .attr("box-size", 3)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.3);
    Military.generate();
  }

  if (isOlderThan("1.4.0")) {
    // v1.35 added dry lakes
    if (!select("#lakes").select("#dry").size()) {
      select("#lakes").append("g").attr("id", "dry");
      select("#lakes")
        .select("#dry")
        .attr("opacity", 1)
        .attr("fill", "#c9bfa7")
        .attr("stroke", "#8e816f")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
    }

    // v1.4 added ice layer
    select("#viewbox").insert("g", "#coastline").attr("id", "ice").style("display", "none");
    select("#ice")
      .attr("opacity", null)
      .attr("fill", "#e8f0f6")
      .attr("stroke", "#e8f0f6")
      .attr("stroke-width", 1)
      .attr("filter", "url(#dropShadow05)");

    // v1.4 added icon and power attributes for units
    for (const unit of options.military) {
      if (!unit.icon) unit.icon = getUnitIcon(unit.type);
      if (!unit.power) unit.power = unit.crew;
    }

    function getUnitIcon(type: string) {
      if (type === "naval") return "🌊";
      if (type === "ranged") return "🏹";
      if (type === "mounted") return "🐴";
      if (type === "machinery") return "💣";
      if (type === "armored") return "🐢";
      if (type === "aviation") return "🦅";
      if (type === "magical") return "🔮";
      else return "⚔️";
    }

    // v1.4 added state reference for regiments
    pack.states
      .filter(s => s.military)
      .forEach(s => {
        s.military!.forEach(r => {
          r.state = s.i;
        });
      });
  }

  if (isOlderThan("1.5.0")) {
    // not need to store default styles from v 1.5
    localStorage.removeItem("styleClean");
    localStorage.removeItem("styleGloom");
    localStorage.removeItem("styleAncient");
    localStorage.removeItem("styleMonochrome");

    // v1.5 cultures has shield attribute
    pack.cultures.forEach(culture => {
      if (culture.removed) return;
      culture.shield = Cultures.getRandomShield();
    });

    // v1.5 added burg type value
    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed) return;
      burg.type = Burgs.getType(burg.cell, burg.port);
    });

    // v1.5 added emblems
    select("#deftemp").append("g").attr("id", "defs-emblems");
    select("#viewbox").insert("g", "#population").attr("id", "emblems").style("display", "none");
    select("#emblems").append("g").attr("id", "burgEmblems");
    select("#emblems").append("g").attr("id", "provinceEmblems");
    select("#emblems").append("g").attr("id", "stateEmblems");
    Emblems.regenerate();
    ensureEl("emblems").style.display = "";

    // v1.5 changed releif icons data
    select("#terrain")
      .selectAll<SVGUseElement, unknown>("use")
      .each(function () {
        const type = this.getAttribute("data-type") || this.getAttribute("xlink:href");
        this.removeAttribute("xlink:href");
        this.removeAttribute("data-type");
        this.removeAttribute("data-size");
        if (type) this.setAttribute("href", type);
      });
  }

  if (isOlderThan("1.6.0")) {
    // v1.6 changed rivers data
    for (const river of pack.rivers) {
      const el = document.getElementById(`river${river.i}`);
      if (el) {
        river.widthFactor = +el.getAttribute("data-width")!;
        el.removeAttribute("data-width");
        el.removeAttribute("data-increment");
        river.discharge = pack.cells.fl[river.mouth] || 1;
        river.width = rn(river.length / 100, 2);
        river.sourceWidth = 0.1;
      } else {
        Rivers.remove(river.i);
      }
    }

    // v1.6 changed lakes data
    for (const f of pack.features) {
      if (f.type !== "lake") continue;
      if (f.evaporation) continue;

      f.flux = f.flux || f.cells * 3;
      f.temp = grid.cells.temp[pack.cells.g[f.firstCell]];
      const heights = pack.cells.c[f.firstCell].map(c => pack.cells.h[c]).filter(h => h >= 20);
      f.height = f.height || min(heights) || 0;
      const height = (f.height - 18) ** heightExponentInput.valueAsNumber;
      const evaporation = ((700 * (f.temp + 0.006 * height)) / 50 + 75) / (80 - f.temp);
      f.evaporation = rn(evaporation * f.cells);
      if (!f.shoreline) f.shoreline = Lakes.defineShoreline(f);
      f.name = f.name || Lakes.getName(f);
      delete f.river;
    }
  }

  if (isOlderThan("1.61.0")) {
    // v1.61 changed rulers data
    select("#ruler").style("display", null);
    pack.measurers = [];

    select("#ruler")
      .selectAll<SVGLineElement, unknown>(".ruler > .white")
      .each(function () {
        const x1 = +this.getAttribute("x1")!;
        const y1 = +this.getAttribute("y1")!;
        const x2 = +this.getAttribute("x2")!;
        const y2 = +this.getAttribute("y2")!;
        if (Number.isNaN(x1) || Number.isNaN(y1) || Number.isNaN(x2) || Number.isNaN(y2)) return;
        const points: Point[] = [
          [x1, y1],
          [x2, y2]
        ];
        pack.measurers.push({ type: "Ruler", points });
      });

    select("#ruler")
      .selectAll<SVGGElement, unknown>("g.opisometer")
      .each(function () {
        const pointsString = this.dataset.points;
        if (!pointsString) return;
        const points = JSON.parse(pointsString);
        pack.measurers.push({ type: "Opisometer", points });
      });

    select("#ruler")
      .selectAll<SVGPathElement, unknown>("path.planimeter")
      .each(function () {
        const length = this.getTotalLength();
        if (length < 30) return;

        const step = length > 1000 ? 40 : length > 400 ? 20 : 10;
        const increment = length / Math.ceil(length / step);
        const points: Point[] = [];
        for (let i = 0; i <= length; i += increment) {
          const point = this.getPointAtLength(i);
          points.push([point.x | 0, point.y | 0]);
        }

        pack.measurers.push({ type: "Planimeter", points });
      });

    select("#ruler").selectAll("*").remove();

    // the measurers are redrawn by the load routine once the layer state is restored
    const ruler = findEl("ruler");
    if (ruler) ruler.style.display = pack.measurers.length ? "" : "none";

    // 1.61 changed oceanicPattern from rect to image
    const pattern = document.getElementById("oceanic")!;
    const filter = pattern.firstElementChild!.getAttribute("filter");
    const href = filter ? `./images/${filter.replace("url(#", "").replace(")", "")}.png` : "";
    pattern.innerHTML = /* html */ `<image id="oceanicPattern" href=${href} width="100" height="100" opacity="0.2"></image>`;
  }

  if (isOlderThan("1.62.0")) {
    // v1.62 changed grid data
    select("#gridOverlay").attr("size", null);
  }

  if (isOlderThan("1.63.0")) {
    // v1.63 changed ocean pattern opacity element
    const oceanPattern = document.getElementById("oceanPattern");
    if (oceanPattern) oceanPattern.removeAttribute("opacity");
    const oceanicPattern = document.getElementById("oceanicPattern");
    if (oceanicPattern && !oceanicPattern.getAttribute("opacity")) oceanicPattern.setAttribute("opacity", "0.2");
  }

  if (isOlderThan("1.64.0")) {
    // v1.64 change states style
    const opacity = select("#regions").attr("opacity");
    const filter = select("#regions").attr("filter");
    select("#statesBody").attr("opacity", opacity).attr("filter", filter);
    select("#statesHalo").attr("opacity", opacity).attr("filter", "blur(5px)");
    select("#regions").attr("opacity", null).attr("filter", null);
  }

  if (isOlderThan("1.65.0")) {
    // v1.65 changed rivers data
    select("#rivers").attr("style", null); // remove style to unhide layer
    const { cells, rivers } = pack;
    const defaultWidthFactor = rn(1 / (Number(pointsInput.dataset.cells) / 10000) ** 0.25, 2);

    for (const river of rivers) {
      const node = document.getElementById(`river${river.i}`) as unknown as SVGPathElement | null;
      if (node && !river.cells) {
        const riverCells = [];
        const riverPoints: [number, number][] = [];

        const length = node.getTotalLength() / 2;
        if (!length) continue;
        const segments = Math.ceil(length / 6);
        const increment = length / segments;

        for (let i = 0; i <= segments; i++) {
          const shift = increment * i;
          const { x: x1, y: y1 } = node.getPointAtLength(length + shift);
          const { x: x2, y: y2 } = node.getPointAtLength(length - shift);
          const x = rn((x1 + x2) / 2, 1);
          const y = rn((y1 + y2) / 2, 1);

          const cell = Pack.findCell(x, y);
          riverPoints.push([x, y]);
          riverCells.push(cell);
        }

        river.cells = riverCells as number[];
        river.points = riverPoints;
      }

      river.widthFactor = defaultWidthFactor;

      cells.i.forEach(i => {
        const riverInWater = cells.r[i] && cells.h[i] < 20;
        if (riverInWater) cells.r[i] = 0;
      });
    }
  }

  if (isOlderThan("1.652.0")) {
    // remove style to unhide layers
    select("#rivers").attr("style", null);
    select("#borders").attr("style", null);
  }

  if (isOlderThan("1.7.0")) {
    // v1.7 changed markers data
    const defs = document.getElementById("defs-markers");
    const markersGroup = document.getElementById("markers");

    if (defs && markersGroup) {
      const markerElements = markersGroup.querySelectorAll<SVGUseElement>("use");
      const rescale = +markersGroup.getAttribute("rescale")!;

      pack.markers = Array.from(markerElements).map((el, i) => {
        const id = el.getAttribute("id");
        const note = notes.find(note => note.id === id);
        if (note) note.id = `marker${i}`;

        let x = +el.dataset.x!;
        let y = +el.dataset.y!;

        const transform = el.getAttribute("transform");
        if (transform) {
          const [dx, dy] = parseTransform(transform);
          if (dx) x += +dx;
          if (dy) y += +dy;
        }
        const cell = Pack.findCell(x, y);
        const size = rn(rescale ? +el.dataset.size! * 30 : +el.getAttribute("width")!, 1);

        const href = el.href.baseVal;
        const type = href.replace("#marker_", "");
        const symbol = defs?.querySelector(`symbol${href}`);
        const text = symbol?.querySelector("text");
        const circle = symbol?.querySelector("circle");

        const icon = text?.innerHTML;
        const px = text ? Number(text.getAttribute("font-size")?.replace("px", "")) : NaN;
        const dx = text ? Number(text.getAttribute("x")?.replace("%", "")) : NaN;
        const dy = text ? Number(text.getAttribute("y")?.replace("%", "")) : NaN;
        const fill = circle?.getAttribute("fill");
        const stroke = circle?.getAttribute("stroke");

        const marker: Record<string, unknown> = { i, icon, type, x, y, size, cell };
        if (size && size !== 30) marker.size = size;
        if (!Number.isNaN(px) && px !== 12) marker.px = px;
        if (!Number.isNaN(dx) && dx !== 50) marker.dx = dx;
        if (!Number.isNaN(dy) && dy !== 50) marker.dy = dy;
        if (fill && fill !== "#ffffff") marker.fill = fill;
        if (stroke && stroke !== "#000000") marker.stroke = stroke;
        if (circle?.getAttribute("opacity") === "0") marker.pin = "no";

        return marker;
      }) as unknown as typeof pack.markers;

      (markersGroup as HTMLElement).style.display = "";
      defs?.remove();
      markerElements.forEach(el => {
        el.remove();
      });
    }
  }

  if (isOlderThan("1.72.0")) {
    // v1.72 renamed custom style presets
    const storedStyles = Object.keys(localStorage).filter(key => key.startsWith("style"));
    storedStyles.forEach(styleName => {
      const style = localStorage.getItem(styleName)!;
      const newStyleName = styleName.replace(/^style/, customPresetPrefix);
      localStorage.setItem(newStyleName, style);
      localStorage.removeItem(styleName);
    });
  }

  if (isOlderThan("1.73.0")) {
    // v1.73 moved the hatching patterns out of the user's SVG
    document.getElementById("hatching")?.remove();

    // v1.73 added zone type to UI, ensure type is populated
    const zones = Array.from(document.querySelectorAll<SVGGElement>("#zones > g"));
    zones.forEach(zone => {
      if (!zone.dataset.type) zone.dataset.type = "Unknown";
    });
  }

  if (isOlderThan("1.84.0")) {
    // v1.84.0 added grid.cellsDesired to stored data
    if (!grid.cellsDesired) grid.cellsDesired = rn((graphWidth * graphHeight) / grid.spacing ** 2, -3);
  }

  if (isOlderThan("1.85.0")) {
    // v1.84.0 moved intial screen out of maon svg
    select("#map").select("#initial").remove();
  }

  if (isOlderThan("1.86.0")) {
    // v1.86.0 added multi-origin culture and religion hierarchy trees
    for (const culture of pack.cultures) {
      const c = culture as typeof culture & { origin?: number };
      culture.origins = [c.origin as number];
      delete c.origin;
    }

    for (const religion of pack.religions) {
      const r = religion as typeof religion & { origin?: number };
      religion.origins = [r.origin as number];
      delete r.origin;
    }
  }

  if (isOlderThan("1.88.0")) {
    // v1.87 may have incorrect shield for some reason
    pack.states.forEach(({ coa }) => {
      if (coa && typeof coa === "object" && coa.shield === "state") delete coa.shield;
    });
  }

  if (isOlderThan("1.91.0")) {
    // from 1.91.00 custom coa is moved to coa object
    pack.states.forEach(state => {
      if ((state.coa as unknown) === "custom") state.coa = { custom: true } as typeof state.coa;
    });
    pack.provinces.forEach(province => {
      if ((province.coa as unknown) === "custom") province.coa = { custom: true } as typeof province.coa;
    });
    pack.burgs.forEach(burg => {
      if ((burg.coa as unknown) === "custom") burg.coa = { custom: true } as typeof burg.coa;
    });

    // from 1.91.00 emblems don't have transform attribute
    select("#emblems")
      .selectAll<SVGUseElement, unknown>("use")
      .each(function () {
        const transform = this.getAttribute("transform");
        if (!transform) return;

        const [dx, dy] = parseTransform(transform);
        const x = Number(this.getAttribute("x")) + Number(dx);
        const y = Number(this.getAttribute("y")) + Number(dy);

        this.setAttribute("x", String(x));
        this.setAttribute("y", String(y));
        this.removeAttribute("transform");
      });

    // from 1.91.00 coaSize is moved to coa object
    pack.states.forEach(state => {
      const s = state as typeof state & { coaSize?: number };
      if (s.coaSize && s.coa) {
        s.coa.size = s.coaSize;
        delete s.coaSize;
      }
    });

    pack.provinces.forEach(province => {
      const p = province as typeof province & { coaSize?: number };
      if (p.coaSize && p.coa) {
        p.coa.size = p.coaSize;
        delete p.coaSize;
      }
    });

    pack.burgs.forEach(burg => {
      const b = burg as typeof burg & { coaSize?: number };
      if (b.coaSize && b.coa) {
        b.coa.size = b.coaSize;
        delete b.coaSize;
      }
    });
  }

  if (isOlderThan("1.92.0")) {
    // v1.92 change labels text-anchor from 'start' to 'middle'
    select("#labels")
      .selectAll<SVGTSpanElement, unknown>("tspan")
      .each(function () {
        this.setAttribute("x", "0");
      });
  }

  if (isOlderThan("1.94.0")) {
    // from v1.94.00 texture image is removed when layer is off
    select("#texture").style("display", null);

    const textureImage = select("#texture").select<SVGImageElement>("image");
    if (textureImage.size()) {
      // restore parameters
      const x = Number(textureImage.attr("x") || 0);
      const y = Number(textureImage.attr("y") || 0);
      const href = textureImage.attr("xlink:href") || textureImage.attr("href") || textureImage.attr("src");
      // save parameters to parent element
      select("#texture").attr("data-href", href).attr("data-x", x).attr("data-y", y);
    }
  }

  if (isOlderThan("1.95.0")) {
    // v1.95.00 added vignette visual layer
    const mask = select("#deftemp").append("mask").attr("id", "vignette-mask");
    mask.append("rect").attr("fill", "white").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
    mask
      .append("rect")
      .attr("id", "vignette-rect")
      .attr("fill", "black")
      .attr("x", "0.3%")
      .attr("y", "0.4%")
      .attr("width", "99.4%")
      .attr("height", "99.2%")
      .attr("rx", "5%")
      .attr("ry", "5%")
      .attr("filter", "blur(20px)");

    const vignette = select("#map")
      .append("g")
      .attr("id", "vignette")
      .attr("mask", "url(#vignette-mask)")
      .attr("opacity", 0.3)
      .attr("fill", "#000000")
      .style("display", "none");
    vignette.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
  }

  if (isOlderThan("1.96.0")) {
    // v1.96 added ocean rendering for heightmap
    select("#terrs").selectAll("*").remove();

    const opacity = select("#terrs").attr("opacity");
    const filter = select("#terrs").attr("filter");
    const scheme = select("#terrs").attr("scheme") || "bright";
    const terracing = select("#terrs").attr("terracing");
    const skip = select("#terrs").attr("skip");
    const relax = select("#terrs").attr("relax");

    const curveTypes: Record<number, string> = { 0: "curveBasisClosed", 1: "curveLinear", 2: "curveStep" };
    const curve = curveTypes[+select("#terrs").attr("curve")] || "curveBasisClosed";

    select("#terrs")
      .attr("opacity", null)
      .attr("filter", null)
      .attr("mask", null)
      .attr("scheme", null)
      .attr("terracing", null)
      .attr("skip", null)
      .attr("relax", null)
      .attr("curve", null);

    select("#terrs")
      .append("g")
      .attr("id", "oceanHeights")
      .attr("data-render", 0)
      .attr("opacity", opacity)
      .attr("filter", filter)
      .attr("scheme", scheme)
      .attr("terracing", 0)
      .attr("skip", 0)
      .attr("relax", 1)
      .attr("curve", curve);

    select("#terrs")
      .append("g")
      .attr("id", "landHeights")
      .attr("opacity", opacity)
      .attr("scheme", scheme)
      .attr("filter", filter)
      .attr("terracing", terracing)
      .attr("skip", skip)
      .attr("relax", relax)
      .attr("curve", curve)
      .attr("mask", "url(#land)");

    // v1.96.00 moved scaleBar options from units editor to style
    select("#scaleBar").remove();
    select("#map")
      .insert("g", "#viewbox + *")
      .attr("id", "scaleBar")
      .attr("opacity", 1)
      .attr("fill", "#353540")
      .attr("data-bar-size", 2)
      .attr("font-size", 10)
      .attr("data-x", 99)
      .attr("data-y", 99)
      .attr("data-label", "");
    select("#scaleBar")
      .append("rect")
      .attr("id", "scaleBarBack")
      .attr("data-group", "back")
      .attr("opacity", 0.2)
      .attr("fill", "#ffffff")
      .attr("stroke", "#000000")
      .attr("stroke-width", 1)
      .attr("filter", "url(#blur5)")
      .attr("data-top", 20)
      .attr("data-right", 15)
      .attr("data-bottom", 15)
      .attr("data-left", 10);

    // v1.96.00 changed coloring approach for regiments
    select("#armies")
      .selectAll<SVGGElement, unknown>(":scope > g")
      .each(function () {
        const fill = this.getAttribute("fill");
        if (!fill) return;
        const darkerColor = color(fill)!.darker().formatHex();
        this.setAttribute("color", darkerColor);
        this.querySelectorAll("g > rect:nth-child(2)").forEach(rect => {
          rect.setAttribute("fill", "currentColor");
        });
      });
  }

  if (isOlderThan("1.98.0")) {
    // v1.98.00 changed compass layer and rose element id
    const rose = select("#compass").select("use");
    rose.attr("xlink:href", "#defs-compass-rose");

    if (!select("#compass").selectAll("*").size()) {
      select("#compass").style("display", "none");
      select("#compass").append("use").attr("xlink:href", "#defs-compass-rose");
      shiftCompass();
    }
  }

  if (isOlderThan("1.99.0")) {
    // v1.99.00 changed routes generation algorithm and data format
    select("#routes").attr("display", null).attr("style", null);

    delete (select("#cells") as unknown as Record<string, unknown>).road;
    delete (select("#cells") as unknown as Record<string, unknown>).crossroad;

    pack.routes = [];
    const POINT_DISTANCE = grid.spacing * 0.75;

    for (const g of document.querySelectorAll("#viewbox > #routes > g")) {
      const group = g.id;
      if (!group) continue;

      for (const node of g.querySelectorAll<SVGPathElement>("path")) {
        const totalLength = node.getTotalLength();
        if (!totalLength) {
          ERROR && console.error("Route path has zero length", node);
          continue;
        }

        const increment = totalLength / Math.ceil(totalLength / POINT_DISTANCE);
        const points: [number, number, number | undefined][] = [];

        for (let i = 0; i <= totalLength + 0.1; i += increment) {
          const point = node.getPointAtLength(i);
          const x = rn(point.x, 2);
          const y = rn(point.y, 2);
          const cellId = Pack.findCell(x, y);
          points.push([x, y, cellId]);
        }

        if (points.length < 2) {
          ERROR && console.error("Route path has less than 2 points", node);
          continue;
        }

        const secondCellId = points[1][2];
        const feature = secondCellId === undefined ? undefined : pack.cells.f[secondCellId];

        pack.routes.push({ i: pack.routes.length, group, feature, points } as unknown as (typeof pack.routes)[number]);
      }
    }
    select("#routes").selectAll("path").remove();

    pack.cells.routes = {};
    const links = pack.cells.routes;
    for (const route of pack.routes) {
      for (let i = 0; i < route.points.length - 1; i++) {
        const cellId = route.points[i][2];
        const nextCellId = route.points[i + 1][2];

        if (cellId !== nextCellId) {
          if (!links[cellId]) links[cellId] = {};
          links[cellId][nextCellId] = route.i;

          if (!links[nextCellId]) links[nextCellId] = {};
          links[nextCellId][cellId] = route.i;
        }
      }
    }
  }

  if (isOlderThan("1.100.0")) {
    // v1.100.00 added zones to pack data
    pack.zones = [];
    select("#zones")
      .selectAll<SVGGElement, unknown>("g")
      .each(function () {
        const i = pack.zones.length;
        const name = this.dataset.description;
        const type = this.dataset.type;
        const color = this.getAttribute("fill");
        const cells = this.dataset.cells!.split(",").map(Number);
        pack.zones.push({ i, name, type, cells, color } as unknown as (typeof pack.zones)[number]);
      });
    select("#zones").style("display", null).selectAll("*").remove();
  }

  if (isOlderThan("1.104.0")) {
    // v1.104.00 separated pole of inaccessibility detection from layer rendering
    States.getPoles();
    Provinces.getPoles();
  }

  if (isOlderThan("1.105.0")) {
    // v1.104.0 introduced some bugs with layers visibility
    select("#viewbox").select("#icons").style("display", null);
    select("#viewbox").select("#ice").style("display", null);
    select("#viewbox").select("#regions").style("display", null);
    select("#viewbox").select("#armies").style("display", null);
  }

  if (isOlderThan("1.106.0")) {
    // v1.104.0 introduced bugs with coastlines. Redraw features
    select("#deftemp").select("#featurePaths").remove();
    select("#deftemp").append("g").attr("id", "featurePaths");
    select("#deftemp").select("#land").selectAll("path, use").remove();
    select("#deftemp").select("#water").selectAll("path, use").remove();
    select("#viewbox").select("#coastline").selectAll("path, use").remove();

    // v1.104.0 introduced bugs with state borders
    select("#regions")
      .attr("opacity", null)
      .attr("stroke-width", null)
      .attr("letter-spacing", null)
      .attr("fill", null)
      .attr("stroke", null);

    // pole can be missing for some states/provinces
    States.getPoles();
    Provinces.getPoles();
  }

  if (isOlderThan("1.108.0")) {
    // v1.108.0 changed features rendering method
    pack.features.forEach(f => {
      // fix lakes with missing group
      if (f?.type === "lake" && !f.group) f.group = "freshwater"; // becomes the subtype in v1.146.0
    });

    // some old maps has incorrect "heights" groups
    select("#viewbox").selectAll("#heights").remove();
  }

  if (isOlderThan("1.109.0")) {
    // v1.109.0 added customizable burg groups and icons
    options.burgs = { groups: [] };

    select("#burgIcons")
      .selectAll<SVGElement, unknown>("circle, use")
      .each(function () {
        const group = (this.parentNode as Element).id;
        const id = this.id.replace(/^burg/, "");
        const burg = pack.burgs[+id];
        if (group && burg) burg.group = group;
      });

    select("#burgIcons")
      .selectAll<SVGGElement, unknown>("g")
      .each(function (_el, index) {
        const name = this.id;
        const isDefault = name === "towns";
        options.burgs.groups.push({ name, active: true, order: index + 1, isDefault, preview: "watabou-city" });
        if (!this.dataset.icon) this.dataset.icon = "#icon-circle";

        const size = Number(this.getAttribute("size") || 2) * 2;
        this.removeAttribute("size");
        this.setAttribute("font-size", String(size));

        this.setAttribute("stroke-width", "1");
      });

    if (options.burgs.groups.filter(g => g.isDefault).length === 0) {
      options.burgs.groups[0].isDefault = true;
    }

    select("#anchors")
      .selectAll<SVGGElement, unknown>("g")
      .each(function () {
        const size = Number(this.getAttribute("size") || 1);
        this.removeAttribute("size");
        this.setAttribute("font-size", String(size));
      });

    select("#burgLabels")
      .selectAll<SVGGElement, unknown>("g")
      .each(function () {
        if (!this.dataset.dy) this.dataset.dy = "-0.4";
      });

    const anchorSymbol = ensureEl("icon-anchor");
    if (anchorSymbol) {
      anchorSymbol.outerHTML = /* html */ `<symbol id="icon-anchor" viewBox="0 0 30 30" width="1em" height="1em" overflow="visible">
        <path d="m 1.003,-9.873 c 0,-0.547 -0.453,-1 -1,-1 -0.547,0 -1,0.453 -1,1 0,0.547 0.453,1 1,1 0.547,0 1,-0.453 1,-1 z m 13,14.5 v 5.5 c 0,0.203 -0.125,0.391 -0.313,0.469 -0.063,0.016 -0.125,0.031 -0.187,0.031 -0.125,0 -0.25,-0.047 -0.359,-0.141 L 11.691,9.033 c -2.453,2.953 -6.859,4.844 -11.688,4.844 -4.829,0 -9.234,-1.891 -11.688,-4.844 l -1.453,1.453 c -0.094,0.094 -0.234,0.141 -0.359,0.141 -0.063,0 -0.125,-0.016 -0.187,-0.031 -0.187,-0.078 -0.313,-0.266 -0.313,-0.469 v -5.5 c 0,-0.281 0.219,-0.5 0.5,-0.5 h 5.5 c 0.203,0 0.391,0.125 0.469,0.313 0.078,0.188 0.031,0.391 -0.109,0.547 L -9.2,6.55 c 1.406,1.891 4.109,3.266 7.203,3.687 V 0.128 h -3 c -0.547,0 -1,-0.453 -1,-1 v -2 c 0,-0.547 0.453,-1 1,-1 h 3 v -2.547 c -1.188,-0.688 -2,-1.969 -2,-3.453 0,-2.203 1.797,-4 4,-4 2.203,0 4,1.797 4,4 0,1.484 -0.812,2.766 -2,3.453 v 2.547 h 3 c 0.547,0 1,0.453 1,1 v 2 c 0,0.547 -0.453,1 -1,1 h -3 V 10.237 C 5.097,9.815 7.8,8.44 9.206,6.55 L 7.643,4.987 C 7.502,4.831 7.456,4.628 7.534,4.44 7.612,4.252 7.8,4.127 8.003,4.127 h 5.5 c 0.281,0 0.5,0.219 0.5,0.5 z"/>
      </symbol>`;
    }

    const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
    const populations = validBurgs.map(b => b.population ?? 0).sort((a, b) => a - b);
    validBurgs.forEach(burg => {
      if (!burg.group) Burgs.defineGroup(burg, populations);

      const b = burg as typeof burg & { MFCG?: number };
      if (b.MFCG) {
        burg.link = Burgs.getPreview(burg)?.link ?? undefined;
        delete b.MFCG;
      }
    });

    const opts = options as Record<string, unknown>;
    delete opts.showBurgPreview;
    delete opts.showMFCGMap;
    delete opts.villageMaxPopulation;
  }

  if (isOlderThan("1.111.0")) {
    // v1.111.0 moved ice data from SVG to data model
    // Migrate old ice SVG elements to new pack.ice structure
    if (!pack.ice.length) {
      pack.ice = [];
      let iceId = 0;

      const iceGroup = document.getElementById("ice");
      if (iceGroup) {
        // Migrate glaciers (type="iceShield")
        iceGroup.querySelectorAll<SVGPolygonElement>("polygon[type='iceShield']").forEach(polygon => {
          // Parse points string "x1,y1 x2,y2 x3,y3 ..." into array [[x1,y1], [x2,y2], ...]
          const points = [...polygon.points].map(svgPoint => [svgPoint.x, svgPoint.y]);

          const transform = polygon.getAttribute("transform");
          const iceElement: Record<string, unknown> = {
            i: iceId++,
            points,
            type: "glacier"
          };
          if (transform) {
            iceElement.offset = parseTransform(transform);
          }
          pack.ice.push(iceElement as unknown as (typeof pack.ice)[number]);
        });

        // Migrate icebergs
        iceGroup.querySelectorAll<SVGPolygonElement>("polygon:not([type])").forEach(polygon => {
          const cellId = +polygon.getAttribute("cell")!;
          const size = +polygon.getAttribute("size")!;

          // points string must exist, cell attribute must be present, and size must be non-zero
          if (polygon.getAttribute("cell") === null || !size) return;

          // Parse points string "x1,y1 x2,y2 x3,y3 ..." into array [[x1,y1], [x2,y2], ...]
          const points = [...polygon.points].map(svgPoint => [svgPoint.x, svgPoint.y]);

          const transform = polygon.getAttribute("transform");
          const iceElement: Record<string, unknown> = {
            i: iceId++,
            points,
            type: "iceberg",
            cellId,
            size
          };
          if (transform) {
            iceElement.offset = parseTransform(transform);
          }
          pack.ice.push(iceElement as unknown as (typeof pack.ice)[number]);
        });

        // Clear old SVG elements
        iceGroup.querySelectorAll("*").forEach(el => {
          el.remove();
        });
      } else {
        // If ice layer element doesn't exist, create it
        select("#viewbox").insert("g", "#coastline").attr("id", "ice");
        select("#ice")
          .attr("opacity", null)
          .attr("fill", "#e8f0f6")
          .attr("stroke", "#e8f0f6")
          .attr("stroke-width", 1)
          .attr("filter", "url(#dropShadow05)");
      }
    }
  }

  if (isOlderThan("1.113.0")) {
    // v1.113.0 fixed issue with zone.cells getting rediculously long
    pack.zones.forEach(zone => {
      zone.cells = unique(zone.cells);
    });
  }

  if (isOlderThan("1.124.0")) {
    // v1.124.0 added goods, markets, deals and trade animation data
    select("#viewbox")
      .insert("g", "#emblems")
      .attr("id", "goods")
      .style("display", "none")
      .attr("stroke-width", "0.32")
      .attr("filter", "url(#dropShadow01)");
    select("#goods").append("g").attr("id", "goodsCells");
    select("#goods").append("g").attr("id", "goodsIcons").attr("data-circle", "1");
    select("#goods").append("g").attr("id", "goodsBurgs");
    select("#viewbox").insert("g", "#emblems").attr("id", "markets").attr("fill-opacity", "0").style("display", "none");
    select("#viewbox").insert("g", "#goods").attr("id", "tradeAnimation").style("display", "none");

    options.trade = { animation: TradeAnimation.getDefaultOptions() };

    for (const state of pack.states) {
      if (!state) continue;
      if (!state.i || state.removed) {
        if (state.i === 0) {
          state.salesTax = 0;
          state.pollTax = 0;
          state.treasury = 0;
        }
        continue;
      }
      const taxes = States.defineTaxRates(state);
      state.salesTax = taxes.salesTax;
      state.pollTax = taxes.pollTax;
      state.treasury = 0;
    }

    Goods.generate();
    Markets.generate();
    Production.produce();
    States.collectTaxes();
  }

  if (isOlderThan("1.127.0")) {
    // goods visibility moved onto the good itself; default to showing the first good
    if (pack.goods?.length && !pack.goods.some(good => good.visible)) pack.goods[0].visible = true;
  }

  if (isOlderThan("1.132.0")) {
    // v1.132.0 added global 3D view options
    options.threeD = { ...defaultOptions };
  }

  if (isOlderThan("1.138.0")) {
    // v1.138.0 migrated measurers from the global rulers string (data[33]) to pack.measurers
    const MEASURER_TYPES = ["Ruler", "Opisometer", "RouteOpisometer", "Planimeter"];
    const isMeasurerType = (type: string): type is MeasurerType => MEASURER_TYPES.includes(type);

    const parse = (serialized: string): Measurer[] => {
      const measurers: Measurer[] = [];
      for (const measurerString of serialized.split("; ")) {
        const [type, pointsString] = measurerString.split(": ");
        if (!type || !pointsString || !isMeasurerType(type)) continue;

        const points = pointsString.split(" ").map(pair => {
          const [x, y] = pair.split(",");
          return [+x, +y] as Point;
        });
        measurers.push({ type, points });
      }
      return measurers;
    };

    if (data[33]) pack.measurers = parse(data[33]);
  }

  if (isOlderThan("1.139.0")) {
    // fix for old issue with heightmap getting styles on top level
    const terrs = select("#terrs");
    if (terrs.attr("opacity") !== null || terrs.attr("filter") !== null || terrs.attr("scheme") !== null) {
      terrs
        .attr("opacity", null)
        .attr("filter", null)
        .attr("scheme", null)
        .attr("terracing", null)
        .attr("skip", null)
        .attr("relax", null)
        .attr("curve", null)
        .attr("mask", null);
    }
  }

  if (isOlderThan("1.140.0")) {
    // v1.140.0 migrated label data and styles to the unified flat Label Group model
    let labels = document.querySelector<SVGGElement>("#labels");
    if (!labels) {
      labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
      labels.setAttribute("id", "labels");
      document.querySelector("#viewbox")?.appendChild(labels);
    }
    labels.setAttribute("font-size", "100px");

    const hadVisibleLabels = getComputedStyle(labels).display !== "none";
    labels.style.removeProperty("display");

    const legacyStateMode = "stateLabelsMode" in options ? options.stateLabelsMode : undefined;
    const stateMode: LabelNameMode =
      legacyStateMode === "short" || legacyStateMode === "full" ? legacyStateMode : "auto";
    const settings = (data[1] || "").split("|");
    const autoVisibility = settings[21] ? Boolean(Number(settings[21])) : true;
    const resizeOnZoom = settings[23] ? Boolean(Number(settings[23])) : true;
    options.labels = { resizeOnZoom, showAll: !autoVisibility, groups: [] };
    styles.labels.groups = {};

    for (const type of ["river", "route"] as const) {
      options.labels.groups.push(Labels.getFallbackGroup(type));
      styles.labels.groups[type] = getGroupStyle({ name: type, type });
    }

    function legacyBurgLabelZoom(fontSize: number): { min: number; max: number } {
      if (!Number.isFinite(fontSize) || fontSize <= 0) return { min: 2, max: 30 };
      return { min: minmax(rn(12 / fontSize - 1, 1), 1, 5), max: minmax(rn(120 / fontSize - 1, 1), 25, 60) };
    }

    // old-era tier names map onto the modern tiers' visibility, so a migrated map's cities appear
    // at the same zooms a modern city does instead of inheriting formula noise from size dialects
    const LEGACY_BURG_GROUP_EQUIVALENTS: Record<string, string> = {
      cities: "city",
      towns: "town",
      town_small: "village",
      town_large: "town"
    };

    function legacyBurgGroupZoom(name: string, fontSize: number): { min: number | null; max: number | null } {
      const modernName = LEGACY_BURG_GROUP_EQUIVALENTS[name];
      const modern =
        modernName &&
        LabelsGenerator.getDefaultGroups().find(group => group.type === "burg" && group.name === modernName);
      return modern ? structuredClone(modern.zoom) : legacyBurgLabelZoom(fontSize);
    }

    const burgGroups = Array.from(document.querySelectorAll<SVGGElement>("#burgLabels > g"));
    for (const burgGroup of burgGroups) {
      const name = burgGroup.id;
      const oldStyle = deriveLabelsStyle(burgGroup);
      const zoom = legacyBurgGroupZoom(name, Number.parseFloat(oldStyle["font-size"] as string));

      options.labels.groups.push({ name, type: "burg", isDefault: name === "towns", zoom });
      styles.labels.groups[name] = labelGroupFromLegacy(oldStyle);
    }

    const migratedBurgStyle = burgGroups.length ? styles.labels.groups[burgGroups[0].id] : undefined;
    for (const { name } of options.burgs.groups) {
      if (options.labels.groups.some(group => group.name === name)) continue;

      const defaultGroup = Labels.getDefaultGroups().find(group => group.type === "burg" && group.name === name);
      const { zoom } = defaultGroup ?? Labels.getFallbackGroup("burg");
      options.labels.groups.push({ name, type: "burg", zoom });
      styles.labels.groups[name] = migratedBurgStyle
        ? structuredClone(migratedBurgStyle)
        : getGroupStyle({ name, type: "burg" });
    }

    if (options.labels.groups.every(group => !group.isDefault) && options.labels.groups[0])
      options.labels.groups[0].isDefault = true;

    // migrate manually shifted burg labels to pack.burgs[burgId].label
    for (const textEl of document.querySelectorAll<SVGTextElement>("#burgLabels > g > text")) {
      const burgId = +textEl.id.slice(9);
      const burg = pack.burgs[burgId];
      if (!burg) continue;

      const transform = textEl.getAttribute("transform");
      if (!transform) continue;
      const tr = parseTransform(transform);
      const dx = rn(tr[0], 1);
      const dy = rn(tr[1], 1);
      if (dx || dy) burg.label = { dx, dy };
    }

    const provs = document.querySelector<SVGGElement>("#provs");
    const provinceGroup = document.querySelector<SVGGElement>("#provs #provinceLabels");
    if (provs && provinceGroup) {
      const oldStyle = deriveLabelsStyle(provs);
      const fontSize = Number.parseFloat(oldStyle["font-size"] as string);

      options.labels.groups.push({
        name: "province",
        type: "province",
        isDefault: true,
        zoom: deriveZoomExtent(fontSize),
        layerDependency: "provinces",
        active: false
      });
      styles.labels.groups.province = labelGroupFromLegacy(oldStyle);
    } else {
      options.labels.groups.push(Labels.getFallbackGroup("province"));
      styles.labels.groups.province = getGroupStyle({ name: "province", type: "province" });
    }

    pack.addedLabels = [];
    const addedGroups = Array.from(labels.querySelectorAll<SVGGElement>(":scope > g:not(#states):not(#burgLabels)"));
    for (const addedGroup of addedGroups) {
      let name = addedGroup.id === "addedLabels" ? "added" : addedGroup.id;
      const isExisting = options.labels.groups.find(group => group.name === name);
      if (isExisting) name += options.labels.groups.length;

      const oldStyle = deriveLabelsStyle(addedGroup);
      const fontSize = Number.parseFloat(oldStyle["font-size"] as string);

      options.labels.groups.push({
        name,
        type: "added",
        isDefault: name === "added",
        zoom: deriveZoomExtent(fontSize)
      });
      styles.labels.groups[name] = labelGroupFromLegacy(oldStyle);

      for (const textEl of addedGroup.querySelectorAll<SVGTextElement>(":scope > text")) {
        const note = notes.find(note => note.id === textEl.id);

        const pathEl = document.getElementById(`textPath_${textEl.id}`) as SVGPathElement | null;
        if (!pathEl) continue;

        const label = getPathLabel({ textEl, pathEl });
        if (label?.text && label.pathPoints?.length) {
          const [x, y] = label.pathPoints[Math.floor(label.pathPoints.length / 2)];
          const addedLabel = AddedLabels.add({ x, y, label: { ...label, group: name } });
          if (note) note.id = `addedLabel${addedLabel.i}`;
        } else {
          if (note) notes = notes.filter(n => n.id !== note.id); // remove note
        }
      }
    }

    const stateGroup = labels.querySelector<SVGGElement>(":scope > #states");
    if (stateGroup) {
      const oldStyle = deriveLabelsStyle(stateGroup);
      const fontSize = Number.parseFloat(oldStyle["font-size"] as string);

      options.labels.groups.push({
        name: "state",
        type: "state",
        isDefault: true,
        zoom: deriveZoomExtent(fontSize),
        mode: stateMode
      });
      styles.labels.groups.state = labelGroupFromLegacy(oldStyle);
    } else {
      options.labels.groups.push({ ...Labels.getFallbackGroup("state"), mode: stateMode });
      styles.labels.groups.state = getGroupStyle({ name: "state", type: "state" });
    }

    for (const textEl of document.querySelectorAll<SVGTextElement>("#labels #states > text")) {
      const stateId = +textEl.id.slice(10);
      const state = pack.states[stateId];
      if (!state) continue;

      const pathEl = document.getElementById(`textPath_${textEl.id}`) as SVGPathElement | null;
      if (pathEl) state.label = getPathLabel({ textEl, pathEl, names: [state.name, state.fullName] });
    }

    delete (options as any).stateLabelsMode; // migrated to group settings

    function deriveLabelsStyle(groupEl: SVGGElement): Record<string, string | number | null> {
      return {
        opacity: groupEl.hasAttribute("opacity") ? Number(groupEl.getAttribute("opacity")) : 1,
        fill: groupEl.getAttribute("fill") || "#000000",
        stroke: groupEl.getAttribute("stroke") || "#000000",
        "stroke-width": Number(groupEl.getAttribute("stroke-width")) || 0,
        style: groupEl.getAttribute("style") || null,
        "letter-spacing": Number(groupEl.getAttribute("letter-spacing")) || 0,
        "font-size": `${Number(groupEl.dataset.size) || Number(groupEl.getAttribute("font-size")) || 18}%`,
        "font-family": groupEl.getAttribute("font-family") || "Almendra SC",
        filter: groupEl.getAttribute("filter") || null,
        "data-dx": Number(groupEl.dataset.dx) || 0,
        "data-dy": Number(groupEl.dataset.dy) || 0
      };
    }

    function deriveZoomExtent(fontSize: number) {
      return { min: rn(12 / fontSize - 1, 1), max: rn(120 / fontSize - 1, 1) };
    }

    function getPathLabel({
      textEl,
      pathEl,
      names
    }: {
      textEl: SVGTextElement;
      pathEl?: SVGPathElement;
      names?: (string | undefined)[];
    }) {
      const label: Label = {};
      const textPath = textEl.querySelector("textPath");
      const text = getMultilineText(textEl);
      if (text && !names?.includes(text)) label.text = text;

      const pathPoints = pathEl ? parsePathPoints(pathEl.getAttribute("d") || "") : null;
      if (pathPoints?.length) label.pathPoints = pathPoints;

      if (textPath) {
        const startOffset = Number.parseFloat(textPath.getAttribute("startOffset") || "");
        if (Number.isFinite(startOffset) && startOffset !== 50) label.startOffset = startOffset;
        const fontSize = Number.parseFloat(textPath.getAttribute("font-size") || "");
        if (Number.isFinite(fontSize) && fontSize !== 100) label.fontSize = fontSize;
        const letterSpacing = Number.parseFloat(textPath.getAttribute("letter-spacing") || "");
        if (letterSpacing && Number.isFinite(letterSpacing)) label.letterSpacing = letterSpacing;
      }

      const [dx, dy] = parseTransform(textEl.getAttribute("transform") || "");
      if (dx) label.dx = rn(dx, 1);
      if (dy) label.dy = rn(dy, 1);

      return Object.keys(label).length > 0 ? label : undefined;
    }

    function getMultilineText(textEl: SVGTextElement) {
      return (
        Array.from(textEl.querySelectorAll("tspan"))
          .map(tspan => tspan.textContent || "")
          .join("|") || textEl.textContent
      );
    }

    provinceGroup?.remove();
    document.getElementById("textPaths")?.replaceChildren();
    labels.replaceChildren();
    // record the state for the 1.144 migration to read: the content this wiped is redrawn by the load routine,
    // so an empty group must not be mistaken for a layer that was off
    labels.dataset.layerActive = String(hadVisibleLabels);

    // other changes
    select("#coastline > #sea_island").attr("filter", null);
  }

  if (isOlderThan("1.142.0")) {
    // v1.142.0 moved relief icons from the svg to pack.relief, rendered within the viewport only
    const terrainEl = document.getElementById("terrain");
    if (terrainEl) {
      // v1.142.0 moved the relief style from the #terrain attributes to the style store
      const set = terrainEl.getAttribute("set");
      styles.relief.options = {
        set: set && set in RELIEF_SETS ? (set as ReliefSet) : "simple",
        size: Number(terrainEl.getAttribute("size")) || 1,
        density: Number(terrainEl.getAttribute("density")) || 0.4
      };
      for (const attribute of ["set", "size", "density"]) terrainEl.removeAttribute(attribute);

      const iconElements = Array.from(terrainEl.querySelectorAll("use"));
      if (iconElements.length) {
        pack.relief = iconElements.map(useEl => ({
          icon: (useEl.getAttribute("href") || useEl.getAttribute("xlink:href") || "").replace("#", ""),
          x: rn(Number(useEl.getAttribute("x")), 2),
          y: rn(Number(useEl.getAttribute("y")), 2),
          s: rn(Number(useEl.getAttribute("width")), 2)
        }));
        terrainEl.replaceChildren();
      } else {
        terrainEl.style.display = "none";
      }
    }
  }

  if (isOlderThan("1.144.0")) {
    // v1.144.0 replaced the toggleLayer ids with layer ids
    const LAYER_ID_MAP: Record<string, LayerId> = {
      toggleTexture: "texture",
      toggleHeight: "heightmap",
      toggleLakes: "lakes",
      toggleBiomes: "biomes",
      toggleCells: "cells",
      toggleGrid: "grid",
      toggleCoordinates: "coordinates",
      toggleCompass: "compass",
      toggleRivers: "rivers",
      toggleRelief: "relief",
      toggleReligions: "religions",
      toggleCultures: "cultures",
      toggleStates: "states",
      toggleProvinces: "provinces",
      toggleZones: "zones",
      toggleBorders: "borders",
      toggleRoutes: "routes",
      toggleTemperature: "temperature",
      toggleIce: "ice",
      toggleGoods: "goods",
      toggleMarketsLayer: "markets",
      toggleTrade: "trade",
      togglePrecipitation: "precipitation",
      togglePopulation: "population",
      toggleEmblems: "emblems",
      toggleBurgIcons: "burgIcons",
      toggleLabels: "labels",
      toggleMilitary: "military",
      toggleMarkers: "markers",
      toggleRulers: "rulers",
      toggleScaleBar: "scaleBar",
      toggleVignette: "vignette"
    };
    for (const group of options.labels?.groups ?? []) {
      const layer = group.layerDependency && LAYER_ID_MAP[group.layerDependency];
      if (layer) group.layerDependency = layer;
    }

    const storedPresets: Record<string, string[]> | null = safeParseJSON(localStorage.getItem("presets") ?? "");
    if (storedPresets) {
      const remapped = Object.entries(storedPresets).map(([name, ids]) => [
        name,
        Array.isArray(ids) ? ids.map(id => LAYER_ID_MAP[id] ?? id) : ids
      ]);
      localStorage.setItem("presets", JSON.stringify(Object.fromEntries(remapped)));
    }

    // v1.144.0 made the compass rose a declared layer child, so it needs the id the registry looks up
    findEl("compass")?.querySelector("use")?.setAttribute("id", "compassRose");

    // v1.144.0 moved the layers state into data[50]
    data[50] = JSON.stringify(recoverLayersState());
    if (findEl("fog") && findEl("fogging")) unfog();

    function recoverLayersState(): LayersState {
      const foggingContainer = findEl("fogging-cont");
      const fogging = findEl("fogging");
      if (foggingContainer) foggingContainer.replaceWith(...(fogging ? [fogging] : []));

      // legacy maps can hide layers with the `display` presentation attribute
      for (const layer of Layers.all) {
        const el = findEl<SVGGElement>(layer.elementId);
        if (el?.getAttribute("display") !== "none") continue;
        el.removeAttribute("display");
        el.style.display = "none";
      }

      const filled = (id: string) => Boolean(findEl(id)?.hasChildNodes());
      const has = (id: string, selector: string) => Boolean(findEl(id)?.querySelector(selector));
      const shown = (id: string) => findEl(id) && findEl(id)?.style.display !== "none";
      const labelsGroup = findEl("labels");
      const labelsState = labelsGroup?.dataset.layerActive;
      delete labelsGroup?.dataset.layerActive; // read once: data[50] owns the state from here on

      const active = [
        has("texture", "image") && "texture",
        filled("landHeights") && "heightmap",
        shown("lakes") && "lakes",
        filled("biomes") && "biomes",
        filled("cells") && "cells",
        filled("gridOverlay") && "grid",
        filled("coordinates") && "coordinates",
        shown("compass") && has("compass", "use") && "compass",
        filled("rivers") && "rivers",
        shown("terrain") && "relief",
        filled("relig") && "religions",
        filled("cults") && "cultures",
        filled("statesBody") && "states",
        filled("provs") && "provinces",
        shown("zones") && filled("zones") && "zones",
        shown("borders") && has("borders", "path") && "borders",
        shown("routes") && has("routes", "path") && "routes",
        filled("temperature") && "temperature",
        shown("ice") && "ice",
        shown("goods") && filled("goods") && "goods",
        shown("markets") && filled("markets") && "markets",
        shown("tradeAnimation") && "trade",
        has("prec", "circle") && "precipitation",
        has("population", "line") && "population",
        shown("emblems") && has("emblems", "use") && "emblems",
        shown("icons") && "burgIcons",
        (labelsState ? labelsState === "true" : filled("labels")) && "labels",
        shown("armies") && filled("armies") && "military",
        has("markers", "svg") && "markers",
        shown("ruler") && "rulers",
        shown("scaleBar") && "scaleBar",
        shown("vignette") && "vignette"
      ].filter(Boolean) as string[];

      const positions = new Map(
        Array.from(ensureEl("map").querySelectorAll("#viewbox > *, #map > g"), (node, index) => [node.id, index])
      );
      const order = Layers.all
        .filter(layer => positions.has(layer.elementId))
        .sort((a, b) => positions.get(a.elementId)! - positions.get(b.elementId)!)
        .map(layer => layer.id);

      return { order, active };
    }
  }

  if (isOlderThan("1.145.0")) {
    // Old maps can have duplicate groups
    const groups = new Set<SVGGElement>();
    for (const layer of Layers.all) {
      for (const group of document.querySelectorAll<SVGGElement>(`#map g#${layer.elementId}`)) {
        groups.add(group);
        for (const child of group.querySelectorAll<SVGGElement>("g[id]")) groups.add(child);
      }
    }

    // scoped to the parent: same-named groups under different parents are by design
    // (#burgIcons > g#city beside #anchors > g#city), only same-parent copies are duplicates
    const groupsById = new Map<string, SVGGElement[]>();
    for (const group of groups) {
      const key = `${(group.parentNode as Element | null)?.id ?? ""}>${group.id}`;
      const sameId = groupsById.get(key) ?? [];
      sameId.push(group);
      groupsById.set(key, sameId);
    }

    const declared = new Set<string>();
    for (const layer of Layers.all) {
      declared.add(layer.elementId);
      for (const child of layer.children) declared.add(child.id);
    }

    const isEmpty = (group: SVGGElement) => group.childElementCount === 0;
    for (const sameId of groupsById.values()) {
      const keep = sameId.find(group => !isEmpty(group)) ?? (declared.has(sameId[0].id) ? sameId[0] : undefined);
      for (const group of sameId) {
        if (group !== keep) group.remove();
      }
    }
  }

  if (isOlderThan("1.146.0")) {
    // v1.146.0 renamed the feature group to subtype and reused group for the svg rendering
    for (const feature of pack.features) {
      if (!feature) continue;
      feature.subtype = feature.group;
      feature.group = Features.getDefaultGroup(feature);
    }

    // the placement stored in the svg wins over the derived group
    for (const use of Array.from(document.querySelectorAll("#coastline > g > use[data-f], #lakes > g > use[data-f]"))) {
      const feature = pack.features[Number(use.getAttribute("data-f"))];
      const group = (use.parentNode as SVGGElement).id;
      if (feature && group) feature.group = group;
    }

    // v1.146.0 preserves vertices dragged in the coastline and lake editors
    if (!data[51]) {
      const recovered = recoverMovedVertices();
      if (recovered) data[51] = JSON.stringify(recovered);
    }

    function recoverMovedVertices(): GraphOverrides | null {
      const FILL_LAYERS = ["statesBody", "provincesBody", "biomes", "cults", "relig"];
      const POINT = /-?[\d.]+(?:e-?\d+)?,-?[\d.]+(?:e-?\d+)?/g;

      const chains: string[][] = [];
      for (const layerId of FILL_LAYERS) {
        const paths = Array.from(findEl(layerId)?.querySelectorAll("path") || []);

        for (const path of paths) {
          if (path.getAttribute("fill") === "none") continue; // stroked gap paths are not full vertex chains

          for (const ring of (path.getAttribute("d") || "").split("Z")) {
            const chain = ring.match(POINT) || [];
            if (chain[chain.length - 1] === chain[0]) chain.pop(); // the ring is closed
            if (chain.length > 2) chains.push(chain);
          }
        }
      }
      if (!chains.length) return null; // no area layer was drawn, there is nothing to recover from

      const vertexByPoint = new Map<string, number>();
      pack.vertices.p.forEach((point, vertexId) => {
        vertexByPoint.set(String(point), vertexId);
      });

      const moved: Record<number, [Point, Point]> = {};
      let points = 0;
      let unresolved = 0;

      for (const chain of chains) {
        points += chain.length;
        unresolved += recoverChain(chain, vertexByPoint, moved);
      }

      if (!Object.keys(moved).length) return null;
      if (unresolved > points * 0.05) return null; // the svg does not match the graph, the result is not trustworthy

      INFO && console.info(`Recovered ${Object.keys(moved).length} moved vertices from the map svg`);
      return { pack: { vertices: { p: moved } } };
    }

    function distance([x1, y1]: Point, [x2, y2]: Point): number {
      return (x2 - x1) ** 2 + (y2 - y1) ** 2;
    }

    function recoverChain(
      chain: string[],
      vertexByPoint: Map<string, number>,
      moved: Record<number, [Point, Point]>
    ): number {
      const { vertices } = pack;
      const ids = chain.map(point => vertexByPoint.get(point) ?? null);
      const inChain = new Set(chain.filter((_, index) => ids[index] !== null));

      for (let resolved = true; resolved; ) {
        resolved = false;

        for (let index = 0; index < ids.length; index++) {
          if (ids[index] !== null) continue;

          const prev = ids[(index - 1 + ids.length) % ids.length];
          const next = ids[(index + 1) % ids.length];
          if (prev === null || next === null) continue;

          // the moved point is the vertex connecting its neighbors in the chain, and it's not there itself
          const candidates = vertices.v[prev].filter(
            vertexId => vertices.v[next].includes(vertexId) && !inChain.has(String(vertices.p[vertexId]))
          );
          if (!candidates.length) continue;

          const point = chain[index].split(",").map(Number) as Point;
          const vertexId = candidates.sort(
            (a, b) => distance(vertices.p[a], point) - distance(vertices.p[b], point)
          )[0];

          ids[index] = vertexId;
          inChain.add(chain[index]);
          moved[vertexId] = [vertices.p[vertexId], point];
          resolved = true;
        }
      }

      return ids.filter(vertexId => vertexId === null).length;
    }
  }

  if (isOlderThan("1.148.0")) {
    const DEFTEMP = /* html */ `<g id="deftemp">
      <g id="featurePaths"></g>
      <g id="textPaths"></g>
      <g id="statePaths"></g>
      <g id="defs-emblems"></g>
        <mask id="land"></mask>
        <mask id="water"></mask>
        <mask id="fog" style="stroke-width: 10; stroke: black; stroke-linejoin: round; stroke-opacity: 0.1">
          <rect x="0" y="0" width="100%" height="100%" fill="white" stroke="none"></rect>
        </mask>
      </g>
      <pattern id="oceanic" width="100" height="100" patternUnits="userSpaceOnUse">
        <image id="oceanicPattern" href="./images/pattern1.png" opacity="0.2"></image>
      </pattern>
      <mask id="vignette-mask">
        <rect x="0" y="0" width="100%" height="100%" fill="white"></rect>
        <rect id="vignette-rect" fill="black" x="0.3%" y="0.4%" width="99.4%" height="99.2%" rx="5%" ry="5%" filter="blur(20px)"></rect>
      </mask>
    `;

    restoreMissingDefTemp();
    function restoreMissingDefTemp(): void {
      const defs = document.querySelector<SVGDefsElement>("#map defs");
      if (!defs) return;
      const template = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${DEFTEMP}</svg>`,
        "image/svg+xml"
      ).documentElement;

      const restored: string[] = [];
      const restore = (node: Element, parent: Element) => {
        const existing = findEl(node.id);
        if (!existing) {
          parent.append(node.cloneNode(true));
          restored.push(node.id);
          return;
        }
        for (const child of Array.from(node.children)) if (child.id) restore(child, existing);
      };

      for (const node of Array.from(template.children)) restore(node, defs);
      if (restored.length) WARN && console.warn("[Auto-update] Restored missing svg defs:", restored.join(", "));
    }
  }

  if (isOlderThan("1.150.0")) {
    // v1.145-1.147 stripped the layer style from saved maps; the migration harvest reads what this re-seeds
    if (!isOlderThan("1.145.0") && isOlderThan("1.148.0")) await restoreStrippedLayerStyles();
    // v1.150.0 made the styles store the source of truth
    data[48] = await migrateStyles(data[48]);
  }
}
