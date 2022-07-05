import * as d3 from "d3";

import {ERROR, WARN} from "config/logging";
import {generateMapOnLoad} from "./generation";
import {loadMapFromURL} from "modules/io/load";
import {restoreDefaultEvents} from "scripts/events";

export function checkIfServerless() {
  document.on("DOMContentLoaded", async () => {
    if (!location.hostname) {
      const wiki = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally";
      alertMessage.innerHTML = `Fantasy Map Generator cannot run serverless. Follow the <a href="${wiki}" target="_blank">instructions</a> on how you can
        easily run a local web-server`;

      $("#alert").dialog({
        resizable: false,
        title: "Loading error",
        width: "28em",
        position: {my: "center center-4em", at: "center", of: "svg"},
        buttons: {
          OK: function () {
            $(this).dialog("close");
          }
        }
      });
    } else {
      hideLoading();
      await checkLoadParameters();
    }
    restoreDefaultEvents(); // apply default viewbox events
  });
}

// decide which map should be loaded or generated on page load
async function checkLoadParameters() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  // of there is a valid maplink, try to load .map file from URL
  if (params.get("maplink")) {
    WARN && console.warn("Load map from URL");
    const maplink = params.get("maplink");
    const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    const valid = pattern.test(maplink);
    if (valid) {
      setTimeout(() => {
        loadMapFromURL(maplink, 1);
      }, 1000);
      return;
    } else showUploadErrorMessage("Map link is not a valid URL", maplink);
  }

  // if there is a seed (user of MFCG provided), generate map for it
  if (params.get("seed")) {
    WARN && console.warn("Generate map for seed");
    await generateMapOnLoad();
    return;
  }

  // open latest map if option is active and map is stored
  const loadLastMap = () =>
    new Promise((resolve, reject) => {
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

  if (onloadMap.value === "saved") {
    try {
      await loadLastMap();
    } catch (error) {
      ERROR && console.error(error);
      WARN && console.warn("Cannot load stored map, random map to be generated");
      await generateMapOnLoad();
    }
  } else {
    WARN && console.warn("Generate random map");
    await generateMapOnLoad();
  }
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
