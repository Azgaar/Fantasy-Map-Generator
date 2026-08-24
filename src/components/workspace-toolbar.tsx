import { Controllers } from "@/controllers";
import { type ViewMode, VIEW_MODE_CHANGE_EVENT } from "@/controllers/view-mode-events";
import { Icon, type IconName, IconSize, Icons } from "@patkepa/kantzen-ui/icons";
import { Menu, MenuDivider, MenuItem } from "@patkepa/kantzen-ui/primitives";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type LayerControlsSnapshot,
  LAYER_CONTROLS_CHANGE_EVENT,
  type LayerView,
  type LegacyLayerControls
} from "./layers/layer-controls";
import { getToolCommands, TOOL_GROUPS } from "./tool-registry";
import { executeLegacyCommand } from "./ui/legacy-command";
import "./workspace-toolbar.css";

export type ToolbarWorkspaceSection =
  | "create"
  | "edit"
  | "inspect"
  | "style"
  | "world-setup"
  | "regenerate"
  | "preferences";

interface WorkspaceToolbarProps {
  initialMapName?: string;
  initialMapSnapshot?: LayerControlsSnapshot;
  mapControls?: LegacyLayerControls;
  onOpenSection: (section: ToolbarWorkspaceSection) => void;
}

interface FloatingMenuProps {
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
  icon: IconName;
  id: string;
  label: string;
  route?: string;
  tip: string;
}

interface LayerMenuProps {
  initialMapSnapshot?: LayerControlsSnapshot;
  mapControls?: LegacyLayerControls;
}

interface LayerMenuState {
  controls: LegacyLayerControls;
  snapshot: LayerControlsSnapshot;
}

interface MapLayerMenuGroup {
  icon: IconName;
  ids: readonly string[];
  label: string;
}

const EDIT_GROUPS = TOOL_GROUPS.filter(group => ["world", "politics", "settlements", "geography"].includes(group.id));
const MAP_LAYER_MENU_GROUPS: readonly MapLayerMenuGroup[] = [
  {
    label: "Terrain & climate",
    icon: "mountain",
    ids: [
      "toggleTexture",
      "toggleHeight",
      "toggleLakes",
      "toggleBiomes",
      "toggleCells",
      "toggleGrid",
      "toggleRivers",
      "toggleRelief",
      "toggleTemperature",
      "toggleIce",
      "togglePrecipitation"
    ]
  },
  {
    label: "Politics & population",
    icon: "people",
    ids: [
      "toggleReligions",
      "toggleCultures",
      "toggleStates",
      "toggleProvinces",
      "toggleZones",
      "toggleBorders",
      "togglePopulation",
      "toggleMilitary"
    ]
  },
  {
    label: "Features & trade",
    icon: "flows",
    ids: [
      "toggleRoutes",
      "toggleGoods",
      "toggleMarketsLayer",
      "toggleTrade",
      "toggleEmblems",
      "toggleBurgIcons",
      "toggleLabels",
      "toggleMarkers"
    ]
  },
  {
    label: "Map decorations",
    icon: "map",
    ids: ["toggleCoordinates", "toggleCompass", "toggleRulers", "toggleScaleBar", "toggleVignette"]
  }
];
const MAP_LAYER_GROUP_INDEX = new Map(
  MAP_LAYER_MENU_GROUPS.flatMap((group, index) => group.ids.map(id => [id, index] as const))
);
const VIEW_MODES: readonly { id: ViewMode; label: string; tip: string }[] = [
  { id: "viewStandard", label: "Standard", tip: "Edit the map in the standard 2D view" },
  { id: "viewMesh", label: "3D scene", tip: "Present the map as a 3D terrain scene" },
  { id: "viewGlobe", label: "Globe", tip: "Project the map onto a globe" }
];
const TOOLBAR_ICONS: IconName[] = ["folder-open", "chart", "refresh", "plus", "edit", "eye-open", "chevron-down"];

const PROJECT_ACTIONS = [
  { label: "New Map", icon: "document", targetId: "newMapButton", shortcut: "F2" },
  { label: "Load", icon: "import", targetId: "loadButton" },
  { label: "Save", icon: "floppy-disk", targetId: "saveButton", shortcut: "Ctrl+S" },
  { label: "Export", icon: "export", targetId: "exportButton" }
] satisfies { label: string; icon: IconName; targetId: string; shortcut?: string }[];

