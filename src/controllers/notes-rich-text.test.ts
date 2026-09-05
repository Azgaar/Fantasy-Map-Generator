// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canEditAsRichText } from "./notes-rich-text";

describe("canEditAsRichText", () => {
  it.each([
    "",
    "plain text",
    "<p>Hi <strong>there</strong></p>",
    "<ul><li>a</li></ul>",
    "<table><tbody><tr><td>x</td></tr></tbody></table>",
    "<h3>T</h3><blockquote>q</blockquote>"
  ])("accepts %j", html => expect(canEditAsRichText(html)).toBe(true));

  it.each([
    "<iframe src='x'></iframe>",
    "<p>a</p><hr>",
    "<script>alert(1)</script>",
    "<video src='x'></video>"
  ])("rejects %j", html => expect(canEditAsRichText(html)).toBe(false));
});
