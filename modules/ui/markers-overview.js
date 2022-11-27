"use strict";
function overviewMarkers() {
  if (customization) return;
  closeDialogs("#markersOverview, .stable");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();

  const markerGroup = document.getElementById("markers");
  const body = document.getElementById("markersBody");
  const markersInverPin = document.getElementById("markersInverPin");
  const markersInverLock = document.getElementById("markersInverLock");
  const markersFooterNumber = document.getElementById("markersFooterNumber");
  const markersOverviewRefresh = document.getElementById("markersOverviewRefresh");
  const markersAddFromOverview = document.getElementById("markersAddFromOverview");
  const markersGenerationConfig = document.getElementById("markersGenerationConfig");
  const markersRemoveAll = document.getElementById("markersRemoveAll");
  const markersExport = document.getElementById("markersExport");

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
    listen(markersInverPin, "click", invertPin),
    listen(markersInverLock, "click", invertLock),
    listen(markersOverviewRefresh, "click", addLines),
    listen(markersAddFromOverview, "click", toggleAddMarker),
    listen(markersGenerationConfig, "click", configMarkersGeneration),
    listen(markersRemoveAll, "click", triggerRemoveAll),
    listen(markersExport, "click", exportMarkers)
  ];

  function handleLineClick(ev) {
    const el = ev.target;
    const i = +el.parentNode.dataset.i;

    if (el.classList.contains("icon-pencil")) return openEditor(i);
    if (el.classList.contains("icon-dot-circled")) return focusOnMarker(i);
    if (el.classList.contains("icon-pin")) return pinMarker(el, i);
    if (el.classList.contains("locks")) return toggleLockStatus(el, i);
    if (el.classList.contains("icon-trash-empty")) return triggerRemove(i);
  }

  function addLines() {
    const lines = pack.markers
      .map(({i, type, icon, pinned, lock}) => {
        return `<div class="states" data-i=${i} data-type="${type}">
        <div data-tip="Marker icon and type" style="width:12em">${icon} ${type}</div>
        <span style="padding-right:.1em" data-tip="Edit marker" class="icon-pencil"></span>
        <span style="padding-right:.1em" data-tip="Focus on marker position" class="icon-dot-circled pointer"></span>
        <span style="padding-right:.1em" data-tip="Pin marker (display only pinned markers)" class="icon-pin ${pinned ? "" : "inactive"}" pointer"></span>
        <span style="padding-right:.1em" class="locks pointer ${lock ? "icon-lock" : "icon-lock-open inactive"}" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="Remove marker" class="icon-trash-empty"></span>
      </div>`;
      })
      .join("");

    body.innerHTML = lines;
    markersFooterNumber.innerText = pack.markers.length;

    applySorting(markersHeader);
  }

  function invertPin() {
    let anyPinned = false;

    pack.markers.forEach(marker => {
      const pinned = !marker.pinned;
      if (pinned) {
        marker.pinned = true;
        anyPinned = true;
      } else delete marker.pinned;
    });

    markerGroup.setAttribute("pinned", anyPinned ? 1 : null);
    drawMarkers();
    addLines();
  }

  function invertLock() {
    pack.markers = pack.markers.map(marker => ({...marker, lock: !marker.lock}));
    addLines();
  }

  function openEditor(i) {
    const marker = pack.markers.find(marker => marker.i === i);
    if (!marker) return;

    const {x, y} = marker;
    zoomTo(x, y, 8, 2000);
    editMarker(i);
  }

  function focusOnMarker(i) {
    highlightElement(document.getElementById(`marker${i}`), 2);
  }

  function pinMarker(el, i) {
    const marker = pack.markers.find(marker => marker.i === i);
    if (marker.pinned) {
      delete marker.pinned;
      const anyPinned = pack.markers.some(marker => marker.pinned);
      if (!anyPinned) markerGroup.removeAttribute("pinned");
    } else {
      marker.pinned = true;
      markerGroup.setAttribute("pinned", 1);
    }
    el.classList.toggle("inactive");
    drawMarkers();
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

  function exportMarkers() {
    const headers = "Id,Type,Icon,Name,Note,X,Y\n";
    const quote = s => '"' + s.replaceAll('"', '""') + '"';

    const body = pack.markers.map(marker => {
      const {i, type, icon, x, y} = marker;
      const id = `marker${i}`;
      const note = notes.find(note => note.id === id);
      const name = note ? quote(note.name) : 'Unknown';
      const legend = note ? quote(note.legend) : '';
      return [id, type, icon, name, legend, x, y].join(",");
    });

    const data = headers + body.join("\n");
    const fileName = getFileName("Markers") + ".csv";
    downloadFile(data, fileName);
  }

  function close() {
    listeners.forEach(removeListener => removeListener());

    addMarker.classList.remove("pressed");
    markerAdd.classList.remove("pressed");
    restoreDefaultEvents();
    clearMainTip();
  }
}
