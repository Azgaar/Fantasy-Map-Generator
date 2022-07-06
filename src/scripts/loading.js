import * as d3 from "d3";

import {ERROR, WARN} from "config/logging";
import {loadMapFromURL} from "modules/io/load";
import {restoreDefaultEvents} from "scripts/events";
import {ldb} from "scripts/indexedDB";
import {getInputValue} from "utils/nodeUtils";
import {generateMapOnLoad} from "./generation";

export function addOnLoadListener() {
  document.on("DOMContentLoaded", async () => {
    await loadOrGenerateMap();
    hideLoading();
    restoreDefaultEvents();
  });
}

// decide which map should be loaded or generated on page load
async function loadOrGenerateMap() {
  const {searchParams} = new URL(window.location.href);
  const maplink = searchParams.get("maplink");
  const seed = searchParams.get("seed");

  // of there is a valid maplink, try to load .map file from URL
  if (maplink) {
    WARN && console.warn("Load map from URL");
    const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    const isValidUrl = pattern.test(maplink);

    if (!isValidUrl) return showUploadErrorMessage("Map link is not a valid URL", maplink);

    setTimeout(() => {
      loadMapFromURL(maplink, 1);
    }, 1000);
  }

  // if there is a seed (user of MFCG provided), generate map for it
  if (seed) {
    WARN && console.warn("Generate map for seed");
    await generateMapOnLoad();
    return;
  }

  if (getInputValue("onloadMap") === "saved") {
    try {
      await loadLastMap();
      return;
    } catch (error) {
      ERROR && console.error("Cannot load stored map, random map to be generated", error);
    }
  }

  WARN && console.warn("Generate random map");
  await generateMapOnLoad();
}

export function hideLoading() {
  d3.select("#loading").transition().duration(3000).style("opacity", 0);
  d3.select("#optionsContainer").transition().duration(2000).style("opacity", 1);
  d3.select("#tooltip").transition().duration(3000).style("opacity", 1);
}

export function showLoading() {
  d3.select("#loading").transition().duration(200).style("opacity", 1);
  d3.select("#optionsContainer").transition().duration(100).style("opacity", 0);
  d3.select("#tooltip").transition().duration(200).style("opacity", 0);
}

// open latest map if option is active and map is stored
function loadLastMap() {
  return new Promise((resolve, reject) => {
    ldb.get("lastMap", blob => {
      if (blob) {
        WARN && console.warn("Load last saved map");
        try {
          uploadMap(blob);
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        reject("No map stored");
      }
    });
  });
}
