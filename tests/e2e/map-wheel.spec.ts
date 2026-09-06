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
  // window the drawer landed at 900 instead of 560, hanging in empty space. Every
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
    // The bug: the offset was BANDS[3][1] + 14 whatever was open, so a wheel showing one ring put
    // its drawer 239px past where that ring visibly ends. It hangs off the OPEN ring now - "About"
    // is a root sector, so that is level 0 - and the clearance is the same 14px at any depth.
    expect(offset).toBeCloseTo(BANDS[0][1] * ui + 14 * ui, 1);
    expect(offset).toBeLessThan(BANDS[3][1] * ui);
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

  test("keeps the drawer open across a hover", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Options"));
    await activate(byLabel("Realms"));
    await expect(page.locator("#mapWheelDrawer #optionsContent")).toBeAttached();

    // Hovering repaints sectors in place and must not disturb the structure: the drawer and the
    // entry animation's finished state both have to survive the pointer resting. One earlier bug
    // closed the drawer on any hover; another rebuilt the ring on hover, which killed the whole
    // mouse path. This is the guard for both.
    const sectors = await readSectors();
    const people = sectors.find(byLabel("People"))!;
    expect(people.level).toBe(1);
    const point = await page
      .locator("#mapWheel .mw-labels > .mw-label")
      .nth(sectors.findIndex(byLabel("People")))
      .evaluate(el => {
        const box = el.getBoundingClientRect();
        return [box.x + box.width / 2, box.y + box.height / 2];
      });
    await page.mouse.move(point[0], point[1]);
    await expect.poll(async () => (await readSectors()).find(byLabel("People"))?.hot, { timeout: 2000 }).toBe(true);

    await expect(page.locator("#mapWheelDrawer #optionsContent")).toBeAttached();
    // and the borrowed host is still the live one, not a corpse left behind by a rebuild
    await expect(page.locator("#mapWheelDrawer #statesNumber")).toBeVisible();

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

  // FIX: the drawer used to be placed against the deepest ring the box could ever hold, so with two
  // rings open it sat ~164px out in empty space - the gap the user photographed. Measured here as
  // the real distance from the outermost drawn ring's edge to the drawer's near edge.
  test("puts the drawer against the ring that is open, at every depth", async () => {
    for (const [drill, level] of [
      [["About"], 0],
      [["Options", "Realms"], 1]
    ] as [string[], number][]) {
      await openWheel();
      await menuTab();
      for (const step of drill) await activate(byLabel(step));
      await expect(page.locator("#mapWheelDrawer")).toBeAttached();
      await page.waitForTimeout(300); // let the 140ms slide-in settle before measuring

      const wheel = (await page.locator("#mapWheel .mw-wheel").boundingBox())!;
      const drawer = (await page.locator("#mapWheelDrawer").boundingBox())!;
      const centre = wheel.x + wheel.width / 2;
      const ui = await page
        .locator("#mapWheel .mw-wheel")
        .evaluate(el => Number.parseFloat(getComputedStyle(el).getPropertyValue("--mw-ui")));
      const side = await page.locator("#mapWheelDrawer").getAttribute("data-side");
      const near = side === "right" ? drawer.x - centre : centre - (drawer.x + drawer.width);

      // 14px of clearance beyond the outermost ring actually drawn, and nothing more
      const gap = near - BANDS[level][1] * ui;
      expect(gap, `${drill.join(" > ")}: ${gap}px of dead space beside a level-${level} ring`).toBeCloseTo(
        14 * ui,
        0
      );
      await page.keyboard.press("Escape");
    }
  });

  // FIX: the breadcrumb was pinned to the top-left of the BOX, which is sized for a drill to level 3
  // - so on a wheel showing one or two rings it landed in the corner of the screen, yards from the
  // dial it describes, and clicking crumb N is the only route back to depth N.
  test("sits the breadcrumb just above the ring it describes", async () => {
    for (const drill of [[], ["Tools"], ["Tools", "Regenerate"]]) {
      await openWheel();
      await menuTab();
      for (const step of drill) await activate(byLabel(step));

      const wheel = (await page.locator("#mapWheel .mw-wheel").boundingBox())!;
      const crumbs = (await page.locator("#mapWheel .mw-crumbs").boundingBox())!;
      const ui = await page
        .locator("#mapWheel .mw-wheel")
        .evaluate(el => Number.parseFloat(getComputedStyle(el).getPropertyValue("--mw-ui")));
      const centre = { x: wheel.x + wheel.width / 2, y: wheel.y + wheel.height / 2 };

      expect(crumbs.x + crumbs.width / 2).toBeCloseTo(centre.x, 0);
      expect(centre.y - crumbs.y - crumbs.height, `depth ${drill.length}`).toBeCloseTo(
        BANDS[drill.length][1] * ui + 10 * ui,
        0
      );

      // on screen, and still a click target
      const viewport = page.viewportSize()!;
      expect(crumbs.y).toBeGreaterThanOrEqual(0);
      expect(crumbs.x).toBeGreaterThanOrEqual(0);
      expect(crumbs.x + crumbs.width).toBeLessThanOrEqual(viewport.width);
      const events = await page
        .locator("#mapWheel .mw-crumb")
        .first()
        .evaluate(el => getComputedStyle(el).pointerEvents);
      expect(events).toBe("auto");
      await page.keyboard.press("Escape");
    }
  });

  // the bar is anchored to the ring and the ring to the click point, so a deep drill near the top of
  // a short window would otherwise push it off the screen
  test("keeps the breadcrumb on screen for a deep drill near the top edge", async () => {
    await openWheel(640, 40);
    await menuTab();
    await activate(byLabel("Tools"));
    await activate(byLabel("Regenerate"));
    await activate(byLabel("Society"));

    const crumbs = (await page.locator("#mapWheel .mw-crumbs").boundingBox())!;
    expect(crumbs.y).toBeGreaterThanOrEqual(0);
    expect(crumbs.y + crumbs.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

  // Every text-bearing control in the drawer, and whether its own text fits inside it. `scrollHeight
  // > clientHeight` is the direct expression of "the glyphs are cut off"; the width assertions below
  // passed for a select whose descenders were being clipped, because nothing measured the text.
  const clippedControls = (): Promise<string[]> =>
    page.locator("#mapWheelDrawer").evaluate(root =>
      [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("select, input, textarea")]
        .filter(el => el.offsetParent !== null && !["range", "color", "checkbox", "radio"].includes(el.type))
        .filter(el => el.scrollHeight > el.clientHeight)
        .map(el => {
          const style = getComputedStyle(el);
          return `#${el.id || el.tagName}: ${el.clientHeight}px content box for ${el.scrollHeight}px of text (height: ${style.height}, font-size: ${style.fontSize})`;
        })
    );

  // FMG carries inline widths on several of its SELECTS (#stylePreset 45%, #styleElementSelect 42%,
  // #styleHeightmapScheme and #styleTextureInput 86%, #styleSelectFont 85%) for the top bar's wide
  // panel. In a 340px drawer that clipped their option text - the user photographed it on "Style
  // preset" and "Select element" - and only !important beats an inline style, since src/index.html
  // is not this feature's to edit. Inputs are deliberately NOT in that rule: their inline widths are
  // pairs meant to sit side by side, and nothing in them is clipped.
  test("gives every hosted select the width of the block it sits in", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Style"));
    await activate(byLabel("Style editor"));
    await expect(page.locator("#mapWheelDrawer #styleContent")).toBeAttached();

    const body = (await page.locator("#mapWheelDrawer .mw-drawer-body").boundingBox())!;
    // measured against the block the control actually sits in, since the hosts carry padding of
    // their own; the inline 45% / 42% / 86% / 85% is what it must no longer be
    const fits = (id: string) =>
      page.locator(`#mapWheelDrawer #${id}`).evaluate(el => {
        const parent = el.parentElement!;
        const style = getComputedStyle(parent);
        const inner =
          parent.getBoundingClientRect().width -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight);
        return { width: el.getBoundingClientRect().width, inner };
      });

    for (const id of ["stylePreset", "styleElementSelect"]) {
      const fit = await fits(id);
      expect(fit.width, `#${id} is ${fit.width}px in a ${fit.inner}px block`).toBeGreaterThanOrEqual(fit.inner - 1);
      // and that block is most of the drawer, so the option text has real room
      expect(fit.width).toBeGreaterThan(body.width * 0.8);
    }

    // the rest of the inventory only renders for the element that owns it, so pick that element
    // first - selecting one changes which section of the form is shown, nothing on the map
    for (const [element, id] of [
      ["terrs", "styleHeightmapScheme"],
      ["texture", "styleTextureInput"],
      ["labels", "styleSelectFont"]
    ]) {
      await page.locator("#mapWheelDrawer #styleElementSelect").selectOption(element);
      await expect(page.locator(`#mapWheelDrawer #${id}`)).toBeVisible();
      const fit = await fits(id);
      expect(fit.width, `#${id} is ${fit.width}px in a ${fit.inner}px block`).toBeGreaterThanOrEqual(fit.inner - 1);
      expect(await clippedControls()).toEqual([]);
    }
    await page.locator("#mapWheelDrawer #styleElementSelect").selectOption("biomes");

    await page.keyboard.press("Escape");
    await expect(page.locator("#options > #styleContent")).toBeAttached();
  });

  // The user photographed "Show" in #azgaarAssistant with its glyphs cut off across the bottom.
  // FMG gives every select `height: 1.6em; padding: 0` with `box-sizing: border-box`; the skin sets
  // 12px type and 4px of vertical padding but no height, so 1.6 x 12 = 19.2px had to contain 8px of
  // padding, 1px of border and a 12px line - about 10px of content box for 12px of text.
  //
  // This is the assertion the width test should have carried from the start: the width was right and
  // the text was still clipped, because nothing ever measured the text.
  test("fits every hosted control's own text inside it", async () => {
    for (const [drill, sample] of [
      [["Options", "Interface"], "azgaarAssistant"],
      [["Options", "Behaviour"], "onloadBehavior"],
      [["Style", "Style editor"], "stylePreset"]
    ] as [string[], string][]) {
      // the em-based height interacts with the scaled font size, so check both ends of uiSize
      for (const uiSize of ["0.8", "1", "2"]) {
        await page.evaluate(v => {
          (document.getElementById("uiSize") as HTMLInputElement).value = v;
        }, uiSize);
        await openWheel();
        await menuTab();
        for (const step of drill) await activate(byLabel(step));
        await expect(page.locator(`#mapWheelDrawer #${sample}`)).toBeVisible();

        expect(await clippedControls(), `uiSize ${uiSize}, ${drill.join(" > ")}`).toEqual([]);
        await page.keyboard.press("Escape");
      }
    }

    await page.evaluate(() => {
      (document.getElementById("uiSize") as HTMLInputElement).value = "1";
    });
    await expect(page.locator("#options > #optionsContent")).toBeAttached();
  });

  // Does a hosted ROW lay out, as opposed to a hosted CONTROL fitting its own text? Nothing had ever
  // asked. The skin used to declare `table, tbody, tr, td { display: block; width: 100% }`, so every
  // cell of every row went on a line of its own: the lock affordance floated above its label, and
  // every row pairing a `type="range"` with a `type="number"` readout was split across two lines -
  // with the readout landing at 6% of the drawer (17px, an apparently empty box) because
  // `#optionsContent table td:nth-of-type(4) { width: 6% }` is a column width, meaningless once the
  // cell is a block. The user photographed it on Options -> People.
  //
  // Ten rows of `#optionsContent` carry that pair, not the two the markup spells out: `<slider-input>`
  // builds its range and its number in LIGHT DOM (src/components/slider-input.ts), so the eight
  // slider rows are found by the same query. The Style editor adds more, varying with the element
  // selected. `paired` below is returned so the count can be asserted rather than described.
  //
  // Three properties, measured rather than assumed:
  //   (a) no visible form control is rendered too narrow to use;
  //   (b) a range and the number that reads it out share a line;
  //   (c) nothing is clipped, which is the sweep the earlier fixes left behind.
  const MIN_CONTROL_WIDTH = 40;

  interface RowLayout {
    narrow: string[];
    split: string[];
    paired: number;
  }

  const rowLayout = (): Promise<RowLayout> =>
    page.locator("#mapWheelDrawer").evaluate((root, min) => {
      const narrow: string[] = [];
      const split: string[] = [];
      let paired = 0;
      const shown = (el: HTMLElement) => el.offsetParent !== null;

      for (const row of root.querySelectorAll<HTMLTableRowElement>("tr")) {
        if (!shown(row)) continue;

        // <output> is a readout like any other and is measured with them; a colour swatch and the
        // app-wide hidden checkboxes are meant to be small or absent
        for (const el of row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLOutputElement>(
          "input, select, textarea, output"
        )) {
          if (!shown(el) || ["color", "checkbox", "radio", "hidden"].includes(el.type)) continue;
          const width = el.getBoundingClientRect().width;
          if (width < min) narrow.push(`#${el.id || el.type}: ${width.toFixed(1)}px wide`);
        }

        const range = row.querySelector<HTMLInputElement>('input[type="range"]');
        const readout = row.querySelector<HTMLInputElement>('input[type="number"]');
        if (!range || !readout || !shown(range) || !shown(readout)) continue;
        paired++;
        const a = range.getBoundingClientRect();
        const b = readout.getBoundingClientRect();
        const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlap <= 0) split.push(`#${range.id} at y${a.top.toFixed(0)}, #${readout.id} at y${b.top.toFixed(0)}`);
      }

      return { narrow, split, paired };
    }, MIN_CONTROL_WIDTH);

  test("lays every hosted row out instead of stacking its cells", async () => {
    // every drawer the wheel can host, and every row shape the three of them contain: 3-cell and
    // 4-cell option rows, the two-column style form, and About, which has no table at all
    const drills = [
      ["Options", "World"],
      ["Options", "Realms"],
      ["Options", "People"],
      ["Options", "Identity"],
      ["Options", "Interface"],
      ["Options", "Behaviour"],
      ["Style", "Style editor"],
      ["About"]
    ];

    for (const uiSize of ["0.8", "1", "2"]) {
      await page.evaluate(v => {
        (document.getElementById("uiSize") as HTMLInputElement).value = v;
      }, uiSize);
      let optionPairs = 0;

      for (const drill of drills) {
        await openWheel();
        await menuTab();
        for (const step of drill) await activate(byLabel(step));
        await expect(page.locator("#mapWheelDrawer .mw-drawer-body")).toBeVisible();

        const where = `uiSize ${uiSize}, ${drill.join(" > ")}`;
        const layout = await rowLayout();
        expect(layout.narrow, `${where}: unusably narrow`).toEqual([]);
        expect(layout.split, `${where}: slider split from its readout`).toEqual([]);
        expect(await clippedControls(), `${where}: clipped`).toEqual([]);
        if (drill[0] === "Options") optionPairs += layout.paired;

        // FIX: the row selector is `tbody tr` so that it matches `#styleContent table tr
        // { display: table }` at equal specificity (1,0,2) and wins on document order. Drop the
        // tbody and the style rows silently keep FMG's table layout - which no other assertion here
        // catches, since those rows stay wide enough and hold no range/number pair.
        if (drill[0] === "Style") {
          const rowDisplay = await page
            .locator("#mapWheelDrawer #styleContent tr")
            .first()
            .evaluate(el => getComputedStyle(el).display);
          expect(rowDisplay, `${where}: style rows are not laid out by the skin`).toBe("flex");
        }

        await page.keyboard.press("Escape");
      }

      // the pair assertion above guards TEN option rows, not the two the markup spells out:
      // <slider-input> builds its range and number in light DOM, so the eight slider rows are found
      // by the same query. Asserted, so the claim cannot rot into an understatement.
      expect(optionPairs, `uiSize ${uiSize}: range/number rows swept`).toBe(10);
    }

    await page.evaluate(() => {
      (document.getElementById("uiSize") as HTMLInputElement).value = "1";
    });
    await expect(page.locator("#options > #optionsContent")).toBeAttached();
  });

  // The lock icons are the row's only affordance and they are click targets, so a row layout that
  // squeezes them to a few pixels or pushes them off the drawer has broken them.
  test("keeps the row locks reachable and clickable", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("Options"));
    await activate(byLabel("People"));

    const lock = page.locator("#mapWheelDrawer #lock_cultures");
    await expect(lock).toBeVisible();
    const body = (await page.locator("#mapWheelDrawer .mw-drawer-body").boundingBox())!;
    const box = (await lock.boundingBox())!;
    expect(box.width, `lock is ${box.width}px wide`).toBeGreaterThanOrEqual(14);
    expect(box.x).toBeGreaterThanOrEqual(body.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(body.x + body.width + 1);

    const before = await lock.getAttribute("class");
    await lock.click();
    await expect(lock).not.toHaveClass(before!);
    await lock.click();
    await expect(lock).toHaveClass(before!);
  });

  // The wheel sampled the theme once per structural redraw, which was defensible while it was a
  // transient ring - but the drawer hosts Options -> Interface, so the user can sit inside the wheel
  // moving these very sliders. The ring follows them in place; a rebuild would be the hover loop.
  test("follows a live theme change, transparency included", async () => {
    const alphaOf = (fill: string): number => Number(/,\s*([\d.]+)\)$/.exec(fill)?.[1] ?? 1);
    const rootFill = (): Promise<string> =>
      page
        .locator("#mapWheel path.mw-sector")
        .first()
        .evaluate(el => el.getAttribute("fill") ?? "");
    // the app's own function, the one all three sliders and the restore-defaults button call
    const theme = (transparency: number, color?: string): Promise<void> =>
      page.evaluate(([t, c]: [number, string | undefined]) => {
        const input = document.getElementById("themeColorInput") as HTMLInputElement;
        (window as any).changeDialogsTheme(c || input.value, t);
      }, [transparency, color] as [number, string | undefined]);

    const before = await page.evaluate(
      () => (document.getElementById("transparencyInput") as HTMLInputElement).value
    );

    await openWheel();
    await menuTab();

    await theme(0);
    await page.waitForTimeout(150);
    const opaque = await rootFill();
    expect(alphaOf(opaque)).toBeCloseTo(0.97, 2);

    // ...and at the other end of the slider the ring takes the user's transparency, down to the floor
    await theme(100);
    await page.waitForTimeout(150);
    const veiled = await rootFill();
    expect(alphaOf(veiled)).toBeCloseTo(0.8, 2);
    expect(veiled).not.toBe(opaque);

    // a colour change reaches it too, and none of it rebuilt the ring or closed the wheel
    await theme(0, "#3355aa");
    await page.waitForTimeout(150);
    expect(await rootFill()).not.toBe(opaque);
    await expect(page.locator("#mapWheel")).toBeAttached();
    expect((await readSectors()).length).toBeGreaterThan(1);

    await page.evaluate(t => (window as any).changeDialogsTheme("#997787", t), Number(before));
  });

  // The user's bug: the first notch of a scroll inside the drawer closed the whole wheel (the
  // dismiss-on-zoom listener was unconditional), which detached the drawer mid-gesture and handed
  // the rest of that scroll to the map, which zoomed. The map transform is what proves it.
  test("scrolls the drawer on a wheel event instead of zooming the map", async () => {
    await openWheel();
    await menuTab();
    await activate(byLabel("About"));
    await expect(page.locator("#mapWheelDrawer #aboutContent")).toBeAttached();
    await page.waitForTimeout(300);

    const body = page.locator("#mapWheelDrawer .mw-drawer-body");
    expect(await body.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(10);
    const transform = await page.locator("#viewbox").getAttribute("transform");

    const box = (await body.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(200);

    expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator("#mapWheel")).toBeAttached();
    await expect(page.locator("#mapWheelDrawer #aboutContent")).toBeAttached();
    expect(await page.locator("#viewbox").getAttribute("transform")).toBe(transform);

    // and the ring is deliberately NOT exempt: wheeling over the dial is reaching for the map
    await page.mouse.move(2, 2);
    await page.keyboard.press("Escape");
    await openWheel();
    await page.mouse.move(640, 380);
    await page.mouse.wheel(0, 200);
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
