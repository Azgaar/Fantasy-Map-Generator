"use strict";

window.Markers = (function () {
  const generate = (number = 1) => {
    if (number === 0) return;
    TIME && console.time("addMarkers");

    addVolcanoes(number);
    addHotSprings(number);
    addMines(number);
    addBridges(number);
    addInns(number);
    addLighthouses(number);
    addWaterfalls(number);
    addBattlefields(number);

    TIME && console.timeEnd("addMarkers");
  };

  function addVolcanoes(number) {
    const {cells} = pack;

    let mounts = Array.from(cells.i)
      .filter(i => cells.h[i] > 70)
      .sort((a, b) => cells.h[b] - cells.h[a]);
    let count = mounts.length < 10 ? 0 : Math.ceil((mounts.length / 300) * number);
    if (count) addMarker("volcano", "🌋", 52, 50, 13);

    while (count && mounts.length) {
      const cell = mounts.splice(biased(0, mounts.length - 1, 5), 1);
      const x = cells.p[cell][0],
        y = cells.p[cell][1];
      const id = appendMarker(cell, "volcano");
      const proper = Names.getCulture(cells.culture[cell]);
      const name = P(0.3) ? "Mount " + proper : Math.random() > 0.3 ? proper + " Volcano" : proper;
      notes.push({id, name, legend: `Active volcano. Height: ${getFriendlyHeight([x, y])}`});
      count--;
    }
  }

  function addHotSprings(number) {
    const {cells} = pack;

    let springs = Array.from(cells.i)
      .filter(i => cells.h[i] > 50)
      .sort((a, b) => cells.h[b] - cells.h[a]);
    let count = springs.length < 30 ? 0 : Math.ceil((springs.length / 1000) * number);
    if (count) addMarker("hot_springs", "♨️", 50, 52, 12.5);

    while (count && springs.length) {
      const cell = springs.splice(biased(1, springs.length - 1, 3), 1);
      const id = appendMarker(cell, "hot_springs");
      const proper = Names.getCulture(cells.culture[cell]);
      const temp = convertTemperature(gauss(30, 15, 20, 100));
      notes.push({id, name: proper + " Hot Springs", legend: `A hot springs area. Temperature: ${temp}`});
      count--;
    }
  }

  function addMines(number) {
    const {cells} = pack;

    let hills = Array.from(cells.i).filter(i => cells.h[i] > 47 && cells.burg[i]);
    let count = !hills.length ? 0 : Math.ceil((hills.length / 7) * number);
    if (!count) return;

    addMarker("mine", "⛏️", 48, 50, 13.5);
    const resources = {salt: 5, gold: 2, silver: 4, copper: 2, iron: 3, lead: 1, tin: 1};

    while (count && hills.length) {
      const cell = hills.splice(Math.floor(Math.random() * hills.length), 1);
      const id = appendMarker(cell, "mine");
      const resource = rw(resources);
      const burg = pack.burgs[cells.burg[cell]];
      const name = `${burg.name} — ${resource} mining town`;
      const population = rn(burg.population * populationRate * urbanization);
      const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine`;
      notes.push({id, name, legend});
      count--;
    }
  }

  function addBridges(number) {
    const {cells} = pack;

    const meanRoad = d3.mean(cells.road.filter(r => r));
    const meanFlux = d3.mean(cells.fl.filter(fl => fl));

    let bridges = Array.from(cells.i)
      .filter(i => cells.burg[i] && cells.h[i] >= 20 && cells.r[i] && cells.fl[i] > meanFlux && cells.road[i] > meanRoad)
      .sort((a, b) => cells.road[b] + cells.fl[b] / 10 - (cells.road[a] + cells.fl[a] / 10));

    let count = !bridges.length ? 0 : Math.ceil((bridges.length / 12) * number);
    if (count) addMarker("bridge", "🌉", 50, 50, 14);

    while (count && bridges.length) {
      const cell = bridges.splice(0, 1);
      const id = appendMarker(cell, "bridge");
      const burg = pack.burgs[cells.burg[cell]];
      const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
      const riverName = river ? `${river.name} ${river.type}` : "river";
      const name = river && P(0.2) ? river.name : burg.name;
      notes.push({id, name: `${name} Bridge`, legend: `A stone bridge over the ${riverName} near ${burg.name}`});
      count--;
    }
  }

  function addInns(number) {
    const {cells} = pack;

    const maxRoad = d3.max(cells.road) * 0.9;
    let taverns = Array.from(cells.i).filter(i => cells.crossroad[i] && cells.h[i] >= 20 && cells.road[i] > maxRoad);
    if (!taverns.length) return;
    const count = Math.ceil(4 * number);
    addMarker("inn", "🍻", 50, 50, 14.5);

    const color = ["Dark", "Light", "Bright", "Golden", "White", "Black", "Red", "Pink", "Purple", "Blue", "Green", "Yellow", "Amber", "Orange", "Brown", "Grey"];
    const animal = ["Antelope", "Ape", "Badger", "Bear", "Beaver", "Bison", "Boar", "Buffalo", "Cat", "Crane", "Crocodile", "Crow", "Deer", "Dog", "Eagle", "Elk", "Fox", "Goat", "Goose", "Hare", "Hawk", "Heron", "Horse", "Hyena", "Ibis", "Jackal", "Jaguar", "Lark", "Leopard", "Lion", "Mantis", "Marten", "Moose", "Mule", "Narwhal", "Owl", "Panther", "Rat", "Raven", "Rook", "Scorpion", "Shark", "Sheep", "Snake", "Spider", "Swan", "Tiger", "Turtle", "Wolf", "Wolverine", "Camel", "Falcon", "Hound", "Ox"];
    const adj = ["New", "Good", "High", "Old", "Great", "Big", "Major", "Happy", "Main", "Huge", "Far", "Beautiful", "Fair", "Prime", "Ancient", "Golden", "Proud", "Lucky", "Fat", "Honest", "Giant", "Distant", "Friendly", "Loud", "Hungry", "Magical", "Superior", "Peaceful", "Frozen", "Divine", "Favorable", "Brave", "Sunny", "Flying"];

    for (let i = 0; i < taverns.length && i < count; i++) {
      const cell = taverns.splice(Math.floor(Math.random() * taverns.length), 1);
      const id = appendMarker(cell, "inn");
      const type = P(0.3) ? "inn" : "tavern";
      const name = P(0.5) ? ra(color) + " " + ra(animal) : P(0.6) ? ra(adj) + " " + ra(animal) : ra(adj) + " " + capitalize(type);
      notes.push({id, name: "The " + name, legend: `A big and famous roadside ${type}`});
    }
  }

  function addLighthouses(number) {
    const {cells} = pack;

    const lands = cells.i.filter(i => cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && cells.road[c]));
    const lighthouses = Array.from(lands).map(i => [i, cells.v[i][cells.c[i].findIndex(c => cells.h[c] < 20 && cells.road[c])]]);
    if (lighthouses.length) addMarker("lighthouse", "🚨", 50, 50, 16);
    const count = Math.ceil(4 * number);

    for (let i = 0; i < lighthouses.length && i < count; i++) {
      const [cell, vertex] = lighthouses[i];
      const id = appendMarker(cell, "lighthouse");
      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Lighthouse" + name, legend: `A lighthouse to keep the navigation safe`});
    }
  }

  function addWaterfalls(number) {
    const {cells} = pack;

    const waterfalls = cells.i.filter(i => cells.r[i] && cells.h[i] > 70);
    if (waterfalls.length) addMarker("waterfall", "⟱", 50, 54, 16.5);
    const count = Math.ceil(3 * number);

    for (let i = 0; i < waterfalls.length && i < count; i++) {
      const cell = waterfalls[i];
      const id = appendMarker(cell, "waterfall");
      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Waterfall" + name, legend: `An extremely beautiful waterfall`});
    }
  }

  function addBattlefields(number) {
    const {cells, states} = pack;

    let battlefields = Array.from(cells.i).filter(i => cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25);
    let count = battlefields.length < 100 ? 0 : Math.ceil((battlefields.length / 500) * number);
    if (count) addMarker("battlefield", "⚔️", 50, 52, 12);

    while (count && battlefields.length) {
      const cell = battlefields.splice(Math.floor(Math.random() * battlefields.length), 1);
      const id = appendMarker(cell, "battlefield");
      const campaign = ra(states[cells.state[cell]].campaigns);
      const date = generateDate(campaign.start, campaign.end);
      const name = Names.getCulture(cells.culture[cell]) + " Battlefield";
      const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.era}`;
      notes.push({id, name, legend});
      count--;
    }
  }

  function addMarker(id, icon, x, y, size) {
    const markers = svg.select("#defs-markers");
    if (markers.select("#marker_" + id).size()) return;

    const symbol = markers
      .append("symbol")
      .attr("id", "marker_" + id)
      .attr("viewBox", "0 0 30 30");
    symbol.append("path").attr("d", "M6,19 l9,10 L24,19").attr("fill", "#000000").attr("stroke", "none");
    symbol.append("circle").attr("cx", 15).attr("cy", 15).attr("r", 10).attr("fill", "#ffffff").attr("stroke", "#000000").attr("stroke-width", 1);
    symbol
      .append("text")
      .attr("x", x + "%")
      .attr("y", y + "%")
      .attr("fill", "#000000")
      .attr("stroke", "#3200ff")
      .attr("stroke-width", 0)
      .attr("font-size", size + "px")
      .attr("dominant-baseline", "central")
      .text(icon);
  }

  function appendMarker(cell, type) {
    const {cells} = pack;

    const [x, y] = cells.p[cell];
    const id = getNextId("markerElement");
    const name = "#marker_" + type;

    markers
      .append("use")
      .attr("id", id)
      .attr("xlink:href", name)
      .attr("data-id", name)
      .attr("data-x", x)
      .attr("data-y", y)
      .attr("x", x - 15)
      .attr("y", y - 30)
      .attr("data-size", 1)
      .attr("width", 30)
      .attr("height", 30);

    return id;
  }

  return {generate};
})();
