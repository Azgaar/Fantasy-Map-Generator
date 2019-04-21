"use strict";
function editMarker() {
  if (customization) return;
  closeDialogs("#markerEditor, .stable");
  $("#markerEditor").dialog();

  elSelected = d3.select(d3.event.target).call(d3.drag().on("start", dragMarker)).classed("draggable", true);
  updateInputs();

  if (modules.editMarker) return;
  modules.editMarker = true;

  $("#markerEditor").dialog({
    title: "Edit Marker", resizable: false,
    position: {my: "center top+30", at: "bottom", of: d3.event, collision: "fit"},
    close: closeMarkerEditor
  });

  // add listeners
  document.getElementById("markerGroup").addEventListener("click", toggleGroupSection);
  document.getElementById("markerAddGroup").addEventListener("click", toggleGroupInput);
  document.getElementById("markerSelectGroup").addEventListener("change", changeGroup);
  document.getElementById("markerInputGroup").addEventListener("change", createGroup);
  document.getElementById("markerRemoveGroup").addEventListener("click", removeGroup);

  document.getElementById("markerIcon").addEventListener("click", toggleIconSection);
  document.getElementById("markerIconSize").addEventListener("input", changeIconSize);
  document.getElementById("markerIconShiftX").addEventListener("input", changeIconShiftX);
  document.getElementById("markerIconShiftY").addEventListener("input", changeIconShiftY);
  document.getElementById("markerIconCustom").addEventListener("input", applyCustomUnicodeIcon);

  document.getElementById("markerStyle").addEventListener("click", toggleStyleSection);
  document.getElementById("markerSize").addEventListener("input", changeMarkerSize);
  document.getElementById("markerBaseStroke").addEventListener("input", changePinStroke);
  document.getElementById("markerBaseFill").addEventListener("input", changePinFill);
  document.getElementById("markerIconStrokeWidth").addEventListener("input", changeIconStrokeWidth);
  document.getElementById("markerIconStroke").addEventListener("input", changeIconStroke);
  document.getElementById("markerIconFill").addEventListener("input", changeIconFill);

  document.getElementById("markerToggleBubble").addEventListener("click", togglePinVisibility);
  document.getElementById("markerLegendButton").addEventListener("click", editMarkerLegend);
  document.getElementById("markerAdd").addEventListener("click", toggleAddMarker);
  document.getElementById("markerRemove").addEventListener("click", removeMarker);

  updateGroupOptions();

  function dragMarker() {
    const tr = parseTransform(this.getAttribute("transform"));
    const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;
  
    d3.event.on("drag", function() {
      const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
      this.setAttribute("transform", transform);
    });
  }

  function updateInputs() {
    const id = elSelected.attr("data-id");
    const symbol = d3.select("#defs-markers").select(id);
    const icon = symbol.select("text");

    markerSelectGroup.value = id.slice(1);
    markerIconSize.value = parseFloat(icon.attr("font-size"));
    markerIconShiftX.value = parseFloat(icon.attr("x"));
    markerIconShiftY.value = parseFloat(icon.attr("y"));

    markerSize.value = elSelected.attr("data-size");
    markerBaseStroke.value = symbol.select("path").attr("fill");
    markerBaseFill.value = symbol.select("circle").attr("fill");

    markerIconStrokeWidth.value = icon.attr("stroke-width");
    markerIconStroke.value = icon.attr("stroke");
    markerIconFill.value = icon.attr("fill");

    markerToggleBubble.className = symbol.select("circle").attr("opacity") === "0" ? "icon-info" : "icon-info-circled";

    const table = document.getElementById("markerIconTable");
    let selected = table.getElementsByClassName("selected");
    if (selected.length) selected[0].removeAttribute("class");
    selected = document.querySelectorAll("#markerIcon" + icon.text().codePointAt());
    if (selected.length) selected[0].className = "selected";
    markerIconCustom.value = selected.length ? "" : icon.text();
  }

  function toggleGroupSection() {
    if (markerGroupSection.style.display === "inline-block") {
      markerEditor.querySelectorAll("button:not(#markerGroup)").forEach(b => b.style.display = "inline-block");
      markerGroupSection.style.display = "none";
    } else {
      markerEditor.querySelectorAll("button:not(#markerGroup)").forEach(b => b.style.display = "none");
      markerGroupSection.style.display = "inline-block";
    }
  }

  function updateGroupOptions() {
    markerSelectGroup.innerHTML = "";
    d3.select("#defs-markers").selectAll("symbol").each(function() {
      markerSelectGroup.options.add(new Option(this.id, this.id));
    });
    markerSelectGroup.value = elSelected.attr("data-id").slice(1);
  }

  function toggleGroupInput() {
    if (markerInputGroup.style.display === "inline-block") {
      markerSelectGroup.style.display = "inline-block";
      markerInputGroup.style.display = "none";
    } else {
      markerSelectGroup.style.display = "none";
      markerInputGroup.style.display = "inline-block";
      markerInputGroup.focus();
    }
  }

  function changeGroup() {
    elSelected.attr("xlink:href", "#"+this.value);
    elSelected.attr("data-id", "#"+this.value);
  }

  function createGroup() {
    let newGroup = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
    if (Number.isFinite(+newGroup.charAt(0))) newGroup = "m" + newGroup;
    if (document.getElementById(newGroup)) {
      tip("Element with this id already exists. Please provide a unique name", false, "error");
      return;
    }

    markerInputGroup.value = "";
    // clone old group assigning new id
    const id = elSelected.attr("data-id");
    const clone = d3.select("#defs-markers").select(id).node().cloneNode(true);
    clone.id = newGroup;
    document.getElementById("defs-markers").insertBefore(clone, null);
    elSelected.attr("xlink:href", "#"+newGroup).attr("data-id", "#"+newGroup);

    // select new group
    markerSelectGroup.options.add(new Option(newGroup, newGroup, false, true));
    toggleGroupInput();
  }

  function removeGroup() {
    const id = elSelected.attr("data-id");
    const used = document.querySelectorAll("use[data-id='"+id+"']");
    const count = used.length === 1 ? "1 element" : used.length + " elements";
    alertMessage.innerHTML = "Are you sure you want to remove the marker (" + count + ")?";

    $("#alert").dialog({resizable: false, title: "Remove marker",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          if (id !== "#marker0") d3.select("#defs-markers").select(id).remove();
          used.forEach(e => e.remove());
          updateGroupOptions();
          updateGroupOptions();
          $("#markerEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function toggleIconSection() {
    if (markerIconSection.style.display === "inline-block") {
      markerEditor.querySelectorAll("button:not(#markerIcon)").forEach(b => b.style.display = "inline-block");
      markerIconSection.style.display = "none";
    } else {
      markerEditor.querySelectorAll("button:not(#markerIcon)").forEach(b => b.style.display = "none");
      markerIconSection.style.display = "inline-block";
      if (!markerIconTable.innerHTML) drawIconsList();
    }
  }

  function drawIconsList() {
    let icons = [
        // emoticons in FF:
        ["2693", "⚓", "Anchor"],
        ["26EA", "⛪", "Church"],
        ["1F3EF", "🏯", "Japanese Castle"],
        ["1F3F0", "🏰", "Castle"],
        ["1F5FC", "🗼", "Tower"],
        ["1F3E0", "🏠", "House"],
        ["1F3AA", "🎪", "Tent"],
        ["1F3E8", "🏨", "Hotel"],
        ["1F4B0", "💰", "Money bag"],
        ["1F4A8", "💨", "Dashing away"],
        ["1F334", "🌴", "Palm"],
        ["1F335", "🌵", "Cactus"],
        ["1F33E", "🌾", "Sheaf"],
        ["1F5FB", "🗻", "Mountain"],
        ["1F30B", "🌋", "Volcano"],
        ["1F40E", "🐎", "Horse"],
        ["1F434", "🐴", "Horse Face"],
        ["1F42E", "🐮", "Cow"],
        ["1F43A", "🐺", "Wolf Face"],
        ["1F435", "🐵", "Monkey face"],
        ["1F437", "🐷", "Pig face"],
        ["1F414", "🐔", "Chiken"],
        ["1F411", "🐑", "Eve"],
        ["1F42B", "🐫", "Camel"],
        ["1F418", "🐘", "Elephant"],
        ["1F422", "🐢", "Turtle"],
        ["1F40C", "🐌", "Snail"],
        ["1F40D", "🐍", "Snake"],
        ["1F433", "🐳", "Whale"],
        ["1F42C", "🐬", "Dolphin"],
        ["1F420", "🐟", "Fish"],
        ["1F432", "🐲", "Dragon Head"],
        ["1F479", "👹", "Ogre"],
        ["1F47B", "👻", "Ghost"],
        ["1F47E", "👾", "Alien"],
        ["1F480", "💀", "Skull"],
        ["1F374", "🍴", "Fork and knife"],
        ["1F372", "🍲", "Food"],
        ["1F35E", "🍞", "Bread"],
        ["1F357", "🍗", "Poultry leg"],
        ["1F347", "🍇", "Grapes"],
        ["1F34F", "🍏", "Apple"],
        ["1F352", "🍒", "Cherries"],
        ["1F36F", "🍯", "Honey pot"],
        ["1F37A", "🍺", "Beer"],
        ["1F377", "🍷", "Wine glass"],
        ["1F3BB", "🎻", "Violin"],
        ["1F3B8", "🎸", "Guitar"],
        ["26A1", "⚡", "Electricity"],
        ["1F320", "🌠", "Shooting star"],
        ["1F319", "🌙", "Crescent moon"],
        ["1F525", "🔥", "Fire"],
        ["1F4A7", "💧", "Droplet"],
        ["1F30A", "🌊", "Wave"],
        ["231B", "⌛", "Hourglass"],
        ["1F3C6", "🏆", "Goblet"],
        ["26F2", "⛲", "Fountain"],
        ["26F5", "⛵", "Sailboat"],
        ["26FA", "⛺", "Tend"],
        ["1F489", "💉", "Syringe"],
        ["1F4D6", "📚", "Books"],
        ["1F3AF", "🎯", "Archery"],
        ["1F52E", "🔮", "Magic ball"],
        ["1F3AD", "🎭", "Performing arts"],
        ["1F3A8", "🎨", "Artist palette"],
        ["1F457", "👗", "Dress"],
        ["1F451", "👑", "Crown"],
        ["1F48D", "💍", "Ring"],
        ["1F48E", "💎", "Gem"],
        ["1F514", "🔔", "Bell"],
        ["1F3B2", "🎲", "Die"],
        // black and white icons in FF:
        ["26A0", "⚠", "Alert"],
        ["2317", "⌗", "Hash"],
        ["2318", "⌘", "POI"],
        ["2307", "⌇", "Wavy"],
        ["21E6", "⇦", "Left arrow"],
        ["21E7", "⇧", "Top arrow"],
        ["21E8", "⇨", "Right arrow"],
        ["21E9", "⇩", "Left arrow"],
        ["21F6", "⇶", "Three arrows"],
        ["2699", "⚙", "Gear"],
        ["269B", "⚛", "Atom"],
        ["0024", "$", "Dollar"],
        ["2680", "⚀", "Die1"],
        ["2681", "⚁", "Die2"],
        ["2682", "⚂", "Die3"],
        ["2683", "⚃", "Die4"],
        ["2684", "⚄", "Die5"],
        ["2685", "⚅", "Die6"],
        ["26B4", "⚴", "Pallas"],
        ["26B5", "⚵", "Juno"],
        ["26B6", "⚶", "Vesta"],
        ["26B7", "⚷", "Chiron"],
        ["26B8", "⚸", "Lilith"],
        ["263F", "☿", "Mercury"],
        ["2640", "♀", "Venus"],
        ["2641", "♁", "Earth"],
        ["2642", "♂", "Mars"],
        ["2643", "♃", "Jupiter"],
        ["2644", "♄", "Saturn"],
        ["2645", "♅", "Uranus"],
        ["2646", "♆", "Neptune"],
        ["2647", "♇", "Pluto"],
        ["26B3", "⚳", "Ceres"],
        ["2654", "♔", "Chess king"],
        ["2655", "♕", "Chess queen"],
        ["2656", "♖", "Chess rook"],
        ["2657", "♗", "Chess bishop"],
        ["2658", "♘", "Chess knight"],
        ["2659", "♙", "Chess pawn"],
        ["2660", "♠", "Spade"],
        ["2663", "♣", "Club"],
        ["2665", "♥", "Heart"],
        ["2666", "♦", "Diamond"],
        ["2698", "⚘", "Flower"],
        ["2625", "☥", "Ankh"],
        ["2626", "☦", "Orthodox"],
        ["2627", "☧", "Chi Rho"],
        ["2628", "☨", "Lorraine"],
        ["2629", "☩", "Jerusalem"],
        ["2670", "♰", "Syriac cross"],
        ["2020", "†", "Dagger"],
        ["262A", "☪", "Muslim"],
        ["262D", "☭", "Soviet"],
        ["262E", "☮", "Peace"],
        ["262F", "☯", "Yin yang"],
        ["26A4", "⚤", "Heterosexuality"],
        ["26A2", "⚢", "Female homosexuality"],
        ["26A3", "⚣", "Male homosexuality"],
        ["26A5", "⚥", "Male and female"],
        ["26AD", "⚭", "Rings"],
        ["2690", "⚐", "White flag"],
        ["2691", "⚑", "Black flag"],
        ["263C", "☼", "Sun"],
        ["263E", "☾", "Moon"],
        ["2668", "♨", "Hot springs"],
        ["2600", "☀", "Black sun"],
        ["2601", "☁", "Cloud"],
        ["2602", "☂", "Umbrella"],
        ["2603", "☃", "Snowman"],
        ["2604", "☄", "Comet"],
        ["2605", "★", "Black star"],
        ["2606", "☆", "White star"],
        ["269D", "⚝", "Outlined star"],
        ["2618", "☘", "Shamrock"],
        ["21AF", "↯", "Lightning"],
        ["269C", "⚜", "FleurDeLis"],
        ["2622", "☢", "Radiation"],
        ["2623", "☣", "Biohazard"],
        ["2620", "☠", "Skull"],
        ["2638", "☸", "Dharma"],
        ["2624", "☤", "Caduceus"],
        ["2695", "⚕", "Aeculapius staff"],
        ["269A", "⚚", "Hermes staff"],
        ["2697", "⚗", "Alembic"],
        ["266B", "♫", "Music"],
        ["2702", "✂", "Scissors"],
        ["2696", "⚖", "Scales"],
        ["2692", "⚒", "Hammer and pick"],
        ["2694", "⚔", "Swords"]
      ];

    const table = document.getElementById("markerIconTable");
    table.addEventListener("click", selectIcon, false);
    table.addEventListener("mouseover", hoverIcon, false);
    let row = "";

    for (let i=0; i < icons.length; i++) {
      if (i%16 === 0) row = table.insertRow(0);
      const cell = row.insertCell(0);
      const icon = String.fromCodePoint(parseInt(icons[i][0], 16));
      cell.innerHTML = icon;
      cell.id = "markerIcon" + icon.codePointAt();
      cell.dataset.desc = icons[i][2];
    }
  }

  function selectIcon(e) {
    if (e.target !== e.currentTarget) {
      const table = document.getElementById("markerIconTable");
      const selected = table.getElementsByClassName("selected");
      if (selected.length) selected[0].removeAttribute("class");
      e.target.className = "selected";
      const id = elSelected.attr("data-id");
      const icon = e.target.innerHTML;
      d3.select("#defs-markers").select(id).select("text").text(icon);
    }
    e.stopPropagation();
  }

  function hoverIcon(e) {
    if (e.target !== e.currentTarget) tip(e.target.innerHTML + " " + e.target.dataset.desc);
    e.stopPropagation();
  }

  function changeIconSize() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").attr("font-size", this.value + "px");
  }

  function changeIconShiftX() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").attr("x", this.value + "%");
  }

  function changeIconShiftY() {
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").attr("y", this.value + "%");
  }

  function applyCustomUnicodeIcon() {
    if (!this.value) return;
    const id = elSelected.attr("data-id");
    d3.select("#defs-markers").select(id).select("text").text(this.value);
  }

  function toggleStyleSection() {
    if (markerStyleSection.style.display === "inline-block") {
      markerEditor.querySelectorAll("button:not(#markerStyle)").forEach(b => b.style.display = "inline-block");
      markerStyleSection.style.display = "none";
    } else {
      markerEditor.querySelectorAll("button:not(#markerStyle)").forEach(b => b.style.display = "none");
      markerStyleSection.style.display = "inline-block";
    }
  }

  function changeMarkerSize() {
    const id = elSelected.attr("data-id");
    document.querySelectorAll("use[data-id='"+id+"']").forEach(e => e.dataset.size = markerSize.value);
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
    if (this.className === "icon-info-circled") {this.className = "icon-info"; show = 0; } 
    else this.className = "icon-info-circled";
    d3.select(id).select("circle").attr("opacity", show);
    d3.select(id).select("path").attr("opacity", show);
  }

  function editMarkerLegend() {
    const id = elSelected.attr("id");
    editLegends(id, id);
  }

  function toggleAddMarker() {
    document.getElementById("addMarker").click();
  }

  function removeMarker() {
    alertMessage.innerHTML = "Are you sure you want to remove the marker?";
    $("#alert").dialog({resizable: false, title: "Remove marker",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          elSelected.remove();
          $("#markerEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function closeMarkerEditor() {
    unselect();
    if (addMarker.classList.contains("pressed")) addMarker.classList.remove("pressed");
    if (markerAdd.classList.contains("pressed")) markerAdd.classList.remove("pressed");
    restoreDefaultEvents();
    clearMainTip();
  }
}

