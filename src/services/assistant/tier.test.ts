import { expect, it } from "vitest";
import { answererFor, resolveTier } from "./tier";

it.each([false, true])("resolves every tier combination when server availability is %s", available => {
  for (const signedIn of [false, true]) {
    for (const connected of [false, true]) {
      const tier = resolveTier(available, signedIn, connected);
      expect(tier).toBe(connected ? "key" : available ? (signedIn ? "member" : "guest") : null);
      expect(answererFor(tier)).toBe(connected ? "provider" : available ? "azgaar-server" : null);
    }
  }
});
