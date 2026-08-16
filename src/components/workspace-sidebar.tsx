import { WorkspaceSidebar } from "@patkepa/kantzen-ui/app-shell";
import { Icon, type IconName } from "@patkepa/kantzen-ui/icons";
import type { NavGroup } from "@patkepa/kantzen-ui/navigation";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { getToolCommands, type ToolCommand, type ToolGroup, TOOL_GROUPS } from "./tool-registry";
import { WorkspaceConfirmDialog } from "./ui/confirm-dialog";
import { executeLegacyCommand } from "./ui/legacy-command";
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

interface PendingRegeneration {
  command: ToolCommand;
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

function ToolButton({
  command,
  onRegenerate
}: {
  command: ToolCommand;
  onRegenerate?: (command: ToolCommand, event: MouseEvent) => void;
}): React.JSX.Element {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onRegenerate) onRegenerate(command, event.nativeEvent);
    else command.invoke();
  };

  return (
    <WorkspacePanelAction
      id={command.controlId}
      data-command-id={command.id}
      data-tip={command.description}
      data-shortcut={command.shortcut}
      icon={command.icon}
      label={command.label}
      onClick={handleClick}
      secondaryAction={command.secondaryAction ? {
        ariaLabel: command.secondaryAction.ariaLabel,
        commandId: command.secondaryAction.id,
        icon: command.secondaryAction.icon,
        id: command.secondaryAction.controlId,
        onClick: event => {
          event.stopPropagation();
          command.secondaryAction?.invoke();
        },
        tip: command.secondaryAction.label
      } : undefined}
      shortcut={command.shortcut?.replace("Shift + ", "⇧")}
    />
  );
}

function ToolSection({
  group,
  onRegenerate,
  query
}: {
  group: ToolGroup;
  onRegenerate: (command: ToolCommand, event: MouseEvent) => void;
  query: string;
}): React.JSX.Element | null {
  const commands = getToolCommands(group.id, query);
  if (!commands.length) return null;

  const containerId = group.id === "create" ? "addFeature" : group.id === "regenerate" ? "regenerateFeature" : undefined;

  return (
    <WorkspacePanelSection
      className={group.id === "regenerate" ? "fmg-panel-section--destructive" : undefined}
      description={group.description}
      title={group.label}
    >
      <div className="fmg-panel-action-list" id={containerId}>
        {commands.map(command => (
          <ToolButton
            command={command}
            key={command.id}
            onRegenerate={command.destructive ? onRegenerate : undefined}
          />
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
  const visibleGroups = TOOL_GROUPS.filter(group => getToolCommands(group.id, query).length > 0);

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

  const requestRegeneration = (command: ToolCommand, event: MouseEvent) => {
    if (sessionStorage.getItem("regenerateFeatureDontAsk")) {
      command.invoke(event);
      return;
    }

    setSkipFutureConfirmation(false);
    setPendingRegeneration({ command, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  };

  const confirmRegeneration = () => {
    if (!pendingRegeneration) return;
    if (skipFutureConfirmation) sessionStorage.setItem("regenerateFeatureDontAsk", "true");
    pendingRegeneration.command.invoke(pendingRegeneration);
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
      {visibleGroups.length ? (
        <div className="fmg-tools-layout">
          {visibleGroups.map(group => (
            <ToolSection group={group} key={group.id} onRegenerate={requestRegeneration} query={query} />
          ))}
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
        title={`Regenerate ${pendingRegeneration?.command.label ?? "feature"}?`}
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
