import {expect, test} from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Covers stashCallbackToken (src/services/help/auth.ts), run first thing in boot(): the OAuth
// callback's fragment token and its token-fixation guard — the token is only accepted when this
// client set the signin-pending flag (src/services/help/api.ts signIn()) before redirecting.

test.describe("help gateway fragment token stash", () => {
  test("stores the token and scrubs the hash when sign-in was pending", async ({page}) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("fmg-help-signin-pending", "1");
    });

    await page.goto("/?seed=e2e-help-token-stash#token=e2e-test-token");
    await waitForMap(page);

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
    await waitForMap(page);

    const token = await page.evaluate(() => localStorage.getItem("fmg-help-token"));
    expect(token).toBeNull();

    const hash = await page.evaluate(() => location.hash);
    expect(hash).toBe("");

    const pathname = await page.evaluate(() => location.pathname);
    expect(pathname.endsWith("/")).toBe(true);
  });
});
