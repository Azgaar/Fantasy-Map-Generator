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

  document.getElementById("addLinearRuler").addEventListener("click", addRuler);
  document.getElementById("addOpisometer").addEventListener("click", toggleOpisometerMode);
  document.getElementById("addRouteOpisometer").addEventListener("click", toggleRouteOpisometerMode);
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

  function addRuler() {
    if (!layerIsOn("toggleRulers")) toggleRulers();
    const pt = document.getElementById('map').createSVGPoint();
    pt.x = graphWidth / 2, pt.y = graphHeight / 4;
    const p = pt.matrixTransform(viewbox.node().getScreenCTM().inverse());
    const dx = graphWidth / 4 / scale;
    const dy = (rulers.data.length * 40) % (graphHeight / 2);
    const from = [p.x-dx | 0, p.y+dy | 0];
    const to = [p.x+dx | 0, p.y+dy | 0];
    rulers.create(Ruler, [from, to]).draw();
  }

  function toggleOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve to measure length. Hold Shift to disallow path optimization", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", function() {
        const point = d3.mouse(this);
        const opisometer = rulers.create(Opisometer, [point]).draw();

        d3.event.on("drag", function() {
          const point = d3.mouse(this);
          opisometer.addPoint(point);
        });

        d3.event.on("end", function() {
          restoreDefaultEvents();
          clearMainTip();
          addOpisometer.classList.remove("pressed");
          if (opisometer.points.length < 2) rulers.remove(opisometer.id);
          if (!d3.event.sourceEvent.shiftKey) opisometer.optimize();
        });
      }));
    }
  }

  function toggleRouteOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve along routes to measure length", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", function() {
        const cells = pack.cells;
        const burgs = pack.burgs;
        const point = d3.mouse(this);
        const c = findCell(point[0], point[1]);
        if (cells.road[c]) {
          const b = cells.burg[c];
          const x = b ? burgs[b].x : cells.p[c][0];
          const y = b ? burgs[b].y : cells.p[c][1];
          const routeOpisometer = rulers.create(RouteOpisometer, [[x, y]]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            const c = findCell(point[0], point[1]);
            if (cells.road[c]) {
              /*const b = cells.burg[c];
              const x = b ? burgs[b].x : cells.p[c][0];
              const y = b ? burgs[b].y : cells.p[c][1];
              routeOpisometer.addPoint([x, y]);*/
              routeOpisometer.trackCell(c, true);
            }
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addRouteOpisometer.classList.remove("pressed");
            if (routeOpisometer.points.length < 2) {
              rulers.remove(routeOpisometer.id);
            }
          });
        } else {
          restoreDefaultEvents();
          clearMainTip();
          addRouteOpisometer.classList.remove("pressed");
          tip("Must start in a cell with a route in it", false, "error");
        }
      }));
    }
  }

  function togglePlanimeterMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve to measure its area. Hold Shift to disallow path optimization", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", function() {
        const point = d3.mouse(this);
        const planimeter = rulers.create(Planimeter, [point]).draw();

        d3.event.on("drag", function() {
          const point = d3.mouse(this);
          planimeter.addPoint(point);
        });

        d3.event.on("end", function() {
          restoreDefaultEvents();
          clearMainTip();
          addPlanimeter.classList.remove("pressed");
          if (planimeter.points.length < 3) rulers.remove(planimeter.id);
          else if (!d3.event.sourceEvent.shiftKey) planimeter.optimize();
        });
      }));

    }
  }

  function removeAllRulers() {
    if (!rulers.data.length) return;
    alertMessage.innerHTML = `
      Are you sure you want to remove all placed rulers?
      <br>If you just want to hide rulers, toggle the Rulers layer off in Menu`;
    $("#alert").dialog({resizable: false, title: "Remove all rulers",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          rulers.undraw();
          rulers = new Rulers();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }


}

