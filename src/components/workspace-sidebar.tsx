import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LayersPanel } from "./layers/layers-panel";
import { MapMinimap } from "./map-minimap";
import {
  getToolCommands,
  type ToolCommand,
  type ToolGroup,
  type ToolGroupId,
  TOOL_GROUPS
} from "./tool-registry";
import { WorkspaceConfirmDialog } from "./ui/confirm-dialog";
import { executeLegacyCommand } from "./ui/legacy-command";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  WorkspacePanel,
  WorkspacePanelAction,
  WorkspacePanelEmptyState,
  WorkspacePanelHeader,
  WorkspacePanelSearch,
  WorkspacePanelSection
} from "./ui/workspace-panel";
import "@patkepa/kantzen-ui/theme.css";
import "./ui/workspace-panel.css";
import "./workspace-sidebar.css";

type ToolWorkspaceSection = "create" | "edit" | "inspect" | "regenerate";
type OptionsWorkspaceSection = "world-setup" | "preferences";
type WorkspaceSection = "layers" | "style" | ToolWorkspaceSection | OptionsWorkspaceSection;
type LegacyWorkspaceSection = WorkspaceSection | "options" | "tools" | "about";

interface WorkspacePanelChangeDetail {
  section: LegacyWorkspaceSection | null;
  title?: string;
}

interface WorkspaceSectionConfig {
  route: string;
  tabId: "layersTab" | "styleTab" | "optionsTab" | "toolsTab";
  title: string;
}

interface PendingRegeneration {
  command: ToolCommand;
  ctrlKey: boolean;
  metaKey: boolean;
}

const WORKSPACE_SECTIONS: Record<WorkspaceSection, WorkspaceSectionConfig> = {
  create: { route: "/create", tabId: "toolsTab", title: "Create" },
  edit: { route: "/edit", tabId: "toolsTab", title: "Edit" },
  inspect: { route: "/inspect", tabId: "toolsTab", title: "Inspect" },
  layers: { route: "/layers", tabId: "layersTab", title: "Layers" },
  style: { route: "/style", tabId: "styleTab", title: "Style" },
  "world-setup": { route: "/world-setup", tabId: "optionsTab", title: "World Setup" },
  regenerate: { route: "/regenerate", tabId: "toolsTab", title: "Regenerate" },
  preferences: { route: "/preferences", tabId: "optionsTab", title: "Preferences" }
};

const TOOL_GROUPS_BY_SECTION: Record<ToolWorkspaceSection, readonly ToolGroupId[]> = {
  create: ["create"],
  edit: ["world", "politics", "settlements", "geography"],
  inspect: ["analysis"],
  regenerate: ["regenerate"]
};

const TOOL_PANEL_COPY: Record<
  ToolWorkspaceSection,
  { emptyDescription: string; placeholder: string; searchLabel: string }
> = {
  create: {
    emptyDescription: "Try a feature such as burg, label, marker, river, or route.",
    placeholder: "Search create actions",
    searchLabel: "Search create actions"
  },
  edit: {
    emptyDescription: "Try a feature such as states, routes, cultures, or markets.",
    placeholder: "Search editors",
    searchLabel: "Search editors"
  },
  inspect: {
    emptyDescription: "Try cells, charts, or notes.",
    placeholder: "Search inspection tools",
    searchLabel: "Search inspection tools"
  },
  regenerate: {
    emptyDescription: "Try a generated feature such as states, rivers, burgs, or markets.",
    placeholder: "Search regeneration actions",
    searchLabel: "Search regeneration actions"
  }
};

const OPTIONS_SECTIONS = new Set<WorkspaceSection>(["world-setup", "preferences"]);

function isToolWorkspaceSection(section: WorkspaceSection): section is ToolWorkspaceSection {
  return section in TOOL_GROUPS_BY_SECTION;
}

function normalizeWorkspaceSection(section: LegacyWorkspaceSection | null): WorkspaceSection | null {
  if (!section || section === "about") return null;
  if (section === "tools") {
    const view = document.getElementById("toolsContent")?.dataset.workspaceView as WorkspaceSection | undefined;
    return view && isToolWorkspaceSection(view) ? view : "edit";
  }
  if (section === "options") {
    const view = document.getElementById("optionsContent")?.dataset.workspaceView as WorkspaceSection | undefined;
    return view && OPTIONS_SECTIONS.has(view) ? view : "preferences";
  }
  return section;
}

function setWorkspaceView(section: WorkspaceSection): void {
  document.body.dataset.workspaceSection = section;
  const options = document.getElementById("options");
  if (section === "preferences") {
    options?.setAttribute("role", "dialog");
    options?.setAttribute("aria-label", "Preferences");
  } else {
    options?.removeAttribute("role");
    options?.removeAttribute("aria-label");
  }
  if (isToolWorkspaceSection(section)) {
    const toolsContent = document.getElementById("toolsContent");
    if (toolsContent) toolsContent.dataset.workspaceView = section;
  } else if (OPTIONS_SECTIONS.has(section)) {
    const optionsContent = document.getElementById("optionsContent");
    if (optionsContent) optionsContent.dataset.workspaceView = section;
  }
}

