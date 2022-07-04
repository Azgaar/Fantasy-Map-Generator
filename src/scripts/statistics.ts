import {INFO} from "config/logging";
import {heightmapTemplates} from "config/heightmap-templates";
import {locked} from "scripts/options/lock";
import {getInputValue} from "utils/nodeUtils";
import {byId} from "utils/shorthands";

// show map stats on generation complete
export function showStatistics() {
  const heightmap = getInputValue("templateInput");
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !locked("template") ? "random " : "";

  const stats = `  Seed: ${seed}
    Canvas size: ${graphWidth}x${graphHeight} px
    Heightmap: ${heightmap} (${isRandomTemplate}${heightmapType})
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${getInputValue("mapSizeOutput")}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${(byId("culturesSet") as HTMLSelectElement)?.selectedOptions[0].innerText}
    Cultures: ${pack.cultures.length - 1}`;

  mapId = Date.now(); // unique map id is it's creation date number
  mapHistory.push({seed, width: graphWidth, height: graphHeight, template: heightmap, created: mapId});
  INFO && console.log(stats);
}
