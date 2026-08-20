import { Button, Icon, Menu, MenuDivider, MenuItem, Popover } from "@patkepa/kantzen-ui/primitives";
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

  const applyPreset = (preset: string) => {
    setOpen(false);
    controls.applyPreset(preset);
  };

  return (
    <>
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
      <Popover
        arrow={false}
        content={
          <Menu aria-label="Map views" className="fmg-map-preview__menu">
            <MenuDivider title="Map view" />
            {presetOptions.map(option => (
              <MenuItem
                active={option.value === snapshot.selectedPreset}
                key={option.value}
                labelElement={
                  option.value === snapshot.selectedPreset ? <Icon icon="tick" size={12} /> : undefined
                }
                onClick={() => applyPreset(option.value)}
                text={option.label}
              />
            ))}
          </Menu>
        }
        disabled={disabled}
        isOpen={open}
        minimal
        onInteraction={setOpen}
        placement="bottom-end"
        popoverClassName="fmg-map-preview__popover"
      >
        <Button
          active={open}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Map view: ${selectedPreset?.label ?? "Custom map"}`}
          className="fmg-map-preview__trigger"
          data-tip="Choose how the map is presented"
          disabled={disabled}
          icon={
            <span className="fmg-map-preview__glyph" aria-hidden="true">
              <Icon icon="layers" size={18} />
              <Icon className="fmg-map-preview__glyph-chevron" icon="chevron-down" size={8} />
            </span>
          }
          id="mapPreviewTrigger"
          small
          title={selectedPreset?.label ?? "Custom map"}
        />
      </Popover>
    </>
  );
}
