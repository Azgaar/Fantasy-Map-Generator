// Browser-mode tests (vitest.browser.config.ts) for the form engine: each standard kind renders,
// a change reaches onChange(path, value), a gate folds its section, null round-trips, flatten holds
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import "./slider-input";
import type { FieldMeta } from "@/types/styles";
import { row, rows, SchemaForm } from "./schema-form";

const meta = z.registry<FieldMeta<string>>();

const schema = z.strictObject({
  attrs: z.strictObject({
    fill: z.string().register(meta, { control: "color" }).nullable(),
    opacity: z.number().min(0).max(1).nullable().register(meta, { nullAs: 1, tip: "Opacity" }),
    "stroke-dasharray": z.string().nullable(),
    "stroke-linecap": z.enum(["butt", "round"]).nullable()
  }),
  options: z.strictObject({
    count: z.number(),
    circle: z.boolean(),
    rescale: z.number().register(meta, { control: "checkbox" }),
    dx: z.number().optional(),
    waves: z
      .strictObject({ render: z.boolean(), density: z.number().min(0.1).max(4) })
      .register(meta, { gate: "render" }),
    contours: z
      .strictObject({ mode: z.enum(["off", "overlay"]), width: z.number().min(0).max(2) })
      .register(meta, { gate: "mode", label: "Contour lines" })
  }),
  box: z.strictObject({ attrs: z.strictObject({ fill: z.string().register(meta, { control: "color" }) }) }),
  groups: z.record(z.string(), z.strictObject({ attrs: z.strictObject({ opacity: z.number() }) }))
});

const value = () => ({
  attrs: { fill: "#123456", opacity: null, "stroke-dasharray": null, "stroke-linecap": "round" },
  options: {
    count: 3,
    circle: true,
    rescale: 0,
    dx: undefined,
    waves: { render: false, density: 1 },
    contours: { mode: "overlay", width: 0.5 }
  },
  box: { attrs: { fill: "#ffffff" } },
  groups: { a: { attrs: { opacity: 1 } } }
});

function mount(options: Partial<Parameters<typeof SchemaForm.render>[2]> = {}) {
  const onChange = vi.fn();
  const form = SchemaForm.render(schema, value(), { meta, onChange, ...options });
  document.body.append(form);
  return { form, onChange };
}

const field = (form: HTMLElement, path: string) => form.querySelector<HTMLElement>(`[data-field="${path}"]`)!;
const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

afterEach(() => document.body.replaceChildren());

