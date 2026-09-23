// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { IconSets } from "@/components/icon-sets";
import { setViewportSize } from "@/components/viewport";
import { Styles } from "@/generators/styles";
import "@/generators/burgs-generator"; // the models own the set definitions the export resolves ids against
import "@/generators/goods-generator";
import "@/generators/relief-generator";
import { drawRelief } from "@/renderers/draw-relief-icons";
import { ExportMap } from "./export";

vi.mock("@/components/layers", () => ({ Layers: { isOn: (id: string) => id === "relief", draw: vi.fn() } }));
vi.mock("@/services/fonts", () => ({ getUsedFonts: () => [], loadFontsAsDataURI: vi.fn() }));
vi.mock("@/components/icon-sets", async original => {
  const actual = await original<typeof import("@/components/icon-sets")>();
  return {
    ...actual,
    IconSets: {
      setForId: actual.IconSets.setForId.bind(actual.IconSets),
      containerId: actual.IconSets.containerId.bind(actual.IconSets),
      retry: vi.fn(),
      isLoaded: vi.fn(),
      loadAll: vi.fn()
    }
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(IconSets.retry).mockResolvedValue();
  vi.mocked(IconSets.isLoaded).mockReturnValue(true);
  vi.mocked(IconSets.loadAll).mockResolvedValue();
  document.body.innerHTML =
    '<svg id="map" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs/><g id="viewbox"><g id="terrain"/><g id="goodsIcons"><use href="#custom-goods-map" width="10" height="10"/></g></g></svg><svg id="defElements"><defs><svg id="custom-goods-map" viewBox="0 0 10 10"><path d="M1 1"/></svg></defs></svg>';
  globalThis.styles = Styles.parse(undefined);
  styles.relief.options.set = "simple";
  globalThis.pack = {
    relief: [
      { type: "mountSnow", variant: 6, x: 0, y: 0, s: 10 },
      { type: "hill", variant: 1, set: "gray", x: 10, y: 10, s: 10 }
    ]
  } as typeof pack;
  globalThis.customization = 0;
  setViewportSize(1000, 1000);
  window.URL.createObjectURL = vi.fn(() => "blob:export");
  window.URL.revokeObjectURL = vi.fn();
});

test.each(["svg", "png"])(
  "%s export waits and uses the start-of-export relief and custom goods snapshot",
  async type => {
    const terrain = document.querySelector("#terrain")!;
    terrain.setAttribute("stroke", "#aabbcc");
    terrain.setAttribute("stroke-width", "0.3");
    let finish!: () => void;
    vi.mocked(IconSets.retry).mockReturnValue(
      new Promise<void>(resolve => {
        finish = resolve;
      })
    );
    drawRelief();
    // The live DOM still shows the previous style; reconciliation must use the new descriptor ids.
    styles.relief.options.set = "illustrated";
    expect(styles.relief.options.set).toBe("illustrated");
    const serialize = vi.spyOn(XMLSerializer.prototype, "serializeToString");
    let done = false;
    const pending = ExportMap.getMapURL(type, { fullMap: type === "svg", noScaleBar: true }).then(url => {
      done = true;
      return url;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    expect(IconSets.retry).toHaveBeenCalledWith("relief-illustrated");
    expect(IconSets.retry).toHaveBeenCalledWith("relief-gray");
    styles.relief.options.set = "colored";
    pack.relief[0] = { type: "grass", variant: 1, x: 1, y: 1, s: 4 };
    const defs = document.querySelector("#defElements defs")!;
    document.querySelector("#custom-goods-map")!.innerHTML = '<path d="M99 99"/>';
    globalThis.pack = { relief: [] } as unknown as typeof pack;
    defs.insertAdjacentHTML(
      "beforeend",
      '<g id="icons-relief-illustrated"><symbol id="relief-illustrated-mountSnow-6" viewBox="0 0 100 100"><use href="#relief-illustrated-mountSnow-3" width="100" height="100"/></symbol><symbol id="relief-illustrated-mountSnow-3" viewBox="0 0 100 100"><path d="M2 2"/></symbol></g><g id="icons-relief-gray"><symbol id="relief-gray-hill-1" viewBox="0 0 100 100"><path/></symbol></g>'
    );
    finish();
    expect(await pending).toBe("blob:export");
    const output = serialize.mock.results.at(-1)!.value as string;
    expect(output).toContain('stroke="#aabbcc"');
    expect(output).toContain('stroke-width="0.3"');
    expect(output).toContain('id="relief-illustrated-mountSnow-3"');
    expect(output).toContain('id="relief-illustrated-mountSnow-6"');
    expect(output).toContain('id="relief-gray-hill-1"');
    expect(output).toContain('d="M1 1"');
    expect(output).not.toContain("M99");
    expect(output).not.toContain("relief-colored");
    expect(output).not.toContain("grass");
    expect(document.getElementById("fantasyMap")).toBeNull();
    serialize.mockRestore();
  }
);

test("failed icon chunks reject the export and clean up its clone", async () => {
  drawRelief();
  vi.mocked(IconSets.isLoaded).mockReturnValue(false);
  await expect(ExportMap.getMapURL("png", { noScaleBar: true })).rejects.toThrow("Failed to load relief-");
  expect(document.getElementById("fantasyMap")).toBeNull();
  expect(window.URL.createObjectURL).not.toHaveBeenCalled();
});

test.each(["svg", "png"])("%s export copies nested and cyclic definitions once", async type => {
  globalThis.pack = { relief: [] } as unknown as typeof pack;
  document.querySelector("#custom-goods-map")!.innerHTML = '<path d="M1 1"/><use href="#custom-goods-nested"/>';
  document
    .querySelector("#defElements defs")!
    .insertAdjacentHTML("beforeend", '<symbol id="custom-goods-nested"><use href="#custom-goods-map"/></symbol>');

  const serialize = vi.spyOn(XMLSerializer.prototype, "serializeToString");
  await ExportMap.getMapURL(type, { fullMap: true, noScaleBar: true });
  const output = serialize.mock.results.at(-1)!.value as string;

  expect(output.match(/id="custom-goods-map"/g)).toHaveLength(1);
  expect(output.match(/id="custom-goods-nested"/g)).toHaveLength(1);
  expect(output).not.toContain("goods-unknown");
  serialize.mockRestore();
});
