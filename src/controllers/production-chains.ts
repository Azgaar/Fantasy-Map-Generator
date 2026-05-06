import {select, zoom, zoomIdentity} from "d3";
import type {Good} from "../modules/goods-generator";

const CARD_WIDTH = 98;
const CARD_HEIGHT = 34;
const CARD_RADIUS = 4;
const COLUMN_GAP = 148;
const ROW_GAP = 6;
const COMPONENT_GAP = 32;
const COLUMN_STEP = CARD_WIDTH + COLUMN_GAP;
const ICON_RADIUS = 11;
const PORT_BAND = 0.55;
const LANE_SPREAD = 12;
const HEADER_HEIGHT = 20;
const SVG_PADDING = 18;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;
const DEFAULT_EDGE_OPACITY = 0.045;
const DEFAULT_LABEL_OPACITY = 0;

const EDGE_COLORS = ["#3d85c8", "#cc7722", "#2a9050", "#7048a8", "#a83030", "#147a6c", "#b05000", "#1f6fa8"];

interface GraphNode {
  id: number;
  good: Good;
  stage: number;
  x: number;
  y: number;
}

interface RawGraphEdge {
  from: number;
  to: number;
  recipeIndex: number;
  amount: number;
}

interface GraphEdge {
  from: GraphNode;
  to: GraphNode;
  recipeIndex: number;
  amount: number;
}

interface RoutedEdge extends GraphEdge {
  sourcePortIndex: number;
  sourcePortCount: number;
  targetPortIndex: number;
  targetPortCount: number;
  lane: number;
  targetBoundary: number;
}

interface ComponentBand {
  y: number;
}

interface LayoutData {
  nodes: GraphNode[];
  edges: RoutedEdge[];
  stages: Set<number>;
  componentBands: ComponentBand[];
}

interface Position {
  x: number;
  y: number;
}

interface EdgeGeometry {
  d: string;
  labelX: number;
  labelY: number;
}

interface EdgeLabel {
  amount: number;
  recipeIndex: number;
}

interface DisplayEdge {
  fromId: number;
  toId: number;
  representative: RoutedEdge;
  labels: EdgeLabel[];
}

function getChainGoods(goods: Good[]): Good[] {
  const chainIds = new Set<number>();

  for (const good of goods) {
    if (!good.recipes?.length) continue;
    chainIds.add(good.i);
    for (const recipe of good.recipes) {
      for (const ingredientId of Object.keys(recipe)) chainIds.add(+ingredientId);
    }
  }

  return goods.filter(good => chainIds.has(good.i));
}

function getRawEdges(goods: Good[]): RawGraphEdge[] {
  const rawEdges: RawGraphEdge[] = [];

  for (const good of goods) {
    if (!good.recipes?.length) continue;
    for (let recipeIndex = 0; recipeIndex < good.recipes.length; recipeIndex++) {
      for (const [ingredientId, amount] of Object.entries(good.recipes[recipeIndex])) {
        rawEdges.push({from: +ingredientId, to: good.i, recipeIndex, amount});
      }
    }
  }

  return rawEdges;
}

function computeStages(goods: Good[]): Map<number, number> {
  const stageById = new Map<number, number>();

  for (const good of goods) {
    if (!good.recipes?.length) stageById.set(good.i, 0);
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const good of goods) {
      if (!good.recipes?.length) continue;

      const ingredientIds = [...new Set(good.recipes.flatMap(recipe => Object.keys(recipe).map(Number)))];
      if (!ingredientIds.length) continue;
      if (!ingredientIds.every(id => stageById.has(id))) continue;

      const nextStage = Math.max(...ingredientIds.map(id => stageById.get(id)!)) + 1;
      if (!stageById.has(good.i) || nextStage > stageById.get(good.i)!) {
        stageById.set(good.i, nextStage);
        changed = true;
      }
    }
  }

  for (const good of goods) {
    if (!stageById.has(good.i)) stageById.set(good.i, 1);
  }

  return stageById;
}

