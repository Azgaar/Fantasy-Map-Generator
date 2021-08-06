'use strict';

window.Resources = (function () {
  let cells, cellId;

  const methods = {
    random: (number) => number >= 100 || (number > 0 && number / 100 > Math.random()),
    nth: (number) => !(cellId % number),
    minHabitability: (min) => biomesData.habitability[pack.cells.biome[cellId]] >= min,
    habitability: () => biomesData.habitability[cells.biome[cellId]] > Math.random() * 100,
    elevation: () => pack.cells.h[cellId] / 100 > Math.random(),
    biome: (...biomes) => biomes.includes(pack.cells.biome[cellId]),
    minHeight: (heigh) => pack.cells.h[cellId] >= heigh,
    maxHeight: (heigh) => pack.cells.h[cellId] <= heigh,
    minTemp: (temp) => grid.cells.temp[pack.cells.g[cellId]] >= temp,
    maxTemp: (temp) => grid.cells.temp[pack.cells.g[cellId]] <= temp,
    shore: (...rings) => rings.includes(pack.cells.t[cellId]),
    type: (...types) => types.includes(pack.features[cells.f[cellId]].group),
    river: () => pack.cells.r[cellId]
  };
  const allMethods = '{' + Object.keys(methods).join(', ') + '}';

  const generate = function () {
    TIME && console.time('generateResources');
    cells = pack.cells;
    cells.resource = new Uint8Array(cells.i.length); // resources array [0, 255]
    const resourceMaxCells = Math.ceil((200 * cells.i.length) / 5000);
    if (!pack.resources) pack.resources = FMG.data.resources;
    pack.resources.forEach((r) => {
      r.cells = 0;
      const model = r.custom || FMG.data.resourceModels[r.model];
      r.fn = new Function(allMethods, 'return ' + model);
    });

    const skipGlaciers = biomesData.habitability[11] === 0;
    const shuffledCells = d3.shuffle(cells.i.slice());

    for (const i of shuffledCells) {
      if (!(i % 10)) d3.shuffle(pack.resources);
      if (skipGlaciers && cells.biome[i] === 11) continue;
      const rnd = Math.random() * 100;
      cellId = i;

      for (const resource of pack.resources) {
        if (resource.cells >= resourceMaxCells) continue;
        if (resource.cells ? rnd > resource.chance : Math.random() * 100 > resource.chance) continue;
        if (!resource.fn({...methods})) continue;

        cells.resource[i] = resource.i;
        resource.cells++;
        break;
      }
    }
    pack.resources.sort((a, b) => (a.i > b.i ? 1 : -1)).forEach((r) => delete r.fn);

    TIME && console.timeEnd('generateResources');
  };

  const getStroke = (color) => d3.color(color).darker(2).hex();
  const get = (i) => pack.resources.find((resource) => resource.i === i);

  return {generate, methods, getStroke, get};
})();
