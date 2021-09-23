"use strict";
function editMarker() {
  if (customization) return;
  closeDialogs(".stable");

  const element = d3.event.target.closest("svg");
  const marker = pack.markers.find(({i}) => Number(element.id.slice(6)) === i);
  if (!marker) return;

  elSelected = d3.select(element).raise().call(d3.drag().on("start", dragMarker)).classed("draggable", true);

  // dom elements
  const markerType = document.getElementById("markerType");
  const markerIcon = document.getElementById("markerIcon");
  const markerIconSelect = document.getElementById("markerIconSelect");
  const markerIconSize = document.getElementById("markerIconSize");
  const markerIconShiftX = document.getElementById("markerIconShiftX");
  const markerIconShiftY = document.getElementById("markerIconShiftY");
  const markerSize = document.getElementById("markerSize");
  const markerPin = document.getElementById("markerPin");
  const markerFill = document.getElementById("markerFill");
  const markerStroke = document.getElementById("markerStroke");

  const markerNotes = document.getElementById("markerNotes");
  const markerLock = document.getElementById("markerLock");
  const addMarker = document.getElementById("addMarker");
  const markerAdd = document.getElementById("markerAdd");
  const markerRemove = document.getElementById("markerRemove");

  updateInputs();

  $("#markerEditor").dialog({
    title: "Edit Marker",
    resizable: false,
    position: {my: "center top+30", at: "bottom", of: element, collision: "fit"},
    close: closeMarkerEditor
  });

  const listeners = [
    listen(markerType, "change", changeMarkerType),
    listen(markerIcon, "input", changeMarkerIcon),
    listen(markerIconSelect, "click", selectMarkerIcon),
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
    });
  }

  function updateInputs() {
    const {icon, type = "", size = 30, dx = 50, dy = 50, px = 12, stroke = "#000000", fill = "#ffffff", pin = "bubble", lock} = marker;

    markerType.value = type;
    markerIcon.value = icon;
    markerIconSize.value = px;
    markerIconShiftX.value = dx;
    markerIconShiftY.value = dy;
    markerSize.value = size;
    markerPin.value = pin;
    markerFill.value = fill;
    markerStroke.value = stroke;

    markerLock.className = lock ? "icon-lock" : "icon-lock-open";
  }

  function changeMarkerType() {
    marker.type = this.value;
  }

  function changeMarkerIcon() {
    const icon = this.value;
    getSameTypeMarkers().forEach(marker => {
      marker.icon = icon;
      redrawIcon(marker);
    });
  }

  function selectMarkerIcon() {
    selectIcon(marker.icon, icon => {
      markerIcon.value = icon;
      getSameTypeMarkers().forEach(marker => {
        marker.icon = icon;
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
      const el = !hidden && document.getElementById(`marker${i}`);
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
    const iconElement = !hidden && document.querySelector(`#marker${i} > text`);
    if (iconElement) {
      iconElement.innerHTML = icon;
      iconElement.setAttribute("x", dx + "%");
      iconElement.setAttribute("y", dy + "%");
      iconElement.setAttribute("font-size", px + "px");
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
    notes = notes.filter(note => note.id !== element.id);
    pack.markers = pack.markers.filter(m => m.i !== marker.i);
    element.remove();
    $("#markerEditor").dialog("close");
  }

  function closeMarkerEditor() {
    listeners.forEach(removeListener => removeListener());

    unselect();
    if (addMarker.classList.contains("pressed")) addMarker.classList.remove("pressed");
    if (markerAdd.classList.contains("pressed")) markerAdd.classList.remove("pressed");
    restoreDefaultEvents();
    clearMainTip();
  }
}
