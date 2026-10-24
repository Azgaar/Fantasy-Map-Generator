// A form built from a zod object schema
import { z } from "zod";
import type { FieldMeta, StandardControl } from "@/types/styles";
import { t } from "@/utils/i18n";
import { htmlEl } from "@/utils/node-utils";
import { getPath } from "@/utils/object-utils";

export type FieldSpec = {
  path: string[]; // from the schema root passed in, e.g. ["attrs", "fill"]
  kind: string; // a standard control or one the caller registered
  label: string;
  tip?: string;
  min?: number;
  max?: number;
  step?: number; // numbers
  options?: readonly (string | number)[]; // enums
  choices?: Record<string, string>; // enum value → label
  nullable: boolean;
  optional: boolean; // an unset optional is undefined, an unset nullable is null
  nullAs?: number | string;
  unsetLabel?: string;
  schemaMin?: number; // the schema's own bound, which a control may not write past
  schemaMax?: number;
  valueType: "boolean" | "number" | "string" | "unknown"; // the leaf's own type, for controls that adapt (a checkbox over a 0/1 number)
  group?: string;
};

export type ControlFactory = (spec: FieldSpec, value: unknown, set: (value: unknown) => void) => HTMLElement;

type WalkedField = { spec: FieldSpec; hidden: boolean; gate: boolean }; // a gate renders in its section's header

type Registry<M extends FieldMeta<string> = FieldMeta<string>> = z.core.$ZodRegistry<M>;

type RenderOptions = {
  meta: Registry;
  controls?: Record<string, ControlFactory>; // merged over the standard ones
  rootTitle?: string; // wraps the rows outside any section in a section of their own, `data-section=""`
  onChange: (path: string[], value: unknown) => void;
};

type Ctx = {
  meta: Registry;
  controls: Record<string, ControlFactory | undefined>;
  onChange: (path: string[], value: unknown) => void;
  root: HTMLElement;
  rootBody?: () => HTMLElement; // where a root-level row goes when the root is titled
};

const GATE_OFF = new Set<unknown>([false, "off", "none"]);
const GROUPS = "groups";
const FLATTENED = new Set(["attrs", "options"]); // bags whose rows render in their parent's place

/** The unset value a control emits for a cleared field */
export const unsetValue = (spec: FieldSpec): null | undefined => (spec.optional ? undefined : null);

// --- reading the schema ---

/** ZodDefault → ZodNullable → ZodOptional → ZodPipe → leaf, with the wrappers passed on the way */
function peel(schema: z.ZodType): { leaf: z.ZodType; wrappers: z.ZodType[] } {
  const wrappers: z.ZodType[] = [];
  let node = schema;
  while (
    node instanceof z.ZodDefault ||
    node instanceof z.ZodNullable ||
    node instanceof z.ZodOptional ||
    node instanceof z.ZodPipe
  ) {
    wrappers.push(node);
    // the schemas are built with classic zod, so the inner nodes are classic too
    node = (node instanceof z.ZodPipe ? node.in : node.unwrap()) as z.ZodType;
  }
  return { leaf: node, wrappers };
}

// meta registered on a wrapper overrides the leaf's
function unwrap<M extends FieldMeta<string>>(
  schema: z.ZodType,
  registry: Registry<M>
): { leaf: z.ZodType; meta: M; nullable: boolean; optional: boolean } {
  const { leaf, wrappers } = peel(schema);
  return {
    leaf,
    meta: Object.assign({}, registry.get(leaf), ...wrappers.reverse().map(wrapper => registry.get(wrapper))),
    nullable: wrappers.some(wrapper => wrapper instanceof z.ZodNullable),
    optional: wrappers.some(wrapper => wrapper instanceof z.ZodOptional)
  };
}

function objectOf(schema: z.ZodType | undefined): z.ZodObject | undefined {
  const leaf = schema && peel(schema).leaf;
  return leaf instanceof z.ZodObject ? leaf : undefined;
}

const recordValue = (record: z.ZodRecord) => record.valueType as z.ZodType;

