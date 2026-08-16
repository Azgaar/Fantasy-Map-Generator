import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceDataTable, type WorkspaceTableColumn } from "./data-table";

interface PlaceRow {
  id: string;
  name: string;
  population: number;
}

const COLUMNS: WorkspaceTableColumn<PlaceRow>[] = [
  { id: "name", label: "Name", render: row => row.name },
  { align: "end", id: "population", label: "Population", render: row => row.population.toLocaleString() }
];

describe("WorkspaceDataTable", () => {
  test("renders labelled columns and selectable rows", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceDataTable
        ariaLabel="Burgs"
        columns={COLUMNS}
        getRowId={row => row.id}
        onSelect={() => {}}
        rows={[
          { id: "1", name: "Northpass", population: 1200 },
          { id: "2", name: "Westwatch", population: 800 }
        ]}
        selectedId="2"
      />
    );

    expect(markup.includes('aria-label="Burgs"')).toBe(true);
    expect(markup.includes('<th class="fmg-data-table__cell--start" scope="col">Name</th>')).toBe(true);
    expect(markup.includes('aria-selected="true"')).toBe(true);
    expect(markup.includes("Northpass")).toBe(true);
    expect(markup.includes("Westwatch")).toBe(true);
  });

  test("renders an empty state when no rows are available", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceDataTable
        ariaLabel="Burgs"
        columns={COLUMNS}
        emptyDescription="Generate burgs to populate this overview."
        emptyTitle="No burgs"
        getRowId={row => row.id}
        rows={[]}
      />
    );

    expect(markup.includes("No burgs")).toBe(true);
    expect(markup.includes("Generate burgs to populate this overview.")).toBe(true);
  });
});
