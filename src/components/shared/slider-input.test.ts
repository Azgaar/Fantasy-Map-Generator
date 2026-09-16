// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "./slider-input";

const render = (html: string) => {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement & { value: string };
};

describe("slider-input", () => {
  it("shows the value it is given, whatever scale it is on", () => {
    const slider = render(`<slider-input min="0.1" max="0.99" step="0.01" value="0.9"></slider-input>`);

    // the range input snaps to its own scale, so it has to be set up before the value reaches it
    expect(slider.querySelector<HTMLInputElement>("input[type=range]")?.value).toBe("0.9");
    expect(slider.querySelector<HTMLInputElement>("input[type=number]")?.value).toBe("0.9");
    expect(slider.value).toBe("0.9");
  });

  it("keeps a value above the default range", () => {
    const slider = render(`<slider-input min="10" max="300" step="5" value="145"></slider-input>`);

    expect(slider.querySelector<HTMLInputElement>("input[type=range]")?.value).toBe("145");
    expect(slider.value).toBe("145");
  });
});