describe("SchemaForm.render", () => {
  test("renders one row per leaf with the standard control for its kind", () => {
    const { form } = mount();
    expect(field(form, "attrs.fill").querySelector("input[type=color]")).not.toBeNull();
    expect(field(form, "attrs.fill").querySelector<HTMLInputElement>("input.hex")?.value).toBe("#123456");
    expect(field(form, "attrs.opacity").querySelector("slider-input")).not.toBeNull();
    expect(field(form, "attrs.opacity").dataset.tip).toBe("Opacity");
    expect(field(form, "attrs.stroke-dasharray").querySelector("input[type=text]")).not.toBeNull();
    expect(field(form, "attrs.stroke-linecap").querySelector("select")).not.toBeNull();
    expect(field(form, "options.count").querySelector("input[type=number]")).not.toBeNull();
    expect(field(form, "options.circle").querySelector("input[type=checkbox]")).not.toBeNull();
    expect(field(form, "options.circle").querySelector("label")?.textContent).toBe("Circle");
    expect(form.querySelector('[data-field="groups"]')).toBeNull(); // records are never walked
  });

  test("a typed hex writes and syncs the swatch, an invalid one reverts", () => {
    const { form, onChange } = mount();
    const swatch = field(form, "attrs.fill").querySelector<HTMLInputElement>("input[type=color]")!;
    const hex = field(form, "attrs.fill").querySelector<HTMLInputElement>("input.hex")!;
    hex.value = " #ABCDEF ";
    fire(hex, "change");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "fill"], "#abcdef");
    expect(swatch.value).toBe("#abcdef");
    expect(hex.value).toBe("#abcdef");

    onChange.mockClear();
    hex.value = "#abc"; // 3 digits is a colour: stored as typed, the swatch expands it
    fire(hex, "change");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "fill"], "#abc");
    expect(swatch.value).toBe("#aabbcc");
    expect(hex.value).toBe("#abc");

    onChange.mockClear();
    hex.value = "#abcde"; // 5 digits is not a colour
    fire(hex, "change");
    expect(onChange).not.toHaveBeenCalled();
    expect(hex.value).toBe("#abc");
  });

  test("the swatch keeps the alpha of a stored 8-digit color it cannot show", () => {
    const onChange = vi.fn();
    const record = value();
    record.attrs.fill = "#ff000080";
    const form = SchemaForm.render(schema, record, { meta, onChange });
    document.body.append(form);
    const swatch = field(form, "attrs.fill").querySelector<HTMLInputElement>("input[type=color]")!;
    expect(swatch.value).toBe("#ff0000");

    swatch.value = "#00ff00";
    fire(swatch, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "fill"], "#00ff0080");
  });

  test("attrs and options are flattened, other objects are subsections", () => {
    const { form } = mount();
    expect(form.querySelector('[data-section="attrs"]')).toBeNull();
    expect(form.querySelector('[data-section="options"]')).toBeNull();
    const box = form.querySelector<HTMLDetailsElement>('[data-section="box"]')!;
    expect(box.tagName).toBe("DETAILS");
    expect(box.querySelector("summary")?.textContent).toBe("Box");
    expect(box.querySelector("summary > .preview")).not.toBeNull(); // the slot the caller fills
    expect(box.querySelector('[data-field="box.attrs.fill"]')).not.toBeNull();
    expect(field(form, "attrs.fill").parentElement).toBe(form); // loose rows stay at the root
  });

  test("a root title gathers the loose rows in a section of their own, sections stay beside it", () => {
    const { form } = mount({ rootTitle: "Rivers" });
    const root = form.querySelector<HTMLDetailsElement>(':scope > details[data-section=""]')!;
    expect(root.querySelector("summary > .title")?.textContent).toBe("Rivers");
    expect(root.open).toBe(true);
    expect(field(form, "attrs.fill").closest("details")).toBe(root);
    expect(field(form, "options.count").closest("details")).toBe(root);
    expect(form.querySelector('[data-section="box"]')?.parentElement).toBe(form);
    expect(form.querySelector('[data-section="options.waves"]')?.parentElement).toBe(form);
    expect(root.querySelector("details")).toBeNull();
  });

  test("a custom flatten swaps which containers stay inline", () => {
    const { form } = mount({ flatten: key => key === "box" || key === "attrs" });
    expect(form.querySelector('[data-section="box"]')).toBeNull();
    expect(form.querySelector('[data-section="options"]')).not.toBeNull();
  });

  test("changes reach onChange with the path and the parsed value", () => {
    const { form, onChange } = mount();

    const color = field(form, "attrs.fill").querySelector<HTMLInputElement>("input[type=color]")!;
    color.value = "#abcdef";
    fire(color, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "fill"], "#abcdef");
    expect(field(form, "attrs.fill").querySelector<HTMLInputElement>("input.hex")?.value).toBe("#abcdef");

    const slider = field(form, "attrs.opacity").querySelector<HTMLElement & { value: string }>("slider-input")!;
    expect(slider.value).toBe("1"); // null shows as nullAs
    const range = slider.querySelector<HTMLInputElement>("input[type=range]")!;
    range.value = "0.4";
    fire(range, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "opacity"], 0.4);

    const select = field(form, "attrs.stroke-linecap").querySelector<HTMLSelectElement>("select")!;
    expect(select.value).toBe("round");
    select.value = "butt";
    fire(select, "change");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "stroke-linecap"], "butt");

    const number = field(form, "options.count").querySelector<HTMLInputElement>("input")!;
    number.value = "7";
    fire(number, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "count"], 7);

    const checkbox = field(form, "options.circle").querySelector<HTMLInputElement>("input")!;
    checkbox.checked = false;
    fire(checkbox, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "circle"], false);

    const numeric = field(form, "options.rescale").querySelector<HTMLInputElement>("input")!;
    numeric.checked = true;
    fire(numeric, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "rescale"], 1); // a checkbox over a 0/1 number

    const text = field(form, "attrs.stroke-dasharray").querySelector<HTMLInputElement>("input")!;
    text.value = " 5 2 ";
    fire(text, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "stroke-dasharray"], "5 2");
  });

  test("clearing a nullable field writes null, an optional one undefined, a required number nothing", () => {
    const { form, onChange } = mount();

    const text = field(form, "attrs.stroke-dasharray").querySelector<HTMLInputElement>("input")!;
    expect(text.value).toBe("");
    text.value = "";
    fire(text, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "stroke-dasharray"], null);

    const select = field(form, "attrs.stroke-linecap").querySelector<HTMLSelectElement>("select")!;
    expect(select.options[0].value).toBe("");
    select.value = "";
    fire(select, "change");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "stroke-linecap"], null);

    const dx = field(form, "options.dx").querySelector<HTMLInputElement>("input")!;
    dx.value = "";
    fire(dx, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "dx"], undefined);

    onChange.mockClear();
    const count = field(form, "options.count").querySelector<HTMLInputElement>("input")!;
    count.value = "";
    fire(count, "input");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a gate renders in the summary, folds the body, and is not repeated inside", () => {
    const { form, onChange } = mount();

    const waves = form.querySelector<HTMLDetailsElement>('[data-section="options.waves"]')!;
    const body = waves.querySelector<HTMLElement>(".body")!;
    const gate = waves.querySelector<HTMLInputElement>('summary [data-field="options.waves.render"] input')!;
    expect(gate.checked).toBe(false);
    expect(body.hidden).toBe(true);
    expect(body.querySelector('[data-field="options.waves.render"]')).toBeNull();
    expect(body.querySelector('[data-field="options.waves.density"]')).not.toBeNull();

    gate.checked = true;
    fire(gate, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "waves", "render"], true);
    expect(body.hidden).toBe(false);

    const contours = form.querySelector<HTMLDetailsElement>('[data-section="options.contours"]')!;
    expect(contours.querySelector("summary > span")?.textContent).toBe("Contour lines");
    const mode = contours.querySelector<HTMLSelectElement>("summary select")!;
    expect(contours.querySelector<HTMLElement>(".body")!.hidden).toBe(false);
    mode.value = "off";
    fire(mode, "change");
    expect(contours.querySelector<HTMLElement>(".body")!.hidden).toBe(true);
  });

  test("clicking the gate control does not toggle the details", async () => {
    const { form } = mount();
    const waves = form.querySelector<HTMLDetailsElement>('[data-section="options.waves"]')!;
    expect(waves.open).toBe(true);
    waves.querySelector<HTMLInputElement>("summary .checkbox-label")!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(waves.open).toBe(true);
    expect(waves.querySelector<HTMLInputElement>("summary input")!.checked).toBe(true);
  });
});

