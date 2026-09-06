import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import { BANDS, boxRadius } from "../../src/components/map-wheel/geometry";

// The map wheel is a radial context controller opened by right-clicking the map. Unit tests cover
// the geometry, the menu tree and the drawer's borrow/restore in isolation; only a browser can
// prove that a sector actually flips a layer, opens a real editor, and hands the borrowed
// #optionsContent back to #options afterwards.
//
// Most sectors are activated with the KEYBOARD here, not the mouse: arrowing to a named label is
// deterministic where hitting a wedge by coordinates is not. Mouse and keyboard share one dispatcher
// (`dispatch` in wheel.ts), so the coverage is the same for everything downstream of the click, and
// "activates a sector from a mouse click" below covers the mouse path itself. Hover, right-click,
// outside click, Escape and the hub tabs are all driven with the real mouse.

let context: BrowserContext;
let page: Page;

interface SectorInfo {
  level: number;
  index: number;
  text: string;
  note: string;
  hot: boolean;
}

// One ring per level, so a sector's level can be read back off its own arc: `d` starts at the
// band's inner radius. Labels live in a sibling layer, appended in the same order as the paths.
//
// Neither the radii nor the hot fill are constants any more: the bands carry the clamped uiSize and
// the fills follow the app's theme. The scale is published on .mw-wheel and the band table is
// imported, rather than hardcoding numbers the app can move.
const readSectors = (): Promise<SectorInfo[]> =>
  page.evaluate(base => {
    const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
    const style = getComputedStyle(wheel);
    const ui = Number.parseFloat(style.getPropertyValue("--mw-ui")) || 1;
    const INNER = base.map(band => band[0] * ui);
    const HOT = ["--mw-fill-hot", "--mw-fill-danger"].map(name => style.getPropertyValue(name).trim());
    const paths = [...document.querySelectorAll<SVGPathElement>("#mapWheel path.mw-sector")];
    const labels = [...document.querySelectorAll<HTMLElement>("#mapWheel .mw-labels > .mw-label")];
    const counts = [0, 0, 0, 0];

    return paths.map((path, i) => {
      const [x, y] = path.getAttribute("d")!.slice(2).split(" ").slice(0, 2).map(Number);
      const radius = Math.hypot(x, y);
      let level = 0;
      for (let l = 1; l < INNER.length; l++) {
        if (Math.abs(radius - INNER[l]) < Math.abs(radius - INNER[level])) level = l;
      }
      const label = labels[i];
      return {
        level,
        index: counts[level]++,
        text: label?.querySelector("span:not(.mw-note)")?.textContent ?? "",
        note: label?.querySelector(".mw-note")?.textContent ?? "",
        hot: HOT.includes(path.getAttribute("fill")!)
      };
    });
  }, BANDS as unknown as number[][]);

const press = async (key: string, times: number): Promise<void> => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

/** Arrow to the sector the predicate picks out, then Enter. Throws if no sector matches. */
const activate = async (match: (sector: SectorInfo) => boolean): Promise<SectorInfo> => {
  const sectors = await readSectors();
  const target = sectors.find(match);
  if (!target) throw new Error(`no sector matched; on screen: ${sectors.map(s => s.text).join(", ")}`);

  const hot = sectors.find(s => s.hot) ?? null;
  const ringSize = sectors.filter(s => s.level === target.level).length;

  if (hot?.level === target.level) {
    await press("ArrowRight", (target.index - hot.index + ringSize) % ringSize);
  } else {
    const from = hot?.level ?? 0;
    if (target.level === 0 && !hot) await press("ArrowRight", target.index + 1);
    else {
      await press("ArrowDown", target.level - from);
      await press("ArrowRight", target.index);
    }
  }

  await page.keyboard.press("Enter");
  return target;
};

const byLabel = (label: string) => (sector: SectorInfo) => sector.text === label;

const openWheel = async (x = 640, y = 380): Promise<void> => {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.locator("#mapWheel")).toBeAttached();
  // park the pointer clear of the ring: a sector under the pointer is hot, and that is the same
  // `hot` the arrow keys move, so a resting pointer would decide where the keyboard starts from
  await page.mouse.move(2, 2);
};

// The wheel opens on MENU, so the HERE channel is one hub click in
const menuTab = async (): Promise<void> => {
  await page.locator("#mapWheel .mw-tab", { hasText: "menu" }).click();
  await page.mouse.move(2, 2);
};

