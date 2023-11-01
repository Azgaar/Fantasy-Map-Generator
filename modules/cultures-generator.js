"use strict";

window.Cultures = (function () {
  let cells;

  const generate = function () {
    TIME && console.time("generateCultures");
    cells = pack.cells;

    const cultureIds = new Uint16Array(cells.i.length); // cell cultures
    let count = Math.min(+culturesInput.value, +culturesSet.selectedOptions[0].dataset.max);

    const populated = cells.i.filter(i => cells.s[i]); // populated cells
    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        WARN && console.warn(`There are no populated cells. Cannot generate cultures`);
        pack.cultures = [{name: "Wildlands", i: 0, base: 1, shield: "round", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"}];
        cells.culture = cultureIds;

        alertMessage.innerHTML = /* html */ `The climate is harsh and people cannot live in this world.<br />
          No cultures, states and burgs will be created.<br />
          Please consider changing climate settings in the World Configurator`;

        $("#alert").dialog({
          resizable: false,
          title: "Extreme climate warning",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
        return;
      } else {
        WARN && console.warn(`Not enough populated cells (${populated.length}). Will generate only ${count} cultures`);
        alertMessage.innerHTML = /* html */ ` There are only ${populated.length} populated cells and it's insufficient livable area.<br />
          Only ${count} out of ${culturesInput.value} requested cultures will be generated.<br />
          Please consider changing climate settings in the World Configurator`;
        $("#alert").dialog({
          resizable: false,
          title: "Extreme climate warning",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
      }
    }

    const cultures = (pack.cultures = selectCultures(count));
    const centers = d3.quadtree();
    const colors = getColors(count);
    const emblemShape = document.getElementById("emblemShape").value;

    const codes = [];

    cultures.forEach(function (c, i) {
      const newId = i + 1;

      if (c.lock) {
        codes.push(c.code);
        centers.add(c.center);

        for (const i of cells.i) {
          if (cells.culture[i] === c.i) cultureIds[i] = newId;
        }

        c.i = newId;
        return;
      }

      const cell = (c.center = placeCenter(c.sort ? c.sort : i => cells.s[i]));
      centers.add(cells.p[cell]);
      c.i = newId;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(cell);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origins = [0];
      c.code = abbreviate(c.name, codes);
      codes.push(c.code);
      cultureIds[cell] = newId;
      if (emblemShape === "random") c.shield = getRandomShield();
    });

    cells.culture = cultureIds;

    function placeCenter(v) {
      let spacing = (graphWidth + graphHeight) / 2 / count;
      const MAX_ATTEMPTS = 100;

      const sorted = [...populated].sort((a, b) => v(b) - v(a));
      const max = Math.floor(sorted.length / 2);

      let cellId = 0;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        cellId = sorted[biased(0, max, 5)];
        spacing *= 0.9;
        if (!cultureIds[cellId] && !centers.find(cells.p[cellId][0], cells.p[cellId][1], spacing)) break;
      }

      return cellId;
    }

    // the first culture with id 0 is for wildlands
    cultures.unshift({name: "Wildlands", i: 0, base: 1, origins: [null], shield: "round", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"});

    // make sure all bases exist in nameBases
    if (!nameBases.length) {
      ERROR && console.error("Name base is empty, default nameBases will be applied");
      nameBases = Names.getNameBases();
    }

    cultures.forEach(c => (c.base = c.base % nameBases.length));

    function selectCultures(culturesNumber) {
      let def = getDefault(culturesNumber);
      const cultures = [];

      pack.cultures?.forEach(function (culture) {
        if (culture.lock) cultures.push(culture);
      });

      if (!cultures.length) {
        if (culturesNumber === def.length) return def;
        if (def.every(d => d.odd === 1)) return def.splice(0, culturesNumber);
      }

      for (let culture, rnd, i = 0; cultures.length < culturesNumber && def.length > 0; ) {
        do {
          rnd = rand(def.length - 1);
          culture = def[rnd];
          i++;
        } while (i < 200 && !P(culture.odd));
        cultures.push(culture);
        def.splice(rnd, 1);
      }
      return cultures;
    }

    // set culture type based on culture center position
    function defineCultureType(i) {
      if (cells.h[i] < 70 && [1, 2, 4].includes(cells.biome[i])) return "Nomadic"; // high penalty in forest biomes and near coastline
      if (cells.h[i] > 50) return "Highland"; // no penalty for hills and moutains, high for other elevations
      const f = pack.features[cells.f[cells.haven[i]]]; // opposite feature
      if (f.type === "lake" && f.cells > 5) return "Lake"; // low water cross penalty and high for growth not along coastline
      if (
        (cells.harbor[i] && f.type !== "lake" && P(0.1)) ||
        (cells.harbor[i] === 1 && P(0.6)) ||
        (pack.features[cells.f[i]].group === "isle" && P(0.4))
      )
        return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (cells.r[i] && cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      if (cells.t[i] > 2 && [3, 7, 8, 9, 10, 12].includes(cells.biome[i])) return "Hunting"; // high penalty in non-native biomes
      return "Generic";
    }

    function defineCultureExpansionism(type) {
      let base = 1; // Generic
      if (type === "Lake") base = 0.8;
      else if (type === "Naval") base = 1.5;
      else if (type === "River") base = 0.9;
      else if (type === "Nomadic") base = 1.5;
      else if (type === "Hunting") base = 0.7;
      else if (type === "Highland") base = 1.2;
      return rn(((Math.random() * powerInput.value) / 2 + 1) * base, 1);
    }

    TIME && console.timeEnd("generateCultures");
  };

  const add = function (center) {
    const defaultCultures = getDefault();
    let culture, base, name;

    if (pack.cultures.length < defaultCultures.length) {
      // add one of the default cultures
      culture = pack.cultures.length;
      base = defaultCultures[culture].base;
      name = defaultCultures[culture].name;
    } else {
      // add random culture based on one of the current ones
      culture = rand(pack.cultures.length - 1);
      name = Names.getCulture(culture, 5, 8, "");
      base = pack.cultures[culture].base;
    }
    const code = abbreviate(
      name,
      pack.cultures.map(c => c.code)
    );
    const i = pack.cultures.length;
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();

    // define emblem shape
    let shield = culture.shield;
    let charges = culture.charges;
    let lines = culture.lines;
    const emblemShape = document.getElementById("emblemShape").value;
    if (emblemShape === "random") shield = getRandomShield();

    pack.cultures.push({
      name,
      color,
      base,
      center,
      i,
      expansionism: 1,
      type: "Generic",
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins: [0],
      code,
      shield,
      charges,
      lines,
      tinctures
    });
  };

  const getDefault = function (count) {
    // generic sorting functions
    const cells = pack.cells,
      s = cells.s,
      sMax = d3.max(s),
      t = cells.t,
      h = cells.h,
      temp = grid.cells.temp;
    const n = cell => Math.ceil((s[cell] / sMax) * 3); // normalized cell score
    const td = (cell, goal) => {
      const d = Math.abs(temp[cells.g[cell]] - goal);
      return d ? d + 1 : 1;
    }; // temperature difference fee
    const bd = (cell, biomes, fee = 4) => (biomes.includes(cells.biome[cell]) ? 1 : fee); // biome difference fee
    const sf = (cell, fee = 4) =>
      cells.haven[cell] && pack.features[cells.f[cells.haven[cell]]].type !== "lake" ? 1 : fee; // not on sea coast fee

    if (culturesSet.value === "european") {
      return [
        {name: "Shwazen", base: 0, odd: 1, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "swiss", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "wedged", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Luari", base: 2, odd: 1, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "french", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Tallian", base: 3, odd: 1, sort: i => n(i) / td(i, 15), shield: "horsehead", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Astellian", base: 4, odd: 1, sort: i => n(i) / td(i, 16), shield: "spanish", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Slovan", base: 5, odd: 1, sort: i => (n(i) / td(i, 6)) * t[i], shield: "polish", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Norse", base: 6, odd: 1, sort: i => n(i) / td(i, 5), shield: "heater", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Elladan", base: 7, odd: 1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "boeotian", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Romian", base: 8, odd: 0.2, sort: i => n(i) / td(i, 15) / t[i], shield: "roman", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Soumi", base: 9, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Portuzian", base: 13, odd: 1, sort: i => n(i) / td(i, 17) / sf(i), shield: "renaissance", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Vengrian", base: 15, odd: 1, sort: i => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "horsehead2", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Turchian", base: 16, odd: 0.05, sort: i => n(i) / td(i, 14), shield: "round", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Euskati", base: 20, odd: 0.05, sort: i => (n(i) / td(i, 15)) * h[i], shield: "oldFrench", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Keltan", base: 22, odd: 0.05, sort: i => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "oval", charges: "Limited", lines: "All", tinctures: "All"}
      ];
    }

    if (culturesSet.value === "oriental") {
      return [
        {name: "Koryo", base: 10, odd: 1, sort: i => n(i) / td(i, 12) / t[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Hantzu", base: 11, odd: 1, sort: i => n(i) / td(i, 13), shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Yamoto", base: 12, odd: 1, sort: i => n(i) / td(i, 15) / t[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Turchian", base: 16, odd: 1, sort: i => n(i) / td(i, 12), shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {
          name: "Berberan",
          base: 17,
          odd: 0.2,
          sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
          shield: "oval", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
        },
        {name: "Eurabic", base: 18, odd: 1, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "oval", charges: "Shapes", lines: "All", tinctures: "All"},
        {name: "Efratic", base: 23, odd: 0.1, sort: i => (n(i) / td(i, 22)) * t[i], shield: "round", charges: "Shapes", lines: "All", tinctures: "All"},
        {name: "Tehrani", base: 24, odd: 1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Maui", base: 25, odd: 0.2, sort: i => n(i) / td(i, 24) / sf(i) / t[i], shield: "vesicaPiscis", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Carnatic", base: 26, odd: 0.5, sort: i => n(i) / td(i, 26), shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Vietic", base: 29, odd: 0.8, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Guantzu", base: 30, odd: 0.5, sort: i => n(i) / td(i, 17), shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Ulus", base: 31, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"}
      ];
    }

    if (culturesSet.value === "english") {
      const getName = () => Names.getBase(1, 5, 9, "", 0);
      return [
        {name: getName(), base: 1, odd: 1, shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "wedged", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "swiss", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "oldFrench", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "swiss", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "spanish", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "hessen", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "fantasy5", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "fantasy4", charges: "Limited", lines: "All", tinctures: "All"},
        {name: getName(), base: 1, odd: 1, shield: "fantasy1", charges: "Limited", lines: "All", tinctures: "All"}
      ];
    }

    if (culturesSet.value === "antique") {
      return [
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 14) / t[i], shield: "roman", charges: "Limited", lines: "All", tinctures: "All"}, // Roman
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 15) / sf(i), shield: "roman", charges: "Limited", lines: "All", tinctures: "All"}, // Roman
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 16) / sf(i), shield: "roman", charges: "Limited", lines: "All", tinctures: "All"}, // Roman
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 17) / t[i], shield: "roman", charges: "Limited", lines: "All", tinctures: "All"}, // Roman
        {name: "Hellenic", base: 7, odd: 1, sort: i => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian", charges: "Limited", lines: "All", tinctures: "All"}, // Greek
        {name: "Hellenic", base: 7, odd: 1, sort: i => (n(i) / td(i, 19) / sf(i)) * h[i], shield: "boeotian", charges: "Limited", lines: "All", tinctures: "All"}, // Greek
        {name: "Macedonian", base: 7, odd: 0.5, sort: i => (n(i) / td(i, 12)) * h[i], shield: "round", charges: "Limited", lines: "All", tinctures: "All"}, // Greek
        {name: "Celtic", base: 22, odd: 1, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]), shield: "round", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Germanic", base: 0, odd: 1, sort: i => n(i) / td(i, 10) ** 0.5 / bd(i, [6, 8]), shield: "round", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Persian", base: 24, odd: 0.8, sort: i => (n(i) / td(i, 18)) * h[i], shield: "oval", charges: "Limited", lines: "All", tinctures: "All"}, // Iranian
        {name: "Scythian", base: 24, odd: 0.5, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [4]), shield: "round", charges: "Limited", lines: "All", tinctures: "All"}, // Iranian
        {name: "Cantabrian", base: 20, odd: 0.5, sort: i => (n(i) / td(i, 16)) * h[i], shield: "oval", charges: "Limited", lines: "All", tinctures: "All"}, // Basque
        {name: "Estian", base: 9, odd: 0.2, sort: i => (n(i) / td(i, 5)) * t[i], shield: "pavise", charges: "Limited", lines: "All", tinctures: "All"}, // Finnic
        {name: "Carthaginian", base: 42, odd: 0.3, sort: i => n(i) / td(i, 20) / sf(i), shield: "oval", charges: "Limited", lines: "All", tinctures: "All"}, // Levantine
        {name: "Hebrew", base: 42, odd: 0.2, sort: i => (n(i) / td(i, 19)) * sf(i), shield: "oval", charges: "Shapes", lines: "All", tinctures: "All"}, // Levantine
        {name: "Mesopotamian", base: 23, odd: 0.2, sort: i => n(i) / td(i, 22) / bd(i, [1, 2, 3]), shield: "oval", charges: "Limited", lines: "All", tinctures: "All"} // Mesopotamian
      ];
    }

    if (culturesSet.value === "highFantasy") {
      return [
        // fantasy races
        {
          name: "Quenian (Elfish)",
          base: 33,
          odd: 1,
          sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "gondor", charges: "Nature", lines: "All", tinctures: "All"
        }, // Elves
        {
          name: "Eldar (Elfish)",
          base: 33,
          odd: 1,
          sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "noldor", charges: "Nature", lines: "All", tinctures: "All"
        }, // Elves
        {
          name: "Trow (Dark Elfish)",
          base: 34,
          odd: 0.9,
          sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "hessen", charges: "Limited", lines: "All", tinctures: "All"
        }, // Dark Elves
        {
          name: "Lothian (Dark Elfish)",
          base: 34,
          odd: 0.3,
          sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "wedged", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
        }, // Dark Elves
        {name: "Dunirr (Dwarven)", base: 35, odd: 1, sort: i => n(i) + h[i], shield: "ironHills", charges: "Shapes", lines: "Things", tinctures: "All"}, // Dwarfs
        {name: "Khazadur (Dwarven)", base: 35, odd: 1, sort: i => n(i) + h[i], shield: "erebor", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"}, // Dwarfs
        {name: "Kobold (Goblin)", base: 36, odd: 1, sort: i => t[i] - s[i], shield: "moriaOrc", charges: "None", lines: "None", tinctures: "NoStains"}, // Goblin
        {name: "Uruk (Orkish)", base: 37, odd: 1, sort: i => h[i] * t[i], shield: "urukHai", charges: "Limited", lines: "Straight", tinctures: "NoPatterns"}, // Orc
        {
          name: "Ugluk (Orkish)",
          base: 37,
          odd: 0.5,
          sort: i => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]),
          shield: "moriaOrc", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
        }, // Orc
        {name: "Yotunn (Giants)", base: 38, odd: 0.7, sort: i => td(i, -10), shield: "pavise", charges: "Limited", lines: "Straight", tinctures: "NoPatterns"}, // Giant
        {name: "Rake (Drakonic)", base: 39, odd: 0.7, sort: i => -s[i], shield: "fantasy2", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"}, // Draconic
        {name: "Arago (Arachnid)", base: 40, odd: 0.7, sort: i => t[i] - s[i], shield: "horsehead2", charges: "Shapes", lines: "None", tinctures: "NoPatterns"}, // Arachnid
        {name: "Aj'Snaga (Serpents)", base: 41, odd: 0.7, sort: i => n(i) / bd(i, [12], 10), shield: "fantasy1", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"}, // Serpents
        // fantasy human
        {name: "Anor (Human)", base: 32, odd: 1, sort: i => n(i) / td(i, 10), shield: "fantasy5", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Dail (Human)", base: 32, odd: 1, sort: i => n(i) / td(i, 13), shield: "roman", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Rohand (Human)", base: 16, odd: 1, sort: i => n(i) / td(i, 16), shield: "round", charges: "Limited", lines: "All", tinctures: "All"},
        {
          name: "Dulandir (Human)",
          base: 31,
          odd: 1,
          sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "easterling", charges: "Limited", lines: "All", tinctures: "All"
        }
      ];
    }

    if (culturesSet.value === "darkFantasy") {
      return [
        // common real-world English
        {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Enlandic", base: 1, odd: 1, sort: i => n(i) / td(i, 12), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Westen", base: 1, odd: 1, sort: i => n(i) / td(i, 10), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Nortumbic", base: 1, odd: 1, sort: i => n(i) / td(i, 7), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Mercian", base: 1, odd: 1, sort: i => n(i) / td(i, 9), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        {name: "Kentian", base: 1, odd: 1, sort: i => n(i) / td(i, 12), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
        // rare real-world western
        {name: "Norse", base: 6, odd: 0.7, sort: i => n(i) / td(i, 5) / sf(i), shield: "oldFrench", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Schwarzen", base: 0, odd: 0.3, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "gonfalon", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Luarian", base: 2, odd: 0.3, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Hetallian", base: 3, odd: 0.3, sort: i => n(i) / td(i, 15), shield: "oval", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Astellian", base: 4, odd: 0.3, sort: i => n(i) / td(i, 16), shield: "spanish", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        // rare real-world exotic
        {
          name: "Kiswaili",
          base: 28,
          odd: 0.05,
          sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]),
          shield: "vesicaPiscis", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
        },
        {name: "Yoruba", base: 21, odd: 0.05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Koryo", base: 10, odd: 0.05, sort: i => n(i) / td(i, 12) / t[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Hantzu", base: 11, odd: 0.05, sort: i => n(i) / td(i, 13), shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Yamoto", base: 12, odd: 0.05, sort: i => n(i) / td(i, 15) / t[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Guantzu", base: 30, odd: 0.05, sort: i => n(i) / td(i, 17), shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {
          name: "Ulus",
          base: 31,
          odd: 0.05,
          sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
        },
        {name: "Turan", base: 16, odd: 0.05, sort: i => n(i) / td(i, 12), shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
        {
          name: "Berberan",
          base: 17,
          odd: 0.05,
          sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
          shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
        },
        {
          name: "Eurabic",
          base: 18,
          odd: 0.05,
          sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
          shield: "round", charges: "Shapes", lines: "All", tinctures: "All"
        },
        {name: "Slovan", base: 5, odd: 0.05, sort: i => (n(i) / td(i, 6)) * t[i], shield: "round", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {
          name: "Keltan",
          base: 22,
          odd: 0.1,
          sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]),
          shield: "vesicaPiscis", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"
        },
        {name: "Elladan", base: 7, odd: 0.2, sort: i => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        {name: "Romian", base: 8, odd: 0.2, sort: i => n(i) / td(i, 14) / t[i], shield: "roman", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
        // fantasy races
        {name: "Eldar", base: 33, odd: 0.5, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "fantasy5", charges: "Nature", lines: "All", tinctures: "All"}, // Elves
        {name: "Trow", base: 34, odd: 0.8, sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "hessen", charges: "Shapes", lines: "All", tinctures: "All"}, // Dark Elves
        {name: "Durinn", base: 35, odd: 0.8, sort: i => n(i) + h[i], shield: "erebor", charges: "Shapes", lines: "All", tinctures: "All"}, // Dwarven
        {name: "Kobblin", base: 36, odd: 0.8, sort: i => t[i] - s[i], shield: "moriaOrc", charges: "Shapes", lines: "None", tinctures: "NoStains"}, // Goblin
        {name: "Uruk", base: 37, odd: 0.8, sort: i => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "urukHai", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"}, // Orc
        {name: "Yotunn", base: 38, odd: 0.8, sort: i => td(i, -10), shield: "pavise", charges: "Limited", lines: "Straight", tinctures: "NoPatterns"}, // Giant
        {name: "Drake", base: 39, odd: 0.9, sort: i => -s[i], shield: "fantasy2", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"}, // Draconic
        {name: "Rakhnid", base: 40, odd: 0.9, sort: i => t[i] - s[i], shield: "horsehead2", charges: "Shapes", lines: "None", tinctures: "NoPatterns"}, // Arachnid
        {name: "Aj'Snaga", base: 41, odd: 0.9, sort: i => n(i) / bd(i, [12], 10), shield: "fantasy1", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"} // Serpents
      ];
    }

    if (culturesSet.value === "random") {
      return d3.range(count).map(function () {
        const rnd = rand(nameBases.length - 1);
        const name = Names.getBaseShort(rnd);
        return {name, base: rnd, odd: 1, shield: getRandomShield()};
      });
    }

    // all-world
    return [
      {name: "Shwazen", base: 0, odd: 0.7, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "hessen", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "heater", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Luari", base: 2, odd: 0.6, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Tallian", base: 3, odd: 0.6, sort: i => n(i) / td(i, 15), shield: "horsehead2", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Astellian", base: 4, odd: 0.6, sort: i => n(i) / td(i, 16), shield: "spanish", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Slovan", base: 5, odd: 0.7, sort: i => (n(i) / td(i, 6)) * t[i], shield: "round", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Norse", base: 6, odd: 0.7, sort: i => n(i) / td(i, 5), shield: "heater", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Elladan", base: 7, odd: 0.7, sort: i => (n(i) / td(i, 18)) * h[i], shield: "boeotian", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Romian", base: 8, odd: 0.7, sort: i => n(i) / td(i, 15), shield: "roman", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Soumi", base: 9, odd: 0.3, sort: i => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Koryo", base: 10, odd: 0.1, sort: i => n(i) / td(i, 12) / t[i], shield: "round", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Hantzu", base: 11, odd: 0.1, sort: i => n(i) / td(i, 13), shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Yamoto", base: 12, odd: 0.1, sort: i => n(i) / td(i, 15) / t[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Portuzian", base: 13, odd: 0.4, sort: i => n(i) / td(i, 17) / sf(i), shield: "spanish", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Nawatli", base: 14, odd: 0.1, sort: i => h[i] / td(i, 18) / bd(i, [7]), shield: "square", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Vengrian", base: 15, odd: 0.2, sort: i => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "wedged", charges: "Limited", lines: "All", tinctures: "All"},
      {name: "Turchian", base: 16, odd: 0.2, sort: i => n(i) / td(i, 13), shield: "round", charges: "Limited", lines: "All", tinctures: "NoPatterns"},
      {
        name: "Berberan",
        base: 17,
        odd: 0.1,
        sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
        shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"
      },
      {name: "Eurabic", base: 18, odd: 0.2, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "round", charges: "Shapes", lines: "All", tinctures: "All"},
      {name: "Inuk", base: 19, odd: 0.05, sort: i => td(i, -1) / bd(i, [10, 11]) / sf(i), shield: "square", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Euskati", base: 20, odd: 0.05, sort: i => (n(i) / td(i, 15)) * h[i], shield: "spanish", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Yoruba", base: 21, odd: 0.05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {
        name: "Keltan",
        base: 22,
        odd: 0.05,
        sort: i => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i],
        shield: "vesicaPiscis", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"
      },
      {name: "Efratic", base: 23, odd: 0.05, sort: i => (n(i) / td(i, 22)) * t[i], shield: "diamond", charges: "Shapes", lines: "All", tinctures: "NoPatterns"},
      {name: "Tehrani", base: 24, odd: 0.1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "round", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Maui", base: 25, odd: 0.05, sort: i => n(i) / td(i, 24) / sf(i) / t[i], shield: "round", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Carnatic", base: 26, odd: 0.05, sort: i => n(i) / td(i, 26), shield: "round", charges: "Limited", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Inqan", base: 27, odd: 0.05, sort: i => h[i] / td(i, 13), shield: "square", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Kiswaili", base: 28, odd: 0.1, sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]), shield: "vesicaPiscis", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Vietic", base: 29, odd: 0.1, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Guantzu", base: 30, odd: 0.1, sort: i => n(i) / td(i, 17), shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Ulus", base: 31, odd: 0.1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"},
      {name: "Hebrew", base: 42, odd: 0.2, sort: i => (n(i) / td(i, 18)) * sf(i), shield: "oval", charges: "Shapes", lines: "Limited", tinctures: "NoPatterns"} // Levantine
    ];
  };

  // expand cultures across the map (Dijkstra-like algorithm)
  const expand = function () {
    TIME && console.time("expandCultures");
    const {cells, cultures} = pack;

    const queue = new PriorityQueue({comparator: (a, b) => a.priority - b.priority});
    const cost = [];

    const neutralRate = byId("neutralRate")?.valueAsNumber || 1;
    const maxExpansionCost = cells.i.length * 0.6 * neutralRate; // limit cost for culture growth

    // remove culture from all cells except of locked
    const hasLocked = cultures.some(c => !c.removed && c.lock);
    if (hasLocked) {
      for (const cellId of cells.i) {
        const culture = cultures[cells.culture[cellId]];
        if (culture.lock) continue;
        cells.culture[cellId] = 0;
      }
    } else {
      cells.culture = new Uint16Array(cells.i.length);
    }

    for (const culture of cultures) {
      if (!culture.i || culture.removed || culture.lock) continue;
      queue.queue({cellId: culture.center, cultureId: culture.i, priority: 0});
    }

    while (queue.length) {
      const {cellId, priority, cultureId} = queue.dequeue();
      const {type, expansionism} = cultures[cultureId];

      cells.c[cellId].forEach(neibCellId => {
        if (hasLocked) {
          const neibCultureId = cells.culture[neibCellId];
          if (neibCultureId && cultures[neibCultureId].lock) return; // do not overwrite cell of locked culture
        }

        const biome = cells.biome[neibCellId];
        const biomeCost = getBiomeCost(cultureId, biome, type);
        const biomeChangeCost = biome === cells.biome[neibCellId] ? 0 : 20; // penalty on biome change
        const heightCost = getHeightCost(neibCellId, cells.h[neibCellId], type);
        const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type);
        const typeCost = getTypeCost(cells.t[neibCellId], type);

        const cellCost = (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / expansionism;
        const totalCost = priority + cellCost;

        if (totalCost > maxExpansionCost) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (cells.pop[neibCellId] > 0) cells.culture[neibCellId] = cultureId; // assign culture to populated cell
          cost[neibCellId] = totalCost;
          queue.queue({cellId: neibCellId, cultureId, priority: totalCost});
        }
      });
    }

    function getBiomeCost(c, biome, type) {
      if (cells.biome[cultures[c].center] === biome) return 10; // tiny penalty for native biome
      if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
      if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
      return biomesData.cost[biome] * 2; // general non-native biome penalty
    }

    function getHeightCost(i, h, type) {
      const f = pack.features[cells.f[i]],
        a = cells.area[i];
      if (type === "Lake" && f.type === "lake") return 10; // no lake crossing penalty for Lake cultures
      if (type === "Naval" && h < 20) return a * 2; // low sea/lake crossing penalty for Naval cultures
      if (type === "Nomadic" && h < 20) return a * 50; // giant sea/lake crossing penalty for Nomads
      if (h < 20) return a * 6; // general sea/lake crossing penalty
      if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
      if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
      if (type === "Highland") return 0; // no penalty for highlanders on highlands
      if (h >= 67) return 200; // general mountains crossing penalty
      if (h >= 44) return 30; // general hills crossing penalty
      return 0;
    }

    function getRiverCost(riverId, cellId, type) {
      if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
      if (!riverId) return 0; // no penalty for others if there is no river
      return minmax(cells.fl[cellId] / 10, 20, 100); // river penalty from 20 to 100 based on flux
    }

    function getTypeCost(t, type) {
      if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
      if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
      if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
      return 0;
    }

    TIME && console.timeEnd("expandCultures");
  };

  const getRandomShield = function () {
    const type = rw(COA.shields.types);
    return rw(COA.shields[type]);
  };

  return {generate, add, expand, getDefault, getRandomShield};
})();
