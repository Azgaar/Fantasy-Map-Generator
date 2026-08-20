import { Icon } from "@patkepa/kantzen-ui/icons";
import { Menu, MenuDivider, MenuItem } from "@patkepa/kantzen-ui/primitives";
import { useEffect, useRef, useState } from "react";
import {
  type LayerControlsSnapshot,
  type LegacyLayerControls
} from "./layers/layer-controls";
import { MapPreviewSelector } from "./layers/map-preview-selector";
import { getToolCommands, TOOL_GROUPS } from "./tool-registry";
import "./workspace-toolbar.css";

interface WorkspaceToolbarProps {
  initialMapSnapshot?: LayerControlsSnapshot;
  mapControls?: LegacyLayerControls;
  onOpenPreferences: () => void;
}

const EDIT_GROUPS = TOOL_GROUPS.filter(group => ["world", "politics", "settlements", "geography"].includes(group.id));

function WorkspaceOptionsMenu(): React.JSX.Element {
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
    <div className="fmg-workspace-options" ref={root}>
      <button
        aria-controls="workspaceOptionsMenu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="fmg-workspace-options__trigger"
        id="workspaceOptionsTrigger"
        onClick={() => setOpen(current => !current)}
        ref={trigger}
        type="button"
      >
        <span className="fmg-workspace-toolbar__icon" aria-hidden="true">
          <Icon icon="build" size={17} />
        </span>
        <span className="fmg-workspace-options__label">Options</span>
        <Icon aria-hidden="true" className="fmg-workspace-options__chevron" icon="chevron-down" size={12} />
      </button>
      {open ? (
        <Menu aria-label="Options" className="fmg-workspace-options__menu" id="workspaceOptionsMenu">
          <MenuDivider title="Edit" />
          {EDIT_GROUPS.map(group => (
            <MenuItem icon={group.icon} key={group.id} text={group.label}>
              {getToolCommands(group.id).map(command => (
                <MenuItem
                  key={command.id}
                  labelElement={command.shortcut ? <kbd>{command.shortcut.replace("Shift + ", "⇧")}</kbd> : undefined}
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
      <WorkspaceOptionsMenu />
      <div className="fmg-workspace-toolbar__map-controls">
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
    </div>
  );
}
