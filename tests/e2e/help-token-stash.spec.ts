import {expect, test} from "@playwright/test";

// Covers public/main.js's fragment-token stash (OAuth callback from the help gateway) and its
// token-fixation guard: the token is only accepted when this client set the signin-pending flag
// (src/services/help/api.ts signIn()) before redirecting. See docs/superpowers/specs for the
// slice 2a design.

test.describe("help gateway fragment token stash", () => {
  test("stores the token and scrubs the hash when sign-in was pending", async ({page}) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("fmg-help-signin-pending", "1");
    });

    await page.goto("/?seed=e2e-help-token-stash#token=e2e-test-token");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});

    const token = await page.evaluate(() => localStorage.getItem("fmg-help-token"));
    expect(token).toBe("e2e-test-token");

    const hash = await page.evaluate(() => location.hash);
    expect(hash).toBe("");

    const pathname = await page.evaluate(() => location.pathname);
    expect(pathname.endsWith("/")).toBe(true);

    const pending = await page.evaluate(() => sessionStorage.getItem("fmg-help-signin-pending"));
    expect(pending).toBeNull();
  });

  test("ignores an unsolicited token but still scrubs the hash", async ({page}) => {
    await page.goto("/?seed=e2e-help-token-stash-unsolicited#token=e2e-test-token");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});

    const token = await page.evaluate(() => localStorage.getItem("fmg-help-token"));
    expect(token).toBeNull();

    const hash = await page.evaluate(() => location.hash);
    expect(hash).toBe("");

    const pathname = await page.evaluate(() => location.pathname);
    expect(pathname.endsWith("/")).toBe(true);
  });
});
