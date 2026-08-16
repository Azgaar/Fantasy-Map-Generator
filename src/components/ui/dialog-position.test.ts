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

  test("places a dialog at the top center of its anchor", () => {
    expect(getDialogPosition(anchor, dialog, "top-center", viewport, { x: 0, y: 20 })).toEqual({
      left: 350,
      top: 70
    });
  });

  test("places dialogs along the bottom edge of an anchor", () => {
    expect(getDialogPosition(anchor, dialog, "bottom-left", viewport, { x: 10, y: 25 })).toEqual({
      left: 110,
      top: 425
    });
    expect(getDialogPosition(anchor, dialog, "bottom-center", viewport, { x: 0, y: 40 })).toEqual({
      left: 350,
      top: 410
    });
  });

  test("places dialogs outside an anchor", () => {
    expect(
      getDialogPosition({ ...anchor, left: 500, width: 200 }, dialog, "left-top", viewport, { x: 10, y: 0 })
    ).toEqual({ left: 190, top: 50 });
    expect(
      getDialogPosition({ ...anchor, left: 500, width: 200 }, dialog, "left-center", viewport, { x: 10, y: 0 })
    ).toEqual({ left: 190, top: 250 });
    expect(
      getDialogPosition({ ...anchor, left: 500, width: 200 }, dialog, "right-center", viewport, { x: 10, y: 0 })
    ).toEqual({ left: 710, top: 250 });
    expect(getDialogPosition(anchor, dialog, "below-right", viewport, { x: 0, y: 10 })).toEqual({
      left: 600,
      top: 660
    });
    expect(getDialogPosition(anchor, dialog, "below-center", viewport, { x: 0, y: 10 })).toEqual({
      left: 350,
      top: 660
    });
  });

  test("keeps a dialog inside the viewport", () => {
    expect(getDialogPosition({ height: 100, left: -40, top: -30, width: 100 }, dialog, "top-left", viewport)).toEqual({
      left: 8,
      top: 8
    });
  });

  test("keeps a dialog to the right of reserved workspace UI", () => {
    expect(
      getDialogPosition({ height: 600, left: 0, top: 0, width: 400 }, dialog, "top-right", {
        ...viewport,
        left: 500
      })
    ).toEqual({ left: 508, top: 10 });
  });
});
