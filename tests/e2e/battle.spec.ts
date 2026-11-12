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

const stepToEnd = (page: Page) =>
  page.evaluate(() => {
    const step = document.getElementById("battleStep") as HTMLButtonElement;
    for (let i = 0; i < 700 && !step.disabled; i++) step.click();
    return step.disabled;
  });

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
    await expect(page.locator("#battleScene .battleTerrain")).toHaveCount(1);
    expect(await page.locator("#battleScene .battleBlock").count()).toBeGreaterThan(1);

    await pickType(page, "field");
    await expect(page.locator("#battleType")).toBeEnabled();
    expect(await stepToEnd(page)).toBe(true);
    await expect(page.locator("#battleType")).toBeDisabled(); // the type is set before the start
    await expect(page.locator("#battleLogList > div").first()).toHaveText(/The battle begins/);
    const left = await page.locator(".battleCount").allTextContents();
    expect(left.some(text => Number(text.split("/")[0]) < Number(text.split("/")[1]))).toBe(true);
    await expect(page.locator("#battleResult")).toBeVisible();

    // the same battle again: back to the start, and to the same end
    await page.locator("#battleResultRestart").click();
    await expect(page.locator("#battleResult")).toBeHidden();
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

  test("turns a battalion held still and writes it to the log", async ({ page }) => {
    await startBattle(page);
    const block = page.locator("#battleScene .battleBlock").first();
    const rotation = async () => (await block.getAttribute("transform"))!.match(/rotate\(([-\d.]+)\)/)![1];
    const before = await rotation();
    const box = (await block.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    expect(await rotation()).not.toBe(before);

    await page.locator("#battleLogToggle").click();
    await expect(page.locator("#battleLogList > div").last()).toContainText("are turned");
  });

  test("changes a side by hand once: phase, power and morale, each written to the log", async ({ page }) => {
    await startBattle(page);
    const banner = page.locator("#battleBanner_attackers");
    const power = () => page.locator("#battleBalance > i").first().textContent();
    const before = await power();

    await banner.locator(".battleOrdersButton").click();
    const phase = page.locator("#battleOrdersPhase");
    const label = (await phase.locator("option").nth(1).textContent())!;
    await phase.selectOption({ index: 1 });
    await page.locator("#battleOrdersPower").fill("5000");
    await page.locator("#battleOrdersMorale").fill("-10");
    await page.locator(".dialog-window:has(#battleOrdersScreen) button", { hasText: "Apply" }).click();

    await expect(page.locator("#battleOrdersScreen")).toHaveCount(0);
    await expect(banner.locator(".battlePhase")).toHaveText(label);
    expect(await power()).not.toBe(before);

    await page.locator("#battleLogToggle").click();
    const log = page.locator("#battleLogList");
    await expect(log).toContainText(label);
    await expect(log).toContainText("+5000");
    await expect(log).toContainText("−10");
  });

  test("rolls a side's die again on a click", async ({ page }) => {
    await startBattle(page);
    const die = page.locator("#battleDie_attackers");
    const before = await die.getAttribute("data-die");
    await die.click();
    await expect(die).not.toHaveAttribute("data-die", before!);
    await page.locator("#battleLogToggle").click();
    await expect(page.locator("#battleLogList")).toContainText("Random factor for attackers");
  });

  test("fits a narrow window: both sides stay above the battlefield, the armies under it", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await startBattle(page);
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const stage = await box("#battleStage");
    expect(Math.abs(stage.width / stage.height - 5 / 3)).toBeLessThan(0.01);
    expect((await box("#battleBanner_defenders")).y).toBeLessThan(stage.y);
    expect((await box("#battleSide_attackers")).y).toBeGreaterThan(stage.y + stage.height);
    expect(stage.x + stage.width).toBeLessThanOrEqual(420);
  });

  test("shows what the simulation sees when the Battles diagnostics are on", async ({ page }) => {
    await page.evaluate(() => (window as any).FMG.log.setDebug(["battle"]));
    await startBattle(page);
    await expect(page.locator("#battleScene .battleDebug.ground path").first()).toBeAttached();
    await page.locator("#battleStep").click();
    await expect(page.locator("#battleScene .battleDebug.doings")).toContainText("tick 1");
    await expect(page.locator("#battleScene .battleDebug.doings")).toContainText("♥");

    const stage = (await page.locator("#battleStage").boundingBox())!;
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await expect(page.locator("#battleScene .battleDebugGround")).toContainText("node 50,30");

    // off again: the plan is clean at the next frame
    await page.evaluate(() => (window as any).FMG.log.setDebug([]));
    await page.locator("#battleStep").click();
    await expect(page.locator("#battleScene .battleDebug")).toHaveCount(0);
  });

  test("applies the losses to the regiments and marks the battlefield", async ({ page }) => {
    const { attacker, defender, troops } = await startBattle(page);
    const markers = await page.evaluate(() => (window as any).pack.markers.length);
    await pickType(page, "field");
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
          type: pack.markers.at(-1).type,
          mode: options.app.mode
        };
      },
      [attacker, defender]
    );
    expect(after.troops).toBeLessThan(troops);
    expect(after).toMatchObject({ moved: false, markers: markers + 1, type: "battlefields", mode: null });
  });
});
