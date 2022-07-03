import {byId} from "utils/shorthands";
import {gauss, P} from "utils/probabilityUtils";
import {locked} from "scripts/options/lock";
import {rn} from "utils/numberUtils";

// define map size and position based on template and random factor
export function defineMapSize() {
  const [size, latitude] = getSizeAndLatitude();
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options
  if (randomize || !locked("mapSize")) mapSizeOutput.value = mapSizeInput.value = rn(size);
  if (randomize || !locked("latitude")) latitudeOutput.value = latitudeInput.value = rn(latitude);

  function getSizeAndLatitude() {
    const template = byId("templateInput").value; // heightmap template

    if (template === "africa-centric") return [45, 53];
    if (template === "arabia") return [20, 35];
    if (template === "atlantics") return [42, 23];
    if (template === "britain") return [7, 20];
    if (template === "caribbean") return [15, 40];
    if (template === "east-asia") return [11, 28];
    if (template === "eurasia") return [38, 19];
    if (template === "europe") return [20, 16];
    if (template === "europe-accented") return [14, 22];
    if (template === "europe-and-central-asia") return [25, 10];
    if (template === "europe-central") return [11, 22];
    if (template === "europe-north") return [7, 18];
    if (template === "greenland") return [22, 7];
    if (template === "hellenica") return [8, 27];
    if (template === "iceland") return [2, 15];
    if (template === "indian-ocean") return [45, 55];
    if (template === "mediterranean-sea") return [10, 29];
    if (template === "middle-east") return [8, 31];
    if (template === "north-america") return [37, 17];
    if (template === "us-centric") return [66, 27];
    if (template === "us-mainland") return [16, 30];
    if (template === "world") return [78, 27];
    if (template === "world-from-pacific") return [75, 32];

    const part = grid.features.some(f => f.land && f.border); // if land goes over map borders
    const max = part ? 80 : 100; // max size
    const lat = () => gauss(P(0.5) ? 40 : 60, 15, 25, 75); // latitude shift

    if (!part) {
      if (template === "Pangea") return [100, 50];
      if (template === "Shattered" && P(0.7)) return [100, 50];
      if (template === "Continents" && P(0.5)) return [100, 50];
      if (template === "Archipelago" && P(0.35)) return [100, 50];
      if (template === "High Island" && P(0.25)) return [100, 50];
      if (template === "Low Island" && P(0.1)) return [100, 50];
    }

    if (template === "Pangea") return [gauss(70, 20, 30, max), lat()];
    if (template === "Volcano") return [gauss(20, 20, 10, max), lat()];
    if (template === "Mediterranean") return [gauss(25, 30, 15, 80), lat()];
    if (template === "Peninsula") return [gauss(15, 15, 5, 80), lat()];
    if (template === "Isthmus") return [gauss(15, 20, 3, 80), lat()];
    if (template === "Atoll") return [gauss(5, 10, 2, max), lat()];

    return [gauss(30, 20, 15, max), lat()]; // Continents, Archipelago, High Island, Low Island
  }
}

// calculate map position on globe
export function calculateMapCoordinates() {
  const size = +byId("mapSizeOutput").value;
  const latShift = +byId("latitudeOutput").value;

  const latT = rn((size / 100) * 180, 1);
  const latN = rn(90 - ((180 - latT) * latShift) / 100, 1);
  const latS = rn(latN - latT, 1);

  const lon = rn(Math.min(((graphWidth / graphHeight) * latT) / 2, 180));
  return {latT, latN, latS, lonT: lon * 2, lonW: -lon, lonE: lon};
}
