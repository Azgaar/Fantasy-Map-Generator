import {heightmapTemplates} from "config/heightmap-templates";
import {precreatedHeightmaps} from "config/precreated-heightmaps";
import {locked} from "scripts/options/lock";
import {getInputNumber, getInputValue, setInputValue} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
import {gauss, P} from "utils/probabilityUtils";

// define map size and position based on template and random factor
export function defineMapSize(touchesEdges: boolean) {
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options
  if (!randomize && locked("mapSize") && locked("mapLatitude")) return;

  const [size, latitude] = getSizeAndLatitude(touchesEdges);

  if (!locked("mapSize")) {
    setInputValue("mapSizeOutput", size);
    setInputValue("mapSizeInput", size);
  }

  if (!locked("latitude")) {
    setInputValue("latitudeOutput", latitude);
    setInputValue("latitudeInput", latitude);
  }
}

function getSizeAndLatitude(touchesEdges: boolean) {
  const heightmap = getInputValue("templateInput"); // heightmap template
  if (heightmap in precreatedHeightmaps) {
    const {size, latitude} = precreatedHeightmaps[heightmap];
    return [size, latitude];
  }

  if (heightmap in heightmapTemplates) {
    const {coversGlobe, size} = heightmapTemplates[heightmap];
    if (!touchesEdges && P(coversGlobe)) return [100, 50]; // whole globe

    const {expected, deviation, min, max = touchesEdges ? 80 : 100} = size;
    const mapSize = gauss(expected, deviation, min, max);
    const latitude = gauss(P(0.5) ? 40 : 60, 15, 25, 75, 0); // latitude shift
    return [mapSize, latitude];
  }

  return [100, 50]; // exception
}

// calculate map position on globe
export function calculateMapCoordinates() {
  const size = getInputNumber("mapSizeOutput");
  const latShift = getInputNumber("latitudeOutput");

  const latT = rn((size / 100) * 180, 1);
  const latN = rn(90 - ((180 - latT) * latShift) / 100, 1);
  const latS = rn(latN - latT, 1);

  const lon = rn(Math.min(((graphWidth / graphHeight) * latT) / 2, 180));
  return {latT, latN, latS, lonT: lon * 2, lonW: -lon, lonE: lon};
}
