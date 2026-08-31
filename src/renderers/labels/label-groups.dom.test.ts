// Browser-mode test (vitest.browser.config.ts): label groups carry their shift as a transform
// derived from the store, not as retired data-dx/data-dy attributes.
import { expect, test } from "vitest";
import "@/generators/styles";
import { writeGroupStyle } from "./label-groups";

test("writeGroupStyle applies the CSS text without stamping data attrs", () => {
  document.body.innerHTML = `<svg id="map"><g id="labels"></g></svg>`;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  document.getElementById("labels")!.appendChild(group);

  const groupStyle = structuredClone(styles.labels.groups.capital);
  groupStyle.attrs.style = "text-shadow: white 0px 0px 4px; transform: translate(1.5em, -0.5em)";
  writeGroupStyle(group, groupStyle);

  expect(group.style.cssText).toBe("text-shadow: white 0px 0px 4px; transform: translate(1.5em, -0.5em)");
  expect(group.getAttribute("data-dx")).toBeNull();
  expect(group.getAttribute("data-dy")).toBeNull();
});
