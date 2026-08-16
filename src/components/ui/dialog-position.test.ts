import { describe, expect, test } from "vitest";
import { getDialogPosition } from "./dialog-position";

const anchor = { height: 600, left: 100, top: 50, width: 800 };
const dialog = { height: 200, width: 300 };
const viewport = { height: 900, width: 1200 };

describe("getDialogPosition", () => {
  test("places a modeless dialog at the top right of its anchor", () => {
    expect(getDialogPosition(anchor, dialog, "top-right", viewport)).toEqual({ left: 590, top: 60 });
  });

  test("centers a dialog within its anchor", () => {
    expect(getDialogPosition(anchor, dialog, "center", viewport)).toEqual({ left: 350, top: 250 });
  });

  test("supports independent placement offsets", () => {
    expect(getDialogPosition(anchor, dialog, "top-left", viewport, { x: 10, y: 140 })).toEqual({
      left: 110,
      top: 190
    });
  });

  test("keeps a dialog inside the viewport", () => {
    expect(getDialogPosition({ height: 100, left: -40, top: -30, width: 100 }, dialog, "top-left", viewport)).toEqual({
      left: 8,
      top: 8
    });
  });
});
