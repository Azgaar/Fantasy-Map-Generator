import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

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
const readSectors = (): Promise<SectorInfo[]> =>
  page.evaluate(() => {
    const INNER = [58, 112, 162, 208];
    const HOT = ["#6b5535", "#a33a2e"]; // FILLS.hot / FILLS.hotDanger
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
  });

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

    // 260px clear of the ring's centre on whichever side it fanned out to: 246 outer radius + 14
    const side = await page.locator("#mapWheelDrawer").getAttribute("data-side");
    const gap = side === "right" ? drawer.x - centre.x : centre.x - (drawer.x + drawer.width);
    expect(gap).toBeCloseTo(260, -1);
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
