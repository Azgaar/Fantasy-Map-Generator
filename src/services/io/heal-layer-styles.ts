// Refill the layer style the v1.145 duplicate group cleanup removed
import { type LayerId, Layers } from "@/components/layers";
import { compareVersions } from "@/services/versioning";

const DAMAGED_FROM = "1.145.0";
const DAMAGED_UNTIL = "1.147.0";

const RELIEF_OPTIONS = ["set", "size", "density"]; // stored in style.relief

type PresetStyle = Record<string, string | number | null>;
type Preset = Record<string, PresetStyle>;

export async function healLayerStyles(mapVersion: string): Promise<void> {
  const isDamaged =
    !compareVersions(mapVersion, DAMAGED_FROM).isOlder && compareVersions(mapVersion, DAMAGED_UNTIL).isOlder;
  if (!isDamaged) return;

  const preset = await loadPreset();
  if (!preset) return;

  const healed = new Set<LayerId>();

  for (const layer of Layers.all) {
    const targets = [
      { id: layer.elementId, selectors: [`#${layer.elementId}`], declared: layer.params.attrs },
      ...layer.children.map(child => ({
        id: child.id,
        selectors: [`#${child.id}`, `#${layer.elementId} > #${child.id}`],
        declared: child.attrs
      }))
    ];

    for (const { id, selectors, declared } of targets) {
      const style = selectors.map(selector => preset[selector]).find(Boolean);
      const group = document.getElementById(id);
      if (!style || group?.tagName !== "g" || !isBare(group, declared)) continue;

      for (const [name, value] of Object.entries(style)) {
        if (value === null || value === "null" || name === "id") continue;
        if (id === "terrain" && RELIEF_OPTIONS.includes(name)) continue;
        group.setAttribute(name, String(value));
      }
      healed.add(layer.id);
    }
  }

  if (healed.size) Layers.draw(...healed);
}

function isBare(group: Element, declared: Record<string, string> = {}): boolean {
  const ignored = new Set(["id", "style", ...Object.keys(declared)]);
  return Array.from(group.attributes).every(attribute => ignored.has(attribute.name));
}

async function loadPreset(): Promise<Preset | undefined> {
  const getStylePreset = (globalThis as { getStylePreset?: (name: string) => Promise<[string, Preset]> })
    .getStylePreset;
  if (!getStylePreset) return;

  try {
    const [, preset] = await getStylePreset(localStorage.getItem("presetStyle") || "default");
    return preset;
  } catch {
    return;
  }
}
