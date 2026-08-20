import { Icon, type IconName, IconSize, Icons } from "@patkepa/kantzen-ui/icons";
import { Menu, MenuDivider, MenuItem } from "@patkepa/kantzen-ui/primitives";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type LayerControlsSnapshot,
  LAYER_CONTROLS_CHANGE_EVENT,
  type LegacyLayerControls
} from "./layers/layer-controls";
import { getToolCommands, TOOL_GROUPS } from "./tool-registry";
import { executeLegacyCommand } from "./ui/legacy-command";
import "./workspace-toolbar.css";

export type ToolbarWorkspaceSection =
  | "create"
  | "edit"
  | "inspect"
  | "layers"
  | "style"
  | "world-setup"
  | "regenerate"
  | "preferences";

interface WorkspaceToolbarProps {
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

const EDIT_GROUPS = TOOL_GROUPS.filter(group => ["world", "politics", "settlements", "geography"].includes(group.id));
const TOOLBAR_ICONS: IconName[] = ["folder-open", "chart", "refresh", "plus", "map", "eye-open", "chevron-down"];

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

function MapMenu(): React.JSX.Element {
  return (
    <FloatingMenu
      align="right"
      icon="map"
      id="workspaceMapTrigger"
      label="Map"
      route="/edit"
      tip="Edit map features"
    >
      {close =>
        EDIT_GROUPS.map(group => (
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
        ))
      }
    </FloatingMenu>
  );
}

function ViewsMenu({
  initialMapSnapshot,
  mapControls,
  onOpenSection
}: WorkspaceToolbarProps): React.JSX.Element {
  const controls = mapControls ?? window.LayerControls;
  const [snapshot, setSnapshot] = useState(() => initialMapSnapshot ?? controls.getSnapshot());
  const presetOptions = snapshot.presetOptions.filter(
    option => !option.hidden || option.value === snapshot.selectedPreset
  );
  const selectedPreset = presetOptions.find(option => option.value === snapshot.selectedPreset);

  useEffect(() => {
    const handleControlsChange = (event: Event) => {
      setSnapshot((event as CustomEvent<LayerControlsSnapshot>).detail);
    };
    window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
    return () => window.removeEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
  }, []);

  return (
    <FloatingMenu
      align="right"
      icon="eye-open"
      id="workspaceViewsTrigger"
      label="Views"
      tip="Map views, layers, and style"
    >
      {close => (
        <>
          <MenuItem icon="layers" text={selectedPreset?.label ?? "Custom map"}>
            {presetOptions.map(option => (
              <MenuItem
                active={option.value === snapshot.selectedPreset}
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
          <MenuDivider />
          <MenuItem
            icon="layers"
            onClick={() => {
              close();
              onOpenSection("layers");
            }}
            text="Layers"
          />
          <MenuItem
            icon="style"
            onClick={() => {
              close();
              onOpenSection("style");
            }}
            text="Style"
          />
        </>
      )}
    </FloatingMenu>
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
        <div
          aria-label="Fantasia, country information placeholder"
          className="fmg-fantasia"
          data-tip="Country information will appear here"
        >
          <span className="fmg-fantasia__mark" aria-hidden="true">
            F
          </span>
          <span className="fmg-fantasia__label">Fantasia</span>
        </div>
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
        <MapMenu />
        <ViewsMenu {...props} />
      </div>
    </nav>
  );
}
