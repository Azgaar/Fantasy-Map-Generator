import type { LabelType } from "@/generators/labels-generator";
import type { Point } from "@/types/global";
import type { PackedGraph } from "@/types/PackedGraph";

export type MapContextEntityKind =
  | "burg"
  | "coastline"
  | "emblem"
  | "goods"
  | "ice"
  | "label"
  | "lake"
  | "market"
  | "marker"
  | "measurer"
  | "production"
  | "regiment"
  | "relief"
  | "river"
  | "route"
  | "zone";

export interface MapContextEntity {
  element?: SVGElement;
  id?: number;
  key: string;
  kind: MapContextEntityKind;
  label: string;
  labelType?: LabelType;
}

export type MapContextAreaKind = "biome" | "culture" | "province" | "religion" | "state";

export interface MapContextArea {
  id: number;
  kind: MapContextAreaKind;
  label: string;
}

export interface MapContext {
  areas: MapContextArea[];
  cellId: number;
  clientX: number;
  clientY: number;
  entities: MapContextEntity[];
  point: Point;
  title: string;
}

interface MapContextInput {
  cellId: number;
  clientX: number;
  clientY: number;
  elements: Element[];
  pack: PackedGraph;
  point: Point;
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export function buildMapContext({ cellId, clientX, clientY, elements, pack, point }: MapContextInput): MapContext {
  const entities = collectEntities(elements, pack);
  const riverId = pack.cells.r?.[cellId];
  if (riverId) addEntity(entities, getRiverEntity(riverId, pack));
  const routeIds = Object.values(pack.cells.routes?.[cellId] || {});
  for (const routeId of new Set(routeIds)) addEntity(entities, getRouteEntity(routeId, pack));
  const cellBurgId = pack.cells.burg[cellId];
  if (cellBurgId) addEntity(entities, getBurgEntity(cellBurgId, pack));

  const areas = getAreas(cellId, pack);
  const title =
    entities[0]?.label || areas.find(area => area.kind === "province")?.label || areas[0]?.label || `Cell ${cellId}`;

  return { areas, cellId, clientX, clientY, entities, point, title };
}

function collectEntities(elements: Element[], pack: PackedGraph): MapContextEntity[] {
  const entities: MapContextEntity[] = [];

  for (const element of elements) {
    const label = element.closest<SVGTextElement>("#labels text[data-label-type][data-id]");
    if (label) addLabelEntities(entities, label, pack);

    const emblem = element.closest<SVGElement>("#emblems use[data-i]");
    if (emblem) addEmblemEntities(entities, emblem, pack);

    const lake = element.closest<SVGElement>("#lakes [data-f]");
    if (lake) addEntity(entities, getLakeEntity(Number(lake.dataset.f), pack, lake));

    const coastline = element.closest<SVGElement>("#coastline [data-f]");
    if (coastline) addEntity(entities, getCoastlineEntity(Number(coastline.dataset.f), pack, coastline));

    const ice = element.closest<SVGElement>("#ice [data-id]");
    if (ice) addEntity(entities, getIceEntity(Number(ice.dataset.id), pack, ice));

    const regiment = element.closest<SVGElement>("#armies [id^='regiment']");
    if (regiment && /^regiment\d+-\d+$/.test(regiment.id)) addEntity(entities, getRegimentEntity(regiment, pack));

    const zone = element.closest<SVGElement>("#zones [id^='zone']");
    if (zone && /^zone\d+$/.test(zone.id)) addEntity(entities, getZoneEntity(Number(zone.id.slice(4)), pack, zone));

    const relief = element.closest<SVGElement>("#terrain > *");
    if (relief)
      addEntity(entities, { element: relief, key: `relief:${relief.id}`, kind: "relief", label: "Relief icon" });

    const measurer = element.closest<SVGElement>("#ruler > g");
    if (measurer)
      addEntity(entities, { element: measurer, key: `measurer:${measurer.id}`, kind: "measurer", label: "Measurer" });

    const market = element.closest<SVGElement>("#markets [data-id]");
    if (market) addEntity(entities, getMarketEntity(Number(market.dataset.id), pack, market));

    const production = element.closest<SVGElement>("#goodsBurgs [data-id]");
    if (production) addEntity(entities, getProductionEntity(Number(production.dataset.id), pack, production));

    if (element.closest("#goodsIcons, #goodsCells"))
      addEntity(entities, { key: "goods", kind: "goods", label: "Goods" });
  }

  return entities;
}

function addLabelEntities(entities: MapContextEntity[], element: SVGTextElement, pack: PackedGraph): void {
  const id = Number(element.dataset.id);
  const labelType = element.dataset.labelType as LabelType;
  const text = element.textContent?.replaceAll("|", "").trim();
  addEntity(entities, {
    element,
    id,
    key: `label:${labelType}:${id}`,
    kind: "label",
    label: `${text || capitalize(labelType)} label`,
    labelType
  });

  if (labelType === "burg") addEntity(entities, getBurgEntity(id, pack));
  else if (labelType === "river") addEntity(entities, getRiverEntity(id, pack));
  else if (labelType === "route") addEntity(entities, getRouteEntity(id, pack));
}

function addEmblemEntities(entities: MapContextEntity[], element: SVGElement, pack: PackedGraph): void {
  const id = Number(element.dataset.i);
  const groupId = element.parentElement?.id;
  const type = groupId === "burgEmblems" ? "burg" : groupId === "provinceEmblems" ? "province" : "state";
  const ownerName =
    type === "burg"
      ? pack.burgs[id]?.name
      : type === "province"
        ? pack.provinces[id]?.fullName || pack.provinces[id]?.name
        : pack.states[id]?.fullName || pack.states[id]?.name;
  addEntity(entities, {
    element,
    id,
    key: `emblem:${type}:${id}`,
    kind: "emblem",
    label: `${ownerName || capitalize(type)} emblem`
  });
  if (type === "burg") addEntity(entities, getBurgEntity(id, pack));
}

function getBurgEntity(id: number, pack: PackedGraph, element?: SVGElement): MapContextEntity {
  return { element, id, key: `burg:${id}`, kind: "burg", label: pack.burgs[id]?.name || `Burg ${id}` };
}

function getRiverEntity(id: number, pack: PackedGraph, element?: SVGElement): MapContextEntity {
  const river = pack.rivers.find(item => item.i === id);
  return { element, id, key: `river:${id}`, kind: "river", label: river?.name || `River ${id}` };
}

function getRouteEntity(id: number, pack: PackedGraph, element?: SVGElement): MapContextEntity {
  const route = pack.routes.find(item => item.i === id);
  return { element, id, key: `route:${id}`, kind: "route", label: route?.name || `Route ${id}` };
}

function getLakeEntity(id: number, pack: PackedGraph, element: SVGElement): MapContextEntity {
  const lake = pack.features[id];
  return { element, id, key: `lake:${id}`, kind: "lake", label: lake?.name || `Lake ${id}` };
}

function getCoastlineEntity(id: number, pack: PackedGraph, element: SVGElement): MapContextEntity {
  const feature = pack.features[id];
  const label = feature?.name || (feature?.group ? capitalize(feature.group.replaceAll("_", " ")) : `Coastline ${id}`);
  return { element, id, key: `coastline:${id}`, kind: "coastline", label };
}

function getIceEntity(id: number, pack: PackedGraph, element: SVGElement): MapContextEntity {
  const ice = pack.ice.find(item => item.i === id);
  return { element, id, key: `ice:${id}`, kind: "ice", label: `${capitalize(ice?.type || "ice")} ${id}` };
}

function getRegimentEntity(element: SVGElement, pack: PackedGraph): MapContextEntity {
  const stateId = Number(element.dataset.state);
  const id = Number(element.dataset.id);
  const regiment = pack.states[stateId]?.military?.find(item => item.i === id);
  return {
    element,
    id,
    key: `regiment:${stateId}:${id}`,
    kind: "regiment",
    label: regiment?.name || element.dataset.name || `Regiment ${id}`
  };
}

function getZoneEntity(id: number, pack: PackedGraph, element: SVGElement): MapContextEntity {
  const zone = pack.zones.find(item => item.i === id);
  return { element, id, key: `zone:${id}`, kind: "zone", label: zone?.name || `Zone ${id}` };
}

function getMarketEntity(id: number, pack: PackedGraph, element: SVGElement): MapContextEntity {
  const market = pack.markets.find(item => item.i === id);
  const burg = market && pack.burgs[market.centerBurgId];
  return { element, id, key: `market:${id}`, kind: "market", label: `${burg?.name || `Market ${id}`} market` };
}

function getProductionEntity(id: number, pack: PackedGraph, element: SVGElement): MapContextEntity {
  return {
    element,
    id,
    key: `production:${id}`,
    kind: "production",
    label: `${pack.burgs[id]?.name || `Burg ${id}`} production`
  };
}

function addEntity(entities: MapContextEntity[], entity: MapContextEntity): void {
  if (!entities.some(item => item.key === entity.key)) entities.push(entity);
}

function getAreas(cellId: number, pack: PackedGraph): MapContextArea[] {
  const cells = pack.cells;
  return [
    getNamedArea("state", cells.state[cellId], pack),
    getNamedArea("province", cells.province[cellId], pack),
    getNamedArea("culture", cells.culture[cellId], pack),
    getNamedArea("religion", cells.religion[cellId], pack),
    getNamedArea("biome", cells.biome[cellId], pack)
  ].filter((area): area is MapContextArea => Boolean(area));
}

function getNamedArea(kind: MapContextAreaKind, id: number, pack: PackedGraph): MapContextArea | undefined {
  const collections = {
    biome: pack.biomes,
    culture: pack.cultures,
    province: pack.provinces,
    religion: pack.religions,
    state: pack.states
  } as const;
  const entity = collections[kind][id];
  if (!entity || ("removed" in entity && entity.removed)) return undefined;
  const name = "fullName" in entity ? entity.fullName || entity.name : entity.name;
  return { id, kind, label: name || `${capitalize(kind)} ${id}` };
}
