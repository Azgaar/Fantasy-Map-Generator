"use strict";
function editRoute(onClick) {
  if (customization) return;
  if (!onClick && elSelected && d3.event.target.id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  $("#routeEditor").dialog({
    title: "Edit Route", resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeRoutesEditor
  });

  debug.append("g").attr("id", "controlPoints");
  const node = onClick ? elSelected.node() : d3.event.target;
  elSelected = d3.select(node).on("click", addInterimControlPoint);
  drawControlPoints(node);
  selectRouteGroup(node);

  viewbox.on("touchmove mousemove", showEditorTips);
  if (onClick) toggleRouteCreationMode();

  if (modules.editRoute) return;
  modules.editRoute = true;

  // add listeners
  document.getElementById("routeGroupsShow").addEventListener("click", showGroupSection);
  document.getElementById("routeGroup").addEventListener("change", changeRouteGroup);
  document.getElementById("routeGroupAdd").addEventListener("click", toggleNewGroupInput);
  document.getElementById("routeGroupName").addEventListener("change", createNewGroup);
  document.getElementById("routeGroupRemove").addEventListener("click", removeRouteGroup);
  document.getElementById("routeGroupsHide").addEventListener("click", hideGroupSection);

  document.getElementById("routeEditStyle").addEventListener("click", editGroupStyle);
  document.getElementById("routeSplit").addEventListener("click", toggleRouteSplitMode);
  document.getElementById("routeLegend").addEventListener("click", editRouteLegend);
  document.getElementById("routeNew").addEventListener("click", toggleRouteCreationMode);
  document.getElementById("routeRemove").addEventListener("click", removeRoute);

  function showEditorTips() {
    showMainTip();
    if (routeNew.classList.contains("pressed")) return;
    if (d3.event.target.id === elSelected.attr("id")) tip("Click to add a control point"); else
    if (d3.event.target.parentNode.id === "controlPoints") tip("Drag to move, click to delete the control point");
  }

  function drawControlPoints(node) {
    const l = node.getTotalLength();
    const increment = l / Math.ceil(l / 8);
    for (let i=0; i <= l; i += increment) {addControlPoint(node.getPointAtLength(i));}
    routeLength.innerHTML = rn(l * distanceScaleInput.value) + " " + distanceUnitInput.value;
  }
  
  function addControlPoint(point) {
    debug.select("#controlPoints").append("circle")
      .attr("cx", point.x).attr("cy", point.y).attr("r", .8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);
  }

  function addInterimControlPoint() {
    const point = d3.mouse(this);

    const dists = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      const x = +this.getAttribute("cx");
      const y = +this.getAttribute("cy");
      dists.push((point[0] - x) ** 2 + (point[1] - y) ** 2);
    });

    let index = dists.length;
    if (dists.length > 1) {
      const sorted = dists.slice(0).sort((a, b) => a-b);
      const closest = dists.indexOf(sorted[0]);
      const next = dists.indexOf(sorted[1]);
      if (closest <= next) index = closest+1; else index = next+1;
    }

    const before = ":nth-child(" + (index + 1) + ")";
    debug.select("#controlPoints").insert("circle", before)
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", .8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);

    redrawRoute();
  }
  
  function dragControlPoint() {
    this.setAttribute("cx", d3.event.x);
    this.setAttribute("cy", d3.event.y);
    redrawRoute();
  }

  function redrawRoute() {
    lineGen.curve(d3.curveCatmullRom.alpha(.1));
    const points = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      points.push([this.getAttribute("cx"), this.getAttribute("cy")]);
    });

    elSelected.attr("d", round(lineGen(points)));
    const l = elSelected.node().getTotalLength();
    routeLength.innerHTML = rn(l * distanceScaleInput.value) + " " + distanceUnitInput.value;    
  }

  function showGroupSection() {
    document.querySelectorAll("#routeEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("routeGroupsSelection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#routeEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("routeGroupsSelection").style.display = "none";
    document.getElementById("routeGroupName").style.display = "none";
    document.getElementById("routeGroupName").value = "";
    document.getElementById("routeGroup").style.display = "inline-block"; 
  }

  function selectRouteGroup(node) {
    const group = node.parentNode.id;
    const select = document.getElementById("routeGroup");
    select.options.length = 0; // remove all options

    routes.selectAll("g").each(function() {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }
  
  function changeRouteGroup() {
    document.getElementById(this.value).appendChild(elSelected.node());
  }
  
  function toggleNewGroupInput() {
    if (routeGroupName.style.display === "none") {
      routeGroupName.style.display = "inline-block";
      routeGroupName.focus();
      routeGroup.style.display = "none";
    } else {
      routeGroupName.style.display = "none";
      routeGroup.style.display = "inline-block";
    }   
  }
  
  function createNewGroup() {
    if (!this.value) {tip("Please provide a valid group name"); return;}
    const group = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");

    if (document.getElementById(group)) {
      tip("Element with this id already exists. Please provide a unique name", false, "error");
      return;
    }

    if (Number.isFinite(+group.charAt(0))) {
      tip("Group name should start with a letter", false, "error");
      return;
    }
    // just rename if only 1 element left
    const oldGroup = elSelected.node().parentNode;
    const basic = ["roads", "trails", "searoutes"].includes(oldGroup.id);
    if (!basic && oldGroup.childElementCount === 1) {
      document.getElementById("routeGroup").selectedOptions[0].remove();      
      document.getElementById("routeGroup").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      document.getElementById("routeGroupName").value = "";      
      return;
    }

    const newGroup = elSelected.node().parentNode.cloneNode(false);
    document.getElementById("routes").appendChild(newGroup);
    newGroup.id = group;
    document.getElementById("routeGroup").options.add(new Option(group, group, false, true));
    document.getElementById(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    document.getElementById("routeGroupName").value = "";
  }
  
  function removeRouteGroup() {
    const group = elSelected.node().parentNode.id;
    const basic = ["roads", "trails", "searoutes"].includes(group);
    const count = elSelected.node().parentNode.childElementCount;
    alertMessage.innerHTML = `Are you sure you want to remove 
      ${basic ? "all elements in the group" : "the entire route group"}?
      <br><br>Routes to be removed: ${count}`;
    $("#alert").dialog({resizable: false, title: "Remove route group",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          $("#routeEditor").dialog("close");
          hideGroupSection();
          if (basic) routes.select("#"+group).selectAll("path").remove();
          else routes.select("#"+group).remove();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function editGroupStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("routes", g);
  }

  function toggleRouteSplitMode() {
    document.getElementById("routeNew").classList.remove("pressed");
    this.classList.toggle("pressed");
  }

  function clickControlPoint() {
    if (routeSplit.classList.contains("pressed")) splitRoute(this);
    else {this.remove(); redrawRoute();}
  }
  
  function splitRoute(clicked) {
    lineGen.curve(d3.curveCatmullRom.alpha(.1));
    const group = d3.select(elSelected.node().parentNode);
    routeSplit.classList.remove("pressed");

    const points1 = [], points2 = [];
    let points = points1;
    debug.select("#controlPoints").selectAll("circle").each(function() {
      points.push([this.getAttribute("cx"), this.getAttribute("cy")]);
      if (this === clicked) {
        points = points2;
        points.push([this.getAttribute("cx"), this.getAttribute("cy")]);
      }
      this.remove();
    });

    elSelected.attr("d", round(lineGen(points1)));
    const id = getNextId("route");
    group.append("path").attr("id", id).attr("d", lineGen(points2));
    debug.select("#controlPoints").selectAll("circle").remove();
    drawControlPoints(elSelected.node());
  }

  function toggleRouteCreationMode() {
    document.getElementById("routeSplit").classList.remove("pressed");
    document.getElementById("routeNew").classList.toggle("pressed");
    if (document.getElementById("routeNew").classList.contains("pressed")) {
      tip("Click on map to add control points", true);
      viewbox.on("click", addPointOnClick).style("cursor", "crosshair");
      elSelected.on("click", null);
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
      elSelected.on("click", addInterimControlPoint).attr("data-new", null);
    }
  }

  function addPointOnClick() {
    // create new route
    if (!elSelected.attr("data-new")) {
      debug.select("#controlPoints").selectAll("circle").remove();
      const parent = elSelected.node().parentNode;
      const id = getNextId("route");
      elSelected = d3.select(parent).append("path").attr("id", id).attr("data-new", 1);
    }

    // add control point
    const point = d3.mouse(this);
    addControlPoint({x: point[0], y: point[1]});
    redrawRoute();
  }

  function editRouteLegend() {
    const id = elSelected.attr("id");
    editNotes(id, id);
  }

  function removeRoute() {
    alertMessage.innerHTML = "Are you sure you want to remove the route?";
    $("#alert").dialog({resizable: false, title: "Remove route",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          elSelected.remove();
          $("#routeEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function closeRoutesEditor() {
    elSelected.attr("data-new", null).on("click", null);
    clearMainTip();
    routeSplit.classList.remove("pressed");
    routeNew.classList.remove("pressed");
    debug.select("#controlPoints").remove();
    unselect();
  }
}
