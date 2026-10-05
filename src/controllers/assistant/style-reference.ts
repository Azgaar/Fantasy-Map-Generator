// The map style as the model reads it through read_docs: elements, formats and choices, then each element's paths
import type { z } from "zod";
import { type FieldSpec, SchemaForm } from "@/controllers/style-editor/schema-form";
import { layerLabel } from "@/data/layer-labels";
import { TEXTURES } from "@/data/textures";
import { styleMeta, stylesSchema } from "@/generators/styles-schema";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { SYSTEM_PRESETS } from "@/services/style-presets";
import type { StyleElement } from "@/types/styles";

// how a value of a custom control is written; the lists they name are in the overview
const FORMATS: Record<string, string> = {
  color: '"#rrggbb"',
  filter: "a filter (see Filters)",
  font: "a family from Fonts",
  texture: "an image from Textures, or an image URL",
  scheme: "a scheme from Heightmap schemes",
  blur: '"blur(5px)"',
  dash: '"none" or lengths such as "2 1"',
  px: '"8px"',
  percent: '"22%"',
  labelStyle: 'cssText of text-shadow, text-transform, font-variant, "transform: translate(0em, -0.5em)"',
  icon: "an icon id, such as burgs-atlas-square or ports-anchor"
};

const valueText = (value: unknown) => (value === undefined ? "" : ` = ${JSON.stringify(value)}`);

function typeOf(spec: FieldSpec): string {
  const custom = FORMATS[spec.kind];
  let type: string;
  if (custom) type = custom;
  else if (spec.options)
    type = spec.options
      .map(option => {
        const label = spec.choices?.[String(option)];
        return label && label !== String(option) ? `${JSON.stringify(option)} (${label})` : JSON.stringify(option);
      })
      .join(" | ");
  else if (spec.valueType === "number")
    type = spec.min !== undefined && spec.max !== undefined ? `number ${spec.min}–${spec.max}` : "number";
  else type = spec.valueType === "unknown" ? "string" : spec.valueType;
  return spec.nullable ? `${type} | null` : type;
}

const current = (path: string[]): unknown =>
  path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], globalThis.styles);

/** One element's every value: its store path, type and current value. A user group stands as <group> */
function elementFields(element: StyleElement): string {
  const fields = SchemaForm.walk(stylesSchema.shape[element] as z.ZodObject, styleMeta).filter(field => !field.hidden);
  const groups = Object.keys((current([element]) as { groups?: object } | undefined)?.groups ?? {});
  const userGroups = fields.some(({ spec }) => spec.path.includes("*"));
  const lines = fields.map(({ spec }) => {
    const path = [element, ...spec.path];
    const shown = path.join(".").replace(".*.", ".<group>.");
    return `- ${shown}: ${typeOf(spec)}${path.includes("*") ? "" : valueText(current(path))}`;
  });
  const header = `## ${element} (${layerLabel(element)})`;
  const groupLine = userGroups
    ? `<group> is one of this map's groups: ${groups.join(", ")}; values differ by group, read \`styles.${element}.groups\``
    : "";
  return [header, groupLine, ...lines].filter(Boolean).join("\n");
}

export function styleOverview(): string {
  const filters = [...document.querySelectorAll("#filters filter[id][name]")].map(
    filter => `url(#${filter.id}) ${filter.getAttribute("name")}`
  );
  const fonts = (globalThis.fonts ?? []).map(font => font.family);
  return [
    "The map style, `styles`: one record by element (map layer, or `map` for the whole map). A node holds `attrs` (SVG attributes), `options` (renderer inputs) and `groups` (named child nodes). Change one value per op: `Styles.setValue(path, value)`.",
    'Paths, types and current values of elements: `read_docs(["Styles: ocean, landmass, labels"])`.',
    `Elements: ${Object.keys(stylesSchema.shape)
      .map(element => `${element} (${layerLabel(element)})`)
      .join(", ")}.`,
    `Filters: "none", CSS functions such as "sepia(0.6) contrast(1.1)", or one of: ${filters.join(", ")}.`,
    `Fonts: ${fonts.join(", ")}.`,
    `Textures: ${Object.entries(TEXTURES)
      .map(([href, label]) => `"${href}" (${label})`)
      .join(", ")}.`,
    `Heightmap schemes: ${HeightmapColorSchemes.names().join(", ")}.`,
    `Presets: ${SYSTEM_PRESETS.join(", ")}. A whole new look starts from the closest one, \`StylePresets.apply(name)\`, then Styles.setValue ops after it in the same batch.`
  ].join("\n");
}

/** "Styles: ocean, labels" → those elements' fields; unknown names are listed back */
export function styleFields(names: string[]): string {
  const elements = Object.keys(stylesSchema.shape);
  const known = names.filter(name => elements.includes(name)) as StyleElement[];
  const unknown = names.filter(name => !elements.includes(name));
  const texts = known.map(elementFields);
  if (unknown.length) texts.push(`No style elements ${unknown.join(", ")}. Elements: ${elements.join(", ")}`);
  return texts.join("\n\n");
}
