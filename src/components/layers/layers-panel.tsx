import { Controllers } from "@/controllers";
import { type ViewMode, VIEW_MODE_CHANGE_EVENT } from "@/controllers/view-mode-events";
import { Button } from "@patkepa/kantzen-ui/primitives";
import { useEffect, useRef, useState } from "react";
import { WorkspaceDialog } from "../ui/dialog";
import { WorkspaceNotice } from "../ui/feedback";
import { WorkspaceTextField } from "../ui/form-field";
import {
  getLayerNeighbors,
  type LayerControlsSnapshot,
  LAYER_CONTROLS_CHANGE_EVENT,
  type LayerMoveDirection,
  type LayerView,
  type LegacyLayerControls,
  moveLayerBefore,
  moveLayerByDirection
} from "./layer-controls";
import {
  WorkspacePanel,
  WorkspacePanelEmptyState,
  WorkspacePanelSearch,
  WorkspacePanelSection
} from "../ui/workspace-panel";
import "./layers-panel.css";

interface LayersPanelProps {
  controls?: LegacyLayerControls;
  initialSnapshot?: LayerControlsSnapshot;
}

const VIEW_MODES: readonly { id: ViewMode; label: string; tip: string }[] = [
  { id: "viewStandard", label: "Standard", tip: "Edit the map in the standard 2D view" },
  { id: "viewMesh", label: "3D scene", tip: "Present the map as a 3D terrain scene" },
  { id: "viewGlobe", label: "Globe", tip: "Project the map onto a globe" }
];

function getCurrentViewMode(): ViewMode {
  if (typeof document === "undefined") return "viewStandard";
  const mode = document.getElementById("canvas3d")?.dataset.type;
  return mode === "viewMesh" || mode === "viewGlobe" ? mode : "viewStandard";
}

function matchesLayer(layer: LayerView, query: string): boolean {
  return `${layer.label} ${layer.description}`.toLocaleLowerCase().includes(query);
}

