'use strict';

window.Trade = (function () {
  const defineCenters = () => {
    TIME && console.time('defineCenters');
    pack.trade = {centers: [], deals: []};
    const {burgs, trade} = pack;

    // min distance between trade centers
    let minSpacing = (((graphWidth + graphHeight) * 2) / burgs.length ** 0.7) | 0;

    const tradeScore = burgs.map(({i, removed, capital, port, population, produced}) => {
      if (!i || removed) return {i: 0, score: 0};
      const totalProduction = d3.sum(Object.values(produced));
      let score = Math.round(totalProduction - population);
      if (capital) score *= 2;
      if (port) score *= 3;
      return {i, score};
    });

    const candidatesSorted = tradeScore.sort((a, b) => b.score - a.score);
    const centersTree = d3.quadtree();

    for (const {i} of candidatesSorted) {
      if (!i) continue;
      const {x, y} = burgs[i];

      const tradeCenter = centersTree.find(x, y, minSpacing);
      if (tradeCenter) {
        const centerBurg = tradeCenter[2];
        burgs[i].tradeCenter = centerBurg;

        const {x: x2, y: y2} = burgs[centerBurg];
        debug.append('line').attr('x1', x).attr('y1', y).attr('x2', x2).attr('y2', y2).attr('stroke', 'black').attr('stroke-width', 0.2);
      } else {
        trade.centers.push({i: trade.centers.length, burg: i, x, y});
        centersTree.add([x, y, i]);
        burgs[i].tradeCenter = i;
      }

      minSpacing += 1;
    }

    for (const {i, score} of candidatesSorted) {
      if (!i) continue;
      const {x, y} = burgs[i];
      debug.append('text').attr('x', x).attr('y', y).style('font-size', 4).text(score);
    }

    TIME && console.timeEnd('defineCenters');
  };

  const exportGoods = () => {
    const {burgs, states, trade} = pack;
    const DEFAULT_TRANSPORT_DIST = (graphWidth + graphHeight) / 20;

    for (const tradeCenter of trade.centers) {
      const {i: centerId, burg: centerBurg, x: x0, y: y0} = tradeCenter;
      const goods = {};

      for (const burg of burgs) {
        const {i, removed, tradeCenter, produced, population, state, x, y} = burg;
        if (!i || removed || tradeCenter !== centerBurg) continue;
        const consumption = Math.ceil(population);

        const distance = Math.hypot(x - x0, y - y0);
        const transportFee = (distance / DEFAULT_TRANSPORT_DIST) ** 0.8 || 0.02;
        const salesTax = states[state].salesTax || 0;

        for (const resourceId in produced) {
          const production = produced[resourceId];
          const quantity = production - consumption;
          if (quantity < 1) continue;

          const {value, name} = Resources.get(+resourceId);

          const basePrice = value * quantity;
          const transportCost = rn((value * quantity) ** 0.5 * transportFee, 1);
          const netPrice = basePrice - transportCost;

          const stateIncome = rn(netPrice * salesTax, 1);
          const burgIncome = rn(netPrice - stateIncome, 1);

          if (burgIncome < 1 || burgIncome < basePrice / 4) continue;

          trade.deals.push({resourceId: +resourceId, name, quantity, exporter: i, tradeCenter: centerId, basePrice, transportCost, stateIncome, burgIncome});

          if (!goods[resourceId]) goods[resourceId] = quantity;
          else goods[resourceId] += quantity;
        }
      }

      tradeCenter.goods = goods;
    }
  };

  const importGoods = () => {};

  return {defineCenters, exportGoods, importGoods};
})();
