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
  document.getElementById("distanceUnitInput").addEventListener("change", changeDistanceUnit);
  document.getElementById("distanceScaleOutput").addEventListener("input", changeDistanceScale);
  document.getElementById("distanceScaleInput").addEventListener("change", changeDistanceScale);
  document.getElementById("areaUnit").addEventListener("change", () => lock("areaUnit"));
  document.getElementById("heightUnit").addEventListener("change", changeHeightUnit);
  document.getElementById("heightExponentInput").addEventListener("input", changeHeightExponent);
  document.getElementById("heightExponentOutput").addEventListener("input", changeHeightExponent);
  document.getElementById("temperatureScale").addEventListener("change", changeTemperatureScale);
  document.getElementById("barSizeOutput").addEventListener("input", changeScaleBarSize);
  document.getElementById("barSize").addEventListener("input", changeScaleBarSize);
  document.getElementById("barLabel").addEventListener("input", changeScaleBarLabel);
  document.getElementById("barPosX").addEventListener("input", changeScaleBarPosition);
  document.getElementById("barPosY").addEventListener("input", changeScaleBarPosition);
  document.getElementById("barBackOpacity").addEventListener("input", changeScaleBarOpacity);
  document.getElementById("barBackColor").addEventListener("input", changeScaleBarColor);

  document.getElementById("populationRateOutput").addEventListener("input", changePopulationRate);
  document.getElementById("populationRate").addEventListener("change", changePopulationRate);
  document.getElementById("urbanizationOutput").addEventListener("input", changeUrbanizationRate);
  document.getElementById("urbanization").addEventListener("change", changeUrbanizationRate);

  document.getElementById("addLinearRuler").addEventListener("click", addAdditionalRuler);
  document.getElementById("addOpisometer").addEventListener("click", toggleOpisometerMode);
  document.getElementById("addPlanimeter").addEventListener("click", togglePlanimeterMode);
  document.getElementById("removeRulers").addEventListener("click", removeAllRulers);
  document.getElementById("unitsRestore").addEventListener("click", restoreDefaultUnits);

  function changeDistanceUnit() {
    if (this.value === "custom_name") {
      prompt("Provide a custom name for a distance unit", {default:""}, custom => {
        this.options.add(new Option(custom, custom, false, true));
        lock("distanceUnit");
        drawScaleBar();
        calculateFriendlyGridSize();
      });
      return;
    }

    lock("distanceUnit");
    drawScaleBar();
    calculateFriendlyGridSize();
  }

  function changeDistanceScale() {
    const scale = +this.value;
    if (!scale || isNaN(scale) || scale < 0) {
      tip("Distance scale should be a positive number", false, "error");
      this.value = document.getElementById("distanceScaleInput").dataset.value;
      return;
    }

    document.getElementById("distanceScaleOutput").value = scale;
    document.getElementById("distanceScaleInput").value = scale;
    document.getElementById("distanceScaleInput").dataset.value = scale;
    lock("distanceScale");

    drawScaleBar();
    calculateFriendlyGridSize();
  }

  function changeHeightUnit() {
    if (this.value === "custom_name") {
      prompt("Provide a custom name for a height unit", {default:""}, custom => {
        this.options.add(new Option(custom, custom, false, true));
        lock("heightUnit");
      });
      return;
    }

    lock("heightUnit");
  }

  function changeHeightExponent() {
    document.getElementById("heightExponentInput").value = this.value;
    document.getElementById("heightExponentOutput").value = this.value;
    calculateTemperatures();
    if (layerIsOn("toggleTemp")) drawTemp();
    lock("heightExponent");
  }

  function changeTemperatureScale() {
    lock("temperatureScale");
    if (layerIsOn("toggleTemp")) drawTemp();
  }

  function changeScaleBarSize() {
    document.getElementById("barSize").value = this.value;
    document.getElementById("barSizeOutput").value = this.value;
    drawScaleBar();
    lock("barSize");
  }

  function changeScaleBarPosition() {
    lock("barPosX");
    lock("barPosY");
    fitScaleBar();
  }

  function changeScaleBarLabel() {
    lock("barLabel");
    drawScaleBar();
  }

  function changeScaleBarOpacity() {
    scaleBar.select("rect").attr("opacity", this.value);
    lock("barBackOpacity");
  }

  function changeScaleBarColor() {
    scaleBar.select("rect").attr("fill", this.value);
    lock("barBackColor");
  }

  function changePopulationRate() {
    const rate = +this.value;
    if (!rate || isNaN(rate) || rate <= 0) {
      tip("Population rate should be a positive number", false, "error");
      this.value = document.getElementById("populationRate").dataset.value;
      return;
    }

    document.getElementById("populationRateOutput").value = rate;
    document.getElementById("populationRate").value = rate;
    document.getElementById("populationRate").dataset.value = rate;
    lock("populationRate");
  }

  function changeUrbanizationRate() {
    const rate = +this.value;
    if (!rate || isNaN(rate) || rate < 0) {
      tip("Urbanization rate should be a number", false, "error");
      this.value = document.getElementById("urbanization").dataset.value;
      return;
    }

    document.getElementById("urbanizationOutput").value = rate;
    document.getElementById("urbanization").value = rate;
    document.getElementById("urbanization").dataset.value = rate;
    lock("urbanization");
  }

  function restoreDefaultUnits() {
    // distanceScale
    document.getElementById("distanceScaleOutput").value = 3;
    document.getElementById("distanceScaleInput").value = 3;
    document.getElementById("distanceScaleInput").dataset.value = 3;
    unlock("distanceScale");

    // units
    const US = navigator.language === "en-US";
    const UK = navigator.language === "en-GB";
    distanceUnitInput.value = US || UK ? "mi" : "km";
    heightUnit.value = US || UK ? "ft" : "m";
    temperatureScale.value = US ? "°F" : "°C";
    areaUnit.value = "square";
    localStorage.removeItem("distanceUnit");
    localStorage.removeItem("heightUnit");
    localStorage.removeItem("temperatureScale");
    localStorage.removeItem("areaUnit");
    calculateFriendlyGridSize();

    // height exponent
    heightExponentInput.value = heightExponentOutput.value = 1.8;
    localStorage.removeItem("heightExponent");
    calculateTemperatures();
    
    // scale bar
    barSizeOutput.value = barSize.value = 2;
    barLabel.value = "";
    barBackOpacity.value = .2;
    barBackColor.value = "#ffffff";
    barPosX.value = barPosY.value = 99;

    localStorage.removeItem("barSize");
    localStorage.removeItem("barLabel");
    localStorage.removeItem("barBackOpacity");
    localStorage.removeItem("barBackColor");
    localStorage.removeItem("barPosX");
    localStorage.removeItem("barPosY");
    drawScaleBar();

    // population
    populationRateOutput.value = populationRate.value = 1000;
    urbanizationOutput.value = urbanization.value = 1;
    localStorage.removeItem("populationRate");
    localStorage.removeItem("urbanization");
  }

  function addAdditionalRuler() {
    if (!layerIsOn("toggleRulers")) toggleRulers();
    const x = graphWidth/2, y = graphHeight/2;
    const pt = document.getElementById('map').createSVGPoint();
    pt.x = x, pt.y = y;
    const p = pt.matrixTransform(viewbox.node().getScreenCTM().inverse());
    const dx = rn(graphWidth / 4 / scale), dy = rand(dx / 2, dx * 2) - rand(dx / 2, dx * 2);
    addRuler(p.x - dx, p.y + dy, p.x + dx, p.y + dy);
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
