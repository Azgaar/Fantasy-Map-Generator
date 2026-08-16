import { WorkspaceSidebar } from "@patkepa/kantzen-ui/app-shell";
import { Icon, type IconName } from "@patkepa/kantzen-ui/icons";
import type { NavGroup } from "@patkepa/kantzen-ui/navigation";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceConfirmDialog } from "./ui/confirm-dialog";
import { executeLegacyCommand } from "./ui/legacy-command";
import { dispatchRegenerationCommand } from "./ui/regeneration-command";
import {
  WorkspacePanel,
  WorkspacePanelAction,
  WorkspacePanelEmptyState,
  WorkspacePanelHeader,
  WorkspacePanelSearch,
  WorkspacePanelSection
} from "./ui/workspace-panel";
import "@patkepa/kantzen-ui/theme.css";
import "@patkepa/kantzen-ui/app-shell/styles.css";
import "./ui/workspace-panel.css";
import "./workspace-sidebar.css";

type WorkspaceSection = "layers" | "style" | "options" | "tools" | "about";

interface ToolAction {
  id: string;
  label: string;
  tip: string;
  shortcut?: string;
}

interface ToolGroup {
  label: string;
  icon: IconName;
  actions: ToolAction[];
}

interface PendingRegeneration {
  action: ToolAction;
  ctrlKey: boolean;
  metaKey: boolean;
}

const SECTION_ROUTES: Record<WorkspaceSection, string> = {
  layers: "/layers",
  style: "/style",
  options: "/options",
  tools: "/tools",
  about: "/about"
};

const SECTION_TABS: Record<WorkspaceSection, string> = {
  layers: "layersTab",
  style: "styleTab",
  options: "optionsTab",
  tools: "toolsTab",
  about: "aboutTab"
};

const SECTION_TITLES: Record<WorkspaceSection, string> = {
  layers: "Layers",
  style: "Style",
  options: "Options",
  tools: "Tools",
  about: "About"
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Layers", icon: "layers", href: SECTION_ROUTES.layers },
      { label: "Style", icon: "style", href: SECTION_ROUTES.style },
      { label: "Options", icon: "settings", href: SECTION_ROUTES.options },
      { label: "Tools", icon: "build", href: SECTION_ROUTES.tools },
      { label: "About", icon: "info-sign", href: SECTION_ROUTES.about }
    ]
  }
];

const EDIT_ACTIONS: ToolAction[] = [
  { id: "editBiomesButton", label: "Biomes", tip: "Open Biomes Editor", shortcut: "Shift + B" },
  { id: "overviewBurgsButton", label: "Burgs", tip: "Open Burgs Overview", shortcut: "Shift + T" },
  { id: "editCoastlineSettings", label: "Coastlines", tip: "Open Coastline Settings Editor" },
  { id: "editCulturesButton", label: "Cultures", tip: "Open Cultures Editor", shortcut: "Shift + C" },
  { id: "editDiplomacyButton", label: "Diplomacy", tip: "Open Diplomatic Relationships Editor", shortcut: "Shift + D" },
  { id: "editEmblemButton", label: "Emblems", tip: "Open Emblem Editor", shortcut: "Shift + Y" },
  { id: "editGoods", label: "Goods", tip: "Open Goods Editor", shortcut: "Shift + G" },
  { id: "editHeightmapButton", label: "Heightmap", tip: "Open Heightmap customization", shortcut: "Shift + H" },
  { id: "overviewLabelsButton", label: "Labels", tip: "Open Labels Overview", shortcut: "Shift + L" },
  { id: "overviewMarketsButton", label: "Markets", tip: "Open Markets Overview" },
  { id: "overviewMarkersButton", label: "Markers", tip: "Open Markers Overview", shortcut: "Shift + K" },
  { id: "editMeasurersButton", label: "Measurers", tip: "Open Measurers Editor", shortcut: "Shift + =" },
  { id: "overviewMilitaryButton", label: "Military", tip: "Open Military Forces Overview", shortcut: "Shift + M" },
  { id: "editNamesBaseButton", label: "Namesbase", tip: "Open Namesbase Editor", shortcut: "Shift + N" },
  { id: "editNotesButton", label: "Notes", tip: "Open Notes Editor", shortcut: "Shift + O" },
  { id: "editProvincesButton", label: "Provinces", tip: "Open Provinces Editor", shortcut: "Shift + P" },
  { id: "editReligions", label: "Religions", tip: "Open Religions Editor", shortcut: "Shift + R" },
  { id: "overviewRiversButton", label: "Rivers", tip: "Open Rivers Overview", shortcut: "Shift + V" },
  { id: "overviewRoutesButton", label: "Routes", tip: "Open Routes Overview", shortcut: "Shift + U" },
  { id: "editStatesButton", label: "States", tip: "Open States Editor", shortcut: "Shift + S" },
  { id: "editTradeAnimationButton", label: "Trade", tip: "Open Trade Animation Editor" },
  { id: "editUnitsButton", label: "Units", tip: "Open Units Editor", shortcut: "Shift + Q" },
  { id: "editZonesButton", label: "Zones", tip: "Open Zones Editor", shortcut: "Shift + Z" }
];

