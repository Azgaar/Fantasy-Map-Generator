"use strict";

function overviewRivers() {
  if (customization) return;
  closeDialogs("#riversOverview, .stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  const body = document.getElementById("riversBody");
  riversOverviewAddLines();
  $("#riversOverview").dialog();

  if (modules.overviewRivers) return;
  modules.overviewRivers = true;

  $("#riversOverview").dialog({
    title: "Rivers Overview",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("riversOverviewRefresh").addEventListener("click", riversOverviewAddLines);
  document.getElementById("addNewRiver").addEventListener("click", toggleAddRiver);
  document.getElementById("riverCreateNew").addEventListener("click", createRiver);
  document.getElementById("riversBasinHighlight").addEventListener("click", toggleBasinsHightlight);
  document.getElementById("riversExport").addEventListener("click", downloadRiversData);
  document.getElementById("riversRemoveAll").addEventListener("click", triggerAllRiversRemove);
  document.getElementById("loadriverfromSavedMap").addEventListener("click", showLoadRiverPane);

  // add line for each river
  function riversOverviewAddLines() {
    body.innerHTML = "";
    let lines = "";
    const unit = distanceUnitInput.value;

    for (const r of pack.rivers) {
      const discharge = r.discharge + " m³/s";
      const length = rn(r.length * distanceScale) + " " + unit;
      const width = rn(r.width * distanceScale, 3) + " " + unit;
      const basin = pack.rivers.find(river => river.i === r.basin)?.name;

      lines += /* html */ `<div
        class="states"
        data-id=${r.i}
        data-name="${r.name}"
        data-type="${r.type}"
        data-discharge="${r.discharge}"
        data-length="${r.length}"
        data-width="${r.width}"
        data-basin="${basin}"
      >
        <span data-tip="Click to focus on river" class="icon-dot-circled pointer"></span>
        <div data-tip="River name" style="margin-left: 0.4em;" class="riverName">${r.name}</div>
        <div data-tip="River type name" class="riverType">${r.type}</div>
        <div data-tip="River discharge (flux power)" class="biomeArea">${discharge}</div>
        <div data-tip="River length from source to mouth" class="biomeArea">${length}</div>
        <div data-tip="River mouth width" class="biomeArea">${width}</div>
        <input data-tip="River basin (name of the main stem)" class="stateName" value="${basin}" disabled />
        <span data-tip="Edit river" class="icon-pencil"></span>
        <span data-tip="Remove river" class="icon-trash-empty"></span>
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);

    // update footer
    riversFooterNumber.innerHTML = pack.rivers.length;
    const averageDischarge = rn(d3.mean(pack.rivers.map(r => r.discharge)));
    riversFooterDischarge.innerHTML = averageDischarge + " m³/s";
    const averageLength = rn(d3.mean(pack.rivers.map(r => r.length)));
    riversFooterLength.innerHTML = averageLength * distanceScale + " " + unit;
    const averageWidth = rn(d3.mean(pack.rivers.map(r => r.width)), 3);
    riversFooterWidth.innerHTML = rn(averageWidth * distanceScale, 3) + " " + unit;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => riverHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => riverHighlightOff(ev)));
    body.querySelectorAll("div > span.icon-dot-circled").forEach(el => el.addEventListener("click", zoomToRiver));
    body.querySelectorAll("div > span.icon-pencil").forEach(el => el.addEventListener("click", openRiverEditor));
    body
      .querySelectorAll("div > span.icon-trash-empty")
      .forEach(el => el.addEventListener("click", triggerRiverRemove));

    applySorting(riversHeader);
  }

  function riverHighlightOn(event) {
    if (!layerIsOn("toggleRivers")) toggleRivers();
    const r = +event.target.dataset.id;
    rivers
      .select("#river" + r)
      .attr("stroke", "red")
      .attr("stroke-width", 1);
  }

  function riverHighlightOff(e) {
    const r = +e.target.dataset.id;
    rivers
      .select("#river" + r)
      .attr("stroke", null)
      .attr("stroke-width", null);
  }

  function zoomToRiver() {
    const r = +this.parentNode.dataset.id;
    const river = rivers.select("#river" + r).node();
    highlightElement(river, 3);
  }

  function toggleBasinsHightlight() {
    if (rivers.attr("data-basin") === "hightlighted") {
      rivers.selectAll("*").attr("fill", null);
      rivers.attr("data-basin", null);
    } else {
      rivers.attr("data-basin", "hightlighted");
      const basins = [...new Set(pack.rivers.map(r => r.basin))];
      const colors = [
        "#1f77b4",
        "#ff7f0e",
        "#2ca02c",
        "#d62728",
        "#9467bd",
        "#8c564b",
        "#e377c2",
        "#7f7f7f",
        "#bcbd22",
        "#17becf"
      ];

      basins.forEach((b, i) => {
        const color = colors[i % colors.length];
        pack.rivers
          .filter(r => r.basin === b)
          .forEach(r => {
            rivers.select("#river" + r.i).attr("fill", color);
          });
      });
    }
  }

  function downloadRiversData() {
    let data = "Id,River,Type,Discharge,Length,Width,Basin\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      const d = el.dataset;
      const discharge = d.discharge + " m³/s";
      const length = rn(d.length * distanceScale) + " " + distanceUnitInput.value;
      const width = rn(d.width * distanceScale, 3) + " " + distanceUnitInput.value;
      data += [d.id, d.name, d.type, discharge, length, width, d.basin].join(",") + "\n";
    });

    const name = getFileName("Rivers") + ".csv";
    downloadFile(data, name);
  }

  function openRiverEditor() {
    const id = "river" + this.parentNode.dataset.id;
    editRiver(id);
  }

  function triggerRiverRemove() {
    const river = +this.parentNode.dataset.id;
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove the river? All tributaries will be auto-removed`;

    $("#alert").dialog({
      resizable: false,
      width: "22em",
      title: "Remove river",
      buttons: {
        Remove: function () {
          Rivers.remove(river);
          riversOverviewAddLines();
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function triggerAllRiversRemove() {
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove all rivers?`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove all rivers",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          removeAllRivers();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function removeAllRivers() {
    pack.rivers = [];
    pack.cells.r = new Uint16Array(pack.cells.i.length);
    rivers.selectAll("*").remove();
    riversOverviewAddLines();
  }
  

async function showLoadRiverPane() {
  $("#loadRiverMapData").dialog({
    title: "Load River from saved map",
    resizable: false,
    width: "auto",
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });

  // already connected to Dropbox: list saved maps
  if (Cloud.providers.dropbox.api) {
    byId("dropboxConnectButton").style.display = "none";
    byId("loadRiverFromDropboxSelect").style.display = "block";
    const loadRiverFromDropboxButtons = byId("loadRiverFromDropboxButtons");
    const fileSelect = byId("loadRiverFromDropboxSelect");
    fileSelect.innerHTML = /* html */ `<option value="" disabled selected>Loading...</option>`;

    const files = await Cloud.providers.dropbox.list();

    if (!files) {
      loadRiverFromDropboxButtons.style.display = "none";
      fileSelect.innerHTML = /* html */ `<option value="" disabled selected>Save files to Dropbox first</option>`;
      return;
    }

    loadRiverFromDropboxButtons.style.display = "block";
    fileSelect.innerHTML = "";
    files.forEach(({name, updated, size, path}) => {
      const sizeMB = rn(size / 1024 / 1024, 2) + " MB";
      const updatedOn = new Date(updated).toLocaleDateString();
      const nameFormatted = `${updatedOn}: ${name} [${sizeMB}]`;
      const option = new Option(nameFormatted, path);
      fileSelect.options.add(option);
    });

    return;
  }

  // not connected to Dropbox: show connect button
  byId("dropboxConnectButton").style.display = "inline-block";
  byId("loadRiverFromDropboxButtons").style.display = "none";
  byId("loadRiverFromDropboxSelect").style.display = "none";
}



function loadRiverURL() {
  const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  const inner = `Provide URL to map file:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map">
    <br><i>Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to Dropbox and provide a direct link</i>`;
  alertMessage.innerHTML = inner;
  $("#alert").dialog({
    resizable: false,
    title: "Load map from URL",
    width: "27em",
    buttons: {
      Load: function () {
        const value = mapURL.value;
        if (!pattern.test(value)) {
          tip("Please provide a valid URL", false, "error");
          return;
        }
        loadMapFromURL(value);
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

// load map
byId("mapRiverToLoad").addEventListener("change", function () {
  const fileToLoad = this.files[0];
  this.value = "";
  closeDialogs();
  uploadRiversMap(fileToLoad);
});

}
