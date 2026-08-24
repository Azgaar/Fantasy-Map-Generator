import { useEffect, useState } from "react";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { precreatedHeightmaps } from "@/data/precreated-heightmaps";
import { applyOption, ensureEl } from "@/utils";
import { lock, unlock } from "@/utils/preferences";
import "./world-preset-gallery.css";

type PresetKind = "blank" | "precreated" | "random" | "template";

interface WorldPreset {
  description?: string;
  id: string;
  kind: PresetKind;
  name: string;
}

const QUICK_PRESETS: WorldPreset[] = [
  { id: "blank", kind: "blank", name: "Blank canvas", description: "Start in the terrain editor" },
  { id: "loneIsland", kind: "template", name: "Lone island", description: "One small landmass" },
  { id: "random", kind: "random", name: "Surprise me", description: "A fresh procedural world" },
  { id: "world", kind: "precreated", name: "World", description: "The full Earth" },
  { id: "europe", kind: "precreated", name: "Europe", description: "Europe and nearby regions" },
  { id: "east-asia", kind: "precreated", name: "East Asia", description: "Eastern Asia and the Pacific" }
];

const TEMPLATE_PREVIEWS: Record<string, string> = {
  archipelago: "indian-ocean",
  atoll: "caribbean",
  continents: "world-from-pacific",
  fractious: "atlantics",
  highIsland: "greenland",
  isthmus: "north-america",
  loneIsland: "iceland",
  lowIsland: "caribbean",
  mediterranean: "mediterranean-sea",
  oldWorld: "world",
  pangea: "africa-centric",
  peninsula: "arabia",
  shattered: "atlantics",
  taklamakan: "eurasia",
  volcano: "iceland"
};

const quickPresetIds = new Set(QUICK_PRESETS.map(preset => preset.id));

const PROCEDURAL_PRESETS: WorldPreset[] = Object.entries(heightmapTemplates)
  .filter(([id]) => !quickPresetIds.has(id))
  .map(([id, template]) => ({ id, kind: "template", name: template.name }));

const REAL_WORLD_PRESETS: WorldPreset[] = Object.entries(precreatedHeightmaps)
  .filter(([id]) => !quickPresetIds.has(id))
  .map(([id, heightmap]) => ({ id, kind: "precreated", name: heightmap.name }));

function getSelectedPreset(): string {
  const specialMode = document.body.dataset.newMapMode;
  if (specialMode === "blank" || specialMode === "random") return specialMode;
  return ensureEl<HTMLSelectElement>("templateInput").value || "random";
}

function PresetPreview({ preset }: { preset: WorldPreset }): React.JSX.Element {
  if (preset.kind === "blank") {
    return (
      <span aria-hidden="true" className="fmg-world-preset-card__preview fmg-world-preset-card__preview--blank">
        <span className="fmg-world-preset-card__blank-island" />
      </span>
    );
  }

  const previewId =
    preset.kind === "precreated"
      ? preset.id
      : preset.kind === "random"
        ? "world-from-pacific"
        : TEMPLATE_PREVIEWS[preset.id] || "world";

  return (
    <span aria-hidden="true" className="fmg-world-preset-card__preview">
      <img alt="" loading="lazy" src={`./heightmaps/${previewId}.png`} />
      {preset.kind === "template" || preset.kind === "random" ? (
        <span className="fmg-world-preset-card__procedural">Procedural</span>
      ) : null}
    </span>
  );
}

function WorldPresetCard({
  compact = false,
  onSelect,
  preset,
  selected
}: {
  compact?: boolean;
  onSelect: (preset: WorldPreset) => void;
  preset: WorldPreset;
  selected: boolean;
}): React.JSX.Element {
  return (
    <button
      aria-pressed={selected}
      className={`fmg-world-preset-card${compact ? " fmg-world-preset-card--compact" : ""}`}
      data-tip={`Use ${preset.name} as the starting world`}
      onClick={() => onSelect(preset)}
      type="button"
    >
      <PresetPreview preset={preset} />
      <span className="fmg-world-preset-card__copy">
        <strong>{preset.name}</strong>
        {preset.description ? <small>{preset.description}</small> : null}
      </span>
      {selected ? (
        <span aria-hidden="true" className="fmg-world-preset-card__selected">
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function WorldPresetGallery(): React.JSX.Element {
  const [selectedPreset, setSelectedPreset] = useState(getSelectedPreset);

  useEffect(() => {
    const templateInput = ensureEl<HTMLSelectElement>("templateInput");
    const syncSelection = () => setSelectedPreset(getSelectedPreset());
    const syncOnPanelOpen = (event: Event) => {
      if ((event as CustomEvent<{ section?: string }>).detail?.section === "world-setup") syncSelection();
    };

    templateInput.addEventListener("change", syncSelection);
    window.addEventListener("workspace-panel-change", syncOnPanelOpen);
    return () => {
      templateInput.removeEventListener("change", syncSelection);
      window.removeEventListener("workspace-panel-change", syncOnPanelOpen);
    };
  }, []);

  const selectPreset = (preset: WorldPreset) => {
    const templateInput = ensureEl<HTMLSelectElement>("templateInput");

    if (preset.kind === "blank" || preset.kind === "random") {
      document.body.dataset.newMapMode = preset.kind;
      if (preset.kind === "random") unlock("template");
    } else {
      delete document.body.dataset.newMapMode;
      applyOption(templateInput, preset.id, preset.name);
      lock("template");
      templateInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    setSelectedPreset(preset.id);
  };

  const renderPreset = (preset: WorldPreset, compact = false) => (
    <WorldPresetCard
      compact={compact}
      key={`${preset.kind}-${preset.id}`}
      onSelect={selectPreset}
      preset={preset}
      selected={selectedPreset === preset.id}
    />
  );

  return (
    <section aria-labelledby="worldPresetGalleryTitle" className="fmg-world-presets">
      <div className="fmg-world-presets__heading">
        <h2 id="worldPresetGalleryTitle">Choose a starting world</h2>
        <p>Pick a ready-made shape, then fine-tune the generation settings below.</p>
      </div>

      <div className="fmg-world-presets__grid fmg-world-presets__grid--quick">
        {QUICK_PRESETS.map(preset => renderPreset(preset))}
      </div>

      <details className="fmg-world-presets__more">
        <summary>Browse all starting worlds</summary>
        <div className="fmg-world-presets__collection">
          <h3>Procedural shapes</h3>
          <div className="fmg-world-presets__grid">
            {PROCEDURAL_PRESETS.map(preset => renderPreset(preset, true))}
          </div>
        </div>
        <div className="fmg-world-presets__collection">
          <h3>Real places</h3>
          <div className="fmg-world-presets__grid">
            {REAL_WORLD_PRESETS.map(preset => renderPreset(preset, true))}
          </div>
        </div>
      </details>
    </section>
  );
}
