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
    listen(body, "click", handleLineClick),
    listen(markersOverviewRefresh, "click", addLines),
    listen(markersAddFromOverview, "click", toggleAddMarker),
    listen(markersGenerationConfig, "click", configMarkersGeneration),
    listen(markersRemoveAll, "click", triggerRemoveAll)
  ];

  function handleLineClick(ev) {
    const el = ev.target;
    const i = +el.parentNode.dataset.i;

    if (el.classList.contains("icon-pencil")) return openEditor(i);
    if (el.classList.contains("locks")) return toggleLockStatus(el, i);
    if (el.classList.contains("icon-trash-empty")) return triggerRemove(i);
  }

  function addLines() {
    const lines = pack.markers
      .map(({i, type, icon, lock}) => {
        return `<div class="states" data-i=${i} data-type="${type}">
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

  function openEditor(i) {
    const marker = pack.markers.find(marker => marker.i === i);
    if (!marker) return;

    const {x, y} = marker;
    zoomTo(x, y, 8, 2000);
    editMarker(i);
  }

  function highlightMarkerOn(event) {
    if (!layerIsOn("toggleLabels")) toggleLabels();
    // burgLabels.select("[data-id='" + burg + "']").classed("drag", true);
  }

  function highlightMarkerOff() {
    // burgLabels.selectAll("text.drag").classed("drag", false);
  }

  function toggleLockStatus(el, i) {
    const marker = pack.markers.find(marker => marker.i === i);
    if (marker.lock) {
      delete marker.lock;
      el.className = "locks pointer icon-lock-open inactive";
    } else {
      marker.lock = true;
      el.className = "locks pointer icon-lock";
    }
  }

  function triggerRemove(i) {
    confirmationDialog({
      title: "Remove marker",
      message: "Are you sure you want to remove this marker? The action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => removeMarker(i)
    });
  }

  function toggleAddMarker() {
    markersAddFromOverview.classList.toggle("pressed");
    addMarker.click();
  }

  function removeMarker(i) {
    notes = notes.filter(note => note.id !== `marker${i}`);
    pack.markers = pack.markers.filter(marker => marker.i !== i);
    document.getElementById(`marker${i}`)?.remove();
    addLines();
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
