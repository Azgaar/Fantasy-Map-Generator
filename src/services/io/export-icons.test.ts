// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { IconSets } from "@/components/icon-sets";
import { setViewportSize } from "@/components/viewport";
import { Styles } from "@/generators/styles";
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
      reliefSets: actual.IconSets.reliefSets.bind(actual.IconSets),
      load: vi.fn(),
      ensureAll: vi.fn().mockResolvedValue(undefined)
    }
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML =
    '<svg id="map" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs/><g id="viewbox"><g id="terrain"/><g id="goodsIcons"><use href="#good-custom-map" width="10" height="10"/></g></g></svg><svg id="defElements"><defs><g id="good-icons"><svg id="good-custom-map" viewBox="0 0 10 10"><path d="M1 1"/></svg></g></defs></svg>';
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
    let finish!: () => void;
    vi.mocked(IconSets.load).mockReturnValue(
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
    expect(IconSets.load).toHaveBeenCalledWith("relief-illustrated", { retry: true });
    expect(IconSets.load).toHaveBeenCalledWith("relief-gray", { retry: true });
    styles.relief.options.set = "colored";
    pack.relief[0] = { type: "grass", variant: 1, x: 1, y: 1, s: 4 };
    const defs = document.querySelector("#defElements defs")!;
    document.querySelector("#good-custom-map")!.innerHTML = '<path d="M99 99"/>';
    globalThis.pack = { relief: [] } as unknown as typeof pack;
    defs.insertAdjacentHTML(
      "beforeend",
      '<g id="icons-relief-illustrated"><symbol id="relief-illustrated-mountSnow-6" viewBox="0 0 100 100"><use href="#relief-illustrated-mountSnow-3" width="100" height="100"/></symbol><symbol id="relief-illustrated-mountSnow-3" viewBox="0 0 100 100"><path d="M2 2"/></symbol></g><g id="icons-relief-gray"><symbol id="relief-gray-hill-1" viewBox="0 0 100 100"><path/></symbol></g>'
    );
    finish();
    expect(await pending).toBe("blob:export");
    const output = serialize.mock.results.at(-1)!.value as string;
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
  vi.mocked(IconSets.load).mockRejectedValue(new Error("chunk failed"));
  await expect(ExportMap.getMapURL("png", { noScaleBar: true })).rejects.toThrow("chunk failed");
  expect(document.getElementById("fantasyMap")).toBeNull();
  expect(window.URL.createObjectURL).not.toHaveBeenCalled();
});

test.each(["svg", "png"])("%s export copies nested and cyclic definitions once", async type => {
  globalThis.pack = { relief: [] } as unknown as typeof pack;
  vi.mocked(IconSets.load).mockResolvedValue();
  document.querySelector("#good-custom-map")!.innerHTML = '<path d="M1 1"/><use href="#good-custom-nested"/>';
  document
    .querySelector("#defElements defs")!
    .insertAdjacentHTML("beforeend", '<symbol id="good-custom-nested"><use href="#good-custom-map"/></symbol>');

  const serialize = vi.spyOn(XMLSerializer.prototype, "serializeToString");
  await ExportMap.getMapURL(type, { fullMap: true, noScaleBar: true });
  const output = serialize.mock.results.at(-1)!.value as string;

  expect(output.match(/id="good-custom-map"/g)).toHaveLength(1);
  expect(output.match(/id="good-custom-nested"/g)).toHaveLength(1);
  expect(output).not.toContain("good-unknown");
  serialize.mockRestore();
});
