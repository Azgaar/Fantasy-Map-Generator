import { expect, type Page, test } from "@playwright/test";

// The merged assistant dialog: Help (gateway) first, This map (BYOK agent) behind a click, note
// editing through write_note with undo. Both remote services are stubbed at the network layer.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "content-type, authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
  "access-control-allow-methods": "GET, POST, OPTIONS"
};

const json = (body: unknown, status = 200) => ({
  status,
  headers: { ...CORS, "content-type": "application/json" },
  body: JSON.stringify(body)
});

async function stubGateway(page: Page): Promise<void> {
  await page.route("https://ask.azgaarsfmg.com/**", route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (request.url().endsWith("/v1/limits")) {
      return route.fulfill(json({ tier: "anonymous", remaining: 5, resetsAt: "2099-01-01T00:00:00.000Z" }));
    }
    if (request.url().endsWith("/v1/ask")) {
      return route.fulfill(
        json({
          conversationId: "abcdefghijklmnopqrstuvwx",
          requestId: 7,
          answer: "Use **File → Export → SVG**.",
          model: "stub",
          usage: null
        })
      );
    }
    return route.fulfill({ status: 204, headers: CORS });
  });
}

// First completion asks to edit the note, second answers in text
async function stubAnthropic(page: Page, html: string): Promise<void> {
  let calls = 0;
  await page.route("https://api.anthropic.com/v1/messages", route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls += 1;
    const usage = { input_tokens: 10, output_tokens: 5 };
    if (calls === 1) {
      return route.fulfill(
        json({
          content: [{ type: "tool_use", id: "toolu_1", name: "write_note", input: { html } }],
          stop_reason: "tool_use",
          usage
        })
      );
    }
    return route.fulfill(
      json({ content: [{ type: "text", text: "Done — I rewrote the note." }], stop_reason: "end_turn", usage })
    );
  });
}

async function loadMap(page: Page): Promise<void> {
  await page.route("https://azgaar.github.io/**", route => route.abort()); // no remote TinyMCE: plain contenteditable
  await page.goto("/?seed=assistant-e2e&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
  // `notes` is a top-level `let` in the classic main.js — a global binding, not a window property
  await page.evaluate('notes.push({ id: "burg1", name: "Kelmora", legend: "<p>Old text.</p>" })');
}

const legendOf = (page: Page, id: string): Promise<string> =>
  page.evaluate(`notes.find(n => n.id === ${JSON.stringify(id)}).legend`);

test.describe("assistant dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5");
      localStorage.setItem("fmg-ai-kl-anthropic", "sk-test");
      localStorage.removeItem("fmg-ai-chat-conversations");
    });
    await stubGateway(page);
    await loadMap(page);
  });

  test("the bubble opens Help first and the mode control switches", async ({ page }) => {
    await page.locator("#helpAssistantBubble").click();
    await expect(page.locator("#helpAssistant")).toBeVisible();
    await expect(page.locator("#helpAssistantHelp")).toBeVisible();
    await expect(page.locator("#helpAssistantMap")).toBeHidden();
    await page.locator("#helpAssistantQuestion").fill("half typed");
    await page.locator('.helpAssistantMode[data-mode="map"]').click();
    await expect(page.locator("#helpAssistantMap")).toBeVisible();
    await expect(page.locator("#helpMapDrawer")).toBeHidden();
    await page.locator('.helpAssistantMode[data-mode="help"]').click();
    await expect(page.locator("#helpAssistantQuestion")).toHaveValue("half typed");
  });

  test("help questions round-trip through the gateway", async ({ page }) => {
    await page.locator("#helpAssistantBubble").click();
    await page.locator("#helpAssistantQuestion").fill("How do I export SVG?");
    await page.locator("#helpAssistantAsk").click();
    const answer = page.locator("#helpAssistantLog .helpAssistantAnswer");
    await expect(answer).toContainText("Use");
    await expect(answer.locator("strong")).toHaveText("File → Export → SVG");
    await expect(answer.locator(".helpAssistantFeedback button")).toHaveCount(2);
    await expect(page.locator("#helpAssistantLimits")).toContainText("5 questions left today");
  });

  test("the notes editor's AI button opens This map with the note chip, and write_note edits with undo", async ({
    page
  }) => {
    await stubAnthropic(page, "<p>Kelmora broods beneath a sky of ash.</p>");
    await page.evaluate(() => (window as any).Controllers.NotesEditor.open("burg1"));
    await expect(page.locator("#notesEditor")).toBeVisible();
    await page.locator("#notesGenerateWithAi").click();

    await expect(page.locator("#helpAssistantMap")).toBeVisible();
    await expect(page.locator("#helpMapContext")).toHaveText("Note: Kelmora");
    await expect(page.locator("#helpMapLog button").first()).toHaveText("Write a description for this note");

    await page.locator("#helpMapInput").fill("make it ominous");
    await page.locator("#helpMapInput").press("Enter");

    const edit = page.locator("#helpMapLog .helpMapEdit");
    await expect(edit).toContainText("Updated note “Kelmora”");
    await expect(page.locator("#helpMapLog .helpMapAssistant")).toContainText("Done");
    expect(await legendOf(page, "burg1")).toBe("<p>Kelmora broods beneath a sky of ash.</p>");
    await expect(page.locator("#notesBody")).toHaveText("Kelmora broods beneath a sky of ash.");
    await expect(page.locator("#notesLegend")).toHaveText("Kelmora broods beneath a sky of ash.");

    await edit.locator("button").click();
    await expect(edit).toContainText("undone");
    expect(await legendOf(page, "burg1")).toBe("<p>Old text.</p>");
    await expect(page.locator("#notesBody")).toHaveText("Old text.");
  });

  test("a missing key opens the settings drawer instead of sending", async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("fmg-ai-kl-anthropic"));
    await page.evaluate(() => (window as any).Controllers.HelpAssistant.open({ mode: "map" }));
    await expect(page.locator("#helpMapStatusKey")).toContainText("no key");
    await page.locator("#helpMapInput").fill("hello");
    await page.locator("#helpMapInput").press("Enter");
    await expect(page.locator("#helpMapDrawer")).toBeVisible();
    await expect(page.locator("#helpMapHint")).toBeVisible();
    await expect(page.locator("#helpMapLog .helpMapUser")).toHaveCount(0);

    await stubAnthropic(page, "<p>unused</p>");
    await page.locator("#helpMapKey").fill("sk-test");
    await page.locator("#helpMapInput").press("Enter");
    await expect(page.locator("#helpMapLog .helpMapUser")).toHaveText("hello");
    await expect(page.locator("#helpMapDrawer")).toBeHidden();
  });
});
