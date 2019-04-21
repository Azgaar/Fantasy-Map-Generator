// module stub to store common functions for ui editors
"use strict";

restoreDefaultEvents(); // apply default viewbox events on load

// restore default viewbox events
function restoreDefaultEvents() {
  svg.call(zoom);
  viewbox.style("cursor", "default")
    .on(".drag", null)
    .on("click", clicked)
    .on("touchmove mousemove", moved);
}

// on viewbox click event - run function based on target
function clicked() {
  const el = d3.event.target; 
  if (!el || !el.parentElement || !el.parentElement.parentElement) return;
  const parent = el.parentElement, grand = parent.parentElement;
  if (parent.id === "rivers") editRiver(); else
  if (grand.id === "routes") editRoute(); else
  if (el.tagName === "textPath" && grand.parentNode.id === "labels") editLabel(); else
  if (grand.id === "burgLabels") editBurg(); else
  if (grand.id === "burgIcons") editBurg(); else
  if (parent.id === "terrain") editReliefIcon(); else
  if (parent.id === "markers") editMarker();
}

// clear elSelected variable
function unselect() {
  restoreDefaultEvents();
  if (!elSelected) return;
  elSelected.call(d3.drag().on("drag", null)).attr("class", null);
  debug.selectAll("*").remove();
  viewbox.style("cursor", "default");
  elSelected = null;
}

// close all dialogs except stated
function closeDialogs(except = "#except") {
  $(".dialog:visible").not(except).each(function() {
    $(this).dialog("close");
  });
}

// move brush radius circle
function moveCircle(x, y, r = 20) {
  let circle = document.getElementById("brushCircle");
  if (!circle) {
    const html = `<circle id="brushCircle" cx=${x} cy=${y} r=${r}></circle>`;
    document.getElementById("debug").insertAdjacentHTML("afterBegin", html);
  } else {
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", r);
  }
}

function removeCircle() {
  if (document.getElementById("brushCircle")) document.getElementById("brushCircle").remove();
}

// get browser-defined fit-content
function fitContent() {
  return !window.chrome ? "-moz-max-content" : "fit-content";
}

// DOM elements sorting on header click
$(".sortable").on("click", function() {
  const el = $(this);
  // remove sorting for all siblings except of clicked element
  el.siblings().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
  const type = el.hasClass("alphabetically") ? "name" : "number";
  let state = "no";
  if (el.is("[class*='down']")) state = "asc";
  if (el.is("[class*='up']")) state = "desc";
  const sortby = el.attr("data-sortby");
  const list = el.parent().next(); // get list container element (e.g. "countriesBody")
  const lines = list.children("div"); // get list elements
  if (state === "no" || state === "asc") { // sort desc
    el.removeClass("icon-sort-" + type + "-down");
    el.addClass("icon-sort-" + type + "-up");
    lines.sort(function(a, b) {
      let an = a.getAttribute("data-" + sortby);
      if (an === "bottom") {return 1;}
      let bn = b.getAttribute("data-" + sortby);
      if (bn === "bottom") {return -1;}
      if (type === "number") {an = +an; bn = +bn;}
      if (an > bn) {return 1;}
      if (an < bn) {return -1;}
      return 0;
    });
  }
  if (state === "desc") { // sort asc
    el.removeClass("icon-sort-" + type + "-up");
    el.addClass("icon-sort-" + type + "-down");
    lines.sort(function(a, b) {
      let an = a.getAttribute("data-" + sortby);
      if (an === "bottom") {return 1;}
      let bn = b.getAttribute("data-" + sortby);
      if (bn === "bottom") {return -1;}
      if (type === "number") {an = +an; bn = +bn;}
      if (an < bn) {return 1;}
      if (an > bn) {return -1;}
      return 0;
    });
  }
  lines.detach().appendTo(list);
});

function applySorting(headers) {
  const header = headers.querySelector("[class*='icon-sort']");
  if (!header) return;
  const sortby = header.dataset.sortby;
  const type = header.classList.contains("alphabetically") ? "name" : "number";
  const desc = headers.querySelector("[class*='-down']") ? -1 : 1;
  const list = headers.nextElementSibling;
  const lines = Array.from(list.children);

  lines.sort(function(a, b) {
    let an = a.getAttribute("data-" + sortby);
    let bn = b.getAttribute("data-" + sortby);
    if (type === "number") {an = +an; bn = +bn;}
    return (an - bn) * desc;
  }).forEach(line => list.appendChild(line));
}

// trigger trash button click on "Delete" keypress
function removeElementOnKey() {
  $(".dialog:visible .icon-trash").click();
  $("button:visible:contains('Remove')").click();
}

function addBurg(point) {
  const cells = pack.cells;
  const x = rn(point[0], 2), y = rn(point[1], 2);
  const cell = findCell(x, point[1]);
  const i = pack.burgs.length;
  const culture = cells.culture[cell];
  const name = Names.getCulture(culture);
  const state = cells.state[cell];
  const feature = cells.f[cell];

  const population = Math.max((cells.s[cell] + cells.road[cell]) / 3 + i / 1000 + cell % 100 / 1000, .1);
  pack.burgs.push({name, cell, x, y, state, i, culture, feature, capital: false, port: 0, population});

  const townSize = burgIcons.select("#towns").attr("size") || 0.5;
  burgIcons.select("#towns").append("circle").attr("id", "burg"+i).attr("data-id", i)
    .attr("cx", x).attr("cy", y).attr("r", townSize);
  burgLabels.select("#towns").append("text").attr("id", "burgLabel"+i).attr("data-id", i)
    .attr("x", x).attr("y", y).attr("dy", `${townSize * -1.5}px`).text(name);

  return i;
}

function moveBurgToGroup(id, g) {
  const label = document.querySelector("#burgLabels [data-id='" + id + "']");
  const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
  const anchor = document.querySelector("#anchors [data-id='" + id + "']");
  if (!label || !icon) {console.error("Cannot find label or icon elements"); return;}

  document.querySelector("#burgLabels > #"+g).appendChild(label);
  document.querySelector("#burgIcons > #"+g).appendChild(icon);

  const iconSize = icon.parentNode.getAttribute("size");
  icon.setAttribute("r", iconSize);
  label.setAttribute("dy", `${iconSize * -1.5}px`);

  if (anchor) {
    document.querySelector("#anchors > #"+g).appendChild(anchor);
    const anchorSize = +anchor.parentNode.getAttribute("size");
    anchor.setAttribute("width", anchorSize);
    anchor.setAttribute("height", anchorSize);
    anchor.setAttribute("x", rn(pack.burgs[id].x - anchorSize * 0.47, 2));
    anchor.setAttribute("y", rn(pack.burgs[id].y - anchorSize * 0.47, 2));
  }
}

function removeBurg(id) {
  const label = document.querySelector("#burgLabels [data-id='" + id + "']");
  const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
  const anchor = document.querySelector("#anchors [data-id='" + id + "']");
  if (label) label.remove();
  if (icon) icon.remove();
  if (anchor) anchor.remove();
  pack.burgs[id].removed = true;
  const cell = pack.burgs[id].cell;
  pack.cells.burg[cell] = 0;
}