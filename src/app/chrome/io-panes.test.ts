// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import type { BrowserSave } from "@/services/io/browser-saves";
import { DIALOGS_MARKUP, dialogButton } from "@/ui/dialog/dialog-testing";

const services = vi.hoisted(() => ({
  BrowserSaves: { list: vi.fn(), remove: vi.fn(async () => {}), download: vi.fn() },
  Load: { loadFromBrowser: vi.fn() },
  Cloud: { isConnected: async () => false }
}));
vi.mock("@/services", () => ({ Services: services }));
vi.mock("@/model/options/options-model", () => ({ Options: { set: vi.fn() } }));
vi.mock("@/renderers/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn() }));

const save = (id: string, kind: BrowserSave["kind"], name: string): BrowserSave => ({
  id,
  kind,
  name,
  mapId: 1,
  version: "1.0.0",
  savedAt: Date.UTC(2026, 10, 9),
  size: 2 * 1024 * 1024
});

const rows = () => Array.from(document.querySelectorAll<HTMLElement>("#browserSaves .browserSave"));

async function openLoadPane(saves: BrowserSave[]): Promise<void> {
  services.BrowserSaves.list.mockResolvedValue(saves);
  const { showLoadPane } = await import("./io-panes");
  await showLoadPane();
  await vi.waitFor(() => expect(document.getElementById("browserSaves")?.innerHTML).not.toBe(""));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = DIALOGS_MARKUP;
});

it("lists browser saves with their actions", async () => {
  await openLoadPane([save("autosave-2", "auto", "<b>Angria</b>"), save("lastMap", "quick", "")]);

  expect(rows().map(row => row.dataset.id)).toEqual(["autosave-2", "lastMap"]);
  expect(rows()[0].textContent).toContain("<b>Angria</b>"); // the name is text, never markup
  expect(rows()[0].textContent).toContain("2 MB");
  expect(rows()[1].textContent).toContain("Unnamed");

  rows()[0].querySelector<HTMLElement>(".browserSaveName")?.click(); // the whole row loads
  expect(services.Load.loadFromBrowser).toHaveBeenCalledWith("autosave-2");

  rows()[1].querySelector<HTMLElement>('[data-action="downloadBrowserSave"]')?.click();
  expect(services.BrowserSaves.download).toHaveBeenCalledWith("lastMap");
  expect(services.Load.loadFromBrowser).toHaveBeenCalledTimes(1); // an action icon never loads
});

it("removes a save only after confirmation, then refreshes the list", async () => {
  await openLoadPane([save("lastMap", "quick", "Angria")]);

  rows()[0].querySelector<HTMLElement>('[data-action="removeBrowserSave"]')?.click();
  expect(services.BrowserSaves.remove).not.toHaveBeenCalled();

  services.BrowserSaves.list.mockResolvedValue([]);
  dialogButton("Remove").click();
  expect(services.BrowserSaves.remove).toHaveBeenCalledWith("lastMap");
  await vi.waitFor(() => expect(rows()).toHaveLength(0));
  expect(document.getElementById("browserSaves")?.textContent).toBe("No maps saved in the browser");
});

it("drops the list when the dialog closes", async () => {
  await openLoadPane([save("lastMap", "quick", "Angria")]);
  const { Dialog } = await import("@/ui/dialog/dialog"); // the instance the freshly imported pane uses
  Dialog.close("loadMapData");
  expect(document.getElementById("browserSaves")?.childElementCount).toBe(0);
});
