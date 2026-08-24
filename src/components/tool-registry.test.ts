import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchRegeneration: vi.fn(() => true),
  invokeController: vi.fn(() => "executed" as const)
}));

vi.mock("./tool-command-executor", () => ({ invokeToolControllerCommand: mocks.invokeController }));
vi.mock("./ui/regeneration-command", () => ({ dispatchRegenerationCommand: mocks.dispatchRegeneration }));

import { getToolCommands, matchesToolCommand, TOOL_COMMANDS, TOOL_GROUPS } from "./tool-registry";

describe("tool registry", () => {
  test("gives every command stable unique identifiers and required metadata", () => {
    expect(TOOL_COMMANDS).toHaveLength(51);
    expect(new Set(TOOL_COMMANDS.map(command => command.id)).size).toBe(TOOL_COMMANDS.length);
    expect(new Set(TOOL_COMMANDS.map(command => command.controlId)).size).toBe(TOOL_COMMANDS.length);

    for (const command of TOOL_COMMANDS) {
      expect(command.label.length).toBeGreaterThan(0);
      expect(command.description.length).toBeGreaterThan(0);
      expect(command.icon.length).toBeGreaterThan(0);
      expect(typeof command.invoke).toBe("function");
    }

    const markerSettings = TOOL_COMMANDS.find(command => command.id === "regenerate.markers")?.secondaryAction;
    expect(markerSettings?.id).toBe("regenerate.markers.settings");
  });

  test("organizes every command into a populated domain group", () => {
    for (const group of TOOL_GROUPS) expect(getToolCommands(group.id).length).toBeGreaterThan(0);
    expect(getToolCommands("politics").some(command => command.id === "politics.states")).toBe(true);
    expect(getToolCommands("settlements").some(command => command.id === "settlements.burgs")).toBe(true);
    expect(getToolCommands("regenerate").every(command => command.destructive)).toBe(true);
  });

  test("searches labels, descriptions, domains, and synonyms", () => {
    const heightmap = TOOL_COMMANDS.find(command => command.id === "world.heightmap");
    const states = TOOL_COMMANDS.find(command => command.id === "politics.states");

    expect(heightmap && matchesToolCommand(heightmap, "elevation")).toBe(true);
    expect(states && matchesToolCommand(states, "countries")).toBe(true);
    expect(getToolCommands("geography", "water").some(command => command.id === "geography.rivers")).toBe(true);
    expect(getToolCommands("settlements", "settlements")).toHaveLength(4);
  });

  test("invokes direct and regeneration command boundaries", () => {
    TOOL_COMMANDS.find(command => command.id === "world.biomes")?.invoke();
    expect(mocks.invokeController).toHaveBeenCalledWith("editBiomesButton");

    const regenerationTarget = { dispatchEvent: vi.fn(() => true) };
    TOOL_COMMANDS.find(command => command.id === "regenerate.zones")?.invoke({
      ctrlKey: true,
      metaKey: false,
      regenerationTarget
    });
    expect(mocks.dispatchRegeneration).toHaveBeenCalledWith(
      "regenerateZones",
      { ctrlKey: true, metaKey: false },
      regenerationTarget
    );

    TOOL_COMMANDS.find(command => command.id === "politics.states")?.invoke({ dialogPresentation: "panel" });
    expect(mocks.invokeController).toHaveBeenCalledWith("editStatesButton", undefined, "panel");
  });
});
