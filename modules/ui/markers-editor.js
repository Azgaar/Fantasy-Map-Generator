"use strict";
function editMarker() {
  if (customization) return;
  closeDialogs(".stable");

  const element = d3.event.target.parentElement;
  elSelected = d3.select(element).call(d3.drag().on("start", dragMarker)).classed("draggable", true);
  const marker = pack.markers.find(({i}) => Number(elSelected.attr("id").slice(6)) === i);
  if (!marker) return;

  // dom elements
  const markerSelectGroup = document.getElementById("markerSelectGroup");
  const markerIconSize = document.getElementById("markerIconSize");
  const markerIconShiftX = document.getElementById("markerIconShiftX");
  const markerIconShiftY = document.getElementById("markerIconShiftY");

  const markerSize = document.getElementById("markerSize");
  const markerBaseStroke = document.getElementById("markerBaseStroke");
  const markerBaseFill = document.getElementById("markerBaseFill");

  const markerToggleBubble = document.getElementById("markerToggleBubble");
  const markerIconSelect = document.getElementById("markerIconSelect");

  updateInputs();

  $("#markerEditor").dialog({
    title: "Edit Marker",
    resizable: false,
    position: {my: "center top+30", at: "bottom", of: element, collision: "fit"},
    close: closeMarkerEditor
  });

  const listeners = [
    listen(markerSelectGroup, "change", changeGroup),
    listen(document.getElementById("markerIcon"), "click", toggleIconSection),
    listen(markerIconSize, "input", changeIconSize),
    listen(markerIconShiftX, "input", changeIconShiftX),
    listen(markerIconShiftY, "input", changeIconShiftY),
    listen(document.getElementById("markerIconSelect"), "click", selectMarkerIcon),
    listen(document.getElementById("markerStyle"), "click", toggleStyleSection),
    listen(markerSize, "input", changeMarkerSize),
    listen(markerBaseStroke, "input", changePinStroke),
    listen(markerBaseFill, "input", changePinFill),
    listen(markerToggleBubble, "click", togglePinVisibility),
    listen(document.getElementById("markerLegendButton"), "click", editMarkerLegend),
    listen(document.getElementById("markerAdd"), "click", toggleAddMarker),
    listen(document.getElementById("markerRemove"), "click", removeMarker)
  ];

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
    const {icon, type = "", size = 30, dx = 50, dy = 50, px = 12, stroke = "#000", fill = "#fff", pin = "bubble"} = marker;

    markerSelectGroup.value = type;
    markerIconSize.value = px;
    markerIconShiftX.value = dx;
    markerIconShiftY.value = dy;

    markerSize.value = size;
    markerBaseStroke.value = stroke;
    markerBaseFill.value = fill;

    markerToggleBubble.className = pin;
    markerIconSelect.innerHTML = icon;
  }

  function toggleGroupSection() {
    if (markerGroupSection.style.display === "inline-block") {
      markerEditor.querySelectorAll("button:not(#markerGroup)").forEach(b => (b.style.display = "inline-block"));
      markerGroupSection.style.display = "none";
    } else {
      markerEditor.querySelectorAll("button:not(#markerGroup)").forEach(b => (b.style.display = "none"));
      markerGroupSection.style.display = "inline-block";
    }
  }

  function changeGroup() {
    elSelected.attr("xlink:href", "#" + this.value);
    elSelected.attr("data-id", "#" + this.value);
  }

  function toggleIconSection() {
    console.log(marker);
    if (markerIconSection.style.display === "inline-block") {
      markerEditor.querySelectorAll("button:not(#markerIcon)").forEach(b => (b.style.display = "inline-block"));
      markerIconSection.style.display = "none";
      markerIconSelect.style.display = "none";
    } else {
      markerEditor.querySelectorAll("button:not(#markerIcon)").forEach(b => (b.style.display = "none"));
      markerIconSection.style.display = "inline-block";
      markerIconSelect.style.display = "inline-block";
    }
  }

  function selectMarkerIcon() {
    selectIcon(this.innerHTML, v => {
      this.innerHTML = v;
      const id = elSelected.attr("data-id");
      d3.select("#defs-markers").select(id).select("text").text(v);
    });
  }

  function changeIconSize() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers")
      .select(id)
      .select("text")
      .attr("font-size", this.value + "px");
  }

  function changeIconShiftX() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers")
      .select(id)
      .select("text")
      .attr("x", this.value + "%");
  }

  function changeIconShiftY() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers")
      .select(id)
      .select("text")
      .attr("y", this.value + "%");
  }

  function toggleStyleSection() {
    if (markerStyleSection.style.display === "inline-block") {
      markerEditor.querySelectorAll("button:not(#markerStyle)").forEach(b => (b.style.display = "inline-block"));
      markerStyleSection.style.display = "none";
    } else {
      markerEditor.querySelectorAll("button:not(#markerStyle)").forEach(b => (b.style.display = "none"));
      markerStyleSection.style.display = "inline-block";
    }
  }

  function changeMarkerSize() {
    const id = elSelected.attr("data-id");
    document.querySelectorAll("use[data-id='" + id + "']").forEach(e => {
      const x = +e.dataset.x,
        y = +e.dataset.y;
      const desired = (e.dataset.size = +markerSize.value);
      const size = Math.max(desired * 5 + 25 / scale, 1);

      e.setAttribute("x", x - size / 2);
      e.setAttribute("y", y - size / 2);
      e.setAttribute("width", size);
      e.setAttribute("height", size);
    });
    invokeActiveZooming();
  }

  function changePinStroke() {
    const id = elSelected.attr("data-id");
    d3.select(id).select("path").attr("fill", this.value);
    d3.select(id).select("circle").attr("stroke", this.value);
  }

  function changePinFill() {
    const id = elSelected.attr("data-id");
    d3.select(id).select("circle").attr("fill", this.value);
  }

  function changeIconStrokeWidth() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").attr("stroke-width", this.value);
  }

  function changeIconStroke() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").attr("stroke", this.value);
  }

  function changeIconFill() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").attr("fill", this.value);
  }

  function togglePinVisibility() {
    const id = elSelected.attr("data-id");
    let show = 1;
    if (this.className === "icon-info-circled") {
      this.className = "icon-info";
      show = 0;
    } else this.className = "icon-info-circled";
    d3.select(id).select("circle").attr("opacity", show);
    d3.select(id).select("path").attr("opacity", show);
  }

  function editMarkerLegend() {
    const id = elSelected.attr("id");
    editNotes(id, id);
  }

  function toggleAddMarker() {
    document.getElementById("addMarker").click();
  }

  function removeMarker() {
    alertMessage.innerHTML = "Are you sure you want to remove the marker?";
    $("#alert").dialog({
      resizable: false,
      title: "Remove marker",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          const index = notes.findIndex(n => n.id === elSelected.attr("id"));
          if (index != -1) notes.splice(index, 1);
          elSelected.remove();
          $("#markerEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
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