describe("SchemaForm layout metas", () => {
  const layoutMeta = z.registry<FieldMeta<string>>();
  const layout = z.strictObject({
    attrs: z.strictObject({
      stroke: z.string().register(layoutMeta, { control: "color", group: "Stroke", label: "Color" }),
      "stroke-width": z.number().min(0).max(10).register(layoutMeta, { group: "Stroke", label: "Width" }),
      opacity: z.number().min(0).max(1),
      fill: z.string().register(layoutMeta, { control: "color", group: "Fill", label: "Color" }),
      "font-size": z.string().register(layoutMeta, { control: "percent", range: [1, 40] }),
      "letter-spacing": z.number().register(layoutMeta, { range: [-10, 10] }),
      style: z.string().register(layoutMeta, { control: "labelStyle" })
    }),
    options: z.strictObject({
      x: z.string().register(layoutMeta, { control: "percent" }),
      size: z.string().register(layoutMeta, { control: "px" })
    })
  });
  const layoutValue = {
    attrs: {
      stroke: "#000000",
      "stroke-width": 1,
      opacity: 1,
      fill: "#ffffff",
      "font-size": "22%",
      "letter-spacing": 30,
      style: ""
    },
    options: { x: "5%", size: "8px" }
  };
  // a composite control: its rows stand in place of the field's row
  const labelStyle = (_spec: unknown, _value: unknown, set: (v: unknown) => void) => {
    const shadow = document.createElement("input");
    shadow.addEventListener("input", () => set(`text-shadow: ${shadow.value}`));
    const dx = document.createElement("input");
    dx.type = "number";
    return rows(row("Shadow", shadow), row("Shift x", dx));
  };
  const mountLayout = () => {
    const onChange = vi.fn();
    const form = SchemaForm.render(layout, layoutValue, { meta: layoutMeta, onChange, controls: { labelStyle } });
    document.body.append(form);
    return { form, onChange };
  };

  test("a run of grouped fields sits under a caption with short labels, a run of one too", () => {
    const { form } = mountLayout();
    const stroke = form.querySelector<HTMLElement>('.group[data-group="Stroke"]')!;
    expect(stroke.querySelector(".caption")?.textContent).toBe("Stroke");
    expect([...stroke.querySelectorAll(".row > label")].map(l => l.textContent)).toEqual(["Color", "Width"]);
    expect(field(form, "attrs.stroke").closest(".group")).toBe(stroke);
    expect(field(form, "attrs.opacity").closest(".group")).toBeNull();
    const fill = form.querySelector<HTMLElement>('.group[data-group="Fill"]')!;
    expect(fill.querySelector(".caption")?.textContent).toBe("Fill");
    expect(field(form, "attrs.fill").querySelector("label")?.textContent).toBe("Color");
  });

  test("a unit control is a slider with its unit when ranged, a number input beside its unit otherwise", () => {
    const { form, onChange } = mountLayout();
    const size = field(form, "attrs.font-size");
    expect(size.querySelector("slider-input")).not.toBeNull();
    expect(size.querySelector(".unit")?.textContent).toBe("%");
    const number = size.querySelector<HTMLInputElement>("input[type=number]")!;
    expect(number.value).toBe("22");
    number.value = "10";
    fire(number, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "font-size"], "10%");

    const x = field(form, "options.x");
    expect(x.querySelector("slider-input")).toBeNull();
    const input = x.querySelector<HTMLInputElement>("input[type=number]")!;
    expect(input.value).toBe("5");
    input.value = "7.5";
    fire(input, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "x"], "7.5%");

    const px = field(form, "options.size").querySelector<HTMLInputElement>("input[type=number]")!;
    px.value = "12";
    fire(px, "input");
    expect(onChange).toHaveBeenLastCalledWith(["options", "size"], "12px");
  });

  test("a slider stays wide enough for a stored value beyond its range", () => {
    const { form } = mountLayout();
    const spacing = field(form, "attrs.letter-spacing").querySelector<HTMLInputElement>("input[type=range]")!;
    expect([spacing.min, spacing.max]).toEqual(["-10", "30"]);
  });

  test("a composite control's rows stand in place of the field's row", () => {
    const { form, onChange } = mountLayout();
    const style = field(form, "attrs.style");
    expect(style.classList.contains("rows")).toBe(true);
    expect([...style.querySelectorAll(".row > label")].map(l => l.textContent)).toEqual(["Shadow", "Shift x"]);
    const shadow = style.querySelector<HTMLInputElement>("input")!;
    shadow.value = "white 0 0 4px";
    fire(shadow, "input");
    expect(onChange).toHaveBeenLastCalledWith(["attrs", "style"], "text-shadow: white 0 0 4px");
  });
});

