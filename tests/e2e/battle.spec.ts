import { expect, type Page, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

/** Start a battle between land regiments of two states, the way the regiment editor does */
async function startBattle(page: Page) {
  return page.evaluate(async () => {
    const { pack, FMG } = window as any;
    const states = pack.states.filter((s: any) => s.i && !s.removed && s.military?.some((r: any) => !r.n && r.a));
    const [attacker, defender] = states.slice(0, 2).map((s: any) => s.military.find((r: any) => !r.n && r.a));
    for (const regiment of [attacker, defender]) Object.assign(regiment, { px: regiment.x, py: regiment.y });
    (await FMG.Controllers.BattleScreen).open(attacker, defender);
    return { attacker: [attacker.state, attacker.i], defender: [defender.state, defender.i], troops: attacker.a + defender.a };
  });
}

const stepToEnd = async (page: Page) => {
  await expect(page.locator("#battleStep")).toBeEnabled(); // the generals have planned
  return page.evaluate(() => {
    const step = document.getElementById("battleStep") as HTMLButtonElement;
    for (let i = 0; i < 700 && !step.disabled; i++) step.click();
    return step.disabled;
  });
};

/** Order the attackers to close with the foe: a general may think better of attacking, and then nobody fights */
async function orderAttack(page: Page) {
  const banner = page.locator("#battleBanner_attackers");
  await banner.locator(".battleOrdersButton").click();
  await banner.locator('.battleOrders [data-order="attack"]').click();
  await expect(banner.locator(".battleOrder")).toHaveText("Attack");
}

/** The battle log opens from Configure Battle */
async function openLog(page: Page) {
  await page.locator("#battleConfigureOpen").click();
  await page.locator(".dialog-window:has(#battleConfigure) .icon-list-bullet").click();
  await expect(page.locator("#battleLogList")).toBeVisible();
}

async function pickType(page: Page, type: string) {
  await page.locator("#battleType").click();
  await page.locator(`#battleScreen .battleTypes [data-type="${type}"]`).click();
  await expect(page.locator("#battleScreen .battleTypes")).toBeHidden();
}

test.describe("Battle simulator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=test-battle&width=1280&height=720");
    await waitForMap(page);
  });

  test("draws both armies on a battle plan and plays the battle to its end", async ({ page }) => {
    await startBattle(page);
    await expect(page.locator("#battleScreen")).toBeVisible();
    await expect(page.locator("#battleTerrain")).toHaveCount(1);
    expect(await page.locator("#battleScene .battleBlock").count()).toBeGreaterThan(1);

    await pickType(page, "field");
    await expect(page.locator("#battleType")).toBeEnabled();
    await orderAttack(page);
    expect(await stepToEnd(page)).toBe(true);
    await expect(page.locator("#battleType")).toBeDisabled(); // the type is set before the start
    await expect(page.locator("#battleLogList")).toContainText("The armies clash"); // told to attack, they close
    const left = await page.locator(".battleCount").allTextContents();
    expect(left.some(text => Number(text.split("/")[0]) < Number(text.split("/")[1]))).toBe(true);
    await expect(page.locator("#battleSummary")).toBeVisible();

    // the same battle again: back to the start, and to the same end
    await page.locator('#battleSummary [data-action="restart"]').click();
    await expect(page.locator("#battleSummary")).toBeHidden();
    expect(await stepToEnd(page)).toBe(true);
    expect(await page.locator(".battleCount").allTextContents()).toEqual(left);
  });

  test("lets troops be dragged before the battle", async ({ page }) => {
    await startBattle(page);
    const block = page.locator("#battleScene .battleBlock").first();
    const before = await block.getAttribute("transform");
    const box = (await block.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    expect(await block.getAttribute("transform")).not.toBe(before);
  });

  test("picks troops by a box and commands them once the battle has started", async ({ page }) => {
    await startBattle(page);
    await pickType(page, "field");
    await expect(page.locator("#battleStep")).toBeEnabled(); // the generals have planned
    await page.locator("#battleStep").click();
    const stage = (await page.locator("#battleStage").boundingBox())!;

    // a box over the whole field picks the battalions of one side
    await page.mouse.move(stage.x + 2, stage.y + 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width - 2, stage.y + stage.height - 2, { steps: 5 });
    await page.mouse.up();
    expect(await page.locator("#battleScene .battleSelected").count()).toBeGreaterThan(0);

    // a right click on the ground sends them there; a click drops the pick
    await page.mouse.click(stage.x + stage.width / 2, stage.y + 10, { button: "right" });
    await openLog(page);
    await expect(page.locator("#battleLogList > div").last()).toContainText("ordered to move");
    await page.mouse.click(stage.x + stage.width / 2, stage.y + 10);
    await expect(page.locator("#battleScene .battleSelected")).toHaveCount(0);
  });

  test("turns a battalion by 15 degrees on a double click and writes it to the log", async ({ page }) => {
    await startBattle(page);
    const block = page.locator("#battleScene .battleBlock").first();
    const rotation = async () => +(await block.getAttribute("transform"))!.match(/rotate\(([-\d.]+)\)/)![1];
    const before = await rotation();
    await block.dblclick();
    expect((((await rotation()) - before) % 360 + 360) % 360).toBeCloseTo(15, 0);

    await openLog(page);
    await expect(page.locator("#battleLogList > div").last()).toContainText("are turned");
  });

  test("changes a side by hand: order and morale, each written to the log", async ({ page }) => {
    await startBattle(page);
    const banner = page.locator("#battleBanner_attackers");
    await banner.locator(".battleOrdersButton").click();
    // attackers of every battle type can be told to retreat, and none begins with it
    const retreat = banner.locator('.battleOrders [data-order="retreat"]');
    const label = (await retreat.textContent())!.trim();
    await retreat.click();
    await expect(banner.locator(".battleOrder")).toHaveText(label);
    await banner.locator('.battleMoraleStep[data-step="-5"]').click();

    await openLog(page);
    const log = page.locator("#battleLogList");
    await expect(log).toContainText(label, { ignoreCase: true });
    await expect(log).toContainText("−5");
  });

  test("turns a side's die to the next face on a click", async ({ page }) => {
    await startBattle(page);
    const die = page.locator("#battleDie_attackers");
    const before = Number(await die.getAttribute("data-die"));
    await die.click();
    await expect(die).toHaveAttribute("data-die", String((before % 6) + 1));
    await die.click();
    await expect(die).toHaveAttribute("data-die", String(((before + 1) % 6) + 1));
    await openLog(page);
    await expect(page.locator("#battleLogList > div.attackers", { hasText: "Fortune" })).toHaveCount(1);
  });

  test("fits a narrow window: both sides stay above the battlefield, the armies under it", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await startBattle(page);
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const stage = await box("#battleStage");
    expect(Math.abs(stage.width / stage.height - 104 / 64)).toBeLessThan(0.01); // the field and the ground round it
    expect((await box("#battleBanner_defenders")).y).toBeLessThan(stage.y);
    expect((await box("#battleSide_attackers")).y).toBeGreaterThan(stage.y + stage.height);
    expect(stage.x + stage.width).toBeLessThanOrEqual(420);
  });

  test("shows what the simulation sees when the Battles diagnostics are on", async ({ page }) => {
    await page.evaluate(() => {
      const { FMG, options } = window as any;
      FMG.log.setDebug(["battle"]);
      options.app.battle.view.camera = "field"; // the whole field in view: its middle is under the middle of the stage
    });
    await startBattle(page);
    await expect(page.locator("#battleDebugGround path").first()).toBeAttached();
    await page.locator("#battleStep").click();
    await expect(page.locator("#battleDebugDoings")).toContainText("tick 1");
    await expect(page.locator("#battleDebugDoings")).toContainText("♥");

    const stage = (await page.locator("#battleStage").boundingBox())!;
    await page.mouse.move(stage.x + (stage.width * 50.5) / 100, stage.y + (stage.height * 30.5) / 60); // the node's middle
    await expect(page.locator("#battleScene .battleDebugNode")).toContainText("node 50,30");

    // off again: the plan is clean at the next frame
    await page.evaluate(() => (window as any).FMG.log.setDebug([]));
    await page.locator("#battleStep").click();
    await expect(page.locator("#battleScene .battleDebug")).toHaveCount(0);
  });

  test("exports the battle from Configure Battle: an animated SVG, a battle report and a GIF", async ({ page }) => {
    test.setTimeout(180000);
    await page.evaluate(() => {
      const { options } = window as any;
      options.app.battle.simulation.maxMinutes = 20; // a short battle: the exports replay it from the start
      options.app.battle.export.quality = "low";
    });
    await startBattle(page);
    await pickType(page, "field");
    await expect(page.locator("#battleStep")).toBeEnabled();
    await page.locator("#battleConfigureOpen").click();
    const exporting = page.locator('#battleConfigure details[data-group="export"]');
    await exporting.evaluate(details => {
      (details as HTMLDetailsElement).open = true;
    });
    for (const [format, ending] of [
      ["svg", ".svg"],
      ["report", "-report.html"],
      ["gif", ".gif"]
    ]) {
      await exporting.locator('[data-key="format"]').selectOption(format);
      const download = page.waitForEvent("download", { timeout: 120000 });
      await page.locator("#battleConfigureSave").click();
      expect((await download).suggestedFilename().endsWith(ending)).toBe(true);
      await expect(page.locator("#battleConfigureSave")).toHaveText("Save");
    }
  });

  test("applies the losses to the regiments and writes the battle as an event", async ({ page }) => {
    const { attacker, defender, troops } = await startBattle(page);
    const [markers, battles] = await page.evaluate(() => {
      const { pack } = window as any;
      return [pack.markers.length, pack.events.filter((event: any) => event.type === "battle").length];
    });
    await pickType(page, "field");
    await orderAttack(page);
    await stepToEnd(page);
    await page.locator("#battleApply").click();

    await expect(page.locator("#battleScreen")).toHaveCount(0);
    const after = await page.evaluate(
      ([a, d]) => {
        const { pack, options } = window as any;
        const find = ([state, i]: number[]) => pack.states[state].military.find((r: any) => r.i === i);
        const regiments = [find(a), find(d)];
        return {
          troops: regiments[0].a + regiments[1].a,
          moved: regiments.some((r: any) => "px" in r),
          markers: pack.markers.length,
          battles: pack.events.filter((event: any) => event.type === "battle").length,
          mode: options.app.mode
        };
      },
      [attacker, defender]
    );
    expect(after.troops).toBeLessThan(troops);
    expect(after).toMatchObject({ moved: false, markers, battles: battles + 1, mode: null }); // a war of the year may come too
  });

  test("watches a past battle again once a state that fought it is gone", async ({ page }) => {
    const { defender } = await startBattle(page);
    await pickType(page, "field");
    await orderAttack(page);
    await stepToEnd(page);
    await page.locator("#battleApply").click();
    await expect(page.locator("#battleScreen")).toHaveCount(0);

    const id = await page.evaluate(async state => {
      const { FMG } = window as any;
      const battle = FMG.Events.list({ type: "battle" }).at(-1);
      FMG.States.remove(state);
      (await FMG.Controllers.BattleScreen).watch(battle.i);
      return battle.i;
    }, defender[0]);
    await expect(page.locator("#battleBanner_defenders .battleStates")).toHaveText(`former state ${defender[0]}`);
    await page.locator("#battleCancel").click();
    await expect(page.locator("#battleScreen")).toHaveCount(0);
    await page.evaluate(async event => (await (window as any).FMG.Controllers.BattleScreen).showRecord(event), id);
    await expect(page.locator("#battleSummary .battleSummarySide.defenders header b")).toHaveText(`former state ${defender[0]}`);
  });

  test("keeps a played battle through a save and a load, and its replay plays out as recorded", async ({ page }) => {
    await startBattle(page);
    await pickType(page, "field");
    await orderAttack(page);
    await stepToEnd(page);
    await page.locator("#battleApply").click();
    await expect(page.locator("#battleScreen")).toHaveCount(0);

    const { id, saved, winner } = await page.evaluate(async () => {
      const { FMG } = window as any;
      const battle = FMG.Events.list({ type: "battle" }).at(-1);
      return { id: battle.i, winner: battle.winner, saved: await FMG.Services.Save.prepareMapData() };
    });
    await page.locator("#mapToLoad").setInputFiles({ name: "battle.map", mimeType: "text/plain", buffer: Buffer.from(saved) });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const loaded = await page.evaluate(async event => {
      const { FMG } = window as any;
      const battle = FMG.Events.get(event);
      (await FMG.Controllers.BattleScreen).watch(event);
      return { winner: battle?.winner, replay: Boolean(battle?.replay) };
    }, id);
    expect(loaded).toEqual({ winner, replay: true });
    await stepToEnd(page);
    await expect(page.locator("#battleSummary")).toBeVisible();
    await expect(page.locator("#tooltip")).not.toContainText("no longer plays out as it was recorded");
  });
});