const ADD_ACTIONS: ToolAction[] = [
  { id: "addBurgTool", label: "Burg", tip: "Place a burg on the map", shortcut: "Shift + 1" },
  { id: "addLabel", label: "Label", tip: "Place a label on the map", shortcut: "Shift + 2" },
  { id: "addMarker", label: "Marker", tip: "Place a marker on the map", shortcut: "Shift + 3" },
  { id: "addRiver", label: "River", tip: "Place a river on the map", shortcut: "Shift + 4" },
  { id: "addRoute", label: "Route", tip: "Open route creation dialog", shortcut: "Shift + 5" }
];

const INSPECT_ACTIONS: ToolAction[] = [
  { id: "overviewCellsButton", label: "Cells", tip: "Open Cell details", shortcut: "Shift + E" },
  { id: "overviewChartsButton", label: "Charts", tip: "Open data charts", shortcut: "Shift + A" },
  { id: "openMinimapButton", label: "Minimap", tip: "Open minimap overview" }
];

const CREATE_ACTIONS: ToolAction[] = [
  { id: "openSubmapTool", label: "Submap", tip: "Generate a submap from the current viewport" },
  { id: "openTransformTool", label: "Transform", tip: "Transform the map" }
];

const REGENERATE_ACTIONS: ToolAction[] = [
  { id: "regenerateBurgs", label: "Burgs", tip: "Regenerate all unlocked burgs and routes" },
  { id: "regenerateCultures", label: "Cultures", tip: "Regenerate non-locked cultures" },
  { id: "regenerateEconomy", label: "Economy", tip: "Rebuild markets, production, trade, and taxes" },
  { id: "regenerateEmblems", label: "Emblems", tip: "Regenerate all emblems" },
  { id: "regenerateGoods", label: "Goods", tip: "Regenerate bonus goods placement" },
  { id: "regenerateIce", label: "Ice", tip: "Regenerate icebergs and glaciers" },
  { id: "regenerateStateLabels", label: "State Labels", tip: "Update state label placement" },
  { id: "regenerateMarkers", label: "Markers", tip: "Regenerate unlocked markers" },
  { id: "regenerateMarkets", label: "Markets", tip: "Regenerate markets and territories" },
  { id: "regenerateMilitary", label: "Military", tip: "Recalculate military forces" },
  { id: "regeneratePopulation", label: "Population", tip: "Recalculate rural and urban population" },
  { id: "regenerateProduction", label: "Production", tip: "Regenerate production and trade deals" },
  { id: "regenerateProvinces", label: "Provinces", tip: "Regenerate non-locked provinces" },
  { id: "regenerateReliefIcons", label: "Relief", tip: "Regenerate relief icons" },
  { id: "regenerateReligions", label: "Religions", tip: "Regenerate non-locked religions" },
  { id: "regenerateRivers", label: "Rivers", tip: "Restore generated rivers" },
  { id: "regenerateRoutes", label: "Routes", tip: "Regenerate unlocked routes" },
  { id: "regenerateStates", label: "States", tip: "Regenerate non-locked states" },
  { id: "regenerateZones", label: "Zones", tip: "Regenerate zones" }
];

const TOOL_GROUPS: ToolGroup[] = [
  { label: "Edit", icon: "edit", actions: EDIT_ACTIONS },
  { label: "Add", icon: "plus", actions: ADD_ACTIONS },
  { label: "Inspect", icon: "eye-open", actions: INSPECT_ACTIONS },
  { label: "Create", icon: "new-object", actions: CREATE_ACTIONS }
];

const SIDEBAR_ACTIONS = [
  { label: "New Map", icon: "document", targetId: "newMapButton", shortcut: "F2" },
  { label: "Save", icon: "floppy-disk", targetId: "saveButton", shortcut: "Ctrl+S" },
  { label: "Export", icon: "export", targetId: "exportButton" },
  { label: "Load", icon: "import", targetId: "loadButton" },
  { label: "Reset Zoom", icon: "reset", targetId: "zoomReset", shortcut: "0" }
] satisfies { label: string; icon: IconName; targetId: string; shortcut?: string }[];

function openWorkspaceSection(section: WorkspaceSection): void {
  const options = document.getElementById("options");
  if (options?.style.display === "none") document.getElementById("optionsTrigger")?.click();
  document.getElementById(SECTION_TABS[section])?.click();
}