function LayerRow({
  canMoveDown,
  canMoveUp,
  dragging,
  layer,
  matchesQuery,
  onDragEnd,
  onDragStart,
  onDrop,
  onMove,
  onToggle
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  dragging: boolean;
  layer: LayerView;
  matchesQuery: boolean;
  onDragEnd: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMove: (direction: LayerMoveDirection) => void;
  onToggle: (event: React.MouseEvent<HTMLElement>) => void;
}): React.JSX.Element {
  const classes = [
    "fmg-layer-row",
    layer.visible ? undefined : "buttonoff",
    layer.fixed ? "solid fmg-layer-row--fixed" : undefined,
    dragging ? "fmg-layer-row--dragging" : undefined
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={classes}
      data-layer-label={layer.label}
      data-shortcut={layer.shortcut || undefined}
      data-tip={layer.description}
      hidden={!matchesQuery}
      id={layer.id}
      onClick={onToggle}
      onDragOver={event => {
        if (layer.fixed) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={event => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
    >
      <span
        aria-hidden="true"
        className="fmg-layer-row__handle"
        draggable={!layer.fixed}
        onClick={event => event.stopPropagation()}
        onDragEnd={onDragEnd}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", layer.id);
          onDragStart();
        }}
        title={layer.fixed ? "Fixed position" : "Drag to reorder"}
      >
        {layer.fixed ? "▣" : "⠿"}
      </span>
      <Button
        aria-pressed={layer.visible}
        className="fmg-layer-row__toggle"
        fill
        icon={layer.visible ? "eye-open" : "eye-off"}
        minimal
      >
        <span>{layer.label}</span>
        {layer.shortcut ? <kbd>{layer.shortcut}</kbd> : null}
      </Button>
      <span className="fmg-layer-row__actions">
        <Button
          aria-label={`Move ${layer.label} up`}
          className="fmg-layer-row__move"
          disabled={!canMoveUp}
          icon="chevron-up"
          minimal
          onClick={event => {
            event.stopPropagation();
            onMove(-1);
          }}
        />
        <Button
          aria-label={`Move ${layer.label} down`}
          className="fmg-layer-row__move"
          disabled={!canMoveDown}
          icon="chevron-down"
          minimal
          onClick={event => {
            event.stopPropagation();
            onMove(1);
          }}
        />
      </span>
    </li>
  );
}

function ViewModeControls(): React.JSX.Element {
  const [mode, setMode] = useState(getCurrentViewMode);

  useEffect(() => {
    const handleModeChange = (event: Event) => setMode((event as CustomEvent<ViewMode>).detail);
    window.addEventListener(VIEW_MODE_CHANGE_EVENT, handleModeChange);
    return () => window.removeEventListener(VIEW_MODE_CHANGE_EVENT, handleModeChange);
  }, []);

  const changeMode = (nextMode: ViewMode) => {
    setMode(nextMode);
    if (nextMode === "viewStandard") void Controllers.View3d.enterStandard();
    else void Controllers.View3d.open(nextMode);
  };

  return (
    <WorkspacePanelSection description="Switch between editing and presentation views" title="View mode">
      <div className="fmg-view-mode" id="viewMode">
        {VIEW_MODES.map(item => (
          <Button
            className={mode === item.id ? "pressed" : undefined}
            data-tip={item.tip}
            id={item.id}
            key={item.id}
            onClick={() => changeMode(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </WorkspacePanelSection>
  );
}

export function LayersPanel({ controls = window.LayerControls, initialSnapshot }: LayersPanelProps): React.JSX.Element {
  const [snapshot, setSnapshot] = useState(() => initialSnapshot ?? controls.getSnapshot());
  const [search, setSearch] = useState("");
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [isSaveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetNameError, setPresetNameError] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const query = search.trim().toLocaleLowerCase();
  const hasResults = snapshot.layers.some(layer => matchesLayer(layer, query));
  useEffect(() => {
    const handleControlsChange = (event: Event) => {
      setSnapshot((event as CustomEvent<LayerControlsSnapshot>).detail);
    };
    window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
    return () => window.removeEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLocaleLowerCase() !== "f") return;
      const panel = document.getElementById("layersContent");
      if (!panel || getComputedStyle(panel).display === "none") return;
      event.preventDefault();
      searchInput.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const commitLayerOrder = (layers: LayerView[], movedLayerId: string) => {
    const [previousId, nextId] = getLayerNeighbors(layers, movedLayerId);
    controls.moveLayer(movedLayerId, previousId, nextId);
    setSnapshot(current => ({ ...current, layers }));
  };

  const moveLayer = (layerId: string, direction: LayerMoveDirection) => {
    commitLayerOrder(moveLayerByDirection(snapshot.layers, layerId, direction), layerId);
  };

  const dropLayer = (targetId: string) => {
    if (!draggedLayerId || draggedLayerId === targetId) return setDraggedLayerId(null);
    commitLayerOrder(moveLayerBefore(snapshot.layers, draggedLayerId, targetId), draggedLayerId);
    setDraggedLayerId(null);
  };

  const closeSaveDialog = () => {
    setSaveDialogOpen(false);
    setPresetName("");
    setPresetNameError("");
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return setPresetNameError("Enter a preset name.");
    if (snapshot.presetOptions.some(option => option.value.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return setPresetNameError("A preset with this name already exists.");
    }
    controls.savePreset(name);
    closeSaveDialog();
  };

  return (
    <WorkspacePanel className="fmg-layers-panel">
      <WorkspacePanelSection description="Save or remove your own combinations of visible layers" title="Custom views">
        <div className="fmg-layer-preset">
          <div className="fmg-layer-preset__actions">
            <Button
              disabled={!snapshot.canSavePreset}
              icon="floppy-disk"
              id="savePresetButton"
              onClick={() => setSaveDialogOpen(true)}
            >
              Save current
            </Button>
            <Button
              disabled={!snapshot.canRemovePreset}
              icon="trash"
              id="removePresetButton"
              onClick={() => controls.removePreset()}
            >
              Remove
            </Button>
          </div>
        </div>
      </WorkspacePanelSection>

      <WorkspacePanelSection description="Toggle visibility or change the SVG stacking order" title="Displayed layers">
        <WorkspacePanelSearch
          ariaLabel="Search layers"
          inputRef={searchInput}
          onChange={setSearch}
          placeholder="Search layers"
          shortcut="Ctrl F"
          value={search}
        />
        {query ? (
          <WorkspaceNotice title="Reordering is paused while filtering">
            Clear the search to drag layers or change their stacking order.
          </WorkspaceNotice>
        ) : null}
        <ul id="mapLayers" hidden={!hasResults}>
          {snapshot.layers.map((layer, index) => (
            <LayerRow
              canMoveDown={!query && !layer.fixed && index < snapshot.layers.findLastIndex(item => !item.fixed)}
              canMoveUp={!query && !layer.fixed && index > snapshot.layers.findIndex(item => !item.fixed)}
              dragging={draggedLayerId === layer.id}
              key={layer.id}
              layer={layer}
              matchesQuery={matchesLayer(layer, query)}
              onDragEnd={() => setDraggedLayerId(null)}
              onDragStart={() => setDraggedLayerId(layer.id)}
              onDrop={() => dropLayer(layer.id)}
              onMove={direction => moveLayer(layer.id, direction)}
              onToggle={event => controls.toggleLayer(layer.id, event.nativeEvent)}
            />
          ))}
        </ul>
        {!hasResults ? (
          <WorkspacePanelEmptyState
            description="Try a map feature such as rivers, labels, borders, or population."
            title={`No layers found for “${search.trim()}”`}
          />
        ) : null}
      </WorkspacePanelSection>

      <ViewModeControls />

      <WorkspaceDialog
        description="Save the current layer visibility as a reusable preset."
        footer={
          <>
            <Button onClick={closeSaveDialog}>Cancel</Button>
            <Button form="save-layer-preset" intent="primary" type="submit">Save preset</Button>
          </>
        }
        isOpen={isSaveDialogOpen}
        onClose={closeSaveDialog}
        size="small"
        title="Save layer preset"
      >
        <form
          id="save-layer-preset"
          onSubmit={event => {
            event.preventDefault();
            savePreset();
          }}
        >
          <WorkspaceTextField
            autoComplete="off"
            data-autofocus
            error={presetNameError}
            label="Preset name"
            onChange={event => {
              setPresetName(event.currentTarget.value);
              if (presetNameError) setPresetNameError("");
            }}
            placeholder="My map view"
            value={presetName}
          />
        </form>
      </WorkspaceDialog>
    </WorkspacePanel>
  );
}
