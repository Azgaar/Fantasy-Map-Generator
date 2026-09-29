export type Tier = "guest" | "member" | "key" | null;

export function resolveTier(serverAvailable: boolean, signedIn: boolean, connected: boolean): Tier {
  if (connected) return "key";
  if (!serverAvailable) return null;
  return signedIn ? "member" : "guest";
}

export const answererFor = (tier: Tier): "provider" | "azgaar-server" | null =>
  tier === "key" ? "provider" : tier ? "azgaar-server" : null;
