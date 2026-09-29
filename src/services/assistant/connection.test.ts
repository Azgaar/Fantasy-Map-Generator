// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { clear, get, isConnected, save } from "./connection";

beforeEach(() => localStorage.clear());

it("shares provider keys with the text generator and keeps model routing explicit", () => {
  save({ provider: "openai", model: "same-id", key: "openai-key", localUrl: "", localModel: "" });
  expect(get().provider).toBe("openai");
  expect(get().model).toBe("same-id");
  expect(isConnected()).toBe(true);
  expect(localStorage.getItem("fmg-ai-kl-openai")).toBe("openai-key");
  clear();
  expect(isConnected()).toBe(false);
  expect(localStorage.getItem("fmg-ai-kl-openai")).toBeNull();
});

it("connects a local model without a key", () => {
  localStorage.setItem("fmg-ai-kl-local", "old-key");
  save({
    provider: "local",
    model: "local",
    key: "other-key",
    localUrl: "http://localhost:11434/v1",
    localModel: "test"
  });
  expect(isConnected()).toBe(true);
  expect(get().localModel).toBe("test");
  expect(get().key).toBe("");
});

it("adopts an existing key from the previous Assistant settings", () => {
  localStorage.setItem("fmg-ai-chat-provider", "anthropic");
  localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5-5");
  localStorage.setItem("fmg-ai-kl-anthropic", "existing-key");
  expect(isConnected()).toBe(true);
  clear();
  expect(isConnected()).toBe(false);
});
