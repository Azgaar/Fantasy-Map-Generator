import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Controllers } from "@/controllers";
import { selectionsAt, setSelection } from "@/services/agent/map-tools";
import { openHere } from "./assistant-here";

vi.mock("@/controllers", () => ({ Controllers: { HelpAssistant: { open: vi.fn().mockResolvedValue(undefined) } } }));
vi.mock("@/utils", () => ({ getPointer: () => [120, 240] }));
vi.mock("@/services/agent/map-tools", () => ({ selectionsAt: vi.fn(), setSelection: vi.fn() }));
const subjects = [
  { target: "burg:1", label: "Town", mapId: "map", cell: 4, x: 120, y: 240 },
  { target: "cell:4", label: "Location", mapId: "map", cell: 4, x: 120, y: 240 }
];
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML =
    '<button id="original">Menu</button><svg id="viewbox"><path id="land"/></svg><textarea id="helpMapInput"></textarea>';
  vi.mocked(selectionsAt).mockReturnValue(subjects);
});
afterEach(() => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
});
function rightClick(target = "land") {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10000, clientY: 10000 });
  document.getElementById(target)!.dispatchEvent(event);
  return event;
}
describe("Here assistant entry", () => {
  it("opens a conventional menu without contacting a model or replacing existing controls", () => {
    expect(rightClick().defaultPrevented).toBe(true);
    expect(document.getElementById("assistantHere")).not.toBeNull();
    expect(document.getElementById("original")).not.toBeNull();
    expect(Controllers.HelpAssistant.open).not.toHaveBeenCalled();
    expect(setSelection).not.toHaveBeenCalled();
    expect(selectionsAt).toHaveBeenCalledWith(120, 240, document.getElementById("land"));
  });
  it("attaches the selected subject to the same assistant without sending a prompt", async () => {
    rightClick();
    const menu = document.getElementById("assistantHere")!;
    const select = menu.querySelector("select")!;
    select.value = "1";
    select.dispatchEvent(new Event("change"));
    const buttons = [...menu.querySelectorAll("button")];
    expect(buttons.find(b => b.textContent === "Draft a note…")?.disabled).toBe(true);
    buttons.find(b => b.textContent === "Use as assistant context")!.click();
    await Promise.resolve();
    expect(setSelection).toHaveBeenCalledWith(subjects[1]);
    expect(Controllers.HelpAssistant.open).toHaveBeenCalledTimes(1);
    expect((document.getElementById("helpMapInput") as HTMLTextAreaElement).value).toBe("");
    expect(document.getElementById("assistantHere")).toBeNull();
  });
  it("leaves non-map context menus alone and dismisses with Escape", () => {
    expect(rightClick("original").defaultPrevented).toBe(false);
    expect(document.getElementById("assistantHere")).toBeNull();
    rightClick();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("assistantHere")).toBeNull();
    expect(openHere).toBeTypeOf("function");
  });
});
