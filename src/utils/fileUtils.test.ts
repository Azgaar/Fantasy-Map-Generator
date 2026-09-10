import { describe, expect, it } from "vitest";
import { isImageIcon } from "./fileUtils";

describe("isImageIcon", () => {
  it("recognises http and data image URLs", () => {
    expect(isImageIcon("https://example.com/icon.png")).toBe(true);
    expect(isImageIcon("data:image/svg+xml;base64,PHN2Zy8+")).toBe(true);
  });

  it("rejects emoji, plain text and other schemes", () => {
    expect(isImageIcon("⛏️")).toBe(false);
    expect(isImageIcon("")).toBe(false);
    expect(isImageIcon("javascript:alert(1)")).toBe(false);
    expect(isImageIcon("httpx")).toBe(false);
    expect(isImageIcon('" onerror="alert(1)" data:image/')).toBe(false);
  });
});
