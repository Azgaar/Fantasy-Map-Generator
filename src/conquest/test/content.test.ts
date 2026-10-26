/**
 * Content pipeline tests (total-war/.plans/PLAN.md Phase 2 acceptance):
 *  - the shipped ruleset validates clean and resolves for all 16 states
 *  - base → culture → faction inheritance (rosters, includes, victory sets, traits)
 *  - human-readable validation errors with did-you-mean suggestions
 *  - buildings: construction flow, chain prereqs, walls effect on assaults
 *  - tech: prereqs + income effect visible in the economy tick
 *  - recruitment: rosters, caps, unlock gating
 *  - victory sets: per-faction resolution + objective evaluation
 *  - content hash stability (§6 principle 3)
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

import { currentContent } from "@/conquest/content/store";
import {
  didYouMean,
  inferRosterForCulture,
  MATCHUP,
  MEN_PER_BLOCK,
  type RawContentDocs,
  resolveForPack,
  validateAndResolve
} from "@/conquest/engine/common/content";
import type { MapPack } from "@/conquest/engine/common/types";
import { compileAzgaar } from "@/conquest/engine/compiler/index";
import { applyCommand, type EngineCtx } from "@/conquest/engine/game/commands";
import { DEFAULT_CONFIG } from "@/conquest/engine/game/config";
import { createCampaign } from "@/conquest/engine/game/state";
import { evaluateVictory } from "@/conquest/engine/game/victory";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const pack: MapPack = compileAzgaar(raw).pack;
const config = DEFAULT_CONFIG;

/**
 * Content docs are JSON since Phase D, so the fixtures are plain objects. This
 * helper exists only to keep the fixture tables readable: it accepts a doc
 * already written in object form.
 */
const y = (doc: unknown): unknown => doc;

/** Build a minimal valid RawContentDocs for string-based tests. */
function docs(overrides: Partial<RawContentDocs> = {}): RawContentDocs {
  const baseRoster = y({
    roster: {
      id: "commonBase",
      units: {
        sword: {
          name: "Swordsmen",
          category: "melee",
          blocks: 0.15,
          attack: 8,
          defense: 11,
          charge: 4,
          missile: 0,
          cost: 300,
          upkeep: 40
        },
        spear: {
          name: "Spearmen",
          category: "melee",
          blocks: 0.15,
          attack: 5,
          defense: 13,
          charge: 3,
          missile: 0,
          cost: 250,
          upkeep: 35
        },
        archers: {
          name: "Archers",
          category: "ranged",
          blocks: 0.12,
          attack: 3,
          defense: 5,
          charge: 1,
          missile: 11,
          cost: 350,
          upkeep: 45
        },
        levy_spear: {
          name: "Levy Spearmen",
          category: "melee",
          blocks: 0.15,
          attack: 3,
          defense: 9,
          charge: 2,
          missile: 0,
          cost: 100,
          upkeep: 15
        },
        levy_archers: {
          name: "Levy Archers",
          category: "ranged",
          blocks: 0.12,
          attack: 2,
          defense: 4,
          charge: 1,
          missile: 8,
          cost: 120,
          upkeep: 18
        }
      },
      garrison: { melee: "levy_spear", ranged: "levy_archers" },
      regimentMap: { infantry: "spear", archers: "archers", cavalry: "sword", artillery: "sword" }
    }
  });
  return {
    rosterDocs: overrides.rosterDocs ?? [{ file: "rosters/base.json", doc: baseRoster }],
    culturesDocs: overrides.culturesDocs ?? [],
    factionDocs: overrides.factionDocs ?? [],
    buildingsDocs: overrides.buildingsDocs ?? [],
    techDocs: overrides.techDocs ?? [],
    victoryDocs: overrides.victoryDocs ?? [
      {
        file: "victory/standard.json",
        doc: y({ victory: [{ id: "standardShort", objectives: [{ type: "controlRegions", fraction: 0.35 }] }] })
      }
    ],
    eventsDocs: overrides.eventsDocs ?? [],
    meta: overrides.meta ?? { defaultRoster: "commonBase", defaultVictory: "standardShort" }
  };
}