/** A `groups` node's entries: a fixed object's own, or a record's value type under each of `names` */
function groupEntries(groups: z.ZodType, names = ["*"]): [string, z.ZodType][] {
  if (groups instanceof z.ZodRecord) return names.map(name => [name, recordValue(groups)]);
  if (groups instanceof z.ZodObject) return Object.entries(groups.shape);
  return [];
}

/** The dotted path of a section's gate field, which may itself be dotted */
const gateOf = (path: string[], meta: FieldMeta<string>) => (meta.gate ? [...path, meta.gate].join(".") : undefined);

/** The leaf schema a path relative to a node schema declares, or undefined when it declares none */
function fieldAt(schema: z.ZodObject, path: string[]): z.ZodType | undefined {
  let node: z.ZodType | undefined = schema;
  for (const key of path) {
    node = objectOf(node)?.shape[key];
    if (!node) return undefined;
  }
  return node;
}

/** The merged meta of every schema along a path, leaf first; a record's key steps into its value type */
function metaAlong<M extends FieldMeta<string>>(schema: z.ZodType, path: string[], registry: Registry<M>): M[] {
  const out: M[] = [];
  let node = schema;
  for (const key of path) {
    const { leaf } = peel(node);
    const next: z.ZodType | undefined =
      leaf instanceof z.ZodRecord ? recordValue(leaf) : leaf instanceof z.ZodObject ? leaf.shape[key] : undefined;
    if (!next) break;
    node = next;
    out.unshift(unwrap(node, registry).meta);
  }
  return out;
}

const finite = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : undefined);

function optionsOf(leaf: z.ZodType): readonly (string | number)[] | undefined {
  if (leaf instanceof z.ZodEnum) return leaf.options;
  if (leaf instanceof z.ZodLiteral) return [...leaf.values] as (string | number)[];
  return undefined;
}

function valueTypeOf(leaf: z.ZodType): FieldSpec["valueType"] {
  if (leaf instanceof z.ZodBoolean) return "boolean";
  if (leaf instanceof z.ZodNumber) return "number";
  if (leaf instanceof z.ZodString) return "string";
  return "unknown";
}

function fieldSpec(key: string, schema: z.ZodType, registry: Registry, path: string[] = [key]): FieldSpec {
  const { leaf, meta, nullable, optional } = unwrap(schema, registry);
  const number = leaf instanceof z.ZodNumber ? leaf : undefined;
  const schemaMin = finite(number?.minValue);
  const schemaMax = finite(number?.maxValue);
  const [min, max] = meta.range ?? [schemaMin, schemaMax];
  const bounded = min !== undefined && max !== undefined;
  const options = optionsOf(leaf);

  let kind: StandardControl = "text";
  if (leaf instanceof z.ZodBoolean) kind = "checkbox";
  else if (options) kind = "select";
  else if (number) kind = bounded ? "slider" : "number";

  let step = meta.step;
  if (step === undefined && number) step = number.isInt ? 1 : bounded && max - min <= 2 ? 0.01 : 0.1;

  return {
    path,
    kind: meta.control ?? kind,
    label: meta.label ?? key,
    tip: meta.tip,
    min,
    max,
    step,
    options,
    choices: meta.choices,
    nullable,
    optional,
    nullAs: meta.nullAs,
    unsetLabel: meta.unsetLabel,
    schemaMin,
    schemaMax,
    valueType: valueTypeOf(leaf),
    group: meta.group
  };
}

/** Every leaf of a node schema in declaration order, descending `groups` entries recursively. A user
 * `groups` record contributes its value type under a `*` segment; a fixed groups object its named entries */
function walk(schema: z.ZodObject, registry: Registry): WalkedField[] {
  const out: WalkedField[] = [];

  const visit = (node: z.ZodObject, nodePath: string[], gate?: string) => {
    for (const [key, child] of Object.entries<z.ZodType>(node.shape)) {
      const path = [...nodePath, key];
      const { leaf, meta } = unwrap(child, registry);
      if (key === GROUPS) {
        for (const [name, entry] of groupEntries(leaf)) {
          const entryNode = objectOf(entry);
          const entryPath = [...path, name];
          if (entryNode) visit(entryNode, entryPath, gateOf(entryPath, unwrap(entry, registry).meta) ?? gate);
        }
      } else if (leaf instanceof z.ZodObject) {
        visit(leaf, path, gateOf(path, meta) ?? gate);
      } else if (!(leaf instanceof z.ZodRecord)) {
        // a record outside `groups` is not part of the tree
        out.push({
          spec: fieldSpec(key, child, registry, path),
          hidden: Boolean(meta.hidden),
          gate: path.join(".") === gate
        });
      }
    }
  };

  visit(schema, []);
  return out;
}

