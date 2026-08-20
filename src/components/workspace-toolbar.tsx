import { Icon } from "@patkepa/kantzen-ui/icons";
import { Menu, MenuItem } from "@patkepa/kantzen-ui/primitives";
import { useEffect, useRef, useState } from "react";
import { type LayerControlsSnapshot, type LegacyLayerControls } from "./layers/layer-controls";
import { MapPreviewSelector } from "./layers/map-preview-selector";
import { getToolCommands, TOOL_GROUPS } from "./tool-registry";
import "./workspace-toolbar.css";

interface WorkspaceToolbarProps {
  initialMapSnapshot?: LayerControlsSnapshot;
  mapControls?: LegacyLayerControls;
  onOpenPreferences: () => void;
}

const EDIT_GROUPS = TOOL_GROUPS.filter(group => ["world", "politics", "settlements", "geography"].includes(group.id));

function WorkspaceEditMenu(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

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

  const invoke = (command: ReturnType<typeof getToolCommands>[number]) => {
    setOpen(false);
    command.invoke();
  };

  return (
    <div className="fmg-workspace-edit" ref={root}>
      <button
        aria-controls="workspaceEditMenu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Edit map"
        className="fmg-workspace-edit__trigger"
        data-tip="Edit map features"
        id="workspaceEditTrigger"
        onClick={() => setOpen(current => !current)}
        ref={trigger}
        type="button"
      >
        <span className="fmg-workspace-toolbar__icon" aria-hidden="true">
          <Icon icon="build" size={17} />
        </span>
        <span className="fmg-workspace-edit__label">Edit</span>
        <Icon
          aria-hidden="true"
          className="fmg-workspace-edit__chevron"
          icon="chevron-down"
          size={12}
        />
      </button>
      {open ? (
        <Menu aria-label="Edit map" className="fmg-workspace-edit__menu" id="workspaceEditMenu">
          {EDIT_GROUPS.map(group => (
            <MenuItem icon={group.icon} key={group.id} text={group.label}>
              {getToolCommands(group.id).map(command => (
                <MenuItem
                  key={command.id}
                  labelElement={
                    command.shortcut ? <kbd>{command.shortcut.replace("Shift + ", "⇧")}</kbd> : undefined
                  }
                  onClick={() => invoke(command)}
                  text={command.label}
                />
              ))}
            </MenuItem>
          ))}
        </Menu>
      ) : null}
    </div>
  );
}

export function WorkspaceToolbar({
  initialMapSnapshot,
  mapControls,
  onOpenPreferences
}: WorkspaceToolbarProps): React.JSX.Element {
  return (
    <div className="fmg-workspace-toolbar">
      <WorkspaceEditMenu />
      <MapPreviewSelector controls={mapControls} initialSnapshot={initialMapSnapshot} />
      <button
        aria-label="Preferences"
        className="fmg-workspace-toolbar__preferences"
        data-tip="Open Preferences"
        id="workspacePreferencesTrigger"
        onClick={onOpenPreferences}
        title="Preferences"
        type="button"
      >
        <Icon aria-hidden="true" icon="settings" size={17} />
      </button>
    </div>
  );
}
