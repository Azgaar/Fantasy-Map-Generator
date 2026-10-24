// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

type DialogModule = typeof import("./dialog");
let Dialog: DialogModule["Dialog"];

beforeEach(async () => {
  localStorage.clear();
  document.body.innerHTML = `<button id="opener">open</button><div id="dialogs"></div>`;
  vi.resetModules(); // a fresh singleton and dialog state per test
  ({ Dialog } = await import("./dialog"));
});

function addContent(id: string, html = "<input id='field' /><button id='action'>Act</button>"): HTMLElement {
  document.getElementById("dialogs")!.insertAdjacentHTML("beforeend", `<div id="${id}" class="dialog">${html}</div>`);
  return document.getElementById(id)!;
}

const windowOf = (id: string) => document.getElementById(id)!.closest<HTMLElement>(".dialog-window")!;
const key = (target: Element, name: string, shiftKey = false) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true, cancelable: true }));
const pointer = (target: Element, type: string, clientX: number, clientY: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX, clientY, pointerId: 1, button: 0, bubbles: true }));

describe("Dialog", () => {
  it("wraps the content in a titled window without moving the focus", () => {
    addContent("test");
    document.getElementById("opener")!.focus();
    Dialog.open("test", { title: "Test Dialog", buttons: [{ label: "OK", onClick: () => {} }] });

    const element = windowOf("test");
    expect(element.parentElement?.id).toBe("dialogs");
    expect(element.getAttribute("role")).toBe("dialog");
    expect(element.querySelector(".dialog-title")?.textContent).toBe("Test Dialog");
    expect(element.querySelector(".dialog-buttonset")?.textContent).toBe("OK");
    expect(element.querySelectorAll(".dialog-resize")).toHaveLength(0);
    expect(document.activeElement?.id).toBe("opener");
    expect(Dialog.isOpen("test")).toBe(true);
  });

  it("updates an open dialog instead of creating a second window", () => {
    addContent("test");
    Dialog.open("test", { title: "First", resizable: true });
    expect(windowOf("test").querySelectorAll(".dialog-resize")).toHaveLength(8);
    Dialog.open("test", { title: "Second" });

    expect(document.querySelectorAll(".dialog-window")).toHaveLength(1);
    expect(windowOf("test").querySelector(".dialog-title")?.textContent).toBe("Second");
    expect(windowOf("test").querySelectorAll(".dialog-resize")).toHaveLength(0); // options are replaced, not merged
  });

  it("lets beforeClose veto, then closes once: callbacks, event, teardown and focus back to the opener", () => {
    const content = addContent("test");
    const onClose = vi.fn();
    const onEvent = vi.fn();
    let allow = false;
    content.addEventListener("dialog:close", onEvent);
    const opener = document.getElementById("opener")!;
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as never); // jsdom has no layout: make it visible
    opener.focus();
    Dialog.open("test", { beforeClose: () => allow, onClose });
    document.getElementById("field")!.focus();

    Dialog.close("test");
    expect(Dialog.isOpen("test")).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    allow = true;
    Dialog.close("test");
    Dialog.close("test");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".dialog-window")).toBeNull();
    expect(document.getElementById("test")).toBeNull();
    expect(document.activeElement?.id).toBe("opener");
  });

  it("closes from the titlebar button and from Escape unless closeOnEscape is off", () => {
    addContent("first");
    addContent("second", "<input id='secondField' />");
    Dialog.open("first");
    Dialog.open("second", { closeOnEscape: false });

    key(document.getElementById("secondField")!, "Escape");
    expect(Dialog.isOpen("second")).toBe(true);
    key(document.getElementById("field")!, "Escape");
    expect(Dialog.isOpen("first")).toBe(false);

    windowOf("second").querySelector<HTMLElement>(".dialog-titlebar-close")!.click();
    expect(Dialog.isOpen("second")).toBe(false);
  });

  it("closes all but the excepted and minimized dialogs", () => {
    addContent("editor").classList.add("stable");
    addContent("minimized");
    addContent("other");
    Dialog.open("editor");
    Dialog.open("minimized");
    Dialog.open("other");
    windowOf("minimized").querySelector<HTMLElement>(".dialog-titlebar-collapse")!.click();

    Dialog.closeAll(".stable");
    expect([Dialog.isOpen("editor"), Dialog.isOpen("minimized"), Dialog.isOpen("other")]).toEqual([true, true, false]);
  });

  it("minimizes to the titlebar, button pane included, and restores", () => {
    addContent("test");
    Dialog.open("test", { buttons: [{ label: "OK", onClick: () => {} }] });
    const collapse = windowOf("test").querySelector<HTMLElement>(".dialog-titlebar-collapse")!;

    collapse.click();
    expect(windowOf("test").classList.contains("dialog-minimized")).toBe(true);
    collapse.click();
    expect(windowOf("test").classList.contains("dialog-minimized")).toBe(false);
  });

  it("cycles Tab between the first and the last control", () => {
    addContent("test");
    Dialog.open("test", { resizable: false });
    const element = windowOf("test");
    const visible = [".dialog-titlebar-collapse", ".dialog-titlebar-close", "#field", "#action"];
    for (const selector of visible)
      vi.spyOn(element.querySelector(selector)!, "getClientRects").mockReturnValue([{}] as never);

    const action = document.getElementById("action")!;
    action.focus();
    key(action, "Tab");
    expect(document.activeElement).toBe(element.querySelector(".dialog-titlebar-collapse"));
    key(document.activeElement!, "Tab", true);
    expect(document.activeElement).toBe(action);
  });

  it("runs button callbacks and replaces the buttons on update", () => {
    addContent("test");
    const apply = vi.fn();
    Dialog.open("test", { buttons: [{ label: "Apply", onClick: apply, tip: "Apply it" }] });
    const button = windowOf("test").querySelector<HTMLElement>(".dialog-buttonset > button")!;
    expect(button.dataset.tip).toBe("Apply it");
    button.click();
    expect(apply).toHaveBeenCalledTimes(1);

    Dialog.update("test", {
      buttons: [
        { label: "A", onClick: () => {} },
        { label: "B", onClick: () => {} }
      ]
    });
    expect(windowOf("test").querySelectorAll(".dialog-buttonset > button")).toHaveLength(2);
    Dialog.update("test", { buttons: [] });
    expect(windowOf("test").querySelector(".dialog-buttonpane")).toBeNull();
  });

  it("hides a persistent dialog and shows the same content again", () => {
    const content = addContent("test");
    const onClose = vi.fn();
    Dialog.open("test", { persistent: true, onClose });
    Dialog.close("test");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(Dialog.isOpen("test")).toBe(false);
    expect(windowOf("test").hidden).toBe(true);
    Dialog.open("test");
    expect(Dialog.isOpen("test")).toBe(true);
    expect(document.getElementById("test")).toBe(content);
  });

  it("puts a modal dialog over an overlay that goes away with it", () => {
    addContent("test");
    Dialog.open("test", { modal: true });
    const overlay = document.querySelector<HTMLElement>(".dialog-overlay")!;
    expect(Number(overlay.style.zIndex)).toBe(Number(windowOf("test").style.zIndex) - 1);

    Dialog.close("test");
    expect(document.querySelector(".dialog-overlay")).toBeNull();
  });

  it("stacks the last opened or pressed dialog on top", () => {
    addContent("first");
    addContent("second");
    Dialog.open("first");
    Dialog.open("second");
    const z = (id: string) => Number(windowOf(id).style.zIndex);
    expect(z("second")).toBeGreaterThan(z("first"));

    pointer(windowOf("first"), "pointerdown", 0, 0);
    expect(z("first")).toBeGreaterThan(z("second"));
  });

  it("remembers a dragged position and forgets it on reset", async () => {
    addContent("test");
    Dialog.open("test", { position: { my: "left top", at: "left+10 top+10", of: window } });
    const element = windowOf("test");
    const titlebar = element.querySelector<HTMLElement>(".dialog-titlebar")!;
    const reset = element.querySelector<HTMLElement>(".dialog-titlebar-reset")!;
    expect([element.style.left, element.style.top]).toEqual(["10px", "10px"]);
    expect(reset.hidden).toBe(true);

    pointer(titlebar, "pointerdown", 100, 100);
    pointer(titlebar, "pointermove", 150, 130);
    pointer(titlebar, "pointerup", 150, 130);
    expect([element.style.left, element.style.top]).toEqual(["60px", "40px"]);
    expect(JSON.parse(localStorage.getItem("fmg-dialog-state")!).test.position).toEqual({ left: 60, top: 40 });
    expect(reset.hidden).toBe(false);

    reset.click();
    expect([element.style.left, element.style.top]).toEqual(["10px", "10px"]);
    expect(reset.hidden).toBe(true);
  });

  it("does not start a drag from the titlebar buttons", () => {
    addContent("test");
    Dialog.open("test", { position: { my: "left top", at: "left top", of: window } });
    const close = windowOf("test").querySelector<HTMLElement>(".dialog-titlebar-close")!;

    pointer(close, "pointerdown", 100, 100);
    pointer(close, "pointermove", 150, 150);
    pointer(close, "pointerup", 150, 150);
    expect(windowOf("test").style.left).toBe("0px");
  });

  it("resizes from an edge within the size bounds and reports the end", () => {
    addContent("test");
    const onResize = vi.fn();
    Dialog.open("test", {
      width: 300,
      minWidth: 200,
      maxWidth: 400,
      resizable: true,
      onResize,
      position: { of: window }
    });
    const element = windowOf("test");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 300, 200));
    const east = element.querySelector<HTMLElement>(".dialog-resize-e")!;

    pointer(east, "pointerdown", 400, 150);
    pointer(east, "pointermove", 450, 150);
    expect(element.style.width).toBe("350px");
    pointer(east, "pointermove", 702, 150);
    expect(element.style.width).toBe("400px");
    pointer(east, "pointerup", 702, 150);
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it("forgets a window removed without closing, so the next open builds a new one", () => {
    addContent("test");
    Dialog.open("test");
    windowOf("test").remove();
    expect(Dialog.isOpen("test")).toBe(false);

    addContent("test");
    Dialog.open("test");
    expect(Dialog.isOpen("test")).toBe(true);
    expect(document.querySelectorAll(".dialog-window")).toHaveLength(1);
  });
});