// --- rendering ---

function render(
  schema: z.ZodObject,
  value: object,
  { meta, controls, rootTitle, onChange }: RenderOptions
): HTMLElement {
  injectStyle();
  const root = htmlEl("div", { className: "schema-form" });
  const ctx: Ctx = { meta, controls: { ...STANDARD_CONTROLS, ...controls }, onChange, root };
  if (rootTitle) {
    let body: HTMLElement | undefined;
    ctx.rootBody = () => {
      if (!body) {
        const card = section(rootTitle, "");
        root.append(card.details);
        body = card.body;
      }
      return body;
    };
  }
  renderInto(root, schema, value, [], ctx);
  return root;
}

// rows of a node: flattened bags recurse in place, a `groups` node renders its entries, other objects
// become subsections
function renderInto(
  container: HTMLElement,
  schema: z.ZodObject,
  value: unknown,
  path: string[],
  ctx: Ctx,
  skip?: string
): void {
  for (const [key, child] of Object.entries<z.ZodType>(schema.shape)) {
    const childPath = [...path, key];
    if (childPath.join(".") === skip) continue;
    const childValue = getPath(value, [key]);
    const { leaf, meta } = unwrap(child, ctx.meta);
    if (key === GROUPS) {
      renderGroups(container, leaf, childValue, childPath, ctx);
    } else if (leaf instanceof z.ZodObject) {
      if (!meta.gate && FLATTENED.has(key)) renderInto(container, leaf, childValue, childPath, ctx, skip);
      else container.append(renderSection(key, leaf, childValue, childPath, ctx, meta));
    } else if (!(leaf instanceof z.ZodRecord) && !meta.hidden) {
      // a record outside `groups` is not part of the tree
      const target = container === ctx.root && ctx.rootBody ? ctx.rootBody() : container;
      place(target, fieldSpec(key, child, ctx.meta, childPath), childValue, ctx);
    }
  }
}

/** A `groups` node is structural: it renders one card per entry — a fixed groups object from the schema,
 * a user record from the store. Entries are nodes, so their own groups recurse the same way */
function renderGroups(container: HTMLElement, schema: z.ZodType, value: unknown, path: string[], ctx: Ctx): void {
  const names = Object.keys((value as Record<string, unknown>) ?? {});
  for (const [name, entry] of groupEntries(schema, names)) {
    const node = objectOf(entry);
    if (!node) continue;
    const { meta } = unwrap(entry, ctx.meta);
    container.append(renderSection(name, node, getPath(value, [name]), [...path, name], ctx, meta));
  }
}

function renderSection(
  key: string,
  schema: z.ZodObject,
  value: unknown,
  path: string[],
  ctx: Ctx,
  meta: FieldMeta<string>
): HTMLElement {
  const { details, summary, preview, body } = section(meta.label ?? key, path.join("."));
  const gateKeys = meta.gate?.split(".");
  const gateSchema = gateKeys && fieldAt(schema, gateKeys);
  if (gateKeys && gateSchema) {
    const gate = [...path, ...gateKeys];
    const spec = fieldSpec(gate.at(-1)!, gateSchema, ctx.meta, gate);
    const gateValue = getPath(value, gateKeys);
    const holder = htmlEl("span", { className: "gate" });
    holder.dataset.field = gate.join(".");
    holder.addEventListener("click", event => event.stopPropagation()); // keeps the section from toggling
    holder.append(
      control(spec, gateValue, ctx, next => {
        ctx.onChange(gate, next);
        body.hidden = GATE_OFF.has(next);
      })
    );
    summary.insertBefore(holder, preview);
    body.hidden = GATE_OFF.has(gateValue);
  }
  renderInto(body, schema, value, path, ctx, gateOf(path, meta));
  return details;
}

