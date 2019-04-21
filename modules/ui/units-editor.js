"use strict";
function editUnits() {
  closeDialogs("#unitsEditor, .stable");
  $("#unitsEditor").dialog();

  if (modules.editUnits) return;
  modules.editUnits = true;

  $("#unitsEditor").dialog({
    title: "Units Editor",
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("distanceUnit").addEventListener("change", changeDistanceUnit);
  document.getElementById("distanceScaleSlider").addEventListener("input", changeDistanceScale);
  document.getElementById("distanceScale").addEventListener("change", changeDistanceScale);
  document.getElementById("distanceScale").addEventListener("mouseenter", hideDistanceUnitOutput);
  document.getElementById("distanceScale").addEventListener("mouseleave", showDistanceUnitOutput);
  document.getElementById("heightUnit").addEventListener("change", changeHeightUnit);
  document.getElementById("heightExponent").addEventListener("input", changeHeightExponent);
  document.getElementById("heightExponentSlider").addEventListener("input", changeHeightExponent);
  document.getElementById("temperatureScale").addEventListener("change", () => {if (layerIsOn("toggleTemp")) drawTemp()});
  document.getElementById("barSizeSlider").addEventListener("input", changeScaleBarSize);
  document.getElementById("barSize").addEventListener("input", changeScaleBarSize);
  document.getElementById("barLabel").addEventListener("input", drawScaleBar);
  document.getElementById("barPosX").addEventListener("input", fitScaleBar);
  document.getElementById("barPosY").addEventListener("input", fitScaleBar);
  document.getElementById("barBackOpacity").addEventListener("input", function() {scaleBar.select("rect").attr("opacity", this.value)});
  document.getElementById("barBackColor").addEventListener("input", function() {scaleBar.select("rect").attr("fill", this.value)});
  document.getElementById("populationRateSlider").addEventListener("input", changePopulationRate);
  document.getElementById("populationRate").addEventListener("change", changePopulationRate);
  document.getElementById("urbanizationSlider").addEventListener("input", changeUrbanizationRate);
  document.getElementById("urbanization").addEventListener("change", changeUrbanizationRate);

  document.getElementById("addLinearRuler").addEventListener("click", addAdditionalRuler);
  document.getElementById("addOpisometer").addEventListener("click", toggleOpisometerMode);
  document.getElementById("addPlanimeter").addEventListener("click", togglePlanimeterMode);
  document.getElementById("removeRulers").addEventListener("click", removeAllRulers);

  function changeDistanceUnit() {
    if (this.value === "custom_name") {
      const custom = prompt("Provide a custom name for distance unit");
      if (custom) this.options.add(new Option(custom, custom, false, true));
      else {this.value = document.getElementById("distanceUnitOutput").innerHTML; return;};
    }

    document.getElementById("distanceUnitOutput").innerHTML = this.value;
    drawScaleBar();
    calculateFriendlyGridSize();
  }

  function changeDistanceScale() {
    const scale = +this.value;
    if (!scale || isNaN(scale) || scale < 0) {
      tip("Distance scale should be a positive number", false, "error");
      this.value = document.getElementById("distanceScale").dataset.value;
      return;
    }

    document.getElementById("distanceScaleSlider").value = scale;
    document.getElementById("distanceScale").value = scale;
    document.getElementById("distanceScale").dataset.value = scale;
    drawScaleBar();
    calculateFriendlyGridSize();
  }

  function hideDistanceUnitOutput() {document.getElementById("distanceUnitOutput").style.opacity = .2;}
  function showDistanceUnitOutput() {document.getElementById("distanceUnitOutput").style.opacity = 1;}

  function changeHeightUnit() {
    if (this.value !== "custom_name") return;
    const custom = prompt("Provide a custom name for height unit");
    if (custom) this.options.add(new Option(custom, custom, false, true));
    else this.value = "ft";
  }

  function changeHeightExponent() {
    document.getElementById("heightExponent").value = this.value;
    document.getElementById("heightExponentSlider").value = this.value;
    calculateTemperatures();
    if (layerIsOn("toggleTemp")) drawTemp();
  }

  function changeScaleBarSize() {
    document.getElementById("barSize").value = this.value;
    document.getElementById("barSizeSlider").value = this.value;
    drawScaleBar();
  }

  function changePopulationRate() {
    const rate = +this.value;
    if (!rate || isNaN(rate) || rate <= 0) {
      tip("Population rate should be a positive number", false, "error");
      this.value = document.getElementById("populationRate").dataset.value;
      return;
    }

    document.getElementById("populationRateSlider").value = rate;
    document.getElementById("populationRate").value = rate;
    document.getElementById("populationRate").dataset.value = rate;
  }

  function changeUrbanizationRate() {
    const rate = +this.value;
    if (!rate || isNaN(rate) || rate < 0) {
      tip("Urbanization rate should be a number", false, "error");
      this.value = document.getElementById("urbanization").dataset.value;
      return;
    }

    document.getElementById("urbanizationSlider").value = rate;
    document.getElementById("urbanization").value = rate;
    document.getElementById("urbanization").dataset.value = rate;
  }

  function addAdditionalRuler() {
    if (!layerIsOn("toggleRulers")) toggleRulers();
    const y = rn(Math.random() * graphHeight * .5 + graphHeight * .25);
    addRuler(graphWidth * .2, y, graphWidth * .8, y);
  }

  function toggleOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve to measure its length", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", drawOpisometer));
    }
  }

  function togglePlanimeterMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a line to measure its inner area", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", drawPlanimeter));
    }
  }

  function removeAllRulers() {
    if (!ruler.selectAll("g").size()) return;
    alertMessage.innerHTML = `Are you sure you want to remove all placed rulers?`;
    $("#alert").dialog({resizable: false, title: "Remove all rulers",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          ruler.selectAll("g").remove();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }


}

