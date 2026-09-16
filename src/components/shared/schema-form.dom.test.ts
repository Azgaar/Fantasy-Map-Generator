// Browser-mode tests (vitest.browser.config.ts) for the form engine: each standard kind renders,
// a change reaches onChange(path, value), a gate folds its section, null round-trips, flatten holds
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import "./slider-input";
import { type FieldMeta, SchemaForm } from "./schema-form";

const meta = z.registry<FieldMeta>();

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
    hex.value = "#abc";
    fire(hex, "change");
    expect(onChange).not.toHaveBeenCalled();
    expect(hex.value).toBe("#abcdef");
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