function section(title: string, id: string) {
  const details = htmlEl("details", { open: true });
  details.dataset.section = id;
  const summary = htmlEl("summary");
  const preview = htmlEl("span", { className: "preview" });
  const body = htmlEl("div", { className: "body" });
  summary.append(htmlEl("span", { className: "title", textContent: title }), preview);
  details.append(summary, body);
  return { details, summary, preview, body };
}

// a field's row goes under its group's caption: the run of consecutive fields sharing the group
function place(container: HTMLElement, spec: FieldSpec, value: unknown, ctx: Ctx): void {
  let target = container;
  if (spec.group) {
    const last = container.lastElementChild as HTMLElement | null;
    const sameGroup = last?.classList.contains("group") && last.dataset.group === spec.group;
    target = sameGroup ? last! : container.appendChild(group(spec.group));
  }
  target.append(renderRow(spec, value, ctx));
}

function group(name: string): HTMLElement {
  const block = htmlEl("div", { className: "group" });
  block.dataset.group = name;
  block.append(htmlEl("div", { className: "caption", textContent: name }));
  return block;
}

// a composite control brings its own rows (see `rows`) and stands in place of the field's row
function renderRow(spec: FieldSpec, value: unknown, ctx: Ctx): HTMLElement {
  const ctl = control(spec, value, ctx, next => ctx.onChange(spec.path, next));
  const field = ctl.classList.contains("rows") ? ctl : row(spec.label, ctl);
  field.dataset.field = spec.path.join(".");
  if (spec.tip) field.dataset.tip = spec.tip;
  return field;
}

function control(spec: FieldSpec, value: unknown, ctx: Ctx, set: (value: unknown) => void): HTMLElement {
  const factory = ctx.controls[spec.kind];
  if (factory) return factory(spec, value, set);
  console.error(`SchemaForm: no control registered for "${spec.kind}" at ${spec.path.join(".")}`);
  return htmlEl("span", { textContent: `unknown control: ${spec.kind}` });
}

const STYLE = /* css */ `
  .schema-form .row { display: flex; align-items: center; gap: .3em; line-height: 1.5; }
  .schema-form .row > label { flex: 0 0 8em; overflow-wrap: anywhere; }
  .schema-form .row > .ctl { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: .3em; }
  .schema-form .ctl > select, .schema-form .ctl > input[type="text"], .schema-form .ctl > slider-input, .schema-form .ctl > .inline { flex: 1 1 0; min-width: 0; }
  .schema-form .inline { display: flex; align-items: center; gap: .3em; }
  .schema-form .inline > select, .schema-form .inline > input[type="text"], .schema-form .inline > input[type="number"], .schema-form .inline > slider-input { flex: 1 1 0; min-width: 0; }
  .schema-form .unit { flex: none; opacity: .7; }
  .schema-form .rows { display: contents; }
  .schema-form .group { margin: .6em 0; padding-left: .5em; border-left: 2px solid var(--style-group-line, rgba(0, 0, 0, .15)); }
  .schema-form .group > .caption { font-size: .8em; line-height: 1; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
  .schema-form .group .row > label { flex-basis: calc(8em - .5em - 2px); }
  .schema-form details[data-section] { margin: .4em 0; border: 1px solid var(--dark-solid, #999); border-radius: 3px; background: var(--style-card-fill, rgba(255, 255, 255, .1)); overflow: hidden; }
  .schema-form details[data-section] details[data-section] { margin: .3em 0; }
  .schema-form details[data-section] > summary { display: flex; align-items: center; gap: .4em; cursor: pointer; font-weight: 700; padding: .3em .5em; list-style: none; background: var(--style-card-head, rgba(255, 255, 255, .2)); }
  .schema-form details[data-section] > summary::-webkit-details-marker { display: none; }
  .schema-form details[data-section] > summary::before { content: "▸"; flex: none; width: 1em; opacity: .6; }
  .schema-form details[data-section][open] > summary::before { content: "▾"; }
  .schema-form details[data-section] > summary > .title { flex: none; white-space: nowrap; }
  .schema-form details[data-section] > summary > .gate { flex: 1 1 auto; display: flex; align-items: center; gap: .3em; font-weight: 400; }
  .schema-form details[data-section] > summary > .gate > select { flex: 1 1 auto; min-width: 0; }
  .schema-form details[data-section] > summary > .preview { margin-left: auto; flex: 0 1 auto; max-width: 50%; display: flex; align-items: center; justify-content: flex-end; gap: .4em; font-weight: 400; min-width: 0; overflow: hidden; }
  .schema-form details[data-section] > summary > .preview:empty { display: none; }
  .schema-form details[data-section] > .body { padding: .3em .3em .3em .5em; }
`;

