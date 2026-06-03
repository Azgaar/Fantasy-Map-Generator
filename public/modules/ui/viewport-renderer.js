"use strict";

const ViewportRenderer = (() => {
  const svgNS = "http://www.w3.org/2000/svg";
  const burgLayerId = "burgs";
  const routeLayerId = "routes";
  const viewportStep = 120;

  let rafId = null;
  let pendingReason = "";

  const burgLayer = {
    registered: false,
    labelsRequested: false,
    iconsRequested: false,
    dirty: true,
    lastRenderKey: "",
    forced: new Set(),
    rankCache: null
  };

  const routeLayer = {
    registered: false,
    requested: false,
    dirty: true,
    lastRenderKey: "",
    forced: new Set(),
    routeCache: null
  };

  function registerBurgLayer() {
    burgLayer.registered = true;
  }

  function registerRouteLayer() {
    routeLayer.registered = true;
  }

  function drawBurgLabels() {
    registerBurgLayer();
    burgLayer.labelsRequested = true;
    invalidate(burgLayerId);
    updateNow("drawBurgLabels", {force: true});
  }

  function drawBurgIcons() {
    registerBurgLayer();
    burgLayer.iconsRequested = true;
    invalidate(burgLayerId);
    updateNow("drawBurgIcons", {force: true});
  }

  function drawBurgLabel(burg) {
    if (!burg?.i) return;
    burgLayer.labelsRequested = true;
    forceVisible(burgLayerId, burg.i);
  }

  function drawBurgIcon(burg) {
    if (!burg?.i) return;
    burgLayer.iconsRequested = true;
    forceVisible(burgLayerId, burg.i);
  }

  function removeBurgLabel(burgId) {
    releaseVisible(burgLayerId, burgId);
    document.getElementById(`burgLabel${burgId}`)?.remove();
  }

  function removeBurgIcon(burgId) {
    releaseVisible(burgLayerId, burgId);
    document.getElementById(`burg${burgId}`)?.remove();
    document.getElementById(`anchor${burgId}`)?.remove();
  }

  function drawRoutes() {
    registerRouteLayer();
    routeLayer.requested = true;
    invalidate(routeLayerId);
    updateNow("drawRoutes", {force: true});
  }

  function drawRoute(route) {
    if (route?.i === undefined) return;
    routeLayer.requested = true;
    forceVisible(routeLayerId, route.i);
  }

  function scheduleUpdate(reason = "update") {
    if (!hasActiveLayer()) return;

    pendingReason = reason;
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      const reason = pendingReason;
      pendingReason = "";
      updateNow(reason);
    });
  }

  function updateNow(reason = "update", {force = false} = {}) {
    const bounds = getBounds();
    updateBurgLayer(bounds, force);
    updateRouteLayer(bounds, force);
  }

  function hasActiveLayer() {
    return (
      (burgLayer.registered && (burgLayer.labelsRequested || burgLayer.iconsRequested)) ||
      (routeLayer.registered && routeLayer.requested)
    );
  }

  function updateBurgLayer(bounds, force) {
    if (!burgLayer.registered || (!burgLayer.labelsRequested && !burgLayer.iconsRequested)) return;

    const renderKey = getBurgRenderKey(bounds);
    if (!force && !burgLayer.dirty && renderKey === burgLayer.lastRenderKey) return;

    renderBurgLayer({bounds, root: document, all: false});
    burgLayer.dirty = false;
    burgLayer.lastRenderKey = renderKey;
  }

  function updateRouteLayer(bounds, force) {
    if (!routeLayer.registered || !routeLayer.requested) return;

    const renderKey = getRouteRenderKey(bounds);
    if (!force && !routeLayer.dirty && renderKey === routeLayer.lastRenderKey) return;

    renderRouteLayer({bounds, root: document, all: false});
    routeLayer.dirty = false;
    routeLayer.lastRenderKey = renderKey;
  }

  function invalidate(layerId = burgLayerId) {
    if (layerId === burgLayerId) {
      burgLayer.dirty = true;
      burgLayer.rankCache = null;
      return;
    }

    if (layerId === routeLayerId) {
      routeLayer.dirty = true;
      routeLayer.routeCache = null;
    }
  }

  function forceVisible(layerId, id) {
    if (id === undefined || id === null) return;

    if (layerId === burgLayerId) {
      registerBurgLayer();
      burgLayer.forced.add(+id);
      burgLayer.dirty = true;
      updateNow("forceVisible", {force: true});
      return;
    }

    if (layerId === routeLayerId) {
      registerRouteLayer();
      routeLayer.requested = true;
      routeLayer.forced.add(+id);
      routeLayer.dirty = true;
    }

    updateNow("forceVisible", {force: true});
  }

  function releaseVisible(layerId, id) {
    if (id === undefined || id === null) return;

    if (layerId === burgLayerId) {
      burgLayer.forced.delete(+id);
      burgLayer.dirty = true;
      return;
    }

    if (layerId === routeLayerId) {
      routeLayer.forced.delete(+id);
      routeLayer.dirty = true;
    }
  }

  function prepareExportClone(cloneEl) {
    if (!cloneEl) return;
    renderBurgLayer({root: cloneEl, all: true});
    renderRouteLayer({root: cloneEl, all: true});
  }

  function renderBurgLayer({bounds = getBounds(), root = document, all = false}) {
    const burgs = all ? getValidBurgs() : selectBurgs(bounds);
    const renderLabels = all ? hasExportContainer(root, "#burgLabels") : shouldRenderLabels();
    const renderIcons = all ? hasExportContainer(root, "#burgIcons") : shouldRenderIcons();

    if (renderLabels) renderLabelGroups(root, burgs);
    else if (!all) clearGroupChildren(document.querySelector("#burgLabels"));

    if (renderIcons) renderIconGroups(root, burgs);
    else if (!all) {
      clearGroupChildren(document.querySelector("#burgIcons"));
      clearGroupChildren(document.querySelector("#anchors"));
    }
  }

  function renderLabelGroups(root, burgs) {
    const container = getContainer(root, "#burgLabels");
    if (!container) return;

    const groups = ensureGroups(container, "burgLabels", root === document);
    const byGroup = groupBurgs(burgs);

    for (const {name} of getGroupDefinitions()) {
      const group = groups.get(name);
      if (!group) continue;

      const dx = group.getAttribute("data-dx") || 0;
      const dy = group.getAttribute("data-dy") || 0;
      const labels = byGroup
        .get(name)
        ?.map(
          burg =>
            `<text text-rendering="optimizeSpeed" id="burgLabel${burg.i}" data-id="${burg.i}" x="${burg.x}" y="${burg.y}" dx="${escapeAttr(dx)}em" dy="${escapeAttr(dy)}em">${escapeHtml(burg.name || "")}</text>`
        );

      group.innerHTML = labels?.join("") || "";
    }
  }

  function renderIconGroups(root, burgs) {
    const iconContainer = getContainer(root, "#burgIcons");
    const anchorContainer = getContainer(root, "#anchors");
    if (!iconContainer || !anchorContainer) return;

    const iconGroups = ensureGroups(iconContainer, "burgIcons", root === document);
    const anchorGroups = ensureGroups(anchorContainer, "anchors", root === document);
    const byGroup = groupBurgs(burgs);

    for (const {name} of getGroupDefinitions()) {
      const iconGroup = iconGroups.get(name);
      const anchorGroup = anchorGroups.get(name);
      const groupBurgs = byGroup.get(name) || [];

      if (iconGroup) {
        const icon = iconGroup.dataset.icon || "#icon-circle";
        iconGroup.innerHTML = groupBurgs
          .map(
            burg =>
              `<use id="burg${burg.i}" data-id="${burg.i}" href="${escapeAttr(icon)}" x="${burg.x}" y="${burg.y}"></use>`
          )
          .join("");
      }

      if (anchorGroup) {
        anchorGroup.innerHTML = groupBurgs
          .filter(burg => burg.port)
          .map(burg => `<use id="anchor${burg.i}" data-id="${burg.i}" href="#icon-anchor" x="${burg.x}" y="${burg.y}"></use>`)
          .join("");
      }
    }
  }

  function ensureGroups(container, styleName, persistStyles) {
    const styleBucket = getStyleBucket(styleName);
    const existing = Array.from(container.children).filter(child => child.tagName.toLowerCase() === "g");

    if (persistStyles) {
      for (const group of existing) {
        if (group.id) styleBucket[group.id] = getAttributes(group);
      }
    }

    container.replaceChildren();

    const groups = new Map();
    const defaultStyle = styleBucket.town || Object.values(styleBucket)[0] || {};
    for (const {name} of getGroupDefinitions()) {
      const group = document.createElementNS(svgNS, "g");
      const attributes = styleBucket[name] || defaultStyle;
      applyAttributes(group, attributes);
      group.setAttribute("id", name);
      container.appendChild(group);
      groups.set(name, group);
    }

    return groups;
  }

  function selectBurgs(bounds) {
    const burgs = getValidBurgs();
    const ranks = getRankSets(burgs);
    const lod = getLod(bounds.scale);

    return burgs.filter(burg => {
      if (burgLayer.forced.has(burg.i)) return true;

      if (lod === "low") {
        return burg.capital || burg.port || ranks.low.has(burg.i);
      }

      if (!isInBounds(burg, bounds)) return false;
      if (lod === "mid") return burg.capital || burg.port || ranks.mid.has(burg.i);

      return true;
    });
  }

  function getRankSets(burgs) {
    const populationTotal = burgs.reduce((sum, burg) => sum + (+burg.population || 0), 0);
    const signature = `${window.mapId || "map"}:${burgs.length}:${populationTotal}`;

    if (burgLayer.rankCache?.signature === signature) return burgLayer.rankCache;

    const ranked = [...burgs].sort((a, b) => (+b.population || 0) - (+a.population || 0));
    const lowCount = Math.ceil(ranked.length * 0.15);
    const midCount = Math.ceil(ranked.length * 0.45);

    burgLayer.rankCache = {
      signature,
      low: new Set(ranked.slice(0, lowCount).map(burg => burg.i)),
      mid: new Set(ranked.slice(0, midCount).map(burg => burg.i))
    };

    return burgLayer.rankCache;
  }

  function getValidBurgs() {
    if (typeof pack === "undefined" || !Array.isArray(pack.burgs)) return [];
    return pack.burgs.filter(burg => burg?.i && !burg.removed);
  }

  function groupBurgs(burgs) {
    const groups = new Map();
    for (const burg of burgs) {
      if (!burg.group) continue;
      if (!groups.has(burg.group)) groups.set(burg.group, []);
      groups.get(burg.group).push(burg);
    }

    return groups;
  }

  function renderRouteLayer({bounds = getBounds(), root = document, all = false}) {
    if (!all && !shouldRenderRoutes()) {
      clearRouteGroups(document);
      return;
    }

    const selectedRoutes = all ? getValidRoutes() : selectRoutes(bounds);
    renderRouteGroups(root, selectedRoutes);
  }

  function renderRouteGroups(root, selectedRoutes) {
    const container = getContainer(root, "#routes");
    if (!container) return;

    container.setAttribute("fill", "none");
    const groups = ensureRouteGroups(container, selectedRoutes);
    const byGroup = groupRoutes(selectedRoutes);

    for (const [name, group] of groups) {
      const routePaths = byGroup
        .get(name)
        ?.map(route => `<path id="route${route.i}" d="${escapeAttr(Routes.getPath(route))}"/>`);

      group.innerHTML = routePaths?.join("") || "";
    }
  }

  function ensureRouteGroups(container, selectedRoutes) {
    const groups = new Map();
    const groupNames = new Set([
      ...Array.from(container.children)
        .filter(child => child.tagName.toLowerCase() === "g")
        .map(group => group.id)
        .filter(Boolean),
      ...getValidRoutes().map(route => route.group).filter(Boolean),
      ...selectedRoutes.map(route => route.group).filter(Boolean)
    ]);

    for (const name of groupNames) {
      let group = container.querySelector(`:scope > g#${CSS.escape(name)}`);
      if (!group) {
        group = document.createElementNS(svgNS, "g");
        group.setAttribute("id", name);
        container.appendChild(group);
      }

      groups.set(name, group);
    }

    return groups;
  }

  function clearRouteGroups(root) {
    const container = getContainer(root, "#routes");
    if (!container) return;
    Array.from(container.children)
      .filter(child => child.tagName.toLowerCase() === "g")
      .forEach(group => group.querySelectorAll("path[id^='route']").forEach(path => path.remove()));
  }

  function selectRoutes(bounds) {
    const validRoutes = getValidRoutes();
    const cache = getRouteCache(validRoutes);
    const lod = getLod(bounds.scale);

    return validRoutes.filter(route => {
      if (routeLayer.forced.has(route.i)) return true;

      const meta = cache.metaById.get(route.i);
      if (!meta) return false;

      if (lod === "low") {
        return route.group !== "trails" || cache.lowTrails.has(route.i);
      }

      if (!isRouteInBounds(meta, bounds)) return false;
      if (lod === "mid") return route.group !== "trails" || cache.midTrails.has(route.i);

      return true;
    });
  }

  function getRouteCache(validRoutes) {
    const signature = `${window.mapId || "map"}:${validRoutes.length}:${validRoutes.reduce(
      (sum, route) => sum + route.points.length,
      0
    )}`;

    if (routeLayer.routeCache?.signature === signature) return routeLayer.routeCache;

    const metaById = new Map();
    for (const route of validRoutes) {
      metaById.set(route.i, getRouteMeta(route));
    }

    const trails = validRoutes
      .filter(route => route.group === "trails")
      .sort((a, b) => (metaById.get(b.i)?.length || 0) - (metaById.get(a.i)?.length || 0));

    routeLayer.routeCache = {
      signature,
      metaById,
      lowTrails: new Set(trails.slice(0, Math.ceil(trails.length * 0.25)).map(route => route.i)),
      midTrails: new Set(trails.slice(0, Math.ceil(trails.length * 0.6)).map(route => route.i))
    };

    return routeLayer.routeCache;
  }

  function getRouteMeta(route) {
    const xs = route.points.map(point => point[0]);
    const ys = route.points.map(point => point[1]);

    return {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
      length: getRoutePolylineLength(route.points)
    };
  }

  function getRoutePolylineLength(points) {
    let length = 0;
    for (let index = 1; index < points.length; index++) {
      length += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
    }

    return length;
  }

  function getValidRoutes() {
    if (typeof pack === "undefined" || !Array.isArray(pack.routes)) return [];
    return pack.routes.filter(route => route?.i !== undefined && route.points?.length >= 2);
  }

  function groupRoutes(validRoutes) {
    const groups = new Map();
    for (const route of validRoutes) {
      if (!route.group) continue;
      if (!groups.has(route.group)) groups.set(route.group, []);
      groups.get(route.group).push(route);
    }

    return groups;
  }

  function getBounds() {
    const transform = window.getMapTransform?.() || {};
    const scale = transform.scale || 1;
    const viewX = transform.viewX || 0;
    const viewY = transform.viewY || 0;
    const svgWidth = transform.svgWidth || window.innerWidth;
    const svgHeight = transform.svgHeight || window.innerHeight;
    const graphWidth = transform.graphWidth || svgWidth;
    const graphHeight = transform.graphHeight || svgHeight;
    const padding = scale < 2 ? 0 : scale < 5 ? 180 : 140;

    return {
      scale,
      x0: clamp(-viewX / scale - padding, 0, graphWidth),
      y0: clamp(-viewY / scale - padding, 0, graphHeight),
      x1: clamp((svgWidth - viewX) / scale + padding, 0, graphWidth),
      y1: clamp((svgHeight - viewY) / scale + padding, 0, graphHeight)
    };
  }

  function getBurgRenderKey(bounds) {
    const lod = getLod(bounds.scale);
    if (lod === "low") return `low:${window.mapId || "map"}:${burgLayer.forced.size}`;

    return [
      lod,
      window.mapId || "map",
      Math.floor(bounds.x0 / viewportStep),
      Math.floor(bounds.y0 / viewportStep),
      Math.floor(bounds.x1 / viewportStep),
      Math.floor(bounds.y1 / viewportStep),
      burgLayer.forced.size
    ].join(":");
  }

  function getRouteRenderKey(bounds) {
    const lod = getLod(bounds.scale);
    if (lod === "low") return `low:${window.mapId || "map"}:${routeLayer.forced.size}`;

    return [
      lod,
      window.mapId || "map",
      Math.floor(bounds.x0 / viewportStep),
      Math.floor(bounds.y0 / viewportStep),
      Math.floor(bounds.x1 / viewportStep),
      Math.floor(bounds.y1 / viewportStep),
      routeLayer.forced.size
    ].join(":");
  }

  function getLod(scale) {
    if (scale < 2) return "low";
    if (scale < 5) return "mid";
    return "high";
  }

  function isInBounds(burg, bounds) {
    return burg.x >= bounds.x0 && burg.x <= bounds.x1 && burg.y >= bounds.y0 && burg.y <= bounds.y1;
  }

  function isRouteInBounds(meta, bounds) {
    return meta.x1 >= bounds.x0 && meta.x0 <= bounds.x1 && meta.y1 >= bounds.y0 && meta.y0 <= bounds.y1;
  }

  function shouldRenderLabels() {
    return burgLayer.labelsRequested && isLayerOnSafe("toggleLabels");
  }

  function shouldRenderIcons() {
    return burgLayer.iconsRequested && isLayerOnSafe("toggleBurgIcons");
  }

  function shouldRenderRoutes() {
    return routeLayer.requested && isLayerOnSafe("toggleRoutes");
  }

  function isLayerOnSafe(toggleId) {
    try {
      if (typeof layerIsOn === "function") return layerIsOn(toggleId);
    } catch (error) {
      WARN && console.warn("Cannot read layer state", toggleId, error);
    }

    const toggle = document.getElementById(toggleId);
    return !toggle || !toggle.classList.contains("buttonoff");
  }

  function hasExportContainer(root, selector) {
    return Boolean(getContainer(root, selector));
  }

  function getContainer(root, selector) {
    if (root.matches?.(selector)) return root;
    return root.querySelector?.(selector);
  }

  function clearGroupChildren(container) {
    if (!container) return;
    Array.from(container.children).forEach(group => group.replaceChildren());
  }

  function getGroupDefinitions() {
    const groups = typeof options !== "undefined" ? options.burgs?.groups : null;
    return [...(groups || [])].sort((a, b) => a.order - b.order);
  }

  function getStyleBucket(styleName) {
    if (typeof style === "undefined") return {};
    if (!style[styleName]) style[styleName] = {};
    return style[styleName];
  }

  function getAttributes(element) {
    return Array.from(element.attributes).reduce((attributes, attribute) => {
      attributes[attribute.name] = attribute.value;
      return attributes;
    }, {});
  }

  function applyAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      if (char === '"') return "&quot;";
      return "&#39;";
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function status() {
    return {
      pending: Boolean(rafId),
      burgs: {
        registered: burgLayer.registered,
        labels: document.querySelectorAll("#burgLabels text").length,
        icons: document.querySelectorAll("#burgIcons use").length,
        anchors: document.querySelectorAll("#anchors use").length,
        forced: burgLayer.forced.size
      },
      routes: {
        registered: routeLayer.registered,
        paths: document.querySelectorAll("#routes path[id^='route']").length,
        forced: routeLayer.forced.size
      }
    };
  }

  return {
    drawBurgIcon,
    drawBurgIcons,
    drawBurgLabel,
    drawBurgLabels,
    drawRoute,
    drawRoutes,
    forceVisible,
    getBounds,
    invalidate,
    prepareExportClone,
    registerBurgLayer,
    registerRouteLayer,
    releaseVisible,
    removeBurgIcon,
    removeBurgLabel,
    scheduleUpdate,
    status,
    updateNow
  };
})();

window.ViewportRenderer = ViewportRenderer;