describe("SchemaForm.fieldSpec", () => {
  test("derives the kind, range and step from the leaf", () => {
    const spec = (s: z.ZodType, key = "x") => SchemaForm.fieldSpec(key, s, meta);
    expect(spec(z.number().min(0).max(1))).toMatchObject({ kind: "slider", min: 0, max: 1, step: 0.01 });
    expect(spec(z.number().int().min(1).max(20))).toMatchObject({ kind: "slider", step: 1 });
    expect(spec(z.number().min(0).max(30))).toMatchObject({ kind: "slider", step: 0.1 });
    expect(spec(z.number())).toMatchObject({ kind: "number", min: undefined, max: undefined });
    expect(spec(z.number().register(meta, { range: [0, 5] }))).toMatchObject({ kind: "slider", min: 0, max: 5 });
    expect(spec(z.boolean())).toMatchObject({ kind: "checkbox", valueType: "boolean" });
    expect(spec(z.enum(["a", "b"]).nullable().default(null))).toMatchObject({
      kind: "select",
      options: ["a", "b"],
      nullable: true
    });
    expect(spec(z.string(), "stroke-width")).toMatchObject({ kind: "text", label: "Stroke width" });
    expect(spec(z.string().register(meta, { control: "font", label: "Font" }))).toMatchObject({
      kind: "font",
      label: "Font"
    });
    expect(
      spec(
        z
          .string()
          .transform(v => v)
          .register(meta, { control: "icon" })
      )
    ).toMatchObject({ kind: "icon" });
  });
});