const hereTab = async (): Promise<void> => {
  await page.locator("#mapWheel .mw-tab", { hasText: "here" }).click();
  await page.mouse.move(2, 2);
};

const closeDialogs = (): Promise<void> =>
  page.evaluate(() => {
    for (const close of document.querySelectorAll<HTMLElement>(".ui-dialog .ui-dialog-titlebar-close")) close.click();
  });

test.describe.configure({ mode: "serial" });

test.describe("map wheel", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/?seed=test-seed&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test.afterEach(async () => {
    await page.keyboard.press("Escape");
    await closeDialogs();
    await page.mouse.move(2, 2);
  });

  test("opens on right-click at the pointer and closes on Escape", async () => {
    await openWheel(700, 400);
    const origin = await page.locator("#mapWheel .mw-origin").evaluate(el => [el.style.left, el.style.top]);
    expect(origin).toEqual(["700px", "400px"]);

    await page.keyboard.press("Escape");
    await expect(page.locator("#mapWheel")).toHaveCount(0);
  });

  test("renders every label with a resolved icon glyph", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Tools"));
    await activate(byLabel("Edit"));

    // one icon per sector, and every one of them has to resolve to a glyph in public/icons.css
    const icons = page.locator("#mapWheel .mw-label i");
    const sectorCount = (await readSectors()).length;
    expect(sectorCount).toBeGreaterThan(20);
    expect(await icons.count()).toBe(sectorCount);
    const unresolved = await icons.evaluateAll(nodes =>
      nodes
        .filter(node => {
          const content = getComputedStyle(node, "::before").content;
          return !content || content === "none" || content === "normal" || content === '""';
        })
        .map(node => node.className)
    );
    expect(unresolved).toEqual([]);
  });

  test("toggles a real layer in place without closing the ring", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Layers"));
    await activate(byLabel("Political"));

    const before = await page.evaluate(() => (window as any).Layers.isOn("borders"));
    await activate(byLabel("Borders"));
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => (window as any).Layers.isOn("borders"));
    expect(after).toBe(!before);

    // the ring is the layer panel's status display: it stays open and repaints the sector in place
    await expect(page.locator("#mapWheel")).toBeAttached();
    const borders = (await readSectors()).find(byLabel("Borders"))!;
    expect(borders.note).toBe(after ? "on" : "off");

    // put it back
    await activate(byLabel("Borders"));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as any).Layers.isOn("borders"))).toBe(before);
  });

  test("fans a ring per level with a spine between each", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Tools"));
    await activate(byLabel("Regenerate"));
    await activate(byLabel("Society"));

    const sectors = await readSectors();
    expect(new Set(sectors.map(s => s.level))).toEqual(new Set([0, 1, 2, 3]));
    await expect(page.locator("#mapWheel line.mw-spine")).toHaveCount(3);
    expect(sectors.filter(s => s.level === 3).map(s => s.text)).toContain("Emblems");
  });

  test("opens the options form in the drawer and gives it back on close", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Options"));
    await activate(byLabel("Realms"));

    await expect(page.locator("#mapWheelDrawer #optionsContent")).toBeAttached();
    await expect(page.locator("#mapWheel line.mw-connector")).toHaveCount(1);

    // Exactly the Realms theme's rows, in order - every other options row is hidden while borrowed.
    // Asserted on RENDERED state, not on `row.hidden`: the drawer's `display: block` overrides are
    // author rules and used to beat the UA stylesheet's [hidden]{display:none}, so the property was
    // set on all 22 other rows and every one of them still drew.
    const wanted = ["statesNumber", "provincesRatio", "sizeVariety", "growthRate", "manorsInput"];
    const shown = await page
      .locator("#optionsContent tr")
      .evaluateAll(rows =>
        rows
          .filter(row => getComputedStyle(row).display !== "none")
          .map(row => [...row.querySelectorAll("[id]")].map(el => el.id))
      );
    expect(shown.map(ids => wanted.find(id => ids.includes(id)) ?? ids.join("+"))).toEqual(wanted);

    // a row from another theme, and the table plus heading the filter emptied, are really gone
    await expect(page.locator("#mapWheelDrawer #culturesInput")).toBeHidden();
    const emptied = await page
      .locator("#optionsContent table, #optionsContent > p")
      .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display === "none"));
    expect(emptied).toContain(true);
    expect(emptied).toContain(false);

    await page.keyboard.press("Escape");
    await expect(page.locator("#options > #optionsContent")).toBeAttached();
    // and nothing keeps a `hidden` the drawer set - on rows, on tables or on the headings
    const leaked = await page
      .locator("#optionsContent tr, #optionsContent table, #optionsContent p")
      .evaluateAll(nodes => nodes.filter(node => (node as HTMLElement).hidden).map(node => node.tagName));
    expect(leaked).toEqual([]);
  });

  test("opens a drawer from a keyboard Enter on a panel node", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("About"));

    await expect(page.locator("#mapWheelDrawer #aboutContent")).toBeAttached();
    await expect(page.locator("#mapWheelDrawer .mw-drawer-title")).toHaveText("About");
  });

  // The drawer used to be a child of #mapWheel, which is `position: fixed; inset: 0`, so its
  // `left: calc(50% + 260px)` resolved against the VIEWPORT: with the ring at x=300 in a 1280px
  // window the drawer landed at 900 instead of 560, connector dangling into empty space. Every
  // other drawer test opens at the viewport centre, where the bug cancels out - so this one does not.
  test("hangs the drawer off the ring when the wheel is well off-centre", async () => {
    await openWheel(300, 380);
    await menuTab();
    await activate(byLabel("About"));
    await expect(page.locator("#mapWheelDrawer #aboutContent")).toBeAttached();
    await page.waitForTimeout(300); // let the 140ms slide-in settle before measuring

    const wheel = (await page.locator("#mapWheel .mw-wheel").boundingBox())!;
    const drawer = (await page.locator("#mapWheelDrawer").boundingBox())!;
    const centre = { x: wheel.x + wheel.width / 2, y: wheel.y + wheel.height / 2 };
    expect(centre.x).toBeLessThan(page.viewportSize()!.width / 2 - 200); // really off-centre

    // clear of the ring's centre by exactly the --mw-drawer-offset the wheel published
    const [offset, ui] = await page.locator("#mapWheel .mw-wheel").evaluate(el => {
      const style = getComputedStyle(el);
      return [
        Number.parseFloat(style.getPropertyValue("--mw-drawer-offset")),
        Number.parseFloat(style.getPropertyValue("--mw-ui"))
      ];
    });
    // clear of the outer ring at the scale actually rendered, not of some old constant
    expect(offset).toBeGreaterThan(BANDS[3][1] * ui);
    const side = await page.locator("#mapWheelDrawer").getAttribute("data-side");
    const gap = side === "right" ? drawer.x - centre.x : centre.x - (drawer.x + drawer.width);
    expect(gap).toBeCloseTo(offset, -1);
    expect(drawer.y + drawer.height / 2).toBeCloseTo(centre.y, -1);

    // and the whole of it is still on screen, which is what clampCentre's drawer reservation buys
    const viewport = page.viewportSize()!;
    expect(drawer.x).toBeGreaterThanOrEqual(0);
    expect(drawer.x + drawer.width).toBeLessThanOrEqual(viewport.width);
    expect(drawer.y).toBeGreaterThanOrEqual(0);
    expect(drawer.y + drawer.height).toBeLessThanOrEqual(viewport.height);

    await page.keyboard.press("Escape");
    await expect(page.locator("#options > #aboutContent")).toBeAttached();
  });

  test("keeps the drawer and its connector open across a hover", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Options"));
    await activate(byLabel("Realms"));
    await expect(page.locator("#mapWheelDrawer #optionsContent")).toBeAttached();

    // hovering repaints sectors in place and must not disturb the structure: the drawer, its
    // connector and the entry animation's finished state all have to survive the pointer resting
    const sectors = await readSectors();
    const peoples = sectors.find(byLabel("Peoples"))!;
    expect(peoples.level).toBe(1);
    const point = await page
      .locator("#mapWheel .mw-labels > .mw-label")
      .nth(sectors.findIndex(byLabel("Peoples")))
      .evaluate(el => {
        const box = el.getBoundingClientRect();
        return [box.x + box.width / 2, box.y + box.height / 2];
      });
    await page.mouse.move(point[0], point[1]);
    await expect.poll(async () => (await readSectors()).find(byLabel("Peoples"))?.hot, { timeout: 2000 }).toBe(true);

    await expect(page.locator("#mapWheelDrawer #optionsContent")).toBeAttached();
    await expect(page.locator("#mapWheel line.mw-connector")).toHaveCount(1);

    // the ring must be VISIBLE while hovered. A hover rebuild restarts the mw-fan entry animation
    // on a fresh <svg> every frame, which pins the whole ring near scale(.86)/opacity 0.
    await page.waitForTimeout(400);
    const painted = await page.locator("#mapWheel .mw-svg").evaluate(el => {
      const style = getComputedStyle(el);
      return { opacity: Number(style.opacity), scale: new DOMMatrix(style.transform).a };
    });
    expect(painted.opacity).toBe(1);
    expect(painted.scale).toBeCloseTo(1, 2);

    await page.mouse.move(2, 2);
    await page.keyboard.press("Escape");
    await expect(page.locator("#options > #optionsContent")).toBeAttached();
  });

  // The ported code built the coat-of-arms id as `burgCoA<id>` where this fork uses `burgCOA<id>`,
  // and passed too few arguments to a controller whose parameters are all optional - so the call
  // compiled and silently did nothing. Nothing but a browser catches that.
  test("opens the emblem editor for a burg, a province and a state", async () => {
    const spot = await page.evaluate(() => {
      const pack = (window as any).pack;
      const ctm = (document.getElementById("viewbox") as any).getScreenCTM();
      for (const burg of pack.burgs) {
        if (!burg.i || burg.removed || !burg.coa) continue;
        const province = pack.provinces[pack.cells.province[burg.cell]];
        const state = pack.states[pack.cells.state[burg.cell]];
        if (!province?.coa || !state?.coa) continue;
        const point = new DOMPoint(burg.x, burg.y).matrixTransform(ctm);
        if (point.x < 300 || point.x > 980 || point.y < 200 || point.y > 560) continue;
        return { x: Math.round(point.x), y: Math.round(point.y), burg: burg.i, province: province.i, state: state.i };
      }
      return null;
    });
    expect(spot, "no burg with a province and a state under the same click").not.toBeNull();

    // the id the editor is opened on is the whole point: the ported code spelled it `burgCoA<id>`
    // where this fork uses `burgCOA<id>`, and the wrong id silently opened nothing
    const expected = {
      Burg: `#burgCOA${spot!.burg}`,
      Province: `#provinceCOA${spot!.province}`,
      State: `#stateCOA${spot!.state}`
    };

    for (const kind of ["Burg", "Province", "State"] as const) {
      await closeDialogs();
      await expect(page.locator("#emblemEditor")).toHaveCount(0);

      await openWheel(spot!.x, spot!.y);
      await hereTab();
      // the top-ranked subject may be any of them, so walk "What's here" to the one under test
      await activate(byLabel("What's here"));
      const picked = await activate(sector => sector.level === 1 && sector.note === kind);
      expect(picked.note).toBe(kind);

      await activate(byLabel("Emblem"));
      await expect(page.locator("#emblemEditor")).toBeVisible();
      await expect(page.locator("#emblemImage")).toHaveAttribute("href", expected[kind]);
      expect((await page.locator("#emblemArmiger").textContent())?.trim()).toBeTruthy();
      await expect(page.locator("#mapWheel")).toHaveCount(0);
    }
    await closeDialogs();
  });

  // The overflow bug this guards, and the only place it can be settled: a label is an upright box,
  // so a sector at 3 o'clock spends the band's radial DEPTH on the label's widest text line while
  // one at 12 o'clock spends it on the whole stack. Sizing labels against the arc alone left ink
  // outside the sector on 141 of 882 placements, worst 9.5px on "World configuration".
  //
  // Measured on the ink actually painted - each text LINE's rect, clipped by the box that clamps it -
  // against the sector the label belongs to, at both ends of the uiSize range.
  const measureInk = (): Promise<{ worst: number; where: string; placements: number }> =>
    page.evaluate(base => {
      const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
      const ui = Number.parseFloat(getComputedStyle(wheel).getPropertyValue("--mw-ui")) || 1;
      const box = wheel.getBoundingClientRect();
      const [ox, oy] = [box.x + box.width / 2, box.y + box.height / 2];
      const paths = [...wheel.querySelectorAll<SVGPathElement>("path.mw-sector")];
      const labels = [...wheel.querySelectorAll<HTMLElement>(".mw-labels > .mw-label")];
      const norm = (a: number) => {
        let v = a;
        while (v > Math.PI) v -= Math.PI * 2;
        while (v < -Math.PI) v += Math.PI * 2;
        return v;
      };

      let worst = Number.NEGATIVE_INFINITY;
      let where = "";
      paths.forEach((path, i) => {
        const d = path.getAttribute("d")!.split(/ +/);
        const from = Math.atan2(Number(d[2]), Number(d[1]));
        const to = Math.atan2(Number(d[16]), Number(d[15]));
        let wedge = to - from;
        while (wedge <= 0) wedge += Math.PI * 2;
        const mid = from + wedge / 2;
        // the ring this sector belongs to, from the radius its arc starts at
        const radius = Math.hypot(Number(d[1]), Number(d[2]));
        const level = base
          .map((band, l) => [Math.abs(radius - band[0] * ui), l])
          .sort((a, b) => a[0] - b[0])[0][1];
        const [inner, outer] = [base[level][0] * ui, base[level][1] * ui];

        for (const child of [...labels[i].children] as HTMLElement[]) {
          const clip = child.getBoundingClientRect();
          const rects: DOMRect[] = [];
          if (child.tagName === "I") rects.push(clip);
          else {
            const range = document.createRange();
            range.selectNodeContents(child);
            for (const line of [...range.getClientRects()]) {
              const [l, r] = [Math.max(line.left, clip.left), Math.min(line.right, clip.right)];
              const [t, b] = [Math.max(line.top, clip.top), Math.min(line.bottom, clip.bottom)];
              if (r > l && b > t) rects.push(new DOMRect(l, t, r - l, b - t));
            }
          }
          for (const rect of rects) {
            for (const [cx, cy] of [
              [rect.left, rect.top],
              [rect.right, rect.top],
              [rect.left, rect.bottom],
              [rect.right, rect.bottom]
            ]) {
              const [x, y] = [cx - ox, cy - oy];
              const r = Math.hypot(x, y);
              const off = Math.abs(norm(Math.atan2(y, x) - mid));
              const bad = Math.max(r - outer, inner - r, (off - wedge / 2) * r);
              if (bad > worst) {
                worst = bad;
                where = `"${labels[i].textContent}" (level ${level}, ${Math.round((mid * 180) / Math.PI)}deg)`;
              }
            }
          }
        }
      });
      return { worst, where, placements: paths.length };
    }, BANDS as unknown as number[][]);

  test("keeps every label's ink inside its own sector", async () => {
    for (const uiSize of ["0.8", "1", "2"]) {
      await page.evaluate(v => {
        (document.getElementById("uiSize") as HTMLInputElement).value = v;
      }, uiSize);

      // the rings that hold the tree's hardest labels: the layer toggles carry a note line, Edit is
      // the 15-item ring, and the HERE root is the one with the longest action names
      for (const drill of [
        ["Layers", "Decoration"],
        ["Tools", "Edit"],
        ["Options"]
      ]) {
        await openWheel();
        await menuTab();
        for (const step of drill) await activate(byLabel(step));
        const ink = await measureInk();
        expect(ink.placements).toBeGreaterThan(4);
        expect(ink.worst, `uiSize ${uiSize}, ${drill.join(" > ")}: ${ink.where} spills`).toBeLessThanOrEqual(0);
        await page.keyboard.press("Escape");
      }

      await openWheel();
      await hereTab();
      await activate(byLabel("What's here"));
      const here = await measureInk();
      expect(here.worst, `uiSize ${uiSize}, HERE: ${here.where} spills`).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");
    }

    await page.evaluate(() => {
      (document.getElementById("uiSize") as HTMLInputElement).value = "1";
    });
  });

  test("marks a parent sector with a tick instead of a line of label text", async () => {
    await openWheel();
    await menuTab();
    // five root sectors, four of which open a child ring; About opens the drawer instead
    expect(await page.locator("#mapWheel path.mw-mark").count()).toBe(4);
    expect(await page.locator("#mapWheel .mw-label .mw-note").count()).toBe(0);

    // and the tick is drawn inside the band it belongs to, not over the map
    const outside = await page.locator("#mapWheel path.mw-mark").evaluateAll((marks, band) => {
      const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
      const ui = Number.parseFloat(getComputedStyle(wheel).getPropertyValue("--mw-ui")) || 1;
      return marks.filter(mark =>
        [...mark.getAttribute("d")!.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].some(m => {
          const r = Math.hypot(Number(m[1]), Number(m[2]));
          return r > band[1] * ui || r < band[0] * ui;
        })
      ).length;
    }, BANDS[0] as unknown as number[]);
    expect(outside).toBe(0);
  });

  // uiSize is the app's own sizing control; the wheel follows it, then refuses to outgrow the window
  test("grows with uiSize and clamps at the viewport", async () => {
    const boxAt = async (uiSize: string): Promise<number> => {
      await page.evaluate(v => {
        (document.getElementById("uiSize") as HTMLInputElement).value = v;
      }, uiSize);
      await openWheel();
      const box = (await page.locator("#mapWheel .mw-wheel").boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press("Escape");
      return box.height;
    };

    const [small, normal, extreme] = [await boxAt("0.8"), await boxAt("1"), await boxAt("3")];
    // uiSize is followed while there is room for it...
    expect(normal).toBeGreaterThan(small);
    // 0.8 is under the cap, so the rendered box is exactly the geometry's box at that scale
    expect(small).toBeCloseTo(boxRadius(0.8) * 2, 0);
    // ...and the second clamp caps the box at min(w, h) - 32 however large uiSize gets. In this
    // 720px-tall viewport the cap binds at uiSize 1 already: the labels the bands are sized to hold
    // need a box wider than the window is tall, so the dial is scaled down to fit, uniformly, and
    // the fit inside each band is a ratio that scaling cannot break.
    expect(extreme).toBeCloseTo(720 - 32, 0);
    expect(normal).toBeCloseTo(720 - 32, 0);
    expect(extreme).toBeGreaterThanOrEqual(normal);

    await page.evaluate(() => {
      (document.getElementById("uiSize") as HTMLInputElement).value = "1";
    });
  });

  test("keeps the whole wheel on screen when opened in a corner", async () => {
    await page.mouse.click(1274, 8, { button: "right" });
    await expect(page.locator("#mapWheel")).toBeAttached();
    const origin = await page.locator("#mapWheel .mw-origin").evaluate(el => [el.style.left, el.style.top]);
    expect(origin).toEqual(["1274px", "8px"]);
    const box = (await page.locator("#mapWheel .mw-wheel").boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  });

  test("stays out of the way during heightmap customization", async () => {
    await page.evaluate(() => ((window as any).customization = 1));
    await page.mouse.click(640, 380, { button: "right" });
    await expect(page.locator("#mapWheel")).toHaveCount(0);

    // and the same click opens it again the moment customization is over
    await page.evaluate(() => ((window as any).customization = 0));
    await page.mouse.click(640, 380, { button: "right" });
    await expect(page.locator("#mapWheel")).toBeAttached();
  });

  // A mouse press over a sector used to reach nothing at all: `mouseenter` called onState, onState
  // redrew, the redraw replaced the node under the pointer, and that fired mouseenter/mouseleave
  // again - a self-sustaining loop at ~62 events/second with the pointer held still. Hover now
  // mutates the hovered sector in place, so the element the press lands on is still the element
  // that was there when the pointer arrived.
  test("activates a sector from a mouse click", async () => {
    await openWheel();
    await menuTab();

    const index = (await readSectors()).findIndex(byLabel("Layers"));
    const point = await page
      .locator("#mapWheel .mw-labels > .mw-label")
      .nth(index)
      .evaluate(el => {
        const box = el.getBoundingClientRect();
        return [box.x + box.width / 2, box.y + box.height / 2];
      });
    await page.mouse.click(point[0], point[1]);
    await page.waitForTimeout(300);

    expect((await readSectors()).some(s => s.level === 1)).toBe(true);
  });

  // #mapWheel is `position: fixed; inset: 0`, so without `pointer-events: none` on the host every
  // pointerdown in the app landed inside it: index.ts's onPointerDown "outside" test could never be
  // true and the overlay swallowed every click on the map. Only the interactive parts opt back in.
  test("closes on an outside click", async () => {
    await openWheel();
    await page.mouse.click(20, 700);
    await expect(page.locator("#mapWheel")).toHaveCount(0);
  });

  test("stays open when its own sectors, tabs, crumbs and drawer are pressed", async () => {
    await openWheel();
    await menuTab(); // a hub tab press is inside the wheel
    await expect(page.locator("#mapWheel")).toBeAttached();

    await activate(byLabel("Options"));
    await activate(byLabel("Realms"));
    await expect(page.locator("#mapWheelDrawer #optionsContent")).toBeAttached();

    // a real form control in the drawer: using it must not dismiss the wheel
    await page.locator("#mapWheelDrawer #statesNumber").click();
    await expect(page.locator("#mapWheel")).toBeAttached();

    // and the breadcrumb is clickable by design - crumb 0 truncates the path back to the root
    await page.locator("#mapWheel .mw-crumb").first().click();
    await expect(page.locator("#mapWheel")).toBeAttached();
    await expect(page.locator("#mapWheelDrawer")).toHaveCount(0);
    expect((await readSectors()).every(s => s.level === 0)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.locator("#options > #optionsContent")).toBeAttached();
  });
});
