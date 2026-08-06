import { describe, expect, it, vi } from "vitest";
import { initEditorTable } from "./table";

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("initEditorTable", () => {
  it("slices the first page and reports counts", () => {
    const onUpdate = vi.fn();
    const table = initEditorTable({ getData: () => items(250), onUpdate, pageSize: 100 });
    table.refresh();
    const view = onUpdate.mock.calls[0][0];
    expect(view.rows).toHaveLength(100);
    expect(view.rows[0]).toBe(1);
    expect(view).toMatchObject({ page: 1, totalPages: 3, total: 250 });
    expect(view.all).toHaveLength(250);
  });

  it("goto clamps to the valid page range", () => {
    const onUpdate = vi.fn();
    const table = initEditorTable({ getData: () => items(250), onUpdate, pageSize: 100 });
    table.goto(99);
    expect(table.view().page).toBe(3);
    expect(table.view().rows).toHaveLength(50);
    table.goto(0);
    expect(table.view().page).toBe(1);
  });

  it("keeps the clamped page when the data shrinks on refresh", () => {
    let data = items(250);
    const table = initEditorTable({ getData: () => data, onUpdate: () => {}, pageSize: 100 });
    table.goto(3);
    data = items(120);
    table.refresh();
    expect(table.view().page).toBe(2);
  });

  it("reset returns to page 1", () => {
    const table = initEditorTable({ getData: () => items(250), onUpdate: () => {}, pageSize: 100 });
    table.goto(3);
    table.reset();
    expect(table.view().page).toBe(1);
  });

  it("renders a single page for small datasets", () => {
    const table = initEditorTable({ getData: () => items(5), onUpdate: () => {} });
    table.refresh();
    expect(table.view()).toMatchObject({ page: 1, totalPages: 1, total: 5 });
  });
});
