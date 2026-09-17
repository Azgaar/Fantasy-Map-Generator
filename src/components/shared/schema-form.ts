// A form built from a zod object schema
import type { z } from "zod";
import type { FieldMeta, Fit, StandardControl } from "@/types/styles";

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
  valueType: "boolean" | "number" | "string" | "unknown"; // the leaf's own type, for controls that adapt (a checkbox over a 0/1 number)
  group?: string;
};

export type ControlFactory = (spec: FieldSpec, value: unknown, set: (value: unknown) => void) => HTMLElement;

type Meta = z.core.$ZodRegistry<FieldMeta<string>>;

type RenderOptions = {
  meta: Meta;
  controls?: Record<string, ControlFactory>; // merged over the standard ones
  flatten?: (key: string) => boolean; // default: key === "attrs" || key === "options"
  rootTitle?: string; // wraps the rows outside any section in a section of their own, `data-section=""`
  onChange: (path: string[], value: unknown) => void;
};

type Ctx = Required<Omit<RenderOptions, "controls" | "rootTitle">> & {
  controls: Record<string, ControlFactory | undefined>;
  root: HTMLElement;
  rootBody?: () => HTMLElement; // where a root-level row goes when the root is titled
  fitted: { field: HTMLElement; source: string; fit: Fit }[]; // the rows to refit when their source changes
};

const GATE_OFF = new Set<unknown>([false, "off", "none"]);
const defaultFlatten = (key: string) => key === "attrs" || key === "options";

/** The unset value a control emits for a cleared field */
export const unsetValue = (spec: FieldSpec): null | undefined => (spec.optional ? undefined : null);

// ZodDefault → ZodNullable → ZodOptional → ZodPipe → leaf; meta registered on a wrapper overrides the leaf's
function unwrap(
  schema: z.ZodType,
  meta: Meta
): { leaf: z.ZodType; meta: FieldMeta<string>; nullable: boolean; optional: boolean } {
  const wrappers: z.ZodType[] = [];
  let nullable = false;
  let optional = false;
  let node: any = schema;
  for (;;) {
    const type = node.def?.type;
    if (type === "nullable") nullable = true;
    else if (type === "optional") optional = true;
    else if (type !== "default" && type !== "pipe") break;
    wrappers.push(node);
    node = type === "pipe" ? node.def.in : node.def.innerType;
  }
  const merged = Object.assign({}, meta.get(node), ...wrappers.reverse().map(wrapper => meta.get(wrapper)));
  return { leaf: node, meta: merged, nullable, optional };
}

const isObject = (schema: z.ZodType): schema is z.ZodObject => (schema as any).def?.type === "object";
const isRecord = (schema: z.ZodType): boolean => (schema as any).def?.type === "record";