function FloatingMenu({
  align = "left",
  children,
  icon,
  id,
  label,
  route,
  tip
}: FloatingMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = `${id}Menu`;

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={`fmg-floating-menu fmg-floating-menu--align-${align}`} ref={root}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="fmg-floating-menu__trigger"
        data-href={route}
        data-tip={tip}
        id={id}
        onClick={() => setOpen(current => !current)}
        ref={trigger}
        type="button"
      >
        <span className="fmg-workspace-toolbar__icon" aria-hidden="true">
          <Icon icon={icon} size={17} />
        </span>
        <span className="fmg-floating-menu__label">{label}</span>
        <Icon aria-hidden="true" className="fmg-floating-menu__chevron" icon="chevron-down" size={12} />
      </button>
      {open ? (
        <Menu aria-label={label} className="fmg-floating-menu__menu" id={menuId}>
          {children(close)}
        </Menu>
      ) : null}
    </div>
  );
}

function ProjectMenu({ onOpenSection }: Pick<WorkspaceToolbarProps, "onOpenSection">): React.JSX.Element {
  return (
    <FloatingMenu
      icon="folder-open"
      id="workspaceProjectTrigger"
      label="Project"
      tip="Create, load, save, and export maps"
    >
      {close => (
        <>
          {PROJECT_ACTIONS.map(action => (
            <MenuItem
              icon={action.icon}
              key={action.targetId}
              labelElement={action.shortcut ? <kbd>{action.shortcut}</kbd> : undefined}
              onClick={() => {
                close();
                executeLegacyCommand(action.targetId);
              }}
              text={action.label}
            />
          ))}
          <MenuDivider />
          <MenuItem
            icon="settings"
            onClick={() => {
              close();
              onOpenSection("preferences");
            }}
            text="Preferences"
          />
        </>
      )}
    </FloatingMenu>
  );
}

function ToolMenu({
  groupId,
  icon,
  id,
  label,
  route,
  tip
}: Pick<FloatingMenuProps, "icon" | "id" | "label" | "route" | "tip"> & {
  groupId: "analysis" | "create";
}): React.JSX.Element {
  return (
    <FloatingMenu icon={icon} id={id} label={label} route={route} tip={tip}>
      {close =>
        getToolCommands(groupId).map(command => (
          <MenuItem
            icon={command.icon}
            key={command.id}
            labelElement={command.shortcut ? <kbd>{command.shortcut.replace("Shift + ", "⇧")}</kbd> : undefined}
            onClick={() => {
              close();
              command.invoke();
            }}
            text={command.label}
          />
        ))
      }
    </FloatingMenu>
  );
}

function useLayerMenu({ initialMapSnapshot, mapControls }: LayerMenuProps): LayerMenuState {
  const controls = mapControls ?? window.LayerControls;
  const [snapshot, setSnapshot] = useState(() => initialMapSnapshot ?? controls.getSnapshot());

  useEffect(() => {
    const handleControlsChange = (event: Event) => {
      setSnapshot((event as CustomEvent<LayerControlsSnapshot>).detail);
    };
    window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
    return () => window.removeEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
  }, []);

  return { controls, snapshot };
}

function getCurrentViewMode(): ViewMode {
  if (typeof document === "undefined") return "viewStandard";
  const mode = document.getElementById("canvas3d")?.dataset.type;
  return mode === "viewMesh" || mode === "viewGlobe" ? mode : "viewStandard";
}

export function EditMenuItems({ close }: { close: () => void }): React.JSX.Element {
  return (
    <>
      {EDIT_GROUPS.map(group => (
        <MenuItem icon={group.icon} key={group.id} text={group.label}>
          {getToolCommands(group.id).map(command => (
            <MenuItem
              key={command.id}
              labelElement={command.shortcut ? <kbd>{command.shortcut.replace("Shift + ", "⇧")}</kbd> : undefined}
              onClick={() => {
                close();
                command.invoke();
              }}
              text={command.label}
            />
          ))}
        </MenuItem>
      ))}
    </>
  );
}

