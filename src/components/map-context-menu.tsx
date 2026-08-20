import { Icon } from "@patkepa/kantzen-ui/icons";
import { Menu, MenuDivider, MenuItem, showContextMenu, type MenuItemProps } from "@patkepa/kantzen-ui/primitives";
import { type ReactNode, useState } from "react";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { MapContext, MapContextArea, MapContextEntity } from "./map-context";
import "./map-context-menu.css";

type MenuIcon = Exclude<MenuItemProps["icon"], undefined>;
type MenuPage = "add" | "areas" | "copy" | "entities" | "main";

interface ActionItemProps {
  disabled?: boolean;
  icon: MenuIcon;
  label?: ReactNode;
  onSelect: () => unknown;
  text: ReactNode;
}

export function showMapContextMenu(context: MapContext): void {
  showContextMenu({
    content: <MapContextMenu context={context} />,
    popoverClassName: "fmg-map-context-menu",
    targetOffset: { left: context.clientX, top: context.clientY }
  });
}

export function MapContextMenu({ context }: { context: MapContext }): React.JSX.Element {
  const [page, setPage] = useState<MenuPage>("main");
  const { cellId, entities, point } = context;
  const isLand = pack.cells.h[cellId] >= 20;
  const canAddBurg = isLand && !pack.cells.burg[cellId];
  const canAddRiver = isLand && !pack.cells.b[cellId] && !pack.cells.r[cellId];
  const pageTitle = { add: "Add here", areas: "Edit map data", copy: "Copy", entities: "Edit object", main: context.title }[
    page
  ];

  return (
    <Menu className="fmg-map-context-menu-list" aria-label={`Map actions for ${context.title}`}>
      <MenuDivider
        title={
          <span className="fmg-map-context-menu-heading">
            <strong>{pageTitle}</strong>
            <span>
              {page === "main" ? "" : `${context.title} · `}Cell {cellId} · {formatPoint(point)}
            </span>
          </span>
        }
      />

      {page !== "main" ? <NavigationItem icon="arrow-left" onSelect={() => setPage("main")} text="Back" /> : null}

      {page === "main" ? (
        <>
          {entities.length === 1 ? (
            <ActionItem
              icon={getEntityIcon(entities[0])}
              onSelect={() => editEntity(entities[0])}
              text={`Edit ${entities[0].label}`}
            />
          ) : null}
          {entities.length > 1 ? (
            <NavigationItem icon="select" onSelect={() => setPage("entities")} text={`Edit object (${entities.length})`} />
          ) : null}
          <ActionItem icon="info-sign" onSelect={() => Controllers.CellInfo.openAt(point)} text="Inspect this cell" />
          {context.areas.length ? (
            <NavigationItem icon="layers" onSelect={() => setPage("areas")} text="Edit map data" />
          ) : null}
          <MenuDivider />
          <NavigationItem icon="add" onSelect={() => setPage("add")} text="Add here" />
          <ActionItem icon="geotime" onSelect={() => Controllers.MeasurersEditor.addRulerAt(point)} text="Measure from here" />
          <ActionItem icon="locate" onSelect={() => zoomTo(point[0], point[1], scale, 450)} text="Center here" />
          <NavigationItem icon="clipboard" onSelect={() => setPage("copy")} text="Copy" />
        </>
      ) : null}

      {page === "entities"
        ? entities.map(entity => (
            <ActionItem
              icon={getEntityIcon(entity)}
              key={entity.key}
              onSelect={() => editEntity(entity)}
              text={entity.label}
            />
          ))
        : null}

      {page === "areas"
        ? context.areas.map(area => (
            <ActionItem
              icon={getAreaIcon(area)}
              key={`${area.kind}:${area.id}`}
              onSelect={() => editArea(area)}
              text={`${capitalize(area.kind)}: ${area.label}`}
            />
          ))
        : null}

      {page === "add" ? (
        <>
          <ActionItem
            disabled={!canAddBurg}
            icon="home"
            label={!isLand ? "Water" : pack.cells.burg[cellId] ? "Occupied" : undefined}
            onSelect={() => Controllers.BurgCreator.addAt(point)}
            text="Burg"
          />
          <ActionItem icon="tag" onSelect={() => Controllers.LabelCreator.addAt(point)} text="Label" />
          <ActionItem icon="map-marker" onSelect={() => Controllers.MarkerCreator.addAt(point)} text="Marker" />
          <ActionItem
            disabled={!canAddRiver}
            icon="waves"
            label={
              !isLand ? "Water" : pack.cells.r[cellId] ? "Occupied" : pack.cells.b[cellId] ? "Map edge" : undefined
            }
            onSelect={() => Controllers.RiverAutoCreator.addAt(point)}
            text="River"
          />
          <ActionItem icon="route" onSelect={() => Controllers.RouteCreator.openAt(point)} text="Start route" />
        </>
      ) : null}

      {page === "copy" ? (
        <>
          <ActionItem
            icon="map"
            onSelect={() => copyText(formatPoint(point), "Map coordinates copied")}
            text="Map coordinates"
          />
          <ActionItem icon="grid" onSelect={() => copyText(String(cellId), "Cell ID copied")} text="Cell ID" />
        </>
      ) : null}
    </Menu>
  );
}