describe("Dialog messages", () => {
  const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".dialog-buttonset > button"));

  it("shows each message in a window of its own, removed when a button closes it", () => {
    const first = Dialog.message({ message: "First" });
    const second = Dialog.message({ title: "Done", message: "<b>Second</b>" });

    expect(document.querySelectorAll(".dialog-window")).toHaveLength(2);
    expect(second.innerHTML).toBe("<b>Second</b>");
    expect(second.closest(".dialog-window")!.querySelector(".dialog-title")?.textContent).toBe("Done");
    expect(first.closest(".dialog-window")!.querySelector(".dialog-title")?.textContent).toBe("Warning");

    second.closest(".dialog-window")!.querySelector<HTMLButtonElement>(".dialog-buttonset > button")!.click();
    expect(document.querySelectorAll(".dialog-window")).toHaveLength(1);
    expect(first.isConnected).toBe(true);
  });

  it("keeps the window open when a button handler returns false", () => {
    let valid = false;
    const onClick = vi.fn(() => valid);
    const text = Dialog.message({ message: "Pick one", buttons: [{ label: "Apply", onClick }] });

    buttons()[0].click();
    expect(text.isConnected).toBe(true);
    valid = true;
    buttons()[0].click();
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(text.isConnected).toBe(false);
  });

  it("takes an element as the message and an id to address the window", () => {
    const chart = document.createElement("svg");
    Dialog.message({ id: "chart", message: chart, buttons: [] });
    expect(document.getElementById("chart")?.contains(chart)).toBe(true);
    expect(document.querySelector(".dialog-buttonpane")).toBeNull();

    Dialog.message({ id: "chart", message: "Replaced" });
    expect(document.querySelectorAll(".dialog-window")).toHaveLength(1);
    Dialog.close("chart");
    expect(document.getElementById("chart")).toBeNull();
  });

  it("confirms from its button or Enter, unless Cancel has the focus", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    Dialog.confirm({ title: "Test", message: "Proceed?", onConfirm, onCancel });
    expect(buttons().map(button => button.textContent)).toEqual(["Continue", "Cancel"]);
    expect(document.activeElement).toBe(buttons()[0]);

    buttons()[1].focus();
    key(buttons()[1], "Enter");
    expect(onConfirm).not.toHaveBeenCalled();
    buttons()[0].focus();
    key(buttons()[0], "Enter");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector(".dialog-window")).toBeNull();
  });

  it("skips the question on a Shift-click", () => {
    const onConfirm = vi.fn();
    Dialog.confirm({ onConfirm, event: new MouseEvent("click", { shiftKey: true }) });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".dialog-window")).toBeNull();
  });

  it("asks in a standard window and hands a valid value to the callback on Confirm or Enter", () => {
    const callback = vi.fn();
    Dialog.prompt("How many?", { default: 3, min: 1 }, callback);
    const input = document.querySelector<HTMLInputElement>("#prompt input")!;
    expect(windowOf("prompt").querySelector(".dialog-title")?.textContent).toBe("Enter value");
    expect([input.type, input.value, document.activeElement === input]).toEqual(["number", "3", true]);

    input.value = "0";
    buttons()[0].click();
    expect(callback).not.toHaveBeenCalled();
    expect(Dialog.isOpen("prompt")).toBe(true);

    input.value = "5";
    key(input, "Enter");
    expect(callback).toHaveBeenCalledExactlyOnceWith(5);
    expect(document.getElementById("prompt")).toBeNull();
  });

  it("leaves the focus in a window opened by a closing one's button", () => {
    const opener = document.getElementById("opener")!;
    vi.spyOn(opener, "getClientRects").mockReturnValue([{}] as never);
    opener.focus();
    Dialog.confirm({ onConfirm: () => Dialog.prompt("How many?", { default: 1 }, () => {}) });
    key(buttons()[0], "Enter");

    expect(document.activeElement).toBe(document.querySelector("#prompt input"));
  });

  it("fills and restores the viewport in fullscreen", () => {
    addContent("test");
    Dialog.open("test", { width: 300, position: { my: "left top", at: "left+40 top+30", of: window } });
    Dialog.update("test", { fullscreen: true });
    expect([windowOf("test").style.left, windowOf("test").style.top]).toEqual(["0px", "0px"]);
    expect(windowOf("test").style.width).toBe(`${window.innerWidth}px`);

    Dialog.update("test", { fullscreen: false });
    expect([windowOf("test").style.left, windowOf("test").style.top, windowOf("test").style.width]).toEqual([
      "40px",
      "30px",
      "300px"
    ]);
  });

  it("keeps messages open when asked to close the rest", () => {
    addContent("editor");
    Dialog.open("editor");
    Dialog.message({ message: "Saving" });
    Dialog.closeAll(undefined, { keepMessages: true });
    expect(Dialog.isOpen("editor")).toBe(false);
    expect(document.querySelectorAll(".dialog-window")).toHaveLength(1);
  });

  it("destroys a dialog without its close callbacks", () => {
    addContent("test");
    const onClose = vi.fn();
    Dialog.open("test", { onClose });
    Dialog.destroy("test");
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector(".dialog-window")).toBeNull();
    expect(Dialog.isOpen("test")).toBe(false);
  });
});
