import { describe, expect, it } from "vitest";
import { formatPetitionText, getPetitionDef, PETITION_CATALOG, petitionsForAnchor } from "./living-petitions";

describe("living-petitions (Slice 4: Two-Choice Guild Dilemma Catalog)", () => {
  it("defines at least 12 distinct petitions with two choices each", () => {
    const defs = Object.values(PETITION_CATALOG);
    expect(defs.length).toBeGreaterThanOrEqual(12);

    for (const def of defs) {
      expect(PETITION_CATALOG[def.id]).toBe(def);
      expect(def.title).toBeTruthy();
      expect(def.text).toBeTruthy();
      expect(def.choices).toHaveLength(2);
      for (const choice of def.choices) {
        expect(choice.label).toBeTruthy();
        expect(choice.tooltip).toBeTruthy();
        expect(Number.isFinite(choice.gold)).toBe(true);
        expect(Number.isFinite(choice.renown)).toBe(true);
      }
    }

    expect(new Set(defs.map(def => def.id)).size).toBe(defs.length);
  });

  it("covers every crisis anchor kind with at least one petition", () => {
    expect(petitionsForAnchor("trouble").length).toBeGreaterThanOrEqual(3);
    expect(petitionsForAnchor("lair").length).toBeGreaterThanOrEqual(2);
    expect(petitionsForAnchor("unrest").length).toBeGreaterThanOrEqual(2);
    expect(petitionsForAnchor("state").length).toBeGreaterThanOrEqual(3);
    expect(petitionsForAnchor("cursedRelic").length).toBeGreaterThanOrEqual(1);
  });

  it("trades resources against world outcomes on both sides of every dilemma", () => {
    for (const def of Object.values(PETITION_CATALOG)) {
      const [loyal, selfish] = def.choices;
      expect(loyal.effects?.length ?? 0, `${def.id} loyal choice has an effect`).toBeGreaterThan(0);
      expect(selfish.gold > loyal.gold || selfish.renown > loyal.renown, `${def.id} selfish choice pays better`).toBe(
        true
      );
    }
  });

  it("retrieves definitions with fallback via getPetitionDef", () => {
    expect(getPetitionDef("desperate_siege")?.anchor).toBe("lair");
    expect(getPetitionDef("no_such_petition")).toBeUndefined();
    expect(getPetitionDef(undefined)).toBeUndefined();
  });

  it("fills petition text tokens with context and falls back gracefully", () => {
    const text = formatPetitionText("{burg} begs {state} for aid against {lair}", {
      burg: "Aelor",
      state: "Aeloria"
    });
    expect(text).toBe("Aelor begs Aeloria for aid against the raiders");

    expect(formatPetitionText("The {relic} whispers", {})).toBe("The a nameless relic whispers");
    expect(formatPetitionText("No tokens here", {})).toBe("No tokens here");
  });
});