function dispatchWorkspacePanelChange(section: WorkspaceSection): void {
  window.dispatchEvent(
    new CustomEvent("workspace-panel-change", {
      detail: { section, title: WORKSPACE_SECTIONS[section].title } satisfies WorkspacePanelChangeDetail
    })
  );
}

function openWorkspaceSection(section: WorkspaceSection): void {
  setWorkspaceView(section);

  const options = document.getElementById("options");
  if (options?.style.display === "none") document.getElementById("optionsTrigger")?.click();

  const tab = document.getElementById(WORKSPACE_SECTIONS[section].tabId);
  if (tab?.classList.contains("active")) dispatchWorkspacePanelChange(section);
  else tab?.click();
}

function WorkspaceHeader(): React.JSX.Element {
  const [title, setTitle] = useState(WORKSPACE_SECTIONS.layers.title);

  useEffect(() => {
    const handlePanelChange = (event: Event) => {
      const detail = (event as CustomEvent<WorkspacePanelChangeDetail>).detail;
      const section = normalizeWorkspaceSection(detail.section);
      if (section) setTitle(detail.title ?? WORKSPACE_SECTIONS[section].title);
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
  hidden,
  onRegenerate,
  query
}: {
  group: ToolGroup;
  hidden: boolean;
  onRegenerate: (command: ToolCommand, event: MouseEvent) => void;
  query: string;
}): React.JSX.Element | null {
  const commands = getToolCommands(group.id, query);
  if (!commands.length) return null;

  const containerId = group.id === "create" ? "addFeature" : group.id === "regenerate" ? "regenerateFeature" : undefined;

  return (
    <WorkspacePanelSection
      className={
        [group.id === "regenerate" ? "fmg-panel-section--destructive" : "", hidden ? "fmg-panel-section--hidden" : ""]
          .filter(Boolean)
          .join(" ") || undefined
      }
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
  const [section, setSection] = useState<ToolWorkspaceSection>(() => {
    const initialSection = document.getElementById("toolsContent")?.dataset.workspaceView as WorkspaceSection | undefined;
    return initialSection && isToolWorkspaceSection(initialSection) ? initialSection : "edit";
  });
  const [search, setSearch] = useState("");
  const [pendingRegeneration, setPendingRegeneration] = useState<PendingRegeneration | null>(null);
  const [skipFutureConfirmation, setSkipFutureConfirmation] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const query = search.trim().toLocaleLowerCase();
  const groupIds = TOOL_GROUPS_BY_SECTION[section];
  const visibleGroups = TOOL_GROUPS.filter(
    group => groupIds.includes(group.id) && getToolCommands(group.id, query).length > 0
  );
  const panelCopy = TOOL_PANEL_COPY[section];

  useEffect(() => {
    const handlePanelChange = (event: Event) => {
      const detail = (event as CustomEvent<WorkspacePanelChangeDetail>).detail;
      const nextSection = normalizeWorkspaceSection(detail.section);
      if (!nextSection || !isToolWorkspaceSection(nextSection)) return;
      setSection(nextSection);
      setSearch("");
    };

    window.addEventListener("workspace-panel-change", handlePanelChange);
    return () => window.removeEventListener("workspace-panel-change", handlePanelChange);
  }, []);

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
    <WorkspacePanel className={`fmg-tools-panel fmg-tools-panel--${section}`}>
      <WorkspacePanelSearch
        ariaLabel={panelCopy.searchLabel}
        inputRef={searchInput}
        onChange={setSearch}
        placeholder={panelCopy.placeholder}
        shortcut="Ctrl K"
        value={search}
      />
      {visibleGroups.length ? (
        <div className="fmg-tools-layout">
          {TOOL_GROUPS.map(group => (
            <ToolSection
              group={group}
              hidden={!groupIds.includes(group.id)}
              key={group.id}
              onRegenerate={requestRegeneration}
              query={groupIds.includes(group.id) ? query : ""}
            />
          ))}
        </div>
      ) : (
        <WorkspacePanelEmptyState
          description={panelCopy.emptyDescription}
          title={`No ${WORKSPACE_SECTIONS[section].title.toLocaleLowerCase()} actions found for “${search.trim()}”`}
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

const headerRoot = document.getElementById("workspacePanelHeaderRoot");
const layersRoot = document.getElementById("layersContent");
const toolsRoot = document.getElementById("toolsContent");
const mapPreviewRoot = document.getElementById("mapPreviewRoot");

if (headerRoot) createRoot(headerRoot).render(<WorkspaceHeader />);
if (layersRoot) createRoot(layersRoot).render(<LayersPanel />);
if (toolsRoot) createRoot(toolsRoot).render(<ToolsPanel />);
if (mapPreviewRoot) {
  createRoot(mapPreviewRoot).render(
    <>
      <WorkspaceToolbar onOpenSection={openWorkspaceSection} />
      <MapMinimap />
    </>
  );
}