describe("the groups rule", () => {
  const node = z.strictObject({
    attrs: z.strictObject({ opacity: z.number() }),
    groups: z.strictObject({
      left: z.strictObject({ attrs: z.strictObject({ x: z.number() }) }),
      right: z.strictObject({
        groups: z.strictObject({ deep: z.strictObject({ attrs: z.strictObject({ y: z.number() }) }) })
      })
    })
  });

  test("a groups node renders one card per entry, recursively, and never as a card of its own", () => {
    const record = {
      attrs: { opacity: 1 },
      groups: { left: { attrs: { x: 2 } }, right: { groups: { deep: { attrs: { y: 3 } } } } }
    };
    const form = SchemaForm.render(node, record, { meta, onChange: vi.fn() });
    document.body.append(form);
    expect(form.querySelector('[data-section="groups"]')).toBeNull();
    expect(form.querySelector('[data-field="attrs.opacity"]')).not.toBeNull();
    expect(form.querySelector('[data-field="groups.left.attrs.x"]')).not.toBeNull();
    expect(form.querySelector('[data-field="groups.right.groups.deep.attrs.y"]')).not.toBeNull();
  });

  test("a user record renders its entries from the value", () => {
    const record = z.strictObject({
      groups: z.record(z.string(), z.strictObject({ attrs: z.strictObject({ x: z.number() }) }))
    });
    const form = SchemaForm.render(record, { groups: { mine: { attrs: { x: 1 } } } }, { meta, onChange: vi.fn() });
    document.body.append(form);
    expect(form.querySelector('[data-section="groups.mine"]')).not.toBeNull();
    expect(form.querySelector('[data-field="groups.mine.attrs.x"]')).not.toBeNull();
  });
});

describe("SchemaForm.fieldAt", () => {
  test("resolves the schema a field path declares; an undeclared path has none", () => {
    expect(SchemaForm.fieldAt(schema, ["attrs", "fill"])).toBeDefined();
    expect(SchemaForm.fieldAt(schema, ["options", "waves", "density"])).toBeDefined();
    expect(SchemaForm.fieldAt(schema, ["box", "attrs", "fill"])).toBeDefined();
    expect(SchemaForm.fieldAt(schema, ["attrs", "missing"])).toBeUndefined();
    expect(SchemaForm.fieldAt(schema, ["options", "waves", "missing"])).toBeUndefined();
  });

  test("the resolved leaf is what a write is checked against", () => {
    const opacity = SchemaForm.fieldAt(schema, ["attrs", "opacity"])!;
    expect(opacity.safeParse(0.5).success).toBe(true);
    expect(opacity.safeParse(null).success).toBe(true);
    expect(opacity.safeParse(2).success).toBe(false);
    const density = SchemaForm.fieldAt(schema, ["options", "waves", "density"])!;
    expect(density.safeParse(1).success).toBe(true);
    expect(density.safeParse(9).success).toBe(false);
  });
});
