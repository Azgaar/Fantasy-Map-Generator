import { expect, test, vi } from "vitest";
import { parsePreset } from "@/controllers/style-preset";
import { Styles } from "@/generators/styles";

/** A preset in the v1.150-1.153 store layout: fixed children flat, the two burg records side by side */
function legacyStorePreset(): Record<string, any> {
  const old = structuredClone(Styles.defaults) as Record<string, any>;
  old.borders.stateBorders = old.borders.groups.stateBorders;
  old.borders.provinceBorders = old.borders.groups.provinceBorders;
  delete old.borders.groups;
  old.states.statesBody = old.states.groups.statesBody;
  old.states.statesHalo = old.states.groups.statesHalo;
  delete old.states.groups;

  const town = old.icons.groups.town;
  town.groups.icons.attrs.fill = "#123456";
  const custom = structuredClone(town);
  custom.groups.icons.attrs.fill = "#abcdef";
  old.burgIcons = {
    burgIcons: { groups: { town: town.groups.icons, custom: custom.groups.icons } },
    anchors: { groups: { town: town.groups.anchors, custom: custom.groups.anchors } }
  };
  delete old.icons;
  return old;
}

test("a store-format preset saved before v1.154.0 still parses after the fold and the rename", () => {
  const warn = vi.spyOn(console, "warn");

  const parsed = parsePreset(legacyStorePreset());

  expect(parsed?.icons.groups.custom.groups.icons.attrs.fill).toBe("#abcdef");
  expect(parsed?.icons.groups.town.groups.icons.attrs.fill).toBe("#123456");
  expect(parsed?.borders.groups.stateBorders).toBeDefined();
  expect(parsed?.states.groups.statesBody).toBeDefined();
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("parsing the bundled default preset leaves the shared defaults untouched", () => {
  const before = JSON.stringify(Styles.defaults);

  parsePreset(Styles.defaults);

  expect(JSON.stringify(Styles.defaults)).toBe(before);
});