describe("the shipped ruleset (total-war/content/docs)", () => {
  const loaded = currentContent();
  const content = loaded.content;
  const resolved = resolveForPack(pack, content);

  test("a unit's men are derived from its AER blocks (Phase 4b)", () => {
    // The authored primitive is `units` — how many AER blocks a full-strength
    // unit *is*. Everything downstream reads `men`, so the two must never
    // disagree, whatever the roster or state patch did to them.
    expect(MEN_PER_BLOCK).toBe(1000);
    for (const [id, u] of Object.entries(content.unitTypes)) {
      expect(u.blocks, id).toBeGreaterThanOrEqual(1 / MEN_PER_BLOCK);
      expect(u.men, id).toBeCloseTo(u.blocks * MEN_PER_BLOCK, 9);
    }
    // The shipped roster still describes the same lines it always did — the
    // conversion renames the unit of measure, not the army.
    expect(content.unitTypes.sword!.blocks).toBeCloseTo(0.15, 9);
    expect(content.unitTypes.sword!.men).toBe(150);
    expect(content.unitTypes.artillery!.men).toBe(40);
    // Same identity holds for a unit a state patched over its base roster.
    const patched = resolveForPack(
      pack,
      validateAndResolve({
        ...loaded.docs,
        factionDocs: [
          {
            file: "states.json",
            doc: y({
              factions: [
                {
                  bind: { stateId: 14 },
                  rosterId: "steppeBase",
                  roster: { units: { sword: { blocks: 0.3, cost: 5 } } }
                }
              ]
            })
          }
        ]
      }).content!
    ).factions["14"]!.roster.units.sword!;
    expect(patched.blocks).toBeCloseTo(0.3, 9);
    expect(patched.men).toBe(300); // re-derived, not left at the base roster's 150
  });

  test("validates clean: zero errors, zero warnings", () => {
    expect(loaded.warnings).toEqual([]);
  });

  test("expected inventory: 32 rosters, and nothing state-specific", () => {
    expect(Object.keys(content.rosters).sort()).toEqual(
      [
        "arachnidBase",
        "beastfolkBase",
        "celestialBase",
        "chaosBase",
        "chivalricBase",
        "commonBase",
        "constructBase",
        "darkElfBase",
        "demonBase",
        "dragonbornBase",
        "dwarfBase",
        "eastAsiaBase",
        "eldritchBase",
        "elementalBase",
        "elfBase",
        "empireBase",
        "feyBase",
        "halflingBase",
        "infernalDwarfBase",
        "lizardmenBase",
        "merfolkBase",
        "mughalBase",
        "ogreBase",
        "orcBase",
        "ottomanBase",
        "renaissanceBase",
        "skavenBase",
        "steppeBase",
        "tombKingsBase",
        "tribalBase",
        "vampireBase",
        "woodElfBase"
      ].sort()
    );
    // Faction defs and culture groups are per-map now: states resolve from the
    // active world, groups live in the browser's config. The shipped pack is
    // only the common vocabulary.
    expect(content.factions).toHaveLength(0);
    expect(content.cultures).toHaveLength(0);
    expect(content.buildings.length).toBeGreaterThanOrEqual(8);
    expect(content.tech).toHaveLength(4);
    expect(Object.keys(content.victory).sort()).toEqual(["standardLong", "standardShort", "warlordLong"]);
  });

  test("every one of the 16 states resolves to a roster with recruitable units", () => {
    expect(Object.keys(resolved.factions)).toHaveLength(16);
    for (const rf of Object.values(resolved.factions)) {
      expect(rf.roster.recruitable.length, `state ${rf.stateId} roster ${rf.rosterId}`).toBeGreaterThan(0);
      expect(content.rosters[rf.rosterId]).toBeDefined();
      expect(content.unitTypes[rf.roster.garrison.melee]).toBeDefined();
    }
  });

  test("race inference lands on the right states without any bindings", () => {
    // The "(Race)" suffix drives inference: Dark Elfish, Elfish, Orkish, Arachnid, Dwarven map
    // to their specific rosters, Human falls through to the default.
    expect(resolved.factions["1"]!.rosterId).toBe("darkElfBase"); // Trow (Dark Elfish)
    expect(resolved.factions["6"]!.rosterId).toBe("elfBase"); // Eldar (Elfish)
    expect(resolved.factions["14"]!.rosterId).toBe("orcBase"); // Ugluk (Orkish)
    expect(resolved.factions["15"]!.rosterId).toBe("orcBase"); // Uruk (Orkish)
    expect(resolved.factions["10"]!.rosterId).toBe("arachnidBase"); // Arago (Arachnid)
    expect(resolved.factions["8"]!.rosterId).toBe("dwarfBase"); // Khazadur (Dwarven)
    expect(resolved.factions["2"]!.rosterId).toBe("commonBase"); // Dulandir (Human)
    expect(resolved.factions["7"]!.rosterId).toBe("commonBase"); // Anor (Human)
  });

  test("steppe extends + overrides: inherited sword, overridden cavalry, merged caps", () => {
    const steppe = content.rosters.steppeBase!;
    expect(steppe.units.sword).toBeDefined(); // inherited from commonBase
    expect(steppe.units.cavalry!.name).toBe("Steppe Horse Archers"); // overridden
    expect(steppe.units.cavalry!.missile).toBe(4);
    expect(steppe.caps.artillery).toBe(2); // overridden
    expect(steppe.caps.sword).toBe(8); // inherited
  });

  test("Old World fantasy rosters: complete archetype coverage with monsters, casters, and powers", () => {
    const oldWorldRosters = [
      "dwarfBase",
      "elfBase",
      "orcBase",
      "empireBase",
      "chivalricBase",
      "woodElfBase",
      "tombKingsBase",
      "vampireBase",
      "chaosBase",
      "darkElfBase",
      "skavenBase",
      "lizardmenBase",
      "infernalDwarfBase",
      "ogreBase",
      "demonBase",
      "beastfolkBase",
      "halflingBase",
      "feyBase",
      "dragonbornBase",
      "celestialBase",
      "merfolkBase",
      "elementalBase",
      "constructBase",
      "eldritchBase",
      "tribalBase",
      "arachnidBase"
    ];

    for (const rId of oldWorldRosters) {
      const roster = content.rosters[rId];
      expect(roster, `roster ${rId} should exist`).toBeDefined();
      expect(roster!.recruitable.length, `${rId} should have recruitable units`).toBeGreaterThanOrEqual(8);
      expect(roster!.garrison.melee, `${rId} garrison melee`).toBeDefined();
      expect(roster!.garrison.ranged, `${rId} garrison ranged`).toBeDefined();
      expect(roster!.regimentMap.infantry, `${rId} regiment infantry`).toBeDefined();
      expect(roster!.regimentMap.archers, `${rId} regiment archers`).toBeDefined();
      expect(roster!.regimentMap.cavalry, `${rId} regiment cavalry`).toBeDefined();
      expect(roster!.regimentMap.artillery, `${rId} regiment artillery`).toBeDefined();

      // Check unit types in content.unitTypes
      for (const u of Object.values(roster!.units)) {
        expect(u.blocks, `${u.id} blocks must be positive`).toBeGreaterThan(0);
        expect(u.men, `${u.id} men must derive from blocks`).toBe(Math.round(u.blocks * 1000));
        if (u.powers) {
          if (u.powers.ward !== undefined) expect(u.powers.ward).toBeGreaterThan(0);
          if (u.powers.hex !== undefined) expect(u.powers.hex).toBeGreaterThan(0);
          if (u.powers.heal !== undefined) expect(u.powers.heal).toBeGreaterThan(0);
          if (u.powers.terror !== undefined) expect(u.powers.terror).toBeGreaterThan(0);
          if (u.powers.arcaneSiege !== undefined) expect(u.powers.arcaneSiege).toBeGreaterThanOrEqual(1);
        }
        if (u.resistArcane !== undefined) {
          expect(u.resistArcane).toBeGreaterThan(0);
          expect(u.resistArcane).toBeLessThanOrEqual(1);
        }
      }
    }

    // Specific faction archetype checks
    const dwarf = content.rosters.dwarfBase!;
    expect(dwarf.units.runesmith_anvil?.category).toBe("spellcaster");
    expect(dwarf.units.runesmith_anvil?.resistArcane).toBe(0.35);

    const elf = content.rosters.elfBase!;
    expect(elf.units.star_dragon?.category).toBe("monster");
    expect(elf.units.high_archmage?.category).toBe("spellcaster");
    expect(elf.units.high_archmage?.powers?.heal).toBe(8);

    const skaven = content.rosters.skavenBase!;
    expect(skaven.units.pit_abomination?.category).toBe("monster");
    expect(skaven.units.pit_abomination?.powers?.heal).toBe(10);
    expect(skaven.units.grey_seers?.category).toBe("spellcaster");

    const lizardmen = content.rosters.lizardmenBase!;
    expect(lizardmen.units.slann_star_priest?.powers?.arcaneSiege).toBe(2);
    expect(lizardmen.units.slann_star_priest?.resistArcane).toBe(0.3);

    const empire = content.rosters.empireBase!;
    expect(empire.units.demigryph_knights?.category).toBe("monster");
    expect(empire.units.collegiate_wizards?.category).toBe("spellcaster");
    expect(empire.units.steam_behemoth?.category).toBe("monster");

    const arachnid = content.rosters.arachnidBase!;
    expect(arachnid.units.brood_mother?.category).toBe("monster");
    expect(arachnid.units.silk_weavers?.category).toBe("spellcaster");
    expect(arachnid.units.brood_mother?.powers?.heal).toBe(10);
  });

  test("Old World culture name inference maps to appropriate base rosters", () => {
    const testCases: [string, string][] = [
      ["Schwarzen", "empireBase"],
      ["Luarian", "chivalricBase"],
      ["Quenian (Elfish)", "elfBase"],
      ["Dunirr (Dwarven)", "dwarfBase"],
      ["Khazadur (Dwarven)", "dwarfBase"],
      ["Aj'Snaga (Serpents)", "lizardmenBase"],
      ["Trow (Dark Elfish)", "darkElfBase"],
      ["Arago (Arachnid)", "arachnidBase"],
      ["Rakhnid", "arachnidBase"],
      ["Skaven (Ratmen)", "skavenBase"],
      ["Ugluk (Orkish)", "orcBase"],
      ["Sylvan Weald", "woodElfBase"],
      ["Khemri Dynasties", "tombKingsBase"],
      ["Sylvania Barrow", "vampireBase"],
      ["Chaos Wastes", "chaosBase"],
      ["Zharr Forge", "infernalDwarfBase"]
    ];

    for (const [cultureName, expectedRoster] of testCases) {
      const rosterId = inferRosterForCulture(cultureName, content.rosters, "commonBase");
      expect(rosterId, `culture '${cultureName}' should resolve to '${expectedRoster}'`).toBe(expectedRoster);
    }
  });

  test("RPG Fantasy cultures resolve to dedicated force rosters with zero fallbacks", () => {
    const rpgCultures: [string, string][] = [
      ["Quenar (High Elf)", "elfBase"],
      ["Sylvan (Wood Elf)", "woodElfBase"],
      ["Drow (Dark Elf)", "darkElfBase"],
      ["Aelvar (Sea Elf)", "merfolkBase"],
      ["Khazad (Mountain Dwarf)", "dwarfBase"],
      ["Hearthdwarf (Hill Dwarf)", "dwarfBase"],
      ["Duergar (Deep Dwarf)", "infernalDwarfBase"],
      ["Halfling (Hobbit)", "halflingBase"],
      ["Gnome (Tinker)", "halflingBase"],
      ["Orc", "orcBase"],
      ["Goblin", "orcBase"],
      ["Hobgoblin (Legion)", "orcBase"],
      ["Skaven (Ratmen)", "skavenBase"],
      ["Troll", "ogreBase"],
      ["Ogre", "ogreBase"],
      ["Dragonborn", "dragonbornBase"],
      ["Kobold", "orcBase"],
      ["Lizardfolk", "lizardmenBase"],
      ["Lionkin (Catfolk)", "beastfolkBase"],
      ["Wolfkin (Werefolk)", "beastfolkBase"],
      ["Aarakocra (Birdfolk)", "beastfolkBase"],
      ["Minotaur (Bullkin)", "beastfolkBase"],
      ["Fey (Fair Folk)", "feyBase"],
      ["Sidhe (Lake Fey)", "feyBase"],
      ["Genasi (Elemental)", "elementalBase"],
      ["Tiefling (Fiendblood)", "demonBase"],
      ["Demon (Fiend)", "demonBase"],
      ["Vampire (Nightblood)", "vampireBase"],
      ["Lich (Necromancer)", "tombKingsBase"],
      ["Aasimar (Celestial)", "celestialBase"],
      ["Chosen (Oracle)", "celestialBase"],
      ["Warforged (Construct)", "constructBase"],
      ["Aboleth (Eldritch)", "eldritchBase"],
      ["Mindflayer (Eldritch)", "eldritchBase"],
      ["Imperial (Human)", "empireBase"],
      ["Feudal (Human)", "chivalricBase"],
      ["Nordlander (Human)", "chaosBase"],
      ["Steppe Rider (Human)", "steppeBase"],
      ["Desert Nomad (Human)", "ottomanBase"],
      ["Islander (Human)", "tribalBase"],
      ["Jungle Tribe (Human)", "tribalBase"],
      ["Tundra Tribe (Human)", "tribalBase"],
      ["Eastern Empire (Human)", "eastAsiaBase"],
      ["Southern Kingdom (Human)", "mughalBase"]
    ];

    expect(rpgCultures).toHaveLength(44);
    for (const [cultureName, expectedRoster] of rpgCultures) {
      const rosterId = inferRosterForCulture(cultureName, content.rosters, "commonBase");
      expect(rosterId, `rpg culture '${cultureName}' should resolve to '${expectedRoster}'`).toBe(expectedRoster);
    }
  });

  test("a per-state def — what the state editor writes — drives everything", () => {
    // The per-state dialogs write defs bound by stateId into the map's rules.
    // This is exactly that shape: roster assignment, stat patch, mechanics,
    // traits and a victory set for one state; every other state untouched.
    const withDefs: RawContentDocs = {
      ...loaded.docs,
      factionDocs: [
        {
          file: "states.json",
          doc: y({
            factions: [
              {
                bind: { stateId: 14 },
                rosterId: "steppeBase",
                victory: "warlordLong",
                traits: ["warmongers"],
                mechanics: { confederation: "never" },
                roster: { units: { sword: { cost: 5, name: "Ash Blade" } } }
              },
              { bind: { stateId: 1 }, traits: ["riverRiders"] }
            ]
          })
        }
      ]
    };
    const defined = validateAndResolve(withDefs).content!;
    const r = resolveForPack(pack, defined);
    const ash = r.factions["14"]!;
    expect(ash.victorySetId).toBe("warlordLong");
    expect(ash.traits).toContain("warmongers");
    expect(ash.mechanics.confederation).toBe("never");
    // rosterId assigns the group outright — beats race inference (Orkish).
    expect(ash.rosterId).toBe("steppeBase");
    // The stat patch merges over the group's unit; the name rides along.
    expect(ash.roster.units.sword).toMatchObject({ cost: 5, name: "Ash Blade" });
    // A state with no def keeps every default.
    expect(r.factions["12"]!.victorySetId).toBe("standardShort");
    expect(r.factions["12"]!.mechanics.confederation).toBe("cultureGroup");
    // …and its units are untouched by the other state's patch.
    expect(r.factions["1"]!.roster.units.dreadspears).toMatchObject({ name: "Dread-Spire Spearmen" });
    // A def with only traits leaves the roster alone.
    expect(r.factions["1"]!.traits).toContain("riverRiders");
    expect(r.factions["1"]!.rosterId).toBe("darkElfBase");
  });

  test("content hash is stable across loads", () => {
    const again = currentContent();
    expect(again.content.hash).toBe(content.hash);
    expect(content.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("validation with human errors (§6 principle 4)", () => {
  test("unknown unit reference suggests the closest name", () => {
    const bad = docs({
      rosterDocs: [
        { file: "rosters/base.json", doc: docs().rosterDocs[0]!.doc },
        {
          file: "rosters/bad.json",
          // "swrod" is a typo for "sword" — the did-you-mean hint must fire.
          doc: y({
            roster: {
              id: "bad",
              units: {
                spear: {
                  name: "S",
                  category: "melee",
                  blocks: 0.15,
                  attack: 1,
                  defense: 1,
                  charge: 1,
                  missile: 0,
                  cost: 1,
                  upkeep: 1
                }
              },
              recruitable: ["swrod"]
            }
          })
        }
      ]
    });
    const { content, errors } = validateAndResolve(bad);
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("'swrod'") && e.includes("did you mean 'sword'"))).toBe(true);
  });

  test("missing category fails loudly with the allowed list", () => {
    const bad = docs({
      rosterDocs: [
        {
          file: "rosters/base.json",
          doc: y({
            roster: {
              id: "commonBase",
              // "ghost" declares no category: the validator must complain, not guess.
              units: {
                ghost: { name: "Ghost", blocks: 0.1, attack: 1, defense: 1, charge: 1, missile: 0, cost: 1, upkeep: 1 }
              }
            }
          })
        }
      ]
    });
    const { content, errors } = validateAndResolve(bad);
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("category") && e.includes("melee"))).toBe(true);
  });

  test("extends cycle is detected", () => {
    const a = y({ roster: { id: "a", extends: "b", units: {} } });
    const b = y({ roster: { id: "b", extends: "a", units: {} } });
    const { content, errors } = validateAndResolve(
      docs({
        rosterDocs: [
          { file: "rosters/base.json", doc: docs().rosterDocs[0]!.doc },
          { file: "rosters/a.yaml", doc: a },
          { file: "rosters/b.yaml", doc: b }
        ]
      })
    );
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("cycle"))).toBe(true);
  });

  test("building chain prereq from another chain is an error", () => {
    const bad = docs({
      buildingsDocs: [
        {
          file: "buildings.json",
          doc: y({
            buildings: [
              {
                id: "farm1",
                name: "Farm",
                chain: "growth",
                tier: 1,
                settlementKinds: ["major"],
                cost: 100,
                effects: {}
              },
              {
                id: "wallsX",
                name: "Walls",
                chain: "defense",
                tier: 1,
                settlementKinds: ["major"],
                cost: 100,
                requires: "farm1",
                effects: {}
              }
            ]
          })
        }
      ]
    });
    const { errors } = validateAndResolve(bad);
    expect(errors.some(e => e.includes("different chain"))).toBe(true);
  });

  test("faction bound to unknown victory set suggests alternatives", () => {
    const bad = docs({
      factionDocs: [
        {
          file: "factions/x.json",
          // "standardShot" does not exist — the validator must say so.
          doc: y({ faction: { bind: { stateName: "Balben" }, victory: "standardShot" } })
        }
      ]
    });
    const { content, errors } = validateAndResolve(bad);
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("standardShot") && e.includes("did you mean 'standardShort'"))).toBe(true);
  });

  test("didYouMean works standalone", () => {
    expect(didYouMean("swrod", ["sword", "spear"])).toContain("sword");
    expect(didYouMean("zzzzzz", ["sword", "spear"])).not.toContain("did you mean");
  });

  test("authoring 'men' is refused with the conversion written out", () => {
    // Phase 4b made `units` the primitive. Quietly ignoring `men: 150` would
    // leave the unit to the field's absence, and the load that unit carries
    // would change behind a warning nobody reads — so the message states the
    // conversion arithmetic and nothing else.
    const bad = docs({
      rosterDocs: [
        {
          file: "rosters/base.json",
          doc: y({
            roster: {
              id: "commonBase",
              units: {
                sword: {
                  name: "Swordsmen",
                  category: "melee",
                  men: 150,
                  attack: 1,
                  defense: 1,
                  charge: 1,
                  missile: 0,
                  cost: 1,
                  upkeep: 1
                }
              }
            }
          })
        }
      ]
    });
    const { content, errors, warnings } = validateAndResolve(bad);
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("'men' was retired") && e.includes("blocks: 0.15"))).toBe(true);
    // Reported once, as an error — not also buried as an unknown-key warning.
    expect(warnings.some(w => w.includes("unknown key 'men'"))).toBe(false);
  });

  describe("magic: spellcaster / monster categories, powers, resistArcane", () => {
    const unit = (extra: Record<string, unknown>): Record<string, unknown> => ({
      name: "Mage",
      category: "spellcaster",
      blocks: 0.02,
      attack: 3,
      defense: 4,
      charge: 0,
      missile: 15,
      cost: 500,
      upkeep: 50,
      ...extra
    });
    const withUnit = (extra: Record<string, unknown>) =>
      validateAndResolve(
        docs({
          rosterDocs: [
            {
              file: "rosters/base.json",
              doc: y({
                roster: {
                  id: "commonBase",
                  units: {
                    mage: unit(extra),
                    spear: { ...unit({}), name: "Spear", category: "melee", blocks: 0.15 },
                    archers: { ...unit({}), name: "Archers", category: "ranged", blocks: 0.12 }
                  },
                  garrison: { melee: "spear", ranged: "archers" },
                  regimentMap: { infantry: "spear", archers: "archers", cavalry: "spear", artillery: "spear" }
                }
              })
            }
          ]
        })
      );

    test("monster and spellcaster categories validate, with powers and resistArcane carried through", () => {
      const { content, errors } = withUnit({
        powers: { ward: 0.1, hex: 0.08, heal: 6, terror: 0.05, arcaneSiege: 1 },
        resistArcane: 0.2
      });
      expect(errors).toEqual([]);
      const mage = content!.unitTypes.mage!;
      expect(mage.category).toBe("spellcaster");
      expect(mage.men).toBeCloseTo(20);
      expect(mage.powers).toEqual({ ward: 0.1, hex: 0.08, heal: 6, terror: 0.05, arcaneSiege: 1 });
      expect(mage.resistArcane).toBe(0.2);
    });

    test("powers are optional and absent powers stay absent", () => {
      const { content, errors } = withUnit({});
      expect(errors).toEqual([]);
      expect(content!.unitTypes.mage!.powers).toBeUndefined();
      expect(content!.unitTypes.mage!.resistArcane).toBeUndefined();
    });

    test("fractional powers and resistArcane above 1 are refused", () => {
      expect(withUnit({ powers: { ward: 1.5 } }).errors.some(e => e.includes("'ward' must be between 0 and 1"))).toBe(
        true
      );
      expect(withUnit({ powers: { hex: 1.2 } }).errors.some(e => e.includes("'hex' must be between 0 and 1"))).toBe(
        true
      );
      expect(
        withUnit({ powers: { terror: 1.1 } }).errors.some(e => e.includes("'terror' must be between 0 and 1"))
      ).toBe(true);
      expect(withUnit({ resistArcane: 2 }).errors.some(e => e.includes("'resistArcane' must be between 0 and 1"))).toBe(
        true
      );
    });

    test("negative powers, non-object powers and unknown power keys are flagged", () => {
      expect(withUnit({ powers: { heal: -1 } }).errors.some(e => e.includes("'heal' must be a number ≥ 0"))).toBe(true);
      expect(
        withUnit({ powers: { arcaneSiege: -2 } }).errors.some(e => e.includes("'arcaneSiege' must be a number ≥ 0"))
      ).toBe(true);
      expect(withUnit({ powers: { ward: -0.1 } }).errors.some(e => e.includes("'ward' must be a number ≥ 0"))).toBe(
        true
      );
      expect(withUnit({ resistArcane: -0.1 }).errors.some(e => e.includes("'resistArcane' must be a number ≥ 0"))).toBe(
        true
      );
      expect(withUnit({ powers: "ward" }).errors.some(e => e.includes("'powers' must be an object"))).toBe(true);
      const { warnings } = withUnit({ powers: { fireball: 3 } });
      expect(warnings.some(w => w.includes("unknown key 'fireball'"))).toBe(true);
    });

    test("monster category validates correctly with powers", () => {
      const { content, errors } = withUnit({
        name: "War Hydra",
        category: "monster",
        blocks: 0.05,
        powers: { terror: 0.1, heal: 20 }
      });
      expect(errors).toEqual([]);
      const hydra = content!.unitTypes.mage!;
      expect(hydra.category).toBe("monster");
      expect(hydra.men).toBe(50);
      expect(hydra.powers).toEqual({ terror: 0.1, heal: 20 });
    });

    test("MATCHUP is a complete 6x6 matrix matching the specification", () => {
      const cats = Object.keys(MATCHUP);
      expect(cats.sort()).toEqual(["artillery", "cavalry", "melee", "monster", "ranged", "spellcaster"]);
      expect(MATCHUP).toEqual({
        melee: { melee: 1.0, ranged: 1.1, cavalry: 0.8, artillery: 1.2, monster: 0.8, spellcaster: 1.4 },
        ranged: { melee: 1.1, ranged: 1.0, cavalry: 0.7, artillery: 1.0, monster: 1.25, spellcaster: 1.2 },
        cavalry: { melee: 0.9, ranged: 1.3, cavalry: 1.0, artillery: 1.4, monster: 0.85, spellcaster: 1.5 },
        artillery: { melee: 1.2, ranged: 1.1, cavalry: 0.6, artillery: 1.0, monster: 1.3, spellcaster: 0.9 },
        monster: { melee: 1.3, ranged: 0.8, cavalry: 1.1, artillery: 1.4, monster: 1.0, spellcaster: 1.4 },
        spellcaster: { melee: 1.25, ranged: 1.0, cavalry: 0.5, artillery: 1.2, monster: 1.1, spellcaster: 1.0 }
      });
    });

    test("the shipped game config carries battle.magic caps", () => {
      expect(DEFAULT_CONFIG.battle.magic).toEqual({
        wardCap: 0.3,
        hexCap: 0.3,
        healCap: 40,
        terrorCap: 0.15,
        arcaneSiegeCap: 2,
        resistCap: 0.5
      });
      expect(currentContent().config.battle.magic).toEqual(DEFAULT_CONFIG.battle.magic);
    });
  });

  test("authoring 'capacity' on a unit is refused by name", () => {
    // `capacity` on a unit is the same trap `men` was: the same word means
    // production on a building, and a unit has no production. A silent
    // acceptance would leave the unit costing what it earns.
    const bad = docs({
      rosterDocs: [
        {
          file: "rosters/base.json",
          doc: y({
            roster: {
              id: "commonBase",
              units: {
                sword: {
                  name: "Swordsmen",
                  category: "melee",
                  blocks: 0.15,
                  attack: 1,
                  defense: 1,
                  charge: 1,
                  missile: 0,
                  cost: 1,
                  upkeep: 1,
                  capacity: { m: 2 }
                }
              }
            }
          })
        }
      ]
    });
    const { content, errors, warnings } = validateAndResolve(bad);
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("renamed 'capacityCost'"))).toBe(true);
    expect(warnings.some(w => w.includes("unknown key 'capacity'"))).toBe(false);
  });

  test("unknown top-level keys warn but do not fail", () => {
    const doc = y({
      roster: {
        id: "commonBase",
        fancyThing: 42, // an unknown key: must warn, never fail
        units: {
          spear: {
            name: "Spearmen",
            category: "melee",
            blocks: 0.15,
            attack: 5,
            defense: 13,
            charge: 3,
            missile: 0,
            cost: 250,
            upkeep: 35,
            op: 1
          },
          levy_spear: {
            name: "Levy",
            category: "melee",
            blocks: 0.15,
            attack: 1,
            defense: 1,
            charge: 1,
            missile: 0,
            cost: 1,
            upkeep: 1
          }
        },
        garrison: { melee: "levy_spear", ranged: "levy_spear" }
      }
    });
    const { content, errors, warnings } = validateAndResolve(docs({ rosterDocs: [{ file: "rosters/x.yaml", doc }] }));
    expect(content).not.toBeNull();
    expect(errors).toEqual([]);
    expect(warnings.some(w => w.includes("fancyThing"))).toBe(true);
    expect(warnings.some(w => w.includes("op"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Engine integration: buildings, tech, gating, victory
// ---------------------------------------------------------------------------

describe("buildings + tech + victory integration", () => {
  const gatingContent = (() => {
    // Ship-like content but with barracks1 gating swords.
    const doc = y({
      buildings: [
        {
          id: "barracks1",
          name: "Barracks",
          chain: "military",
          tier: 1,
          settlementKinds: ["major"],
          cost: 300,
          turns: 1,
          effects: { unlock: ["sword"] }
        }
      ]
    });
    const raw = {
      rosterDocs: [
        {
          file: "rosters/inline.json",
          doc: y({
            roster: {
              id: "commonBase",
              units: {
                sword: {
                  name: "Swordsmen",
                  category: "melee",
                  blocks: 0.15,
                  attack: 8,
                  defense: 11,
                  charge: 4,
                  missile: 0,
                  cost: 100,
                  upkeep: 40
                },
                levy_spear: {
                  name: "Levy Spearmen",
                  category: "melee",
                  blocks: 0.15,
                  attack: 3,
                  defense: 9,
                  charge: 2,
                  missile: 0,
                  cost: 100,
                  upkeep: 15
                },
                levy_archers: {
                  name: "Levy Archers",
                  category: "ranged",
                  blocks: 0.12,
                  attack: 2,
                  defense: 4,
                  charge: 1,
                  missile: 8,
                  cost: 120,
                  upkeep: 18
                }
              },
              recruitable: ["sword", "levy_spear"],
              garrison: { melee: "levy_spear", ranged: "levy_archers" },
              regimentMap: {
                infantry: "levy_spear",
                archers: "levy_archers",
                cavalry: "levy_spear",
                artillery: "levy_spear"
              }
            }
          })
        }
      ],
      culturesDocs: [],
      factionDocs: [],
      buildingsDocs: [{ file: "buildings.json", doc }],
      techDocs: [
        {
          file: "tech.json",
          doc: y({
            tech: [
              { id: "census", name: "Census", cost: 500, effects: { incomePct: 0.5 } },
              { id: "roads", name: "Roads", cost: 500, requires: ["census"], effects: {} }
            ]
          })
        }
      ],
      victoryDocs: [
        {
          file: "victory/v.json",
          doc: y({ victory: [{ id: "standardShort", objectives: [{ type: "controlRegions", fraction: 0.9 }] }] })
        }
      ],
      meta: { defaultRoster: "commonBase", defaultVictory: "standardShort" }
    };
    const out = validateAndResolve(raw as never);
    if (!out.content) throw new Error(`gating content invalid: ${out.errors.join("; ")}`);
    return { content: out.content, warnings: out.warnings };
  })();

  function ctxWith(): EngineCtx {
    const campaign = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed: 5,
      config,
      content: gatingContent.content,
      resolved: resolveForPack(pack, gatingContent.content),
      id: "gating-test"
    });
    return {
      campaign,
      pack,
      config,
      content: gatingContent.content,
      resolved: resolveForPack(pack, gatingContent.content),
      commands: []
    };
  }

  function capitalRegionOf(_ctx: EngineCtx, factionId: number): number {
    return pack.factions.find(f => f.id === factionId)!.capitalRegion;
  }

  function armyInRegion(ctx: EngineCtx, regionId: number): string | null {
    const idx = ctx.pack.settlements.find(s => s.kind === "major" && s.regionId === regionId)!.cell;
    const candidates = Object.values(ctx.campaign.armies).filter(a => !a.fleet && a.factionId === 1);
    const army = candidates.find(a => a.cell === idx) ?? candidates.find(a => a.units.length < 20) ?? null;
    if (!army) return null;
    army.cell = idx;
    army.movementLeft = 100;
    // Make recruitment room (test setup — starting stacks are often 20/20).
    if (army.units.length > 15) army.units.splice(0, army.units.length - 15);
    return army.id;
  }

  test("unlock gating: sword requires barracks; levy_spear always available", () => {
    const ctx = ctxWith();
    applyCommand(ctx, { type: "EndTurn" }); // refresh MP + construct nothing
    const regionId = capitalRegionOf(ctx, 1);
    const armyId = armyInRegion(ctx, regionId)!;
    expect(armyId).toBeTruthy();

    const levy = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType: "levy_spear" });
    expect(levy.ok).toBe(true);

    // Founding domains may already include a Barracks (CAPACITY-PLAN §1
    // *Starting domains*), so assert the gate against a realm that has none.
    // The gate is **per faction**, not per region: one Barracks anywhere the
    // realm holds opens the sword for the whole realm. Since §4.5 gives a
    // populous province several barracks, the realm usually holds many — so
    // every one of its regions has to be cleared, not just the capital's.
    const rs = ctx.campaign.regions[String(regionId)]!;
    const owned = Object.values(ctx.campaign.regions).filter(r => r.owner === 1);
    const founded = owned.some(r => r.buildings.includes("barracks1"));
    for (const r of owned) r.buildings = r.buildings.filter(b => b !== "barracks1");

    const gated = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType: "sword" });
    expect(gated.ok).toBe(false);
    expect(gated.error).toContain("Barracks");

    // …and that founding one, when present, opens the same gate.
    if (founded) {
      rs.buildings.push("barracks1");
      expect(applyCommand(ctx, { type: "RecruitUnit", armyId, unitType: "sword" }).ok).toBe(true);
    }
  });

  test("build → construct → gate opens; walls from buildings raise assault modifier", () => {
    const ctx = ctxWith();
    applyCommand(ctx, { type: "EndTurn" });
    const regionId = capitalRegionOf(ctx, 1);
    const armyId = armyInRegion(ctx, regionId)!;

    // Give treasury headroom (test-only) for instant builds.
    ctx.campaign.factions["1"]!.treasury += 5000;

    // Clear any founding Barracks so this exercises build-from-nothing; the
    // founding-asset case is covered by its own test above.
    const rs = ctx.campaign.regions[String(regionId)]!;
    rs.buildings = rs.buildings.filter(b => b !== "barracks1");

    const queued = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "barracks1" });
    expect(queued.ok).toBe(true);
    expect(queued.events.some(e => e.type === "BuildingQueued")).toBe(true);

    const dup = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "barracks1" });
    expect(dup.ok).toBe(false); // already under construction

    // Construction completes on the next economy tick (turns: 1).
    applyCommand(ctx, { type: "EndTurn" });
    expect(ctx.campaign.regions[String(regionId)]!.buildings).toContain("barracks1");

    // Sword unlocks once Barracks stands; army sits in the region.
    ctx.campaign.armies[armyId]!.cell = pack.settlements.find(s => s.kind === "major" && s.regionId === regionId)!.cell;
    const recruited = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType: "sword" });
    expect(recruited.ok).toBe(true);
  });

  test("chain prereqs: walls2 rejected before walls1", () => {
    const ctx = ctxWith();
    applyCommand(ctx, { type: "EndTurn" });
    // Use shipped content for walls chains — swap content on the ctx.
    const shipped = currentContent();
    ctx.content = shipped.content;
    ctx.resolved = resolveForPack(pack, shipped.content);
    const regionId = capitalRegionOf(ctx, 1);
    ctx.campaign.factions["1"]!.treasury += 10000;

    const skip = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "walls2" });
    expect(skip.ok).toBe(false);
    expect(skip.error).toMatch(/requires/i);

    expect(applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "walls1" }).ok).toBe(true);
    applyCommand(ctx, { type: "EndTurn" });
    expect(ctx.campaign.regions[String(regionId)]!.buildings).toContain("walls1");
    expect(applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "walls2" }).ok).toBe(true);
  });

  test("enemy region cannot be built in", () => {
    const ctx = ctxWith();
    applyCommand(ctx, { type: "EndTurn" });
    const enemyRegion = capitalRegionOf(ctx, 9);
    const res = applyCommand(ctx, { type: "BuildBuilding", regionId: enemyRegion, buildingId: "barracks1" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not yours/i);
  });

  test("tech: prereqs enforced; incomePct visible in the treasury tick", () => {
    const ctx = ctxWith();
    applyCommand(ctx, { type: "EndTurn" });

    const missingPrereq = applyCommand(ctx, { type: "ResearchTech", techId: "roads" });
    expect(missingPrereq.ok).toBe(false);
    expect(missingPrereq.error).toMatch(/Census/);

    ctx.campaign.factions["1"]!.treasury += 2000;
    const researched = applyCommand(ctx, { type: "ResearchTech", techId: "census" });
    expect(researched.ok).toBe(true);
    expect(ctx.campaign.factions["1"]!.tech).toContain("census");

    const dup = applyCommand(ctx, { type: "ResearchTech", techId: "census" });
    expect(dup.ok).toBe(false);

    // Income comparison: +50% incomePct on the researched faction.
    const before = applyCommand(ctx, { type: "EndTurn" });
    const tick = before.events.find(e => e.type === "TreasuryTicked" && (e as any).factionId === 1)! as any;
    const baseline = tick.income;
    expect(baseline).toBeGreaterThan(0);

    const twin = ctxWith();
    applyCommand(twin, { type: "EndTurn" });
    const twinTick = twin.campaign.log
      .filter(e => e.type === "TreasuryTicked")
      .map(e => e as any)
      .find(e => e.factionId === 1)!;
    // The twin has no census: its income is the un-researched baseline.
    expect(Math.abs(baseline - twinTick.income * 1.5)).toBeLessThan(Math.max(2, baseline * 0.05));
  });

  test("caps: recruiting past the roster cap is rejected", () => {
    const ctx = ctxWith();
    applyCommand(ctx, { type: "EndTurn" });
    const regionId = capitalRegionOf(ctx, 1);
    const armyId = armyInRegion(ctx, regionId)!;
    ctx.campaign.factions["1"]!.treasury += 100000;
    // levy_spear has no cap in this content → fill the army to 20 with swords gated off;
    // use levy_spear to hit maxUnitsPerArmy instead.
    let recruited = 0;
    for (let i = 0; i < 25; i++) {
      const res = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType: "levy_spear" });
      if (res.ok) recruited++;
      else break;
    }
    expect(recruited).toBeGreaterThan(0);
    expect(recruited).toBeLessThanOrEqual(20);
    expect(ctx.campaign.armies[armyId]!.units.length).toBeLessThanOrEqual(20);
  });

  test("victory sets: eliminateFactions + controlRegions evaluated per faction", () => {
    const ctx = ctxWith();
    // Replace Ash's victory set with the shipped warlordLong (eliminate 7 and 14).
    const shipped = currentContent();
    ctx.content = shipped.content;
    ctx.resolved = resolveForPack(pack, shipped.content);
    ctx.campaign.factions["14"]!.victorySetId = "warlordLong";

    // Not satisfied initially (7 and 14 alive).
    expect(evaluateVictory(ctx, 14)).toBe(false);
    ctx.campaign.factions["7"]!.alive = false;
    ctx.campaign.factions["14"]!.alive = false; // a dead faction never wins
    expect(evaluateVictory(ctx, 14)).toBe(false);

    // A living Ash with both rivals dead + 30 regions wins.
    ctx.campaign.factions["14"]!.alive = true;
    let given = 0;
    for (const r of Object.values(ctx.campaign.regions)) {
      if (given >= 30) break;
      r.owner = 14;
      given++;
    }
    expect(evaluateVictory(ctx, 14)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §7: the game is playable on ANY Azgaar world, not just the sample world's pack.
// ---------------------------------------------------------------------------

describe("a world nobody has exported before", () => {
  /** Shipped docs plus the portable race defs a config group would write. */
  const withRaceDefs: RawContentDocs = {
    ...currentContent().docs,
    factionDocs: [
      {
        file: "groups.json",
        doc: y({
          factions: [
            { bind: { cultureRace: "Orkish" }, mechanics: { confederation: "never" } },
            { bind: { cultureRace: "Elfish" }, mechanics: { corruption: false } },
            { bind: { cultureRace: "Human" }, mechanics: { corruption: false }, roster: { exclude: ["artillery"] } },
            // Two races this foreign world does not have — they must warn.
            { bind: { cultureRace: "Dwarven" } },
            { bind: { cultureRace: "Dark Elfish" } }
          ]
        })
      }
    ]
  };
  const defined = validateAndResolve(withRaceDefs).content!;

  /** A pack shaped like an arbitrary FMG world: unknown state + culture names. */
  const foreignPack = {
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Voth (Orkish)" },
      { i: 2, name: "Kel Mirith (Elfish)" },
      { i: 3, name: "Ashenmoor (Human)" }
    ],
    factions: [
      { id: 0, name: "Wildlands", culture: 0 },
      { id: 1, name: "Voth", culture: 1 },
      { id: 2, name: "Kel Mirith", culture: 2 },
      { id: 3, name: "Ashenmoor", culture: 3 }
    ]
  } as unknown as Parameters<typeof resolveForPack>[0];

  const resolved = resolveForPack(foreignPack, defined);

  test("cultureRace binds by the '(Race)' suffix, so unseen worlds still get doctrine", () => {
    // Orcish state → confederation never (differs from the engine default).
    expect(resolved.factions["1"]!.mechanics.confederation).toBe("never");
    expect(resolved.factions["1"]!.mechanics.corruption).toBe(true);
    // Elfish state → no corruption, culture-group confederation.
    expect(resolved.factions["2"]!.mechanics.confederation).toBe("cultureGroup");
    expect(resolved.factions["2"]!.mechanics.corruption).toBe(false);
    // Human state → no corruption, and artillery dropped from the roster.
    expect(resolved.factions["3"]!.mechanics.corruption).toBe(false);
    expect(resolved.factions["3"]!.roster.recruitable).not.toContain("artillery");
  });

  test("every faction still gets a playable roster", () => {
    expect(Object.keys(resolved.factions)).toHaveLength(4);
    for (const rf of Object.values(resolved.factions)) {
      expect(rf.roster.recruitable.length).toBeGreaterThan(0);
      expect(defined.rosters[rf.rosterId]).toBeDefined();
    }
    // Unbound culture ("Wildlands", no race suffix) falls back cleanly.
    expect(resolved.factions["0"]!.rosterId).toBe(defined.defaultRoster);
  });

  test("race defs warn only for races the world does not have", () => {
    // This world has Orkish/Elfish/Human — those defs must bind silently.
    // Dwarven/Dark-Elfish cultures are absent, so those two legitimately warn,
    // exactly like a stateName def for a missing state does.
    const raceWarnings = resolved.bindingWarnings.filter(w => w.includes("culture race"));
    expect(raceWarnings.join("\n")).toContain("Dwarven");
    expect(raceWarnings.join("\n")).toContain("Dark Elfish");
    expect(raceWarnings.join("\n")).not.toContain("'Orkish'");
    expect(raceWarnings.join("\n")).not.toContain("'Elfish'");
    expect(raceWarnings.join("\n")).not.toContain("'Human'");
  });

  test("a hand-tuned state binding still beats the race def", () => {
    // Balben (Dark Elfish) gets its own def: it must win over the Dark-Elfish
    // race def for everything it names.
    const both: RawContentDocs = {
      ...withRaceDefs,
      factionDocs: [
        {
          file: "groups.json",
          doc: withRaceDefs.factionDocs[0]!.doc
        },
        {
          file: "states.json",
          doc: y({ factions: [{ bind: { stateId: 1 }, victory: "warlordLong" }] })
        }
      ]
    };
    const r = resolveForPack(pack, validateAndResolve(both).content!);
    expect(r.factions["1"]!.victorySetId).toBe("warlordLong");
    // An unhand-tuned state keeps the race def's doctrine.
    expect(r.factions["6"]!.victorySetId).toBe("standardShort");
  });
});

describe("culture groups scope buildings and tech per faction", () => {
  /** Shipped docs + a dwarven-flavoured group entry in each pool. */
  const shippedDocs = currentContent().docs;
  const withGroups: RawContentDocs = {
    ...shippedDocs,
    buildingsDocs: [
      ...(shippedDocs.buildingsDocs ?? []),
      {
        file: "buildings-groups.json",
        doc: y({
          buildings: [
            // Same chain as a common building but a dwarven tier: allowed.
            {
              id: "deepForge",
              name: "Deep Forge",
              chain: "forge",
              tier: 2,
              settlementKinds: ["major"],
              cost: 900,
              group: "dwarfBase",
              effects: { incomePct: 0.2 }
            }
          ]
        })
      }
    ],
    techDocs: [
      ...(shippedDocs.techDocs ?? []),
      {
        file: "tech-groups.json",
        doc: y({
          tech: [{ id: "runeLore", name: "Rune Lore", cost: 4000, group: "dwarfBase", effects: { incomePct: 0.1 } }]
        })
      }
    ]
  };
  const defined = validateAndResolve(withGroups).content!;
  const r = resolveForPack(pack, defined);
  const dwarf = r.factions["8"]!; // Unalbu — Khazadur (Dwarven) → dwarfBase
  const human = r.factions["7"]!; // Flavengmia — Anor (Human) → commonBase

  test("group entries reach their own group and nobody else", () => {
    expect(dwarf.rosterId).toBe("dwarfBase");
    expect(dwarf.buildings.map(b => b.id)).toContain("deepForge");
    expect(human.buildings.map(b => b.id)).not.toContain("deepForge");
    expect(dwarf.tech.map(t => t.id)).toContain("runeLore");
    expect(human.tech.map(t => t.id)).not.toContain("runeLore");
  });

  test("common entries still reach everyone", () => {
    for (const faction of [dwarf, human]) {
      expect(faction.buildings.length).toBeGreaterThan(1);
      expect(faction.tech.length).toBeGreaterThan(1);
    }
  });

  test("a per-state def can exclude its group's entry or include a foreign one", () => {
    const tuned: RawContentDocs = {
      ...withGroups,
      factionDocs: [
        {
          file: "states.json",
          doc: y({
            factions: [
              {
                bind: { stateId: 8 },
                buildings: { exclude: ["deepForge"], include: ["market1"] },
                tech: { exclude: ["runeLore"] }
              }
            ]
          })
        }
      ]
    };
    const tunedR = resolveForPack(pack, validateAndResolve(tuned).content!);
    const tunedDwarf = tunedR.factions["8"]!;
    expect(tunedDwarf.buildings.map(b => b.id)).not.toContain("deepForge");
    expect(tunedDwarf.tech.map(t => t.id)).not.toContain("runeLore");
    // The include reaches into the common pool even though dwarfBase scopes it out? No:
    // common entries were never scoped out — include exists for foreign GROUP entries
    // and for re-adding something excluded. Common entries are already there.
    expect(tunedDwarf.buildings.map(b => b.id)).toContain("market1");
  });

  test("the build and research commands honour the scope", () => {
    const campaign = createCampaign({
      mapPackId: "group-scope",
      pack,
      factionId: 8, // play as the dwarves
      seed: 1,
      config,
      content: defined,
      resolved: r
    });
    const ctx: EngineCtx = {
      campaign,
      pack,
      config,
      content: defined,
      resolved: r,
      commands: []
    };
    const capital = pack.factions.find(f => f.id === 8)!.capitalRegion;
    // Fund the war chest so cost checks pass; this test is about scope.
    campaign.factions["8"]!.treasury = 50000;
    // The dwarves can research their own group tech…
    expect(applyCommand(ctx, { type: "ResearchTech", techId: "runeLore" }).ok).toBe(true);
    campaign.factions["8"]!.tech = campaign.factions["8"]!.tech.filter(t => t !== "runeLore");
    // …but a foreign group's tech is not even offered to them.
    const foreignTech = defined.tech.find(t => t.group && t.group !== "dwarfBase");
    if (foreignTech) {
      const err = applyCommand(ctx, { type: "ResearchTech", techId: foreignTech.id }).error;
      expect(String(err)).toContain("not available");
    }
    // Same for buildings: a foreign group's entry is rejected.
    const foreign = defined.buildings.find(b => b.group && b.group !== "dwarfBase");
    if (foreign) {
      const err = applyCommand(ctx, { type: "BuildBuilding", regionId: capital, buildingId: foreign.id }).error;
      expect(String(err)).toContain("not available");
    }
  });

  test("culture bindings can match by race and beat inference", () => {
    const bound: RawContentDocs = {
      ...currentContent().docs,
      culturesDocs: [
        {
          file: "groups.json",
          doc: y({
            cultures: [
              { cultureRace: "Dwarven", roster: "dwarfBase" },
              { cultureName: "Dulandir (Human)", roster: "steppeBase" }
            ]
          })
        }
      ]
    };
    const boundR = resolveForPack(pack, validateAndResolve(bound).content!);
    expect(boundR.factions["8"]!.rosterId).toBe("dwarfBase");
    // The name binding hands the steppe doctrine to a Human culture — the
    // nomad case the old static cultures.json used to carry.
    expect(boundR.factions["2"]!.rosterId).toBe("steppeBase");
    expect(boundR.factions["3"]!.rosterId).toBe("steppeBase");
    // Other humans stay on the default.
    expect(boundR.factions["7"]!.rosterId).toBe("commonBase");
  });
});