let styleInjected = false;
function injectStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  document.head.append(htmlEl("style", { textContent: STYLE }));
}

// --- the building blocks a control may compose ---

/** A row: the label column and the control column */
export function row(label: string, ...controls: HTMLElement[]): HTMLElement {
  const ctl = htmlEl("div", { className: "ctl" });
  ctl.append(...controls);
  const el = htmlEl("div", { className: "row" });
  el.append(htmlEl("label", { textContent: label }), ctl);
  return el;
}

/** The rows of a composite control, rendered in place of the field's own row */
export function rows(...items: HTMLElement[]): HTMLElement {
  const el = htmlEl("div", { className: "rows" });
  el.append(...items);
  return el;
}

/** A control of several elements that together fill the column; a string is a unit beside them */
export function inline(...items: (HTMLElement | string)[]): HTMLElement {
  const el = htmlEl("span", { className: "inline" });
  el.append(
    ...items.map(item => (typeof item === "string" ? htmlEl("span", { className: "unit", textContent: item }) : item))
  );
  return el;
}

// --- the standard controls ---

let uid = 0;
const nextId = () => `schemaForm${++uid}`;

const checkbox: ControlFactory = (spec, value, set) => {
  const input = htmlEl("input", { type: "checkbox", className: "checkbox", id: nextId(), checked: Boolean(value) });
  input.addEventListener("input", () => set(spec.valueType === "number" ? Number(input.checked) : input.checked));
  const wrapper = htmlEl("span");
  wrapper.append(input, htmlEl("label", { className: "checkbox-label", htmlFor: input.id }));
  return wrapper;
};

const select: ControlFactory = (spec, value, set) => {
  const el = htmlEl("select");
  // "" is the unset sentinel only where the field has one: a real empty-string choice keeps its meaning
  const emptyChoice = spec.options?.some(option => String(option) === "") ?? false;
  const unsettable = (spec.nullable || spec.optional) && !emptyChoice;
  if (unsettable) el.add(new Option(spec.unsetLabel ?? t("inherit"), ""));
  for (const option of spec.options ?? []) {
    el.add(new Option(spec.choices?.[String(option)] ?? String(option), String(option)));
  }
  el.value = value == null ? "" : String(value);
  el.addEventListener("change", () => {
    if (el.value === "" && unsettable) return set(unsetValue(spec));
    set(spec.options?.find(option => String(option) === el.value) ?? el.value);
  });
  return el;
};

/** The schema's own bound is the one a control may not write past; its `range` only sizes the slider */
const clamp = (value: number, spec: FieldSpec): number =>
  Math.min(Math.max(value, spec.schemaMin ?? -Infinity), spec.schemaMax ?? Infinity);

/** What an empty text or number input shows */
const shownUnset = (spec: FieldSpec) => (spec.nullAs === undefined ? "" : String(spec.nullAs));

const slider: ControlFactory = (spec, value, set) => {
  const current = typeof value === "number" ? value : typeof spec.nullAs === "number" ? spec.nullAs : (spec.min ?? 0);
  // a stored value beyond the range keeps the range wide enough to hold it; parsed from markup because
  // the component builds its inputs in the constructor, which createElement forbids
  const min = Math.min(spec.min ?? 0, current);
  const max = Math.max(spec.max ?? 100, current);
  const holder = htmlEl("span");
  holder.innerHTML = /* html */ `<slider-input min="${min}" max="${max}" step="${spec.step ?? 1}" value="${current}"></slider-input>`;
  const el = holder.firstElementChild as HTMLElement & { value: string };
  el.remove();
  el.addEventListener("input", event => {
    if (event.target !== el) return; // the inner inputs bubble their own event before the component's
    const next = Number(el.value);
    if (el.value !== "" && Number.isFinite(next)) set(clamp(next, spec)); // typing past the drag range is allowed, the schema is not
  });
  return el;
};