export function LayerMenuItems({
  controls,
  snapshot
}: {
  controls: LegacyLayerControls;
  snapshot: LayerControlsSnapshot;
}): React.JSX.Element {
  const renderLayer = (layer: LayerView) => (
    <MenuItem
      active={layer.visible}
      icon={layer.visible ? "eye-open" : "eye-off"}
      key={layer.id}
      labelElement={layer.shortcut ? <kbd>{layer.shortcut}</kbd> : undefined}
      onClick={() => controls.toggleLayer(layer.id)}
      text={layer.label}
    />
  );
  const groupedLayers = MAP_LAYER_MENU_GROUPS.map((): LayerView[] => []);
  const otherLayers: LayerView[] = [];
  for (const layer of snapshot.layers) {
    const groupIndex = MAP_LAYER_GROUP_INDEX.get(layer.id);
    if (groupIndex === undefined) otherLayers.push(layer);
    else groupedLayers[groupIndex]?.push(layer);
  }

  return (
    <>
      {MAP_LAYER_MENU_GROUPS.map((group, index) => {
        const layers = groupedLayers[index];
        return layers.length ? (
          <MenuItem icon={group.icon} key={group.label} text={group.label}>
            {layers.map(renderLayer)}
          </MenuItem>
        ) : null;
      })}
      {otherLayers.length ? (
        <MenuItem icon="layers" text="Other">
          {otherLayers.map(renderLayer)}
        </MenuItem>
      ) : null}
    </>
  );
}

function EditMenu(): React.JSX.Element {
  return (
    <FloatingMenu
      align="right"
      icon="edit"
      id="workspaceMapTrigger"
      label="Edit"
      route="/edit"
      tip="Edit map features"
    >
      {close => <EditMenuItems close={close} />}
    </FloatingMenu>
  );
}

export function ViewsMenuItems({
  close,
  controls,
  onChangeViewMode,
  onOpenSection,
  snapshot,
  viewMode
}: Pick<WorkspaceToolbarProps, "onOpenSection"> &
  LayerMenuState & {
    close: () => void;
    onChangeViewMode: (mode: ViewMode) => void;
    viewMode: ViewMode;
  }): React.JSX.Element {
  const presetOptions = snapshot.presetOptions.filter(
    option => !option.hidden || option.value === snapshot.selectedPreset
  );
  const selectedPreset = presetOptions.find(option => option.value === snapshot.selectedPreset);

  return (
    <>
      <MenuDivider title="Map preset" />
      <MenuItem icon="layers" text={selectedPreset?.label ?? "Custom map"}>
        {presetOptions.map(option => (
          <MenuItem
            active={option.value === snapshot.selectedPreset}
            disabled={snapshot.presetSelectionDisabled}
            icon={option.value === snapshot.selectedPreset ? "tick" : "blank"}
            key={option.value}
            onClick={() => {
              close();
              controls.applyPreset(option.value);
            }}
            text={option.label}
          />
        ))}
      </MenuItem>
      <MenuDivider title="Show on map" />
      <LayerMenuItems controls={controls} snapshot={snapshot} />
      <MenuDivider />
      <MenuItem
        icon="style"
        onClick={() => {
          close();
          onOpenSection("style");
        }}
        text="Style"
      />
      <MenuDivider title="View mode" />
      {VIEW_MODES.map(option => (
        <MenuItem
          active={option.id === viewMode}
          data-tip={option.tip}
          icon={option.id === viewMode ? "tick" : "blank"}
          key={option.id}
          onClick={() => {
            close();
            onChangeViewMode(option.id);
          }}
          text={option.label}
        />
      ))}
    </>
  );
}

