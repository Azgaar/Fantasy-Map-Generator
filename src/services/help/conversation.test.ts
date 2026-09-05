import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adoptConversationId,
  CONVERSATION_STORAGE,
  clearConversationId,
  getConversationId,
  isNewConversation
} from "./conversation";

afterEach(() => vi.unstubAllGlobals());

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k)
  };
};

describe("conversation id storage", () => {
  it("pins the storage key", () => {
    expect(CONVERSATION_STORAGE).toBe("fmg-help-conversation");
  });

  it("adopts, reads back, and clears via sessionStorage", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    expect(getConversationId()).toBeNull();
    adoptConversationId("id-1234567890123456");
    expect(getConversationId()).toBe("id-1234567890123456");
    clearConversationId();
    expect(getConversationId()).toBeNull();
  });

  it("rejects a malformed id (storage stays empty)", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    adoptConversationId("not valid!");
    expect(getConversationId()).toBeNull();
  });

  it("accepts a 24-char base64url id", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    const id = "abcDEF123_-abcDEF123_-ab";
    expect(id).toHaveLength(24);
    adoptConversationId(id);
    expect(getConversationId()).toBe(id);
  });

  it("survives a throwing storage without throwing", () => {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      }
    };
    vi.stubGlobal("sessionStorage", throwing);
    expect(getConversationId()).toBeNull();
    expect(() => adoptConversationId("x-1234567890123456")).not.toThrow();
    expect(() => clearConversationId()).not.toThrow();
  });
});

describe("isNewConversation", () => {
  it("is false for the first question (nothing sent)", () => {
    expect(isNewConversation(null, "fresh-id-123456789")).toBe(false);
  });
  it("is false when the sent id survived", () => {
    expect(isNewConversation("same-id-1234567890", "same-id-1234567890")).toBe(false);
  });
  it("is true when a sent id came back different (expiry/unknown-id rollover)", () => {
    expect(isNewConversation("old-id-12345678901", "new-id-12345678901")).toBe(true);
  });
});