const number: ControlFactory = (spec, value, set) => {
  const el = htmlEl("input", { type: "number", value: value == null ? shownUnset(spec) : String(value) });
  if (spec.step !== undefined) el.step = String(spec.step);
  if (spec.min !== undefined) el.min = String(spec.min);
  if (spec.max !== undefined) el.max = String(spec.max);
  el.addEventListener("input", () => {
    if (el.value === "") {
      if (spec.nullable || spec.optional) set(unsetValue(spec));
      return; // a non-nullable number keeps its last value
    }
    const next = Number(el.value);
    if (Number.isFinite(next)) set(clamp(next, spec));
  });
  return el;
};

const text: ControlFactory = (spec, value, set) => {
  const el = htmlEl("input", {
    type: "text",
    placeholder: "none",
    value: value == null ? shownUnset(spec) : String(value)
  });
  el.addEventListener("input", () => {
    const next = el.value.trim();
    set(next === "" && (spec.nullable || spec.optional) ? unsetValue(spec) : next);
  });
  return el;
};

/** "#abc" → "#aabbcc": the swatch only takes 6-digit hex */
function toColorInput(value: unknown): string {
  if (typeof value !== "string") return "#000000";
  const hex = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map(c => c + c).join("")}`;
  if (/^[0-9a-f]{4}$/.test(hex)) return `#${[...hex.slice(0, 3)].map(c => c + c).join("")}`;
  if (/^[0-9a-f]{6}$/.test(hex) || /^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
  return "#000000";
}

/** The alpha suffix a stored 4/8-digit color carries, so the swatch can put it back */
function alphaOf(value: unknown): string {
  const hex = typeof value === "string" ? value.trim() : "";
  if (/^#[0-9a-f]{8}$/i.test(hex)) return hex.slice(7).toLowerCase();
  if (/^#[0-9a-f]{4}$/i.test(hex)) return hex.slice(4).toLowerCase().repeat(2);
  return "";
}

/** A hex colour the store accepts: #rgb, #rgba, #rrggbb or #rrggbbaa */
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/;

// the swatch and an editable hex beside it: a hex colour typed in writes and syncs the swatch, anything
// else reverts; the swatch keeps the alpha suffix of a stored 4/8-digit color, which it cannot show
const color: ControlFactory = (_spec, value, set) => {
  let alpha = alphaOf(value);
  let shown = typeof value === "string" ? value.trim().toLowerCase() : "";
  const swatch = htmlEl("input", { type: "color", value: toColorInput(value) });
  const hex = htmlEl("input", { type: "text", className: "hex", placeholder: "none", spellcheck: false, value: shown });
  const write = (next: string) => {
    shown = next;
    hex.value = next;
    set(next);
  };
  swatch.addEventListener("input", () => write(swatch.value + alpha));
  hex.addEventListener("change", () => {
    const next = hex.value.trim().toLowerCase();
    if (HEX_COLOR.test(next)) {
      alpha = alphaOf(next);
      swatch.value = toColorInput(next);
      write(next);
    } else hex.value = shown; // revert to the last written value
  });
  return inline(swatch, hex);
};

// a number stored with its unit ("22%", "8px"): a slider when the field has a range, else a number input
const withUnit =
  (unit: string): ControlFactory =>
  (spec, value, set) => {
    const parsed = Number.parseFloat(String(value ?? ""));
    const numeric = Number.isFinite(parsed) ? parsed : value == null ? null : 0;
    const bounded = spec.min !== undefined && spec.max !== undefined;
    const input = (bounded ? slider : number)({ ...spec, valueType: "number" }, numeric, next =>
      set(next == null ? next : `${next}${unit}`)
    );
    return inline(input, unit);
  };

export const STANDARD_CONTROLS: Record<StandardControl, ControlFactory> = {
  checkbox,
  select,
  slider,
  number,
  text,
  color,
  percent: withUnit("%"),
  px: withUnit("px")
};

export const SchemaForm = { render, fieldSpec, walk, unwrap, metaAlong, fieldAt };
