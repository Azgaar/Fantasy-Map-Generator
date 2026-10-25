// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { tip } from "./tooltips";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const line = () => document.getElementById("tooltip")!.innerHTML;

describe("timed tips", () => {
  test("a timed tip clears itself when nothing replaced it", async () => {
    document.body.innerHTML = `<div id="tooltip"></div>`;
    tip("Apply Astral naming under Tools", false, "info", 10);
    await wait(40);
    expect(line()).toBe("");
  });

  test("a hover tip that replaced a timed one survives its expiry", async () => {
    document.body.innerHTML = `<div id="tooltip"></div>`;
    tip("Apply Astral naming under Tools", false, "info", 10);
    tip("G-class yellow dwarf. Click to edit"); // a transient hover tip takes over the line
    await wait(40);
    expect(line()).toContain("G-class");
  });
});
