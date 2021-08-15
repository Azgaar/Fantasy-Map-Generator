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
      if (port) score *= 2;
      return {i, score};
    });

    const candidatesSorted = tradeScore.sort((a, b) => b.score - a.score);
    const centersTree = d3.quadtree();

    for (const {i: burgId} of candidatesSorted) {
      if (!burgId) continue;
      const burg = burgs[burgId];
      const {x, y} = burg;

      const tradeCenter = centersTree.find(x, y, minSpacing);

      if (tradeCenter) {
        const tradeCenterId = tradeCenter[2];
        burg.tradeCenter = tradeCenterId;
      } else {
        const tradeCenterId = trade.centers.length;
        trade.centers.push({i: tradeCenterId, burg: burgId, x, y});
        centersTree.add([x, y, tradeCenterId]);
        burg.tradeCenter = tradeCenterId;
      }

      minSpacing += 1;
    }

    // TODO: remove debug rendering
    for (const burg of burgs) {
      const {i, x: x1, y: y1, tradeCenter} = burg;
      if (!i) continue;
      const {x: x2, y: y2} = trade.centers[tradeCenter];
      debug.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', 'black').attr('stroke-width', 0.2);
    }
    for (const {i, score} of candidatesSorted) {
      if (!i) continue;
      const {x, y, capital} = burgs[i];
      debug
        .append('text')
        .attr('x', x)
        .attr('y', y)
        .style('font-size', capital ? 5 : 3)
        .style('fill', 'blue')
        .text(score);
    }
    for (const {x, y, i} of trade.centers) {
      debug
        .append('circle')
        .attr('cx', x - 4)
        .attr('cy', y - 4)
        .attr('r', 2)
        .style('stroke', '#000')
        .style('stroke-width', 0.2)
        .style('fill', 'white');
      debug
        .append('text')
        .attr('x', x - 4)
        .attr('y', y - 4)
        .style('font-size', 3)
        .text(i);
    }

    TIME && console.timeEnd('defineCenters');
  };

  const calculateDistances = () => {
    TIME && console.time('calculateDistances');
    const {cells, burgs, trade} = pack;
    const {centers} = trade;

    const getCost = (dist, sameFeature, sameFeaturePorts) => {
      if (sameFeaturePorts) return dist / 2;
      if (sameFeature) return dist;
      return dist * 1.5;
    };

    const costs = new Array(centers.length);
    for (let i = 0; i < centers.length; i++) {
      costs[i] = new Array(centers.length);
      const {x: x1, y: y1, port: port1, cell: cell1} = burgs[centers[i].burg];

      for (let j = i + 1; j < centers.length; j++) {
        const {x: x2, y: y2, port: port2, cell: cell2} = burgs[centers[j].burg];
        const distance = Math.hypot(x1 - x2, y1 - y2);
        const sameFeature = cell1 === cell2;
        const sameFeaturePorts = port1 && port2 && port1 === port2;
        costs[i][j] = getCost(distance, sameFeature, sameFeaturePorts) | 0;
      }
    }

    for (const center of centers) {
      center.nearest = centers.map(({i}) => {
        const cost = center.i < i ? costs[center.i][i] : costs[i][center.i];
        return {i, cost: cost || 0};
      });
      center.nearest.sort((a, b) => a.cost - b.cost);
    }

    TIME && console.timeEnd('calculateDistances');
  };

  const exportGoods = () => {
    const {burgs, states, trade} = pack;
    const DEFAULT_TRANSPORT_DIST = (graphWidth + graphHeight) / 20;

    for (const tradeCenter of trade.centers) {
      const {i: centerId, burg: centerBurg, x: x0, y: y0} = tradeCenter;
      const tradeCenterGoods = {};

      for (const burg of burgs) {
        const {i, removed, tradeCenter, produced, population, state, x, y} = burg;
        if (!i || removed || tradeCenter !== centerBurg) continue;
        const consumption = Math.ceil(population);
        const exportPool = {};

        const distance = Math.hypot(x - x0, y - y0);
        const transportFee = (distance / DEFAULT_TRANSPORT_DIST) ** 0.8 || 0.02;
        const salesTax = states[state].salesTax || 0;
        let income = 0;

        const categorized = {};
        for (const resourceId in produced) {
          const {category} = Resources.get(+resourceId);
          if (!categorized[category]) categorized[category] = {};
          categorized[category][resourceId] = produced[resourceId];
        }

        for (const category in categorized) {
          const categoryProduction = d3.sum(Object.values(categorized[category]));
          const exportQuantity = categoryProduction - consumption;
          if (exportQuantity <= 0) continue;

          for (const resourceId in categorized[category]) {
            const production = categorized[category][resourceId];
            const quantity = Math.round((production / categoryProduction) * exportQuantity);
            if (quantity <= 0) continue;

            const {value, name} = Resources.get(+resourceId);

            const basePrice = value * quantity;
            const transportCost = rn((value * quantity) ** 0.5 * transportFee, 1);
            const netPrice = basePrice - transportCost;

            const stateIncome = rn(netPrice * salesTax, 1);
            const burgIncome = rn(netPrice - stateIncome, 1);

            if (burgIncome < 1 || burgIncome < basePrice / 4) continue;

            trade.deals.push({resourceId: +resourceId, name, quantity, exporter: i, tradeCenter: centerId, basePrice, transportCost, stateIncome, burgIncome});
            income += burgIncome;

            if (!exportPool[resourceId]) exportPool[resourceId] = quantity;
            else exportPool[resourceId] += quantity;

            if (!tradeCenterGoods[resourceId]) tradeCenterGoods[resourceId] = quantity;
            else tradeCenterGoods[resourceId] += quantity;
          }
        }

        burg.exported = exportPool;
        burg.income = income;
      }

      tradeCenter.supply = tradeCenterGoods;
    }
  };

  const importGoods = () => {
    const {resources, burgs, states, trade} = pack;

    for (const burg of burgs) {
      const {i, removed, tradeCenter: localTradeCenterId, x, y, produced, population} = burg;
      if (!i || removed) continue;

      const importPool = {};
      const localTradeCenter = trade.centers[localTradeCenterId];

      let demand = Math.ceil(population);

      for (const resource of resources) {
        const {i: resourceId, value, category} = resource;
        if (produced[resourceId]) continue;

        // check for resource supply on markets starting from closest
        for (const {i: tradeCenterId, cost: transportCost} of localTradeCenter.nearest) {
          const tradeCenter = trade.centers[tradeCenterId];
          const stored = tradeCenter.supply[resourceId];
          if (!stored) continue;

          const quantity = Math.min(demand, stored);
          importPool[resourceId] = quantity;

          tradeCenter.supply[resourceId] -= quantity;
          demand -= quantity;
          if (demand <= 0) break;
        }
      }

      burg.imported = importPool;
    }
  };

  return {defineCenters, calculateDistances, exportGoods, importGoods};
})();