function getConnectedComponents(ids: number[], edges: RawGraphEdge[]): Set<number>[] {
  const adjacency = new Map<number, number[]>();
  for (const id of ids) adjacency.set(id, []);

  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  }

  const visited = new Set<number>();
  const components: Set<number>[] = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    const component = new Set<number>();
    const stack = [id];

    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.add(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function minimizeCrossings(stageEntries: Map<number, number[]>, edges: RawGraphEdge[]) {
  const sortedStages = [...stageEntries.keys()].sort((a, b) => a - b);
  if (sortedStages.length < 2) return;

  const incoming = new Map<number, number[]>();
  const outgoing = new Map<number, number[]>();

  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    incoming.get(edge.to)!.push(edge.from);
    outgoing.get(edge.from)!.push(edge.to);
  }

  const getBarycenter = (id: number, neighbors: number[], positions: Map<number, number>) => {
    const values = neighbors
      .map(neighbor => positions.get(neighbor))
      .filter((value): value is number => value !== undefined);
    if (!values.length) return positions.get(id) ?? 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  for (let pass = 0; pass < 12; pass++) {
    for (let index = 1; index < sortedStages.length; index++) {
      const prevPositions = new Map(stageEntries.get(sortedStages[index - 1])!.map((id, position) => [id, position]));
      stageEntries
        .get(sortedStages[index])!
        .sort(
          (left, right) =>
            getBarycenter(left, incoming.get(left) ?? [], prevPositions) -
            getBarycenter(right, incoming.get(right) ?? [], prevPositions)
        );
    }

    for (let index = sortedStages.length - 2; index >= 0; index--) {
      const nextPositions = new Map(stageEntries.get(sortedStages[index + 1])!.map((id, position) => [id, position]));
      stageEntries
        .get(sortedStages[index])!
        .sort(
          (left, right) =>
            getBarycenter(left, outgoing.get(left) ?? [], nextPositions) -
            getBarycenter(right, outgoing.get(right) ?? [], nextPositions)
        );
    }
  }
}

function assignPortsAndLanes(nodes: GraphNode[], edges: GraphEdge[]): RoutedEdge[] {
  const outgoingByNode = new Map<number, GraphEdge[]>();
  const incomingByNode = new Map<number, GraphEdge[]>();

  for (const node of nodes) {
    outgoingByNode.set(node.id, []);
    incomingByNode.set(node.id, []);
  }

  for (const edge of edges) {
    outgoingByNode.get(edge.from.id)!.push(edge);
    incomingByNode.get(edge.to.id)!.push(edge);
  }

  for (const edgeList of outgoingByNode.values()) edgeList.sort((a, b) => a.to.y - b.to.y || a.to.id - b.to.id);
  for (const edgeList of incomingByNode.values()) edgeList.sort((a, b) => a.from.y - b.from.y || a.from.id - b.from.id);

  const boundaryPairs = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const key = `${edge.to.stage - 1}-${edge.to.stage}`;
    if (!boundaryPairs.has(key)) boundaryPairs.set(key, []);
    boundaryPairs.get(key)!.push(edge);
  }

  for (const edgeList of boundaryPairs.values()) {
    edgeList.sort((a, b) => {
      return a.to.y - b.to.y || a.from.y - b.from.y || a.from.id - b.from.id || a.to.id - b.to.id;
    });
  }

  return edges.map(edge => {
    const targetBoundary = edge.to.stage - 1;
    const pair = boundaryPairs.get(`${targetBoundary}-${edge.to.stage}`) ?? [];
    const pairIndex = pair.indexOf(edge);
    return {
      ...edge,
      sourcePortIndex: outgoingByNode.get(edge.from.id)!.indexOf(edge),
      sourcePortCount: outgoingByNode.get(edge.from.id)!.length,
      targetPortIndex: incomingByNode.get(edge.to.id)!.indexOf(edge),
      targetPortCount: incomingByNode.get(edge.to.id)!.length,
      lane: pair.length > 1 ? pairIndex - (pair.length - 1) / 2 : 0,
      targetBoundary
    };
  });
}

