'use strict';

window.Trade = (function () {
  const defineCenters = () => {
    const {cells} = pack;
  };

  const exportGoods = () => {
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      const {population, production: resourcePool} = burg;
      const localUsage = Math.ceil(population);

      const surplus = {};
      for (const resourceId in resourcePool) {
        const production = resourcePool[resourceId];
        const extraProduction = production - localUsage;
        if (extraProduction > 0) surplus[resourceId] = extraProduction;
      }

      burg.export = surplus;
    }
  };

  const importGoods = () => {};

  return {defineCenters, exportGoods, importGoods};
})();
