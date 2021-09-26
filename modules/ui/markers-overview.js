"use strict";
function overviewMarkers() {
  if (customization) return;
  closeDialogs("#markersOverview, .stable");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();

  const body = document.getElementById("markersBody");
  const markersFooterNumber = document.getElementById("markersFooterNumber");
  const markersOverviewRefresh = document.getElementById("markersOverviewRefresh");
  const markersAddFromOverview = document.getElementById("markersAddFromOverview");
  const markersGenerationConfig = document.getElementById("markersGenerationConfig");
  const markersRemoveAll = document.getElementById("markersRemoveAll");

  addLines();

  $("#markersOverview").dialog({
    title: "Markers Overview",
    resizable: false,
    width: fitContent(),
    close: close,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  const listeners = [
    listen(markersOverviewRefresh, "click", addLines),
    listen(markersAddFromOverview, "click", () => {}),
    listen(markersGenerationConfig, "click", configMarkersGeneration),
    listen(markersRemoveAll, "click", triggerRemoveAll)
  ];

  function addLines() {
    const lines = pack.markers
      .map(({i, type, icon, lock}) => {
        return `<div class="states" data-id=${i} data-type="${type}">
        <div data-tip="Marker icon and type" style="width:12em">${icon} ${type}</div>
        <span data-tip="Edit marker" class="icon-pencil"></span>
        <span class="locks pointer ${lock ? "icon-lock" : "icon-lock-open inactive"}" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="Remove marker" class="icon-trash-empty"></span>
      </div>`;
      })
      .join("");

    body.innerHTML = lines;
    markersFooterNumber.innerText = pack.markers.length;

    applySorting(markersHeader);
  }

  function highlightMarkerOn(event) {
    if (!layerIsOn("toggleLabels")) toggleLabels();
    // burgLabels.select("[data-id='" + burg + "']").classed("drag", true);
  }

  function highlightMarkerOff() {
    // burgLabels.selectAll("text.drag").classed("drag", false);
  }

  function zoomInto() {
    const burg = +this.parentNode.dataset.id;
    const label = document.querySelector("#burgLabels [data-id='" + burg + "']");
    const x = +label.getAttribute("x"),
      y = +label.getAttribute("y");
    zoomTo(x, y, 8, 2000);
  }

  function toggleLockStatus() {
    const burg = +this.parentNode.dataset.id;
    toggleBurgLock(burg);
    if (this.classList.contains("icon-lock")) {
      this.classList.remove("icon-lock");
      this.classList.add("icon-lock-open");
      this.classList.add("inactive");
    } else {
      this.classList.remove("icon-lock-open");
      this.classList.add("icon-lock");
      this.classList.remove("inactive");
    }
  }

  function openEditor() {
    const burg = +this.parentNode.dataset.id;
    editBurg(burg);
  }

  function triggerRemove(i) {
    confirmationDialog({
      title: "Remove marker",
      message: "Are you sure you want to remove this marker? The action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => removeMarker(i)
    });
  }

  function removeMarker(i) {
    notes = notes.filter(note => note.id !== `marker${i}`);
    pack.markers = pack.markers.filter(marker => marker.i !== i);
    document.getElementById(`marker${i}`)?.remove();
  }

  function triggerRemoveAll() {
    confirmationDialog({
      title: "Remove all markers",
      message: "Are you sure you want to remove all non-locked markers? The action cannot be reverted",
      confirm: "Remove all",
      onConfirm: removeAllMarkers
    });
  }

  function removeAllMarkers() {
    pack.markers = pack.markers.filter(({i, lock}) => {
      if (lock) return true;

      const id = `marker${i}`;
      document.getElementById(id)?.remove();
      notes = notes.filter(note => note.id !== id);
      return false;
    });

    addLines();
  }

  function close() {
    listeners.forEach(removeListener => removeListener());

    addMarker.classList.remove("pressed");
    markerAdd.classList.remove("pressed");
    restoreDefaultEvents();
    clearMainTip();
  }
}