function ViewsMenu(props: Pick<WorkspaceToolbarProps, "onOpenSection"> & LayerMenuState): React.JSX.Element {
  const [viewMode, setViewMode] = useState(getCurrentViewMode);

  useEffect(() => {
    const handleViewModeChange = (event: Event) => setViewMode((event as CustomEvent<ViewMode>).detail);
    window.addEventListener(VIEW_MODE_CHANGE_EVENT, handleViewModeChange);
    return () => window.removeEventListener(VIEW_MODE_CHANGE_EVENT, handleViewModeChange);
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "viewStandard") void Controllers.View3d.enterStandard();
    else void Controllers.View3d.open(mode);
  };

  return (
    <FloatingMenu
      align="right"
      icon="eye-open"
      id="workspaceViewsTrigger"
      label="Views"
      tip="Map presets, visible layers, view modes, and style"
    >
      {close => (
        <ViewsMenuItems {...props} close={close} onChangeViewMode={changeViewMode} viewMode={viewMode} />
      )}
    </FloatingMenu>
  );
}

function getCurrentMapName(fallback?: string): string {
  if (typeof document === "undefined") return fallback?.trim() || "Untitled map";
  return document.querySelector<HTMLInputElement>("#mapName")?.value.trim() || fallback?.trim() || "Untitled map";
}

function MapIdentity({ initialMapName }: Pick<WorkspaceToolbarProps, "initialMapName">): React.JSX.Element {
  const [mapName, setMapName] = useState(() => getCurrentMapName(initialMapName));

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("#mapName");
    const updateMapName = () => setMapName(getCurrentMapName(initialMapName));
    input?.addEventListener("input", updateMapName);
    input?.addEventListener("change", updateMapName);
    window.addEventListener("map:generated", updateMapName);
    window.addEventListener("map:loaded", updateMapName);
    updateMapName();
    return () => {
      input?.removeEventListener("input", updateMapName);
      input?.removeEventListener("change", updateMapName);
      window.removeEventListener("map:generated", updateMapName);
      window.removeEventListener("map:loaded", updateMapName);
    };
  }, [initialMapName]);

  return (
    <div aria-label={`Current map: ${mapName}`} className="fmg-fantasia" data-tip="Current map name">
      <span className="fmg-fantasia__mark" aria-hidden="true">
        {mapName.charAt(0).toLocaleUpperCase() || "M"}
      </span>
      <span className="fmg-fantasia__label">{mapName}</span>
    </div>
  );
}

function GenerateMenu({ onOpenSection }: Pick<WorkspaceToolbarProps, "onOpenSection">): React.JSX.Element {
  return (
    <FloatingMenu
      align="right"
      icon="refresh"
      id="workspaceGenerateTrigger"
      label="Generate"
      tip="World setup and regeneration"
    >
      {close => (
        <>
          <MenuItem
            icon="document"
            onClick={() => {
              close();
              executeLegacyCommand("newMapButton");
            }}
            text="New Map"
          />
          <MenuDivider />
          <MenuItem
            icon="globe-network"
            onClick={() => {
              close();
              onOpenSection("world-setup");
            }}
            text="World Setup"
          />
          <MenuItem
            icon="refresh"
            onClick={() => {
              close();
              onOpenSection("regenerate");
            }}
            text="Regenerate features"
          />
        </>
      )}
    </FloatingMenu>
  );
}

export function WorkspaceToolbar(props: WorkspaceToolbarProps): React.JSX.Element {
  const [, setIconsLoaded] = useState(false);
  const layerMenu = useLayerMenu(props);

  useEffect(() => {
    let active = true;
    void Icons.load(TOOLBAR_ICONS, IconSize.STANDARD).then(() => {
      if (active) setIconsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <nav aria-label="Map workspace" className="fmg-workspace-toolbar">
      <div className="fmg-workspace-toolbar__group">
        <MapIdentity initialMapName={props.initialMapName} />
        <ProjectMenu onOpenSection={props.onOpenSection} />
        <ToolMenu
          groupId="analysis"
          icon="chart"
          id="workspaceInspectTrigger"
          label="Inspect"
          route="/inspect"
          tip="Inspect map data"
        />
        <GenerateMenu onOpenSection={props.onOpenSection} />
        <ToolMenu
          groupId="create"
          icon="plus"
          id="workspaceCreateTrigger"
          label="Create"
          route="/create"
          tip="Create map features"
        />
      </div>
      <div className="fmg-workspace-toolbar__group fmg-workspace-toolbar__group--right">
        <EditMenu />
        <ViewsMenu {...layerMenu} onOpenSection={props.onOpenSection} />
      </div>
    </nav>
  );
}
