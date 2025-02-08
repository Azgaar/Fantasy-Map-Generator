"use strict";
function editMarker(markerI) {
  if (customization) return;
  closeDialogs(".stable");

  const [element, marker] = getElement(markerI, d3.event);
  if (!marker || !element) return;

  elSelected = d3.select(element).raise().call(d3.drag().on("start", dragMarker)).classed("draggable", true);

  if (byId("notesEditor").offsetParent) editNotes(element.id, element.id);

  // dom elements
  const markerType = byId("markerType");
  const markerIconSelect = byId("markerIconSelect");
  const markerIconSize = byId("markerIconSize");
  const markerIconShiftX = byId("markerIconShiftX");
  const markerIconShiftY = byId("markerIconShiftY");
  const markerSize = byId("markerSize");
  const markerPin = byId("markerPin");
  const markerFill = byId("markerFill");
  const markerStroke = byId("markerStroke");

  const markerNotes = byId("markerNotes");
  const markerLock = byId("markerLock");
  const addMarker = byId("addMarker");
  const markerAdd = byId("markerAdd");
  const markerRemove = byId("markerRemove");

  updateInputs();

  $("#markerEditor").dialog({
    title: "Edit Marker",
    resizable: false,
    position: {my: "left top", at: "left+10 top+10", of: "svg", collision: "fit"},
    close: closeMarkerEditor
  });

  const listeners = [
    listen(markerType, "change", changeMarkerType),
    listen(markerIconSelect, "click", changeMarkerIcon),
    listen(markerIconSize, "input", changeIconSize),
    listen(markerIconShiftX, "input", changeIconShiftX),
    listen(markerIconShiftY, "input", changeIconShiftY),
    listen(markerSize, "input", changeMarkerSize),
    listen(markerPin, "change", changeMarkerPin),
    listen(markerFill, "input", changePinFill),
    listen(markerStroke, "input", changePinStroke),
    listen(markerNotes, "click", editMarkerLegend),
    listen(markerLock, "click", toggleMarkerLock),
    listen(markerAdd, "click", toggleAddMarker),
    listen(markerRemove, "click", confirmMarkerDeletion)
  ];

  function getElement(markerI, event) {
    if (event) {
      const element = event.target?.closest("svg");
      const marker = pack.markers.find(({i}) => Number(element.id.slice(6)) === i);
      return [element, marker];
    }

    const element = byId(`marker${markerI}`);
    const marker = pack.markers.find(({i}) => i === markerI);
    return [element, marker];
  }

  function getSameTypeMarkers() {
    const currentType = marker.type;
    if (!currentType) return [marker];
    return pack.markers.filter(({type}) => type === currentType);
  }

  function dragMarker() {
    const dx = +this.getAttribute("x") - d3.event.x;
    const dy = +this.getAttribute("y") - d3.event.y;

    d3.event.on("drag", function () {
      const {x, y} = d3.event;
      this.setAttribute("x", dx + x);
      this.setAttribute("y", dy + y);
    });

    d3.event.on("end", function () {
      const {x, y} = d3.event;
      this.setAttribute("x", rn(dx + x, 2));
      this.setAttribute("y", rn(dy + y, 2));

      const size = marker.size || 30;
      const zoomSize = Math.max(rn(size / 5 + 24 / scale, 2), 1);

      marker.x = rn(x + dx + zoomSize / 2, 1);
      marker.y = rn(y + dy + zoomSize, 1);
      marker.cell = findCell(marker.x, marker.y);
    });
  }

  function updateInputs() {
    byId("markerIcon").innerHTML = marker.icon.startsWith("http")
      ? `<img src="${marker.icon}" style="width: 1em; height: 1em;">`
      : marker.icon;

    markerType.value = marker.type || "";
    markerIconSize.value = marker.px || 12;
    markerIconShiftX.value = marker.dx || 50;
    markerIconShiftY.value = marker.dy || 50;
    markerSize.value = marker.size || 30;
    markerPin.value = marker.pin || "bubble";
    markerFill.value = marker.fill || "#ffffff";
    markerStroke.value = marker.stroke || "#000000";

    markerLock.className = marker.lock ? "icon-lock" : "icon-lock-open";
  }

  function changeMarkerType() {
    marker.type = this.value;
  }

  function changeMarkerIcon() {
    selectIcon(marker.icon, value => {
      const isExternal = value.startsWith("http");
      byId("markerIcon").innerHTML = isExternal ? `<img src="${value}" style="width: 1em; height: 1em;">` : value;

      getSameTypeMarkers().forEach(marker => {
        marker.icon = value;
        redrawIcon(marker);
      });
    });
  }

  function changeIconSize() {
    const px = +this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.px = px;
      redrawIcon(marker);
    });
  }

  function changeIconShiftX() {
    const dx = +this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.dx = dx;
      redrawIcon(marker);
    });
  }

  function changeIconShiftY() {
    const dy = +this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.dy = dy;
      redrawIcon(marker);
    });
  }

  function changeMarkerSize() {
    const size = +this.value;
    const rescale = +markers.attr("rescale");

    getSameTypeMarkers().forEach(marker => {
      marker.size = size;
      const {i, x, y, hidden} = marker;
      const el = !hidden && byId(`marker${i}`);
      if (!el) return;

      const zoomedSize = rescale ? Math.max(rn(size / 5 + 24 / scale, 2), 1) : size;
      el.setAttribute("width", zoomedSize);
      el.setAttribute("height", zoomedSize);
      el.setAttribute("x", rn(x - zoomedSize / 2, 1));
      el.setAttribute("y", rn(y - zoomedSize, 1));
    });
  }

  function changeMarkerPin() {
    const pin = this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.pin = pin;
      redrawPin(marker);
    });
  }

  function changePinFill() {
    const fill = this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.fill = fill;
      redrawPin(marker);
    });
  }

  function changePinStroke() {
    const stroke = this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.stroke = stroke;
      redrawPin(marker);
    });
  }

  function redrawIcon({i, hidden, icon, dx = 50, dy = 50, px = 12}) {
    const isExternal = icon.startsWith("http");

    const iconText = !hidden && document.querySelector(`#marker${i} > text`);
    if (iconText) {
      iconText.innerHTML = isExternal ? "" : icon;
      iconText.setAttribute("x", dx + "%");
      iconText.setAttribute("y", dy + "%");
      iconText.setAttribute("font-size", px + "px");
    }

    const iconImage = !hidden && document.querySelector(`#marker${i} > image`);
    if (iconImage) {
      iconImage.setAttribute("x", dx / 2 + "%");
      iconImage.setAttribute("y", dy / 2 + "%");
      iconImage.setAttribute("width", px + "px");
      iconImage.setAttribute("height", px + "px");
      iconImage.setAttribute("href", isExternal ? icon : "");
    }
  }

  function redrawPin({i, hidden, pin = "bubble", fill = "#fff", stroke = "#000"}) {
    const pinGroup = !hidden && document.querySelector(`#marker${i} > g`);
    if (pinGroup) pinGroup.innerHTML = getPin(pin, fill, stroke);
  }

  function editMarkerLegend() {
    const id = element.id;
    editNotes(id, id);
  }

  function toggleMarkerLock() {
    marker.lock = !marker.lock;
    markerLock.classList.toggle("icon-lock-open");
    markerLock.classList.toggle("icon-lock");
  }

  function toggleAddMarker() {
    markerAdd.classList.toggle("pressed");
    addMarker.click();
  }

  function confirmMarkerDeletion() {
    confirmationDialog({
      title: "Remove marker",
      message: "Are you sure you want to remove this marker? The action cannot be reverted",
      confirm: "Remove",
      onConfirm: deleteMarker
    });
  }

  function deleteMarker() {
    Markers.deleteMarker(marker.i);
    element.remove();
    $("#markerEditor").dialog("close");
    if (byId("markersOverviewRefresh").offsetParent) markersOverviewRefresh.click();
  }

  function closeMarkerEditor() {
    listeners.forEach(removeListener => removeListener());

    unselect();
    addMarker.classList.remove("pressed");
    markerAdd.classList.remove("pressed");
    restoreDefaultEvents();
    clearMainTip();
  }
}
