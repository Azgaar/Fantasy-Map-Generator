// @vitest-environment jsdom
import { expect, it } from "vitest";
import { Styles } from "@/generators/styles";
import { styleFields, styleOverview } from "./style-reference";

it("lists the elements, choices and how to read an element's fields", () => {
  document.body.innerHTML = `<svg><defs><g id="filters"><filter id="filter-sepia" name="Sepia"></filter></g></defs></svg>`;
  globalThis.fonts = [{ family: "Almendra SC" }];
  const overview = styleOverview();
  expect(overview).toContain("ocean (Ocean)");
  expect(overview).toContain("url(#filter-sepia) Sepia");
  expect(overview).toContain("Fonts: Almendra SC.");
  expect(overview).toContain("antique-big.jpg");
  expect(overview).toContain('"Styles: ocean, landmass, labels"');
});

it("lists an element's paths with their types and current values, user groups by name", () => {
  Styles.set(Styles.parse(Styles.defaults));
  const ocean = styleFields(["ocean"]);
  expect(ocean).toContain(
    `- ocean.groups.base.attrs.fill: "#rrggbb" | null = "${styles.ocean.groups.base.attrs.fill}"`
  );
  expect(ocean).toMatch(/- ocean\.options\.bands\.count: number 1–8 = \d/);
  const labels = styleFields(["labels"]);
  expect(labels).toContain(`<group> is one of this map's groups: ${Object.keys(styles.labels.groups).join(", ")};`);
  expect(labels).toContain("- labels.groups.<group>.attrs.font-family: a family from Fonts");
  expect(styleFields(["sea"])).toMatch(/^No style elements sea\. Elements: /);
});
