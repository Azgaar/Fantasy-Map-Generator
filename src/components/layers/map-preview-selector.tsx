import { Icon } from "@patkepa/kantzen-ui/icons";
import { useEffect, useRef, useState } from "react";
import {
  type LayerControlsSnapshot,
  LAYER_CONTROLS_CHANGE_EVENT,
  type LegacyLayerControls
} from "./layer-controls";
import "./map-preview-selector.css";

interface MapPreviewSelectorProps {
  controls?: LegacyLayerControls;
  initialSnapshot?: LayerControlsSnapshot;
}

export function MapPreviewSelector({
  controls = window.LayerControls,
  initialSnapshot
}: MapPreviewSelectorProps): React.JSX.Element {
  const [snapshot, setSnapshot] = useState(() => initialSnapshot ?? controls.getSnapshot());
  const [disabled, setDisabled] = useState(false);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const legacySelect = useRef<HTMLSelectElement>(null);
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

  useEffect(() => {
    const select = legacySelect.current;
    if (!select) return;
    const updateDisabled = () => setDisabled(select.disabled);
    const observer = new MutationObserver(updateDisabled);
    observer.observe(select, { attributeFilter: ["disabled"], attributes: true });
    updateDisabled();
    return () => observer.disconnect();
  }, []);

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

  const applyPreset = (preset: string) => {
    setOpen(false);
    controls.applyPreset(preset);
  };

  return (
    <div className="fmg-map-preview" ref={root}>
      <select
        aria-hidden="true"
        className="fmg-map-preview__legacy-select"
        id="layersPreset"
        onChange={event => applyPreset(event.currentTarget.value)}
        ref={legacySelect}
        tabIndex={-1}
        value={snapshot.selectedPreset}
      >
        {presetOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        aria-controls="mapPreviewDropdown"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Map view: ${selectedPreset?.label ?? "Custom map"}`}
        className="fmg-map-preview__trigger"
        data-tip="Choose how the map is presented"
        disabled={disabled}
        id="mapPreviewTrigger"
        onClick={() => setOpen(current => !current)}
        ref={trigger}
        type="button"
      >
        <span className="fmg-map-preview__icon" aria-hidden="true">
          <Icon icon="layers" size={17} />
        </span>
        <span className="fmg-map-preview__value">{selectedPreset?.label ?? "Custom map"}</span>
        <Icon
          aria-hidden="true"
          className="fmg-map-preview__chevron"
          icon="chevron-down"
          size={12}
        />
      </button>
      {open ? (
        <div aria-label="Map views" className="fmg-map-preview__dropdown" id="mapPreviewDropdown" role="menu">
          <div className="fmg-map-preview__dropdown-title">Map view</div>
          {presetOptions.map(option => {
            const selected = option.value === snapshot.selectedPreset;
            return (
              <button
                aria-checked={selected}
                className="fmg-map-preview__option"
                data-active={selected || undefined}
                key={option.value}
                onClick={() => applyPreset(option.value)}
                role="menuitemradio"
                type="button"
              >
                <span>{option.label}</span>
                {selected ? <Icon aria-hidden="true" icon="tick" size={13} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