function ActionItem({ disabled, icon, label, onSelect, text }: ActionItemProps): React.JSX.Element {
  return (
    <MenuItem
      disabled={disabled}
      icon={icon}
      labelElement={label}
      onClick={() => {
        void onSelect();
      }}
      text={text}
    />
  );
}

function NavigationItem({ icon, onSelect, text }: Omit<ActionItemProps, "disabled" | "label">): React.JSX.Element {
  return (
    <li className="kui-menu-item-shell" role="none">
      <button className="kui-menu-item bp6-menu-item fmg-map-context-navigation" onClick={onSelect} role="menuitem" type="button">
        <Icon icon={icon} />
        <span className="bp6-text-overflow-ellipsis">{text}</span>
        {icon === "arrow-left" ? null : <Icon icon="chevron-right" />}
      </button>
    </li>
  );
}

function editEntity(entity: MapContextEntity): unknown {
  const { element, id } = entity;
  switch (entity.kind) {
    case "burg":
      return Controllers.BurgEditor.open(id!);
    case "coastline":
      return Controllers.CoastlineVertexEditor.open(element!);
    case "emblem":
      return Controllers.EmblemsEditor.open(undefined, undefined, undefined, element);
    case "goods":
      return Controllers.GoodsEditor.open();
    case "ice":
      return Controllers.IceEditor.open(element!);
    case "label":
      return Controllers.LabelsEditor.open(entity.labelType!, id!);
    case "lake":
      return Controllers.LakesEditor.open(element!);
    case "market":
      return Controllers.MarketOverview.open(id!);
    case "marker":
      return Controllers.MarkersEditor.open(id, element);
    case "measurer":
      return Controllers.MeasurersEditor.open();
    case "production":
      return Controllers.ProductionOverview.open(id!);
    case "regiment":
      return Controllers.RegimentEditor.open(`#${element!.id}`);
    case "relief":
      return Controllers.ReliefEditor.open(element!);
    case "river":
      return Controllers.RiverEditor.open(id!);
    case "route":
      return Controllers.RouteEditor.open(id!);
    case "zone":
      return Controllers.ZonesEditor.open();
  }
}

function editArea(area: MapContextArea): unknown {
  switch (area.kind) {
    case "biome":
      return Controllers.BiomesEditor.open();
    case "culture":
      return Controllers.CulturesEditor.open();
    case "province":
      return Controllers.ProvincesEditor.open();
    case "religion":
      return Controllers.ReligionsEditor.open();
    case "state":
      return Controllers.StatesEditor.open();
  }
}

function getEntityIcon(entity: MapContextEntity): MenuIcon {
  const icons: Record<MapContextEntity["kind"], MenuIcon> = {
    burg: "home",
    coastline: "path",
    emblem: "shield",
    goods: "shop",
    ice: "snowflake",
    label: "tag",
    lake: "tint",
    market: "shop",
    marker: "map-marker",
    measurer: "geotime",
    production: "flows",
    regiment: "flag",
    relief: "mountain",
    river: "waves",
    route: "route",
    zone: "polygon-filter"
  };
  return icons[entity.kind];
}

function getAreaIcon(area: MapContextArea): MenuIcon {
  const icons: Record<MapContextArea["kind"], MenuIcon> = {
    biome: "mountain",
    culture: "people",
    province: "map",
    religion: "star",
    state: "globe-network"
  };
  return icons[area.kind];
}

function formatPoint([x, y]: [number, number]): string {
  return `${Math.round(x * 100) / 100}, ${Math.round(y * 100) / 100}`;
}

async function copyText(value: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    tip(successMessage, false, "success", 3000);
  } catch {
    tip("Could not copy to the clipboard", false, "error", 3000);
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
