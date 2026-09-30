import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, storeToken, TOKEN_STORAGE } from "./auth";

afterEach(() => vi.unstubAllGlobals());

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k)
  };
};

describe("token storage", () => {
  it("pins the storage key main.js must match", () => {
    expect(TOKEN_STORAGE).toBe("fmg-help-token");
  });

  it("stores, reads back, and clears the token", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(getToken()).toBeNull();
    storeToken("tok-123");
    expect(getToken()).toBe("tok-123");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
