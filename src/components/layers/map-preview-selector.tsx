import { Icon } from "@patkepa/kantzen-ui/icons";
import { useEffect, useState } from "react";
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
  const presetOptions = snapshot.presetOptions.filter(
    option => !option.hidden || option.value === snapshot.selectedPreset
  );

  useEffect(() => {
    const handleControlsChange = (event: Event) => {
      setSnapshot((event as CustomEvent<LayerControlsSnapshot>).detail);
    };
    window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
    return () => window.removeEventListener(LAYER_CONTROLS_CHANGE_EVENT, handleControlsChange);
  }, []);

  return (
    <label className="fmg-map-preview" data-tip="Choose how the map is presented" htmlFor="layersPreset">
      <span className="fmg-map-preview__icon" aria-hidden="true">
        <Icon icon="layers" size={17} />
      </span>
      <span className="fmg-map-preview__content">
        <span className="fmg-map-preview__label">Map view</span>
        <select
          aria-label="Map view"
          className="fmg-map-preview__select"
          id="layersPreset"
          onChange={event => controls.applyPreset(event.currentTarget.value)}
          value={snapshot.selectedPreset}
        >
          {presetOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      <Icon aria-hidden="true" className="fmg-map-preview__chevron" icon="chevron-down" size={13} />
    </label>
  );
}
