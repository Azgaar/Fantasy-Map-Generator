import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDrawer, connectorLine, isDrawerOpen, openDrawer, pickSide } from "./drawer";

let overlay: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="options">
      <div id="before"></div>
      <div id="optionsContent" class="tabcontent">
        <p>Map generation settings</p>
        <table><tbody>
          <tr><td><input id="alpha"></td></tr>
          <tr><td><input id="beta"></td></tr>
          <tr><td><input id="gamma"></td></tr>
        </tbody></table>
      </div>
      <div id="after"></div>
    </div>`;
  overlay = document.createElement("div");
  document.body.append(overlay);
});

afterEach(() => closeDrawer());

describe("pickSide", () => {
  it("opens on the side the sector points into", () => {
    expect(pickSide(0, 640, 1280)).toBe("right");
    expect(pickSide(Math.PI, 640, 1280)).toBe("left");
  });

  it("overrides to the other side when the preferred one lacks room", () => {
    expect(pickSide(0, 1200, 1280)).toBe("left");
  });

  it("decides by viewport room when the sector points near-vertically", () => {
    expect(pickSide(-Math.PI / 2, 300, 1280)).toBe("right");
    expect(pickSide(-Math.PI / 2, 1000, 1280)).toBe("left");
  });
});

describe("openDrawer", () => {
  it("reparents the live host element into the drawer", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options" }, "right", () => {});
    expect(document.getElementById("optionsContent")!.closest("#mapWheelDrawer")).toBeTruthy();
    expect(isDrawerOpen()).toBe(true);
  });

  it("shows the title", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Realms" }, "right", () => {});
    expect(overlay.querySelector(".mw-drawer-title")!.textContent).toBe("Realms");
  });

  it("hides exactly the rows outside the filter", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options", only: ["beta"] }, "right", () => {});
    const rows = [...document.querySelectorAll("#optionsContent tr")] as HTMLElement[];
    expect(rows.map(r => r.hidden)).toEqual([true, false, true]);
  });

  it("does nothing when the host id does not exist", () => {
    openDrawer(overlay, { host: "nope", title: "Nope" }, "right", () => {});
    expect(isDrawerOpen()).toBe(false);
  });
});

describe("closeDrawer", () => {
  it("puts the host back exactly where it was", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options" }, "right", () => {});
    closeDrawer();
    const host = document.getElementById("optionsContent")!;
    expect(host.parentElement!.id).toBe("options");
    expect(host.previousElementSibling!.id).toBe("before");
    expect(host.nextElementSibling!.id).toBe("after");
  });

  it("clears every hidden flag it set", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options", only: ["beta"] }, "right", () => {});
    closeDrawer();
    const rows = [...document.querySelectorAll("#optionsContent tr")] as HTMLElement[];
    expect(rows.every(r => !r.hidden)).toBe(true);
  });

  it("leaves a row alone that was already hidden before the drawer opened", () => {
    const pre = document.querySelector("#optionsContent tr") as HTMLElement;
    pre.hidden = true;
    openDrawer(overlay, { host: "optionsContent", title: "Options", only: ["beta"] }, "right", () => {});
    closeDrawer();
    expect(pre.hidden).toBe(true);
  });

  it("is idempotent", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options" }, "right", () => {});
    closeDrawer();
    expect(() => closeDrawer()).not.toThrow();
    expect(document.getElementById("optionsContent")!.parentElement!.id).toBe("options");
  });

  it("still restores when the recorded next sibling was removed while the drawer was open", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options" }, "right", () => {});
    document.getElementById("after")!.remove();
    closeDrawer();
    expect(document.getElementById("optionsContent")!.parentElement!.id).toBe("options");
  });

  it("restores the first host before hosting a second", () => {
    openDrawer(overlay, { host: "optionsContent", title: "Options" }, "right", () => {});
    openDrawer(overlay, { host: "before", title: "Other" }, "right", () => {});
    expect(document.getElementById("optionsContent")!.parentElement!.id).toBe("options");
    expect(document.getElementById("before")!.closest("#mapWheelDrawer")).toBeTruthy();
  });

  it("aims the connector at the drawer's near edge, not along the sector angle", () => {
    const line = connectorLine(-Math.PI / 2, "right");
    expect(line.x1).toBeCloseTo(0, 6);
    expect(line.x2).toBeGreaterThan(0);
    expect(line.y2).toBeCloseTo(line.y1, 6);
  });

  it("keeps the connector inside the drawer's height for a sector pointing far off it", () => {
    const line = connectorLine(-Math.PI / 2, "right");
    expect(Math.abs(line.y2)).toBeLessThanOrEqual(Math.min(560, window.innerHeight - 32) / 2);
  });

  it("notifies the caller when the close button is used", () => {
    const onClose = vi.fn();
    openDrawer(overlay, { host: "optionsContent", title: "Options" }, "right", onClose);
    (overlay.querySelector(".mw-drawer-close") as HTMLElement).click();
    expect(onClose).toHaveBeenCalled();
  });
});