/** Sentence case from a key: "stroke-width" → "Stroke width", "patternOpacity" → "Pattern opacity" */
export function labelOf(key: string): string {
  const words = key
    .replace(/[-_]/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fieldSpec(key: string, schema: z.ZodType, meta: Meta, path: string[] = [key]): FieldSpec {
  const { leaf, meta: fieldMeta, nullable, optional } = unwrap(schema, meta);
  const def: any = (leaf as any).def;
  const type: string = def?.type;
  const leafAny = leaf as any;

  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  let min = finite(leafAny.minValue) ? leafAny.minValue : undefined;
  let max = finite(leafAny.maxValue) ? leafAny.maxValue : undefined;
  if (fieldMeta.range) [min, max] = fieldMeta.range;
  const bounded = min !== undefined && max !== undefined;

  const options: readonly (string | number)[] | undefined =
    type === "enum" ? leafAny.options : type === "literal" ? [...def.values] : undefined;

  const derived: StandardControl =
    type === "boolean" ? "checkbox" : options ? "select" : type === "number" ? (bounded ? "slider" : "number") : "text";

  const valueType = type === "boolean" || type === "number" || type === "string" ? type : "unknown";
  const isInt = leafAny._zod?.bag?.format === "safeint";
  const step =
    fieldMeta.step ?? (type === "number" ? (isInt ? 1 : bounded && max! - min! <= 2 ? 0.01 : 0.1) : undefined);

  return {
    path,
    kind: fieldMeta.control ?? derived,
    label: fieldMeta.label ?? labelOf(key),
    tip: fieldMeta.tip,
    min,
    max,
    step,
    options,
    choices: fieldMeta.choices,
    nullable,
    optional,
    nullAs: fieldMeta.nullAs,
    valueType,
    group: fieldMeta.group
  };
}

export type WalkedField = { spec: FieldSpec; hidden: boolean; gate: boolean }; // a gate renders in its section's header

/** Every leaf of an object schema in declaration order. Records are skipped unless `records` is set,
 * which descends into their value type under a `*` segment */
function walk(schema: z.ZodObject, meta: Meta, options: { records?: boolean } = {}): WalkedField[] {
  const out: WalkedField[] = [];
  const visit = (node: z.ZodObject, nodePath: string[], gate?: string) => {
    for (const [key, child] of Object.entries(node.shape as Record<string, z.ZodType>)) {
      const { leaf, meta: childMeta } = unwrap(child, meta);
      if (isRecord(leaf)) {
        const valueType = unwrapObject((leaf as any).valueType);
        if (options.records && valueType) visit(valueType, [...nodePath, key, "*"]);
        continue;
      }
      if (isObject(leaf)) {
        visit(
          leaf,
          [...nodePath, key],
          childMeta.gate ? [...nodePath, key, ...childMeta.gate.split(".")].join(".") : gate
        );
        continue;
      }
      const path = [...nodePath, key];
      out.push({
        spec: fieldSpec(key, child, meta, path),
        hidden: Boolean(childMeta.hidden),
        gate: path.join(".") === gate
      });
    }
  };
  visit(schema, []);
  return out;
}

const getPath = (value: unknown, path: string[]): unknown =>
  path.reduce<unknown>((node, key) => (node == null ? undefined : (node as Record<string, unknown>)[key]), value);

const STYLE = /* css */ `
  .schema-form .row { display: flex; align-items: center; gap: .3em; line-height: 1.5; }
  .schema-form .row > label { flex: 0 0 8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
  .schema-form details[data-section] > .body { padding: .3em .5em; }
`;

let styleInjected = false;
function injectStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
}

function render(schema: z.ZodObject, value: object, options: RenderOptions): HTMLElement {
  injectStyle();
  const ctx: Ctx = {
    meta: options.meta,
    controls: { ...STANDARD_CONTROLS, ...options.controls },
    flatten: options.flatten ?? defaultFlatten,
    onChange: (path, value) => {
      options.onChange(path, value);
      const source = path.join(".");
      for (const entry of ctx.fitted) if (entry.source === source) refit(entry.field, entry.fit, value);
    },
    root: document.createElement("div"),
    fitted: []
  };
  const root = document.createElement("div");
  root.className = "schema-form";
  ctx.root = root;
  if (options.rootTitle) {
    let body: HTMLElement | undefined;
    ctx.rootBody = () => {
      if (body) return body;
      const card = section(options.rootTitle!, "");
      body = card.querySelector<HTMLElement>(".body")!;
      root.append(card);
      return body;
    };
  }
  renderInto(root, schema, value, [], ctx);
  return root;
}

function section(title: string, id: string): HTMLDetailsElement {
  const details = document.createElement("details");
  details.open = true;
  details.dataset.section = id;
  const summary = document.createElement("summary");
  const span = document.createElement("span");
  span.className = "title";
  span.textContent = title;
  summary.append(span);
  const preview = document.createElement("span");
  preview.className = "preview";
  summary.append(preview);
  const body = document.createElement("div");
  body.className = "body";
  details.append(summary, body);
  return details;
}

// rows of an object: flattened containers recurse in place, other objects become subsections
function renderInto(
  container: HTMLElement,
  schema: z.ZodObject,
  value: unknown,
  path: string[],
  ctx: Ctx,
  skip?: string[]
): void {
  for (const [key, child] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    const childPath = [...path, key];
    if (skip && skip.join(".") === childPath.join(".")) continue;
    const { leaf, meta } = unwrap(child, ctx.meta);
    if (isRecord(leaf)) continue;
    if (isObject(leaf)) {
      const childValue = getPath(value, [key]);
      if (!meta.gate && ctx.flatten(key)) renderInto(container, leaf, childValue, childPath, ctx, skip);
      else container.append(renderSection(key, leaf, childValue, childPath, ctx, meta));
      continue;
    }
    if (meta.hidden) continue;
    const target = container === ctx.root && ctx.rootBody ? ctx.rootBody() : container;
    const spec = fieldSpec(key, child, ctx.meta, childPath);
    if (meta.fit) Object.assign(spec, fitted(meta.fit, getPath(value, [meta.fit.to])));
    const field = place(target, spec, getPath(value, [key]), ctx);
    if (meta.fit) ctx.fitted.push({ field, source: [...path, meta.fit.to].join("."), fit: meta.fit });
  }
}

const fitted = (fit: Fit, source: unknown): Pick<FieldSpec, "min" | "max" | "step"> => {
  const n = Number.parseFloat(String(source ?? ""));
  if (!Number.isFinite(n)) return {};
  const [min, max] = fit.range(n);
  return fit.step ? { min, max, step: fit.step(n) } : { min, max };
};

function refit(field: HTMLElement, fit: Fit, source: unknown): void {
  const slider = field.querySelector("slider-input");
  const { min, max, step } = fitted(fit, source);
  if (!slider || min === undefined || max === undefined) return;
  const current = Number((slider as HTMLElement & { value: string }).value) || 0;
  slider.setAttribute("min", String(Math.min(min, current)));
  slider.setAttribute("max", String(Math.max(max, current)));
  if (step !== undefined) slider.setAttribute("step", String(step));
}

// a field's row goes under its group's caption: the run of consecutive fields sharing the group
function place(container: HTMLElement, spec: FieldSpec, value: unknown, ctx: Ctx): HTMLElement {
  let target = container;
  if (spec.group) {
    const last = container.lastElementChild as HTMLElement | null;
    target = last?.classList.contains("group") && last.dataset.group === spec.group ? last : group(spec.group);
    if (target !== last) container.append(target);
  }
  const field = renderRow(spec, value, ctx);
  target.append(field);
  return field;
}

function group(name: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "group";
  block.dataset.group = name;
  const caption = document.createElement("div");
  caption.className = "caption";
  caption.textContent = name;
  block.append(caption);
  return block;
}

function renderSection(
  key: string,
  schema: z.ZodObject,
  value: unknown,
  path: string[],
  ctx: Ctx,
  meta: FieldMeta<string>
): HTMLElement {
  const details = section(meta.label ?? labelOf(key), path.join("."));
  const summary = details.querySelector("summary")!;
  const preview = summary.querySelector(".preview")!;
  const body = details.querySelector<HTMLElement>(".body")!;

  let gatePath: string[] | undefined;
  if (meta.gate) {
    gatePath = [...path, ...meta.gate.split(".")];
    const gateKey = gatePath.at(-1)!;
    const gateSchema = resolveSchema(schema, meta.gate.split("."));
    if (gateSchema) {
      const spec = fieldSpec(gateKey, gateSchema, ctx.meta, gatePath);
      const gateValue = getPath(value, meta.gate.split("."));
      const gate = document.createElement("span");
      gate.className = "gate";
      gate.dataset.field = gatePath.join(".");
      gate.addEventListener("click", event => event.stopPropagation());
      gate.append(
        ctx.controls[spec.kind]!(spec, gateValue, next => {
          ctx.onChange(gatePath!, next);
          body.hidden = GATE_OFF.has(next);
        })
      );
      summary.insertBefore(gate, preview);
      body.hidden = GATE_OFF.has(gateValue);
    }
  }

  renderInto(body, schema, value, path, ctx, gatePath);
  return details;
}

function resolveSchema(schema: z.ZodObject, path: string[]): z.ZodType | undefined {
  let node: z.ZodType | undefined = schema;
  for (const key of path) {
    if (!node) return undefined;
    const leaf: z.ZodObject | undefined = isObject(node) ? node : unwrapObject(node);
    node = (leaf?.shape as Record<string, z.ZodType> | undefined)?.[key];
  }
  return node;
}

/** The merged meta of every schema along a path, leaf first; a record's key steps into its value type */
function metaAlong<M extends FieldMeta<string>>(
  schema: z.ZodType,
  path: string[],
  registry: z.core.$ZodRegistry<M>
): M[] {
  const meta = registry as unknown as Meta;
  const out: M[] = [];
  let node: z.ZodType | undefined = schema;
  for (const key of path) {
    if (!node) break;
    const { leaf } = unwrap(node, meta);
    node = isRecord(leaf) ? (leaf as any).valueType : (leaf as z.ZodObject).shape?.[key];
    if (node) out.unshift(unwrap(node, meta).meta as M);
  }
  return out;
}

function unwrapObject(schema: z.ZodType): z.ZodObject | undefined {
  let node: any = schema;
  while (node && ["default", "nullable", "optional"].includes(node.def?.type)) node = node.def.innerType;
  return node?.def?.type === "object" ? node : undefined;
}

// a composite control brings its own rows (see `rows`) and stands in place of the field's row
function renderRow(spec: FieldSpec, value: unknown, ctx: Ctx): HTMLElement {
  const ctl = control(spec, value, ctx);
  const field = ctl.classList.contains("rows") ? ctl : row(spec.label, ctl);
  field.dataset.field = spec.path.join(".");
  if (spec.tip) field.dataset.tip = spec.tip;
  return field;
}

function control(spec: FieldSpec, value: unknown, ctx: Ctx): HTMLElement {
  const factory = ctx.controls[spec.kind];
  if (factory) return factory(spec, value, next => ctx.onChange(spec.path, next));
  console.error(`SchemaForm: no control registered for "${spec.kind}" at ${spec.path.join(".")}`);
  const missing = document.createElement("span");
  missing.textContent = `unknown control: ${spec.kind}`;
  return missing;
}

// --- the building blocks a control may compose ---

/** A row: the label column and the control column */
export function row(label: string, ...controls: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "row";
  const text = document.createElement("label");
  text.textContent = label;
  const ctl = document.createElement("div");
  ctl.className = "ctl";
  ctl.append(...controls);
  el.append(text, ctl);
  return el;
}

/** The rows of a composite control, rendered in place of the field's own row */
export function rows(...items: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "rows";
  el.append(...items);
  return el;
}

/** A control of several elements that together fill the column */
export function inline(...items: (HTMLElement | string)[]): HTMLElement {
  const el = document.createElement("span");
  el.className = "inline";
  el.append(...items.map(item => (typeof item === "string" ? unit(item) : item)));
  return el;
}

const unit = (text: string): HTMLElement => {
  const el = document.createElement("span");
  el.className = "unit";
  el.textContent = text;
  return el;
};

// --- the standard controls ---

let uid = 0;
const nextId = () => `schemaForm${++uid}`;

const checkbox: ControlFactory = (spec, value, set) => {
  const wrapper = document.createElement("span");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "checkbox";
  input.id = nextId();
  input.checked = Boolean(value);
  const label = document.createElement("label");
  label.className = "checkbox-label";
  label.htmlFor = input.id;
  input.addEventListener("input", () => set(spec.valueType === "number" ? Number(input.checked) : input.checked));
  wrapper.append(input, label);
  return wrapper;
};

const select: ControlFactory = (spec, value, set) => {
  const el = document.createElement("select");
  if (spec.nullable || spec.optional) el.add(new Option("inherit", ""));
  for (const option of spec.options ?? []) {
    el.add(new Option(spec.choices?.[String(option)] ?? String(option), String(option)));
  }
  el.value = value == null ? "" : String(value);
  el.addEventListener("change", () => {
    if (el.value === "") return set(unsetValue(spec));
    const option = spec.options?.find(option => String(option) === el.value);
    set(option ?? el.value);
  });
  return el;
};

const slider: ControlFactory = (spec, value, set) => {
  const current = typeof value === "number" ? value : typeof spec.nullAs === "number" ? spec.nullAs : (spec.min ?? 0);
  // a stored value beyond the range keeps the range wide enough to hold it; parsed from markup because
  // the component builds its inputs in the constructor, which createElement forbids
  const holder = document.createElement("span");
  holder.innerHTML = /* html */ `<slider-input min="${Math.min(spec.min ?? 0, current)}" max="${Math.max(spec.max ?? 100, current)}" step="${spec.step ?? 1}" value="${current}"></slider-input>`;
  const el = holder.firstElementChild as HTMLElement & { value: string };
  el.remove();
  el.addEventListener("input", event => {
    if (event.target !== el) return; // the inner inputs bubble their own event before the component's
    const next = Number(el.value);
    if (el.value === "" || !Number.isFinite(next)) return;
    set(next);
  });
  return el;
};

const number: ControlFactory = (spec, value, set) => {
  const el = document.createElement("input");
  el.type = "number";
  if (spec.step !== undefined) el.step = String(spec.step);
  if (spec.min !== undefined) el.min = String(spec.min);
  if (spec.max !== undefined) el.max = String(spec.max);
  el.value = value == null ? (spec.nullAs !== undefined ? String(spec.nullAs) : "") : String(value);
  el.addEventListener("input", () => {
    if (el.value === "") {
      if (spec.nullable || spec.optional) set(unsetValue(spec));
      return; // a non-nullable number keeps its last value
    }
    const next = Number(el.value);
    if (Number.isFinite(next)) set(next);
  });
  return el;
};

const text: ControlFactory = (spec, value, set) => {
  const el = document.createElement("input");
  el.type = "text";
  el.placeholder = "none";
  el.value = value == null ? (spec.nullAs !== undefined ? String(spec.nullAs) : "") : String(value);
  el.addEventListener("input", () => {
    const next = el.value.trim();
    set(next === "" && (spec.nullable || spec.optional) ? unsetValue(spec) : next);
  });
  return el;
};

/** "#abc" → "#aabbcc": the color input only takes 6-digit hex */
export function toColorInput(value: unknown): string {
  if (typeof value !== "string") return "#000000";
  const hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${[...hex.slice(1)].map(c => c + c).join("")}`;
  if (/^#[0-9a-f]{6}/i.test(hex)) return hex.slice(0, 7).toLowerCase();
  return "#000000";
}

// the swatch and an editable hex beside it: a valid #rrggbb typed in writes and syncs the swatch, anything else reverts
const color: ControlFactory = (_spec, value, set) => {
  const input = document.createElement("input");
  input.type = "color";
  input.value = toColorInput(value);
  const hex = document.createElement("input");
  hex.type = "text";
  hex.className = "hex";
  hex.placeholder = "none";
  hex.spellcheck = false;
  hex.value = typeof value === "string" ? value : "";
  input.addEventListener("input", () => {
    hex.value = input.value;
    set(input.value);
  });
  hex.addEventListener("change", () => {
    const next = hex.value.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(next)) {
      hex.value = input.value;
      return;
    }
    input.value = hex.value = next;
    set(next);
  });
  return inline(input, hex);
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

export const SchemaForm = { render, fieldSpec, walk, unwrap, metaAlong };
