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

  const renderScaleBar = () => {
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);
  };

  // add listeners
  byId("distanceUnitInput").on("change", changeDistanceUnit);
  byId("distanceScaleInput").on("change", changeDistanceScale);
  byId("heightUnit").on("change", changeHeightUnit);
  byId("heightExponentInput").on("input", changeHeightExponent);
  byId("temperatureScale").on("change", changeTemperatureScale);

  byId("populationRateInput").on("change", changePopulationRate);
  byId("urbanizationInput").on("change", changeUrbanizationRate);
  byId("urbanDensityInput").on("change", changeUrbanDensity);

  byId("addLinearRuler").on("click", addRuler);
  byId("addOpisometer").on("click", toggleOpisometerMode);
  byId("addRouteOpisometer").on("click", toggleRouteOpisometerMode);
  byId("addPlanimeter").on("click", togglePlanimeterMode);
  byId("removeRulers").on("click", removeAllRulers);
  byId("unitsRestore").on("click", restoreDefaultUnits);

  function changeDistanceUnit() {
    if (this.value === "custom_name") {
      prompt("Provide a custom name for a distance unit", {default: ""}, custom => {
        this.options.add(new Option(custom, custom, false, true));
        lock("distanceUnit");
        renderScaleBar();
        calculateFriendlyGridSize();
      });
      return;
    }

    renderScaleBar();
    calculateFriendlyGridSize();
  }

  function changeDistanceScale() {
    distanceScale = +this.value;
    renderScaleBar();
    calculateFriendlyGridSize();
  }

  function changeHeightUnit() {
    if (this.value !== "custom_name") return;

    prompt("Provide a custom name for a height unit", {default: ""}, custom => {
      this.options.add(new Option(custom, custom, false, true));
      lock("heightUnit");
    });
  }

  function changeHeightExponent() {
    calculateTemperatures();
    if (layerIsOn("toggleTemperature")) drawTemperature();
  }

  function changeTemperatureScale() {
    if (layerIsOn("toggleTemperature")) drawTemperature();
  }

  function changePopulationRate() {
    populationRate = +this.value;
  }

  function changeUrbanizationRate() {
    urbanization = +this.value;
  }

  function changeUrbanDensity() {
    urbanDensity = +this.value;
  }

  function restoreDefaultUnits() {
    distanceScale = 3;
    byId("distanceScaleInput").value = distanceScale;
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
    heightExponentInput.value = 1.8;
    localStorage.removeItem("heightExponent");
    calculateTemperatures();

    renderScaleBar();

    // population
    populationRate = populationRateInput.value = 1000;
    urbanization = urbanizationInput.value = 1;
    urbanDensity = urbanDensityInput.value = 10;
    localStorage.removeItem("populationRate");
    localStorage.removeItem("urbanization");
    localStorage.removeItem("urbanDensity");
  }

  function addRuler() {
    if (!layerIsOn("toggleRulers")) toggleRulers();
    
    // Get the current viewbox transform to determine visible bounds
    const transform = d3.zoomTransform(viewbox.node());
    const viewboxBounds = viewbox.node().getBBox();
    
    // Calculate visible area bounds in viewbox coordinates
    const visibleLeft = -transform.x / transform.k;
    const visibleTop = -transform.y / transform.k;
    const visibleWidth = svgWidth / transform.k;
    const visibleHeight = svgHeight / transform.k;
    const visibleRight = visibleLeft + visibleWidth;
    const visibleBottom = visibleTop + visibleHeight;
    
    // Constrain visible bounds to the actual graph bounds
    const boundedLeft = Math.max(visibleLeft, 0);
    const boundedTop = Math.max(visibleTop, 0);
    const boundedRight = Math.min(visibleRight, graphWidth);
    const boundedBottom = Math.min(visibleBottom, graphHeight);
    
    // Calculate ruler position within the visible and bounded area
    const centerX = (boundedLeft + boundedRight) / 2;
    const centerY = (boundedTop + boundedBottom) / 2;
    
    // Set ruler length to be a reasonable portion of the visible width, but not too long
    const maxRulerLength = Math.min((boundedRight - boundedLeft) * 0.6, graphWidth / 4);
    const rulerLength = Math.max(maxRulerLength, 50); // Minimum ruler length of 50 units
    const dx = rulerLength / 2;
    
    // Vertical offset for multiple rulers
    const dy = (rulers.data.length * 40) % ((boundedBottom - boundedTop) / 2);
    
    // Calculate ruler endpoints, ensuring they stay within bounds
    let from = [centerX - dx, centerY + dy];
    let to = [centerX + dx, centerY + dy];
    
    // Adjust if ruler extends beyond visible bounds
    if (from[0] < boundedLeft) {
      const offset = boundedLeft - from[0];
      from[0] = boundedLeft;
      to[0] += offset;
    }
    if (to[0] > boundedRight) {
      const offset = to[0] - boundedRight;
      to[0] = boundedRight;
      from[0] -= offset;
    }
    
    // Final bounds check and adjustment
    from[0] = Math.max(from[0], boundedLeft);
    to[0] = Math.min(to[0], boundedRight);
    from[1] = Math.max(Math.min(from[1], boundedBottom), boundedTop);
    to[1] = Math.max(Math.min(to[1], boundedBottom), boundedTop);
    
    rulers.create(Ruler, [[from[0] | 0, from[1] | 0], [to[0] | 0, to[1] | 0]]).draw();
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
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const point = d3.mouse(this);
          const opisometer = rulers.create(Opisometer, [point]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            opisometer.addPoint(point);
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addOpisometer.classList.remove("pressed");
            if (opisometer.points.length < 2) rulers.remove(opisometer.id);
            if (!d3.event.sourceEvent.shiftKey) opisometer.optimize();
          });
        })
      );
    }
  }

  function toggleRouteOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve along routes to measure length. Hold Shift to measure away from roads.", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");

      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const cells = pack.cells;
          const burgs = pack.burgs;
          const point = d3.mouse(this);
          const c = findCell(point[0], point[1]);

          if (Routes.isConnected(c) || d3.event.sourceEvent.shiftKey) {
            const b = cells.burg[c];
            const x = b ? burgs[b].x : cells.p[c][0];
            const y = b ? burgs[b].y : cells.p[c][1];
            const routeOpisometer = rulers.create(RouteOpisometer, [[x, y]]).draw();

            d3.event.on("drag", function () {
              const point = d3.mouse(this);
              const c = findCell(point[0], point[1]);
              if (Routes.isConnected(c) || d3.event.sourceEvent.shiftKey) {
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
        })
      );
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
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const point = d3.mouse(this);
          const planimeter = rulers.create(Planimeter, [point]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            planimeter.addPoint(point);
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addPlanimeter.classList.remove("pressed");
            if (planimeter.points.length < 3) rulers.remove(planimeter.id);
            else if (!d3.event.sourceEvent.shiftKey) planimeter.optimize();
          });
        })
      );
    }
  }

  function removeAllRulers() {
    if (!rulers.data.length) return;
    alertMessage.innerHTML = /* html */ ` Are you sure you want to remove all placed rulers?
      <br />If you just want to hide rulers, toggle the Rulers layer off in Menu`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove all rulers",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          rulers.undraw();
          rulers = new Rulers();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }
}