function buildLayout(goods: Good[]): LayoutData {
  const chainGoods = getChainGoods(goods);
  if (!chainGoods.length) return {nodes: [], edges: [], stages: new Set(), componentBands: []};

  const goodsById = new Map(chainGoods.map(good => [good.i, good]));
  const rawEdges = getRawEdges(chainGoods);
  const components = getConnectedComponents(
    chainGoods.map(good => good.i),
    rawEdges
  ).sort((a, b) => b.size - a.size);

  const nodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  const stages = new Set<number>();
  const componentBands: ComponentBand[] = [];
  let currentYOffset = 0;

  for (const component of components) {
    const componentGoods = chainGoods.filter(good => component.has(good.i));
    const componentEdges = rawEdges.filter(edge => component.has(edge.from) && component.has(edge.to));
    const stageById = computeStages(componentGoods);
    const stageEntries = new Map<number, number[]>();

    for (const good of componentGoods) {
      const stage = stageById.get(good.i) ?? 0;
      if (!stageEntries.has(stage)) stageEntries.set(stage, []);
      stageEntries.get(stage)!.push(good.i);
    }

    for (const ids of stageEntries.values()) {
      ids.sort((left, right) => (goodsById.get(left)?.name ?? "").localeCompare(goodsById.get(right)?.name ?? ""));
    }

    minimizeCrossings(stageEntries, componentEdges);

    const rowHeight = CARD_HEIGHT + ROW_GAP;
    const maxRows = Math.max(...[...stageEntries.values()].map(ids => ids.length));
    const componentHeight = maxRows * rowHeight - ROW_GAP;
    const componentNodesById = new Map<number, GraphNode>();

    for (const [stage, ids] of stageEntries) {
      stages.add(stage);
      const columnHeight = ids.length * rowHeight - ROW_GAP;
      const startY = (componentHeight - columnHeight) / 2 + currentYOffset;

      for (let row = 0; row < ids.length; row++) {
        const id = ids[row];
        const good = goodsById.get(id);
        if (!good) continue;

        const node: GraphNode = {
          id,
          good,
          stage,
          x: stage * COLUMN_STEP,
          y: startY + row * rowHeight
        };

        nodes.push(node);
        componentNodesById.set(id, node);
      }
    }

    for (const edge of componentEdges) {
      const from = componentNodesById.get(edge.from);
      const to = componentNodesById.get(edge.to);
      if (!from || !to) continue;
      graphEdges.push({from, to, recipeIndex: edge.recipeIndex, amount: edge.amount});
    }

    componentBands.push({y: currentYOffset});
    currentYOffset += componentHeight + COMPONENT_GAP;
  }

  return {nodes, edges: assignPortsAndLanes(nodes, graphEdges), stages, componentBands};
}

function getBasePositions(nodes: GraphNode[]): Map<number, Position> {
  return new Map(nodes.map(node => [node.id, {x: node.x, y: node.y}]));
}

function buildDirectedAdjacency(edges: RoutedEdge[]) {
  const incoming = new Map<number, number[]>();
  const outgoing = new Map<number, number[]>();

  for (const edge of edges) {
    if (!incoming.has(edge.to.id)) incoming.set(edge.to.id, []);
    if (!outgoing.has(edge.from.id)) outgoing.set(edge.from.id, []);
    incoming.get(edge.to.id)!.push(edge.from.id);
    outgoing.get(edge.from.id)!.push(edge.to.id);
  }

  return {incoming, outgoing};
}

function getDirectedChainIds(startId: number, edges: RoutedEdge[]): Set<number> {
  const {incoming, outgoing} = buildDirectedAdjacency(edges);
  const result = new Set([startId]);

  const upstream = [startId];
  while (upstream.length) {
    for (const neighbor of incoming.get(upstream.shift()!) ?? []) {
      if (result.has(neighbor)) continue;
      result.add(neighbor);
      upstream.push(neighbor);
    }
  }

  const downstream = [startId];
  while (downstream.length) {
    for (const neighbor of outgoing.get(downstream.shift()!) ?? []) {
      if (result.has(neighbor)) continue;
      result.add(neighbor);
      downstream.push(neighbor);
    }
  }

  return result;
}

function getPortY(nodeY: number, portIndex: number, portCount: number): number {
  if (portCount === 1) return nodeY + CARD_HEIGHT / 2;
  const top = nodeY + (CARD_HEIGHT * (1 - PORT_BAND)) / 2;
  return top + (portIndex / (portCount - 1)) * CARD_HEIGHT * PORT_BAND;
}

function getLaneOffset(edge: RoutedEdge): number {
  const sourceSpread = (edge.sourcePortIndex - (edge.sourcePortCount - 1) / 2) * 5;
  const targetSpread = (edge.targetPortIndex - (edge.targetPortCount - 1) / 2) * 5;
  const recipeSpread = ((edge.recipeIndex % EDGE_COLORS.length) - (EDGE_COLORS.length - 1) / 2) * 0.5;
  return edge.lane * LANE_SPREAD + sourceSpread + targetSpread + recipeSpread;
}

