import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  WorkspaceColorField,
  WorkspaceNumberField,
  WorkspaceRangeField,
  WorkspaceSelectField,
  WorkspaceTextField,
  WorkspaceToggleField
} from "./form-field";

describe("workspace form fields", () => {
  test("associates text fields with descriptions and validation errors", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceTextField
        description="Shown on the map"
        error="A name is required"
        id="mapName"
        label="Map name"
        readOnly
        required
        value=""
      />
    );

    expect(markup.includes('for="mapName"')).toBe(true);
    expect(markup.includes('id="mapName"')).toBe(true);
    expect(markup.includes('aria-describedby="mapName-description mapName-error"')).toBe(true);
    expect(markup.includes('aria-invalid="true"')).toBe(true);
  });

  test("renders number and select constraints", () => {
    const numberMarkup = renderToStaticMarkup(
      <WorkspaceNumberField id="density" label="Density" max={10} min={1} readOnly value={5} />
    );
    const selectMarkup = renderToStaticMarkup(
      <WorkspaceSelectField
        id="preset"
        label="Preset"
        onChange={() => {}}
        options={[
          { label: "Political", value: "political" },
          { disabled: true, label: "Unavailable", value: "disabled" }
        ]}
        value="political"
      />
    );

    expect(numberMarkup.includes('type="number"')).toBe(true);
    expect(numberMarkup.includes('min="1"')).toBe(true);
    expect(numberMarkup.includes('max="10"')).toBe(true);
    expect(selectMarkup.includes('<option value="political" selected="">Political</option>')).toBe(true);
    expect(selectMarkup.includes('<option disabled="" value="disabled">Unavailable</option>')).toBe(true);
  });

  test("renders range, color, and toggle values accessibly", () => {
    const rangeMarkup = renderToStaticMarkup(
      <WorkspaceRangeField
        formatValue={value => `${value}%`}
        id="opacity"
        label="Opacity"
        max={100}
        min={0}
        onChange={() => {}}
        value={75}
      />
    );
    const colorMarkup = renderToStaticMarkup(
      <WorkspaceColorField id="fill" label="Fill" onChange={() => {}} value="#abcdef" />
    );
    const toggleMarkup = renderToStaticMarkup(
      <WorkspaceToggleField checked label="Show labels" onChange={() => {}} />
    );

    expect(rangeMarkup.includes('type="range"')).toBe(true);
    expect(rangeMarkup.includes('for="opacity">75%</output>')).toBe(true);
    expect(colorMarkup.includes('type="color"')).toBe(true);
    expect(colorMarkup.includes('#ABCDEF</output>')).toBe(true);
    expect(toggleMarkup.includes('role="switch"')).toBe(true);
    expect(toggleMarkup.includes('checked=""')).toBe(true);
  });
});