function SidebarActions(): React.JSX.Element {
  return (
    <div className="fmg-sidebar-actions" aria-label="Map actions">
      {SIDEBAR_ACTIONS.map(action => (
        <button
          type="button"
          className="fmg-sidebar-action"
          key={action.targetId}
          data-target-id={action.targetId}
          onClick={() => executeLegacyCommand(action.targetId)}
        >
          <Icon icon={action.icon} size={16} />
          <span>{action.label}</span>
          {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
        </button>
      ))}
    </div>
  );
}

function WorkspaceNavigation(): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(() =>
    window.innerWidth < 720 || localStorage.getItem("fmg_workspace_sidebar_collapsed") === "true"
  );
  const [currentPath, setCurrentPath] = useState(SECTION_ROUTES.tools);

  useEffect(() => {
    document.body.classList.toggle("workspace-sidebar-collapsed", collapsed);
    localStorage.setItem("fmg_workspace_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handlePanelChange = (event: Event) => {
      const section = (event as CustomEvent<{ section: WorkspaceSection | null }>).detail.section;
      setCurrentPath(section ? SECTION_ROUTES[section] : "");
    };
    const openDefaultPanel = () => openWorkspaceSection("tools");

    window.addEventListener("workspace-panel-change", handlePanelChange);
    if (document.readyState === "complete") openDefaultPanel();
    else window.addEventListener("load", openDefaultPanel, { once: true });

    return () => {
      window.removeEventListener("workspace-panel-change", handlePanelChange);
      window.removeEventListener("load", openDefaultPanel);
    };
  }, []);

  const navigate = (href: string) => {
    const section = (Object.entries(SECTION_ROUTES) as [WorkspaceSection, string][]).find(
      ([, route]) => route === href
    )?.[0];
    if (!section) return;
    setCurrentPath(href);
    openWorkspaceSection(section);
  };

  return (
    <WorkspaceSidebar
      isCollapsed={collapsed}
      productName="Fantasy Map Generator"
      collapsedProductName="FM"
      currentPath={currentPath}
      navGroups={NAV_GROUPS}
      onExpandSidebar={() => setCollapsed(value => !value)}
      onNavigate={navigate}
      navigationFooter={<SidebarActions />}
      sidebarShortcutLabel="click"
    />
  );
}

function WorkspaceHeader(): React.JSX.Element {
  const [title, setTitle] = useState(SECTION_TITLES.layers);

  useEffect(() => {
    const handlePanelChange = (event: Event) => {
      const detail = (event as CustomEvent<{ section: WorkspaceSection | null; title?: string }>).detail;
      if (detail.section) setTitle(detail.title ?? SECTION_TITLES[detail.section]);
    };

    window.addEventListener("workspace-panel-change", handlePanelChange);
    return () => window.removeEventListener("workspace-panel-change", handlePanelChange);
  }, []);

  return <WorkspacePanelHeader onClose={() => executeLegacyCommand("optionsHide")} title={title} />;
}

function matchesSearch(action: ToolAction, query: string): boolean {
  return `${action.label} ${action.tip}`.toLocaleLowerCase().includes(query);
}

function ToolButton({
  action,
  icon,
  onRegenerate
}: {
  action: ToolAction;
  icon: IconName;
  onRegenerate?: (action: ToolAction, event: MouseEvent) => void;
}): React.JSX.Element {
  const hasMarkerSettings = action.id === "regenerateMarkers";
  const handleClick = onRegenerate
    ? (event: React.MouseEvent<HTMLButtonElement>) => {
        if (event.target instanceof Element && event.target.closest("#configRegenerateMarkers")) return;
        event.stopPropagation();
        onRegenerate(action, event.nativeEvent);
      }
    : undefined;

  return (
    <WorkspacePanelAction
      id={action.id}
      data-tip={action.tip}
      data-shortcut={action.shortcut}
      icon={icon}
      label={action.label}
      onClick={handleClick}
      secondaryAction={hasMarkerSettings ? {
        ariaLabel: "Marker settings",
        icon: "settings",
        id: "configRegenerateMarkers",
        tip: "Set marker number multiplier"
      } : undefined}
      shortcut={action.shortcut?.replace("Shift + ", "⇧")}
    />
  );
}

function ToolSection({ group, query, containerId }: { group: ToolGroup; query: string; containerId?: string }) {
  const actions = group.actions.filter(action => matchesSearch(action, query));
  if (!actions.length) return null;

  return (
    <WorkspacePanelSection title={group.label}>
      <div className="fmg-panel-action-list" id={containerId}>
        {actions.map(action => (
          <ToolButton action={action} icon={group.icon} key={action.id} />
        ))}
      </div>
    </WorkspacePanelSection>
  );
}