function getEdgeGeometry(edge: RoutedEdge, positions: Map<number, Position>): EdgeGeometry {
  const from = positions.get(edge.from.id) ?? {x: edge.from.x, y: edge.from.y};
  const to = positions.get(edge.to.id) ?? {x: edge.to.x, y: edge.to.y};

  const x1 = from.x + CARD_WIDTH;
  const y1 = getPortY(from.y, edge.sourcePortIndex, edge.sourcePortCount);
  const x2 = to.x;
  const y2 = getPortY(to.y, edge.targetPortIndex, edge.targetPortCount);

  const boundaryBaseX = edge.targetBoundary * COLUMN_STEP + CARD_WIDTH + COLUMN_GAP * 0.62;
  const minElbowX = x1 + 14;
  const maxElbowX = x2 - 14;
  const rawElbowX = boundaryBaseX + getLaneOffset(edge);
  const elbowX = Math.max(minElbowX, Math.min(maxElbowX, rawElbowX));

  let d: string;
  if (Math.abs(y2 - y1) < 1) {
    d = `M${x1},${y1} H${x2}`;
  } else {
    const cornerRadius = Math.min(8, Math.abs(y2 - y1) / 2, Math.max(6, (x2 - x1) / 6));
    const dy = y2 > y1 ? 1 : -1;
    d = `M${x1},${y1} H${elbowX - cornerRadius} Q${elbowX},${y1} ${elbowX},${y1 + dy * cornerRadius} V${y2 - dy * cornerRadius} Q${elbowX},${y2} ${elbowX + cornerRadius},${y2} H${x2}`;
  }

  return {d, labelX: x2 - 10, labelY: y2 - 4};
}

function renderMarkers(): string {
  return EDGE_COLORS.map(
    (color, index) =>
      `<marker id="ca${index}" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M0,-4L8,0L0,4" fill="${color}"/>
      </marker>`
  ).join("");
}

function renderHeaders(stages: Set<number>, offsetX: number): string {
  return [...stages]
    .sort((a, b) => a - b)
    .map(stage => {
      const centerX = stage * COLUMN_STEP + CARD_WIDTH / 2 + offsetX;
      const label = stage === 0 ? "Raw Materials" : `Stage ${stage}`;
      return `<text x="${centerX}" y="${HEADER_HEIGHT - 4}" text-anchor="middle"
        font-size="9" font-family="sans-serif" fill="#c0c0c0" font-weight="700"
        letter-spacing="0.7">${label.toUpperCase()}</text>
      <line x1="${centerX - CARD_WIDTH / 2 + 4}" y1="${HEADER_HEIGHT - 1}"
        x2="${centerX + CARD_WIDTH / 2 - 4}" y2="${HEADER_HEIGHT - 1}" stroke="#e4e4e4" stroke-width="1"/>`;
    })
    .join("");
}

function renderComponentSeparators(componentBands: ComponentBand[], offsetY: number, svgWidth: number): string {
  if (componentBands.length <= 1) return "";

  return componentBands
    .slice(1)
    .map(band => {
      const y = band.y + offsetY - COMPONENT_GAP / 2;
      return `<line x1="${SVG_PADDING / 2}" y1="${y}" x2="${svgWidth - SVG_PADDING / 2}" y2="${y}"
        stroke="#e0e0e0" stroke-width="1" stroke-dasharray="4,4"/>`;
    })
    .join("");
}

