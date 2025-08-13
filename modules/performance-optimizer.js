"use strict";

window.PerformanceOptimizer = (function() {
  // Performance monitoring
  const metrics = {
    burgGeneration: 0,
    routeGeneration: 0,
    coaGeneration: 0,
    provinceGeneration: 0,
    renderTime: 0
  };

  // Cache for expensive calculations
  const cache = new Map();
  const CACHE_SIZE_LIMIT = 1000;

  // Spatial index for fast nearest neighbor queries
  class SpatialIndex {
    constructor() {
      this.tree = null;
      this.points = [];
    }

    build(points) {
      this.points = points;
      this.tree = d3.quadtree()
        .x(d => d.x)
        .y(d => d.y)
        .addAll(points);
    }

    findWithin(x, y, radius) {
      if (!this.tree) return [];
      const results = [];
      
      this.tree.visit((node, x1, y1, x2, y2) => {
        if (!node.length) {
          do {
            const d = node.data;
            const dx = d.x - x;
            const dy = d.y - y;
            if (dx * dx + dy * dy < radius * radius) {
              results.push(d);
            }
          } while (node = node.next);
        }
        return x1 > x + radius || x2 < x - radius || 
               y1 > y + radius || y2 < y - radius;
      });
      
      return results;
    }

    findNearest(x, y, maxDistance = Infinity) {
      if (!this.tree) return null;
      
      let closest = null;
      let closestDistance = maxDistance * maxDistance;
      
      this.tree.visit((node, x1, y1, x2, y2) => {
        if (!node.length) {
          do {
            const d = node.data;
            const dx = d.x - x;
            const dy = d.y - y;
            const dist = dx * dx + dy * dy;
            if (dist < closestDistance) {
              closest = d;
              closestDistance = dist;
            }
          } while (node = node.next);
        }
        
        const dx = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
        const dy = y < y1 ? y1 - y : y > y2 ? y - y2 : 0;
        return dx * dx + dy * dy > closestDistance;
      });
      
      return closest;
    }
  }

  // Lazy loading wrapper for expensive computations
  class LazyProperty {
    constructor(computeFn) {
      this.computeFn = computeFn;
      this.computed = false;
      this.value = undefined;
    }

    get() {
      if (!this.computed) {
        this.value = this.computeFn();
        this.computed = true;
      }
      return this.value;
    }

    reset() {
      this.computed = false;
      this.value = undefined;
    }
  }

  // Cache management
  function getCached(key, computeFn) {
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const value = computeFn();
    
    // Limit cache size
    if (cache.size >= CACHE_SIZE_LIMIT) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, value);
    return value;
  }

  function clearCache() {
    cache.clear();
  }

  // Performance measurement helpers
  function measureTime(name, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    metrics[name] = (metrics[name] || 0) + duration;
    return result;
  }

  // Batch processing for large datasets
  function processBatch(items, processFn, batchSize = 100, onProgress) {
    return new Promise((resolve) => {
      let index = 0;
      const results = [];

      function processNextBatch() {
        const batch = items.slice(index, index + batchSize);
        
        for (const item of batch) {
          results.push(processFn(item));
        }
        
        index += batchSize;
        
        if (onProgress) {
          onProgress(Math.min(index / items.length, 1));
        }
        
        if (index < items.length) {
          // Use requestIdleCallback if available, otherwise setTimeout
          if (window.requestIdleCallback) {
            requestIdleCallback(processNextBatch);
          } else {
            setTimeout(processNextBatch, 0);
          }
        } else {
          resolve(results);
        }
      }

      processNextBatch();
    });
  }

  // Optimize burg feature assignment using lazy evaluation
  function optimizeBurgFeatures(burgs) {
    TIME && console.time("optimizeBurgFeatures");
    
    for (const burg of burgs) {
      if (!burg.i || burg.removed) continue;
      
      // Convert expensive properties to lazy evaluation
      if (!burg.lazyProperties) {
        burg.lazyProperties = {};
        
        // Trading post calculation - only compute when needed
        burg.lazyProperties.tradingPost = new LazyProperty(() => {
          const {cells} = pack;
          const cellId = burg.cell;
          
          const isRiverCrossing = cells.r[cellId] && Routes.isCrossroad && Routes.isCrossroad(cellId);
          const isMountainPass = cells.h[cellId] > 50 && cells.h[cellId] < 67 && Routes.hasRoad && Routes.hasRoad(cellId);
          const isRouteHub = Routes.isCrossroad && Routes.isCrossroad(cellId);
          
          if (isRiverCrossing || isMountainPass || isRouteHub) {
            let chance = 0.2;
            if (burg.settlementType === "marketTown" || burg.plaza === 1) chance = 0.8;
            else if (burg.settlementType === "largeVillage") chance = 0.5;
            else if (burg.settlementType === "smallVillage") chance = 0.3;
            return Number(P(chance));
          }
          return 0;
        });
        
        // Seasonal fair calculation
        burg.lazyProperties.seasonalFair = new LazyProperty(() => {
          if (burg.settlementType === "marketTown" || burg.capital || burg.population > 5) {
            let fairChance = 0.3;
            if (burg.capital) fairChance = 0.7;
            if (burg.population > 10) fairChance = 0.8;
            if (burg.tradingPost) fairChance *= 1.2;
            
            if (P(Math.min(fairChance, 1))) {
              const seasons = ["Spring", "Summer", "Autumn", "Winter"];
              const months = [
                "Early Spring", "Mid Spring", "Late Spring",
                "Early Summer", "Midsummer", "Late Summer",
                "Early Autumn", "Harvest", "Late Autumn",
                "Early Winter", "Midwinter", "Late Winter"
              ];
              
              burg.fairTime = (burg.capital || burg.population > 15) ? ra(months) : ra(seasons);
              return 1;
            }
          }
          return 0;
        });
      }
    }
    
    TIME && console.timeEnd("optimizeBurgFeatures");
  }

  // Optimized route generation using spatial indexing
  function createOptimizedRouteFinder() {
    const burgIndex = new SpatialIndex();
    
    return {
      initialize(burgs) {
        const burgPoints = burgs
          .filter(b => b.i && !b.removed)
          .map(b => ({x: b.x, y: b.y, id: b.i, data: b}));
        burgIndex.build(burgPoints);
      },
      
      findNearbyBurgs(x, y, radius) {
        return burgIndex.findWithin(x, y, radius).map(p => p.data);
      },
      
      findNearestBurg(x, y, maxDistance) {
        const result = burgIndex.findNearest(x, y, maxDistance);
        return result ? result.data : null;
      }
    };
  }

  // Progressive rendering for large datasets
  async function renderProgressive(elements, renderFn, options = {}) {
    const {
      batchSize = 50,
      priority = 'high', // 'high', 'medium', 'low'
      onProgress = null,
      container = null
    } = options;
    
    // Sort elements by priority (capitals first, then by population)
    const sorted = [...elements].sort((a, b) => {
      if (a.capital && !b.capital) return -1;
      if (!a.capital && b.capital) return 1;
      if (a.population && b.population) return b.population - a.population;
      return 0;
    });
    
    // Render high-priority items immediately
    const highPriority = sorted.filter(e => 
      e.capital || e.population > 10 || e.isLargePort
    );
    
    for (const element of highPriority) {
      renderFn(element);
    }
    
    // Render remaining items progressively
    const remaining = sorted.filter(e => !highPriority.includes(e));
    
    if (remaining.length > 0) {
      await processBatch(remaining, renderFn, batchSize, onProgress);
    }
  }

  // Memory management
  function optimizeMemory() {
    // Clear unused properties from burgs
    pack.burgs.forEach(b => {
      if (!b.i || b.removed) return;
      
      // Remove temporary properties
      delete b._temp;
      delete b._cache;
      
      // Convert rarely-used properties to lazy evaluation
      if (b.lazyProperties) {
        // Reset lazy properties to free memory
        Object.values(b.lazyProperties).forEach(prop => prop.reset());
      }
    });
    
    // Clear cache
    clearCache();
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  // Performance report
  function getPerformanceReport() {
    const report = {
      metrics: {...metrics},
      cacheSize: cache.size,
      memory: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
      } : 'Not available',
      recommendations: []
    };
    
    // Add recommendations based on metrics
    if (metrics.routeGeneration > 5000) {
      report.recommendations.push('Consider reducing route density for better performance');
    }
    if (metrics.coaGeneration > 3000) {
      report.recommendations.push('Many COAs generated - consider increasing population threshold');
    }
    if (cache.size > CACHE_SIZE_LIMIT * 0.9) {
      report.recommendations.push('Cache is nearly full - consider clearing old entries');
    }
    
    return report;
  }

  // Export public API
  return {
    SpatialIndex,
    LazyProperty,
    getCached,
    clearCache,
    measureTime,
    processBatch,
    optimizeBurgFeatures,
    createOptimizedRouteFinder,
    renderProgressive,
    optimizeMemory,
    getPerformanceReport,
    metrics
  };
})();