function ToolsPanel(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [pendingRegeneration, setPendingRegeneration] = useState<PendingRegeneration | null>(null);
  const [skipFutureConfirmation, setSkipFutureConfirmation] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const query = search.trim().toLocaleLowerCase();
  const [editGroup, addGroup, inspectGroup, createGroup] = TOOL_GROUPS;
  const regenerateActions = REGENERATE_ACTIONS.filter(action => matchesSearch(action, query));
  const hasResults =
    regenerateActions.length > 0 ||
    TOOL_GROUPS.some(group => group.actions.some(action => matchesSearch(action, query)));

  useEffect(() => {
    const focusToolSearch = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLocaleLowerCase() !== "k") return;
      const panel = document.getElementById("toolsContent");
      if (!panel || getComputedStyle(panel).display === "none") return;

      event.preventDefault();
      searchInput.current?.focus();
    };

    window.addEventListener("keydown", focusToolSearch);
    return () => window.removeEventListener("keydown", focusToolSearch);
  }, []);

  const requestRegeneration = (action: ToolAction, event: MouseEvent) => {
    if (sessionStorage.getItem("regenerateFeatureDontAsk")) {
      dispatchRegenerationCommand(action.id, event);
      return;
    }

    setSkipFutureConfirmation(false);
    setPendingRegeneration({ action, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const confirmRegeneration = () => {
    if (!pendingRegeneration) return;
    if (skipFutureConfirmation) sessionStorage.setItem("regenerateFeatureDontAsk", "true");
    dispatchRegenerationCommand(pendingRegeneration.action.id, pendingRegeneration);
    setPendingRegeneration(null);
    setSkipFutureConfirmation(false);
  };

  const cancelRegeneration = () => {
    setPendingRegeneration(null);
    setSkipFutureConfirmation(false);
  };

  return (
    <WorkspacePanel className="fmg-tools-panel">
      <WorkspacePanelSearch
        ariaLabel="Search tools"
        inputRef={searchInput}
        onChange={setSearch}
        placeholder="Search tools"
        shortcut="Ctrl K"
        value={search}
      />
      {hasResults ? (
        <div className="fmg-tools-layout">
          <div>{editGroup ? <ToolSection group={editGroup} query={query} /> : null}</div>
          <div className="fmg-tools-secondary">
            {addGroup ? <ToolSection group={addGroup} query={query} containerId="addFeature" /> : null}
            {inspectGroup ? <ToolSection group={inspectGroup} query={query} /> : null}
            {createGroup ? <ToolSection group={createGroup} query={query} /> : null}
            {regenerateActions.length ? (
              <details className="fmg-regenerate" open={query ? true : undefined}>
                <summary>
                  <span>Regenerate</span>
                  <small>Rebuild generated features</small>
                </summary>
                <div id="regenerateFeature" className="fmg-panel-action-list">
                  {regenerateActions.map(action => (
                    <ToolButton action={action} icon="refresh" key={action.id} onRegenerate={requestRegeneration} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : (
        <WorkspacePanelEmptyState
          description="Try a feature name such as states, routes, or markets."
          title={`No tools found for “${search.trim()}”`}
        />
      )}
      <input type="hidden" id="addedMarkerType" name="addedMarkerType" value="" />
      <WorkspaceConfirmDialog
        confirmLabel="Regenerate"
        description="Regeneration removes custom changes made to this feature. This action cannot be undone."
        isOpen={pendingRegeneration !== null}
        onCancel={cancelRegeneration}
        onConfirm={confirmRegeneration}
        rememberChoice={{
          checked: skipFutureConfirmation,
          label: "Do not ask again this session",
          onChange: setSkipFutureConfirmation
        }}
        title={`Regenerate ${pendingRegeneration?.action.label ?? "feature"}?`}
      />
    </WorkspacePanel>
  );
}

function bindLayerSearch(): void {
  const search = document.getElementById("layersSearchInput") as HTMLInputElement | null;
  if (!search) return;
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    document.querySelectorAll<HTMLElement>("#mapLayers > li").forEach(layer => {
      layer.hidden = Boolean(query) && !layer.textContent?.toLocaleLowerCase().includes(query);
    });
  });
}

const navigationRoot = document.getElementById("workspaceNavigationRoot");
const headerRoot = document.getElementById("workspacePanelHeaderRoot");
const toolsRoot = document.getElementById("toolsContent");

if (navigationRoot) createRoot(navigationRoot).render(<WorkspaceNavigation />);
if (headerRoot) createRoot(headerRoot).render(<WorkspaceHeader />);
if (toolsRoot) createRoot(toolsRoot).render(<ToolsPanel />);
bindLayerSearch();
