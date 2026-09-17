// Browser-mode tests (vitest.browser.config.ts): the dialog's choices, without the jQuery dialog around them
import { afterEach, expect, test } from "vitest";
import { paintBurgIconDialog, renderChoices } from "./burg-icon-dialog";

afterEach(() => document.body.replaceChildren());

const render = (anchors: boolean, selected: string) => {
  const content = document.createElement("div");
  content.innerHTML = renderChoices(anchors, selected);
  return content;
};

test("the burg sets are listed by group with the current icon pressed", () => {
  const content = render(false, "#icon-watabou-city");
  expect([...content.querySelectorAll("h4")].map(h => h.textContent)).toEqual(["Atlas", "Watabou", "Illustrated"]);
  expect(content.querySelectorAll("button[data-icon]").length).toBeGreaterThan(20);
  const pressed = content.querySelectorAll("button.pressed");
  expect(pressed).toHaveLength(1);
  expect(pressed[0].getAttribute("data-icon")).toBe("#icon-watabou-city");
});

test("the port set offers the anchor and the harbor", () => {
  const content = render(true, "#icon-anchor");
  expect([...content.querySelectorAll<HTMLElement>("button[data-icon]")].map(b => b.dataset.icon)).toEqual([
    "#icon-anchor",
    "#icon-harbor"
  ]);
});

test("the previews inherit the paint set on the dialog, never their own", () => {
  const dialog = document.createElement("div");
  dialog.append(render(false, "#icon-circle"));
  document.body.append(dialog);
  paintBurgIconDialog("#123456", "#abcdef", dialog);
  for (const use of dialog.querySelectorAll("use")) {
    expect(use.getAttribute("fill")).toBeNull();
    expect(use.getAttribute("stroke")).toBeNull();
    expect(getComputedStyle(use).fill).toBe("rgb(18, 52, 86)");
  }
});
