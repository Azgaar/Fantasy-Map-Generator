// @vitest-environment jsdom
import { expect, it } from "vitest";
import { ArmoriaSessions } from "./armoria-sessions";

const origin = "https://azgaar.github.io";
const update = (session: string, overrides: Record<string, unknown> = {}, from = origin) =>
  new MessageEvent("message", {
    origin: from,
    data: { type: "armoria:coa", version: 1, session, coa: { t1: "gules" }, svg: "<svg/>", ...overrides }
  });

it("accepts every valid update of a live session, and nothing else", () => {
  const sessions = new ArmoriaSessions<string>();
  const map = {};
  const token = sessions.start("state:1", "state:1", map);
  expect(sessions.receive(update(token, {}, "https://example.com"), map)).toBeNull();
  expect(sessions.receive(update(token, { version: 2 }), map)).toBeNull();
  expect(sessions.receive(update(token, { coa: { charges: [] } }), map)).toBeNull();
  expect(sessions.receive(update("unknown"), map)).toBeNull();
  expect(sessions.receive(update(token), {})).toBeNull(); // another map is loaded
  expect(sessions.receive(update(token), map)).toEqual({ target: "state:1", coa: { t1: "gules" }, svg: "<svg/>" });
  expect(sessions.receive(update(token, { coa: { t1: "azure" } }), map)?.coa).toEqual({ t1: "azure" });
});

it("replaces an earlier session for the same emblem", () => {
  const sessions = new ArmoriaSessions<string>();
  const map = {};
  const stale = sessions.start("state:1", "state:1", map);
  const live = sessions.start("state:1", "state:1", map);
  expect(sessions.receive(update(stale), map)).toBeNull();
  expect(sessions.receive(update(live), map)?.target).toBe("state:1");
});

it("accepts the origin of the GUI used for a local editing session", () => {
  const sessions = new ArmoriaSessions<string>();
  const map = {};
  const local = "http://127.0.0.1:5000";
  const token = sessions.start("state:1", "state:1", map, local);
  expect(sessions.receive(update(token), map)).toBeNull();
  expect(sessions.receive(update(token, {}, local), map)?.target).toBe("state:1");
});
