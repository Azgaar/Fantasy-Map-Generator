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
    title: "Rivers Overview", resizable: false, width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("riversOverviewRefresh").addEventListener("click", riversOverviewAddLines);
  document.getElementById("addNewRiver").addEventListener("click", toggleAddRiver);
  document.getElementById("riversBasinHighlight").addEventListener("click", toggleBasinsHightlight);
  document.getElementById("riversExport").addEventListener("click", downloadRiversData);
  document.getElementById("riversRemoveAll").addEventListener("click", triggerAllRiversRemove);

  // add line for each river
  function riversOverviewAddLines() {
    body.innerHTML = "";
    let lines = "";

    for (const r of pack.rivers) {
      const length = rn(r.length * distanceScaleInput.value) + " " + distanceUnitInput.value;
      const basin = pack.rivers.find(river => river.i === r.basin).name;

      lines += `<div class="states" data-id=${r.i} data-name="${r.name}" data-type="${r.type}" data-length="${r.length}" data-basin="${basin}">
        <span data-tip="Click to focus on river" class="icon-dot-circled pointer"></span>
        <input data-tip="River proper name. Click to change. Ctrl + click to regenerate" class="riverName" value="${r.name}" autocorrect="off" spellcheck="false">
        <input data-tip="River type name. Click to change" class="riverType" value="${r.type}">
        <div data-tip="River length" class="biomeArea">${length}</div>
        <input data-tip="River basin (name of the main stem)" class="stateName" value="${basin}" disabled>
        <span data-tip="Edit river" class="icon-pencil"></span>
        <span data-tip="Remove river" class="icon-trash-empty"></span>
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);

    // update footer
    riversFooterNumber.innerHTML = pack.rivers.length;
    const averageLength = rn(d3.sum(pack.rivers.map(r => r.length)) / pack.rivers.length);
    riversFooterLength.innerHTML = (averageLength * distanceScaleInput.value) + " " + distanceUnitInput.value;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => riverHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => riverHighlightOff(ev)));
    body.querySelectorAll("div > input.riverName").forEach(el => el.addEventListener("input", changeRiverName));
    body.querySelectorAll("div > input.riverName").forEach(el => el.addEventListener("click", regenerateRiverName));
    body.querySelectorAll("div > input.riverType").forEach(el => el.addEventListener("input", changeRiverType));
    body.querySelectorAll("div > span.icon-dot-circled").forEach(el => el.addEventListener("click", zoomToRiver));
    body.querySelectorAll("div > span.icon-pencil").forEach(el => el.addEventListener("click", openRiverEditor));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", triggerRiverRemove));

    applySorting(riversHeader);
  }

  function riverHighlightOn(event) {
    if (!layerIsOn("toggleRivers")) toggleRivers();
    const r = +event.target.dataset.id;
    rivers.select("#river"+r).attr("stroke", "red").attr("stroke-width", 1);
  }

  function riverHighlightOff() {
    const r = +event.target.dataset.id;
    rivers.select("#river"+r).attr("stroke", null).attr("stroke-width", null);
  }

  function changeRiverName() {
    if (this.value == "") tip("Please provide a proper name", false, "error");
    const river = +this.parentNode.dataset.id;
    pack.rivers.find(r => r.i === river).name = this.value;
    this.parentNode.dataset.name = this.value;
  }

  function regenerateRiverName(event) {
    if (!isCtrlClick(event)) return;
    const river = +this.parentNode.dataset.id;
    const r = pack.rivers.find(r => r.i === river);
    r.name = this.value = this.parentNode.dataset.name = Rivers.getName(r.mouth);
  }

  function changeRiverType() {
    if (this.value == "") tip("Please provide a type name", false, "error");
    const river = +this.parentNode.dataset.id;
    pack.rivers.find(r => r.i === river).type = this.value;
    this.parentNode.dataset.type = this.value;
  }

  function zoomToRiver() {
    const r = +this.parentNode.dataset.id;
    const river = rivers.select("#river"+r).node();
    highlightElement(river);
  }

  function toggleBasinsHightlight() {
    if (rivers.attr("data-basin") === "hightlighted") {
      rivers.selectAll("*").attr("fill", null);
      rivers.attr("data-basin", null);
    } else {
      rivers.attr("data-basin", "hightlighted");
      const basins = [...(new Set(pack.rivers.map(r=>r.basin)))];
      const colors = getColors(basins.length);
  
      basins.forEach((b,i) => {
        pack.rivers.filter(r => r.basin === b).forEach(r => {
          rivers.select("#river"+r.i).attr("fill", colors[i]);
        });
      });
    }
  }

  function downloadRiversData() {
    let data = "Id,River,Type,Length,Basin\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.type + ",";
      data += el.querySelector(".biomeArea").innerHTML + ",";
      data += el.dataset.basin + "\n";
    });

    const name = getFileName("Rivers") + ".csv";
    downloadFile(data, name);
  }

  function openRiverEditor() {
    editRiver("river"+this.parentNode.dataset.id);
  }

  function triggerRiverRemove() {
    const river = +this.parentNode.dataset.id;
    alertMessage.innerHTML = `Are you sure you want to remove the river? 
      All tributaries will be auto-removed`;

    $("#alert").dialog({resizable: false, width: "22em", title: "Remove river",
      buttons: {
        Remove: function() {
          Rivers.remove(river);
          riversOverviewAddLines();
          $(this).dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function triggerAllRiversRemove() {
    alertMessage.innerHTML = `Are you sure you want to remove all rivers?`;
    $("#alert").dialog({resizable: false, title: "Remove all rivers",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          removeAllRivers();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function removeAllRivers() {
    pack.rivers = [];
    rivers.selectAll("*").remove();
    riversOverviewAddLines();
  }

}
