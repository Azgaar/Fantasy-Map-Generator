import { describe, expect, test, vi } from "vitest";
import {
  dispatchRegenerationCommand,
  type RegenerationCommandDetail,
  type RegenerationCommandTarget,
  RUN_REGENERATION_EVENT
} from "./regeneration-command";

describe("dispatchRegenerationCommand", () => {
  test("dispatches the feature id and input modifiers", () => {
    const dispatchEvent = vi.fn<(event: Event) => boolean>(() => true);
    const target: RegenerationCommandTarget = { dispatchEvent };

    expect(dispatchRegenerationCommand("regenerateZones", { ctrlKey: true, metaKey: false }, target)).toBe(true);

    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent<RegenerationCommandDetail>;
    expect(event.type).toBe(RUN_REGENERATION_EVENT);
    expect(event.detail).toEqual({ buttonId: "regenerateZones", ctrlKey: true, metaKey: false });
  });
});