function getDisplayEdges(edges: RoutedEdge[]): DisplayEdge[] {
  const grouped = new Map<string, DisplayEdge>();

  for (const edge of edges) {
    const key = `${edge.from.id}-${edge.to.id}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        fromId: edge.from.id,
        toId: edge.to.id,
        representative: edge,
        labels: [{amount: edge.amount, recipeIndex: edge.recipeIndex}]
      });
      continue;
    }

    existing.labels.push({amount: edge.amount, recipeIndex: edge.recipeIndex});
    if (edge.recipeIndex < existing.representative.recipeIndex) existing.representative = edge;
  }

  for (const displayEdge of grouped.values()) {
    displayEdge.labels.sort((left, right) => left.recipeIndex - right.recipeIndex || left.amount - right.amount);
  }

  return [...grouped.values()];
}

function renderEdge(displayEdge: DisplayEdge, positions: Map<number, Position>): string {
  const geometry = getEdgeGeometry(displayEdge.representative, positions);
  const labels = displayEdge.labels
    .map((label, index) => {
      const color = EDGE_COLORS[label.recipeIndex % EDGE_COLORS.length];
      const y = geometry.labelY - (displayEdge.labels.length - 1 - index) * 10;

      return `<text x="${geometry.labelX}" y="${y}" text-anchor="middle"
        font-size="8" font-family="sans-serif" fill="${color}"
        paint-order="stroke" stroke="#f9f9f9" stroke-width="2.5"
        style="opacity:${DEFAULT_LABEL_OPACITY};transition:opacity 0.15s">x${label.amount}</text>`;
    })
    .join("");

  return `<g data-ef="${displayEdge.fromId}" data-et="${displayEdge.toId}" style="opacity:${DEFAULT_EDGE_OPACITY};transition:opacity 0.15s">
    <path d="${geometry.d}" fill="none" stroke="#7b7b7b" stroke-opacity="0.8" stroke-width="1.4"
      marker-end="url(#ca${displayEdge.representative.recipeIndex % EDGE_COLORS.length})"/>
    ${labels}
  </g>`;
}

function renderNode(node: GraphNode, positions: Map<number, Position>): string {
  const position = positions.get(node.id) ?? {x: node.x, y: node.y};
  const iconX = 15;
  const iconY = CARD_HEIGHT / 2;
  const textX = iconX + ICON_RADIUS + 5;
  const tooltip = [
    `${node.good.name} — base price: ${node.good.value}`,
    ...(node.good.recipes ?? []).map(
      (recipe, index) =>
        `Recipe ${index + 1}: ` +
        Object.entries(recipe)
          .map(([id, amount]) => `${Goods.get(+id)?.name ?? id} x${amount}`)
          .join(" + ")
    )
  ].join("\n");

  return `<g data-nid="${node.id}" style="cursor:pointer;transition:opacity 0.12s" transform="translate(${position.x},${position.y})">
    <title>${tooltip}</title>
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CARD_RADIUS}" fill="#fff"/>
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CARD_RADIUS}"
      fill="${node.good.color}" fill-opacity="0.13"
      stroke="${node.good.color}" stroke-opacity="0.6" stroke-width="1.3"/>
    <circle cx="${iconX}" cy="${iconY}" r="${ICON_RADIUS + 2}" fill="${node.good.color}" fill-opacity="0.17"/>
    <circle cx="${iconX}" cy="${iconY}" r="${ICON_RADIUS}" fill="${node.good.color}" fill-opacity="0.68"/>
    <use href="#${node.good.icon}" x="${iconX - ICON_RADIUS}" y="${iconY - ICON_RADIUS}"
      width="${ICON_RADIUS * 2}" height="${ICON_RADIUS * 2}"/>
    <text x="${textX}" y="${iconY - 2}" font-size="10" font-family="sans-serif"
      fill="#111" font-weight="600">${node.good.name}</text>
    <text x="${textX}" y="${iconY + 8}" font-size="8.5" font-family="sans-serif" fill="#888">🟡 ${node.good.value}</text>
  </g>`;
}

function attachGraphInteractions(svgEl: SVGSVGElement, layout: LayoutData) {
  const viewportEl = svgEl.querySelector<SVGGElement>("#viewport");
  if (!viewportEl) return;

  const svg = select(svgEl);
  const viewport = select(viewportEl);
  const nodeSelection = svg.selectAll<SVGGElement, unknown>("[data-nid]");
  const edgeSelection = svg.selectAll<SVGGElement, unknown>("[data-ef]");

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([ZOOM_MIN, ZOOM_MAX])
    .on("zoom", event => viewport.attr("transform", event.transform.toString()));

  svg.call(zoomBehavior);
  svg.call(zoomBehavior.transform, zoomIdentity.translate(16, 0).scale(1));

  function applyVisibility(chainIds: Set<number> | null) {
    edgeSelection.each(function () {
      const group = this as SVGGElement;
      const fromId = +(group.dataset.ef || -1);
      const toId = +(group.dataset.et || -1);
      const visible = chainIds ? chainIds.has(fromId) && chainIds.has(toId) : false;
      group.style.opacity = chainIds ? (visible ? "1" : "0") : String(DEFAULT_EDGE_OPACITY);

      const label = group.querySelector<SVGTextElement>("text");
      if (label) label.style.opacity = chainIds ? (visible ? "1" : "0") : String(DEFAULT_LABEL_OPACITY);
    });

    nodeSelection.each(function () {
      const group = this as SVGGElement;
      const nodeId = +(group.dataset.nid || -1);
      group.style.opacity = chainIds ? (chainIds.has(nodeId) ? "1" : "0") : "1";
    });
  }

  nodeSelection.each(function () {
    const group = this as SVGGElement;
    const nodeId = +(group.dataset.nid || -1);

    group.addEventListener("mouseenter", () => {
      applyVisibility(getDirectedChainIds(nodeId, layout.edges));
    });

    group.addEventListener("mouseleave", () => {
      applyVisibility(null);
    });
  });
}

function renderGraph(layout: LayoutData): string {
  const positions = getBasePositions(layout.nodes);
  const displayEdges = getDisplayEdges(layout.edges);
  const minX = Math.min(...layout.nodes.map(node => node.x));
  const maxX = Math.max(...layout.nodes.map(node => node.x)) + CARD_WIDTH;
  const minY = Math.min(...layout.nodes.map(node => node.y));
  const maxY = Math.max(...layout.nodes.map(node => node.y)) + CARD_HEIGHT;

  const svgWidth = maxX - minX + SVG_PADDING * 2;
  const svgHeight = maxY - minY + SVG_PADDING * 2 + HEADER_HEIGHT;
  const offsetX = -minX + SVG_PADDING;
  const offsetY = -minY + SVG_PADDING + HEADER_HEIGHT;

  const headers = renderHeaders(layout.stages, offsetX);
  const separators = renderComponentSeparators(layout.componentBands, offsetY, svgWidth);

  return /*html*/ `<svg id="chains-svg" xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" style="display:block;cursor:grab">
    <defs>${renderMarkers()}</defs>
    <g id="viewport" transform="translate(16,0)">
      ${headers}
      ${separators}
      <g transform="translate(${offsetX},${offsetY})">
        <g id="cedges">${displayEdges.map(edge => renderEdge(edge, positions)).join("")}</g>
        <g id="cnodes">${layout.nodes.map(node => renderNode(node, positions)).join("")}</g>
      </g>
    </g>
  </svg>`;
}

function openDialog(layout: LayoutData) {
  const contentEl = document.getElementById("productionChainsContent") as HTMLElement;
  const graphMarkup = renderGraph(layout);

  const minX = Math.min(...layout.nodes.map(node => node.x));
  const maxX = Math.max(...layout.nodes.map(node => node.x)) + CARD_WIDTH;
  const minY = Math.min(...layout.nodes.map(node => node.y));
  const maxY = Math.max(...layout.nodes.map(node => node.y)) + CARD_HEIGHT;
  const svgWidth = maxX - minX + SVG_PADDING * 2;
  const svgHeight = maxY - minY + SVG_PADDING * 2 + HEADER_HEIGHT;

  contentEl.style.maxHeight = `${window.innerHeight - 160}px`;
  contentEl.innerHTML = graphMarkup;

  const svgEl = contentEl.querySelector<SVGSVGElement>("#chains-svg");
  if (svgEl) attachGraphInteractions(svgEl, layout);

  ($ as any)("#productionChainsDialog").dialog({
    title: "Production Chains",
    resizable: true,
    width: Math.min(svgWidth + 32, window.innerWidth - 40),
    height: Math.min(svgHeight + 80, window.innerHeight - 60),
    position: {my: "center", at: "center", of: window},
    close() {
      contentEl.innerHTML = "";
    }
  });
}

export function open() {
  const goods = [...(pack.goods as Good[])];
  if (!goods.length) {
    tip("No goods data available.", true, "warn");
    return;
  }

  const layout = buildLayout(goods);
  if (!layout.nodes.length) {
    tip("No production chains found — add manufactured goods with recipes first.", true, "warn");
    return;
  }

  openDialog(layout);
}

declare global {
  interface Window {
    ProductionChains: {open: typeof open};
  }
}

window.ProductionChains = {open};
