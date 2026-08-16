import { useRovingFocus } from "@patkepa/kantzen-ui/interactions";
import type { ReactNode } from "react";
import { WorkspacePanelEmptyState } from "./workspace-panel";
import "./data-table.css";

export interface WorkspaceTableColumn<TRow> {
  align?: "center" | "end" | "start";
  id: string;
  label: string;
  render: (row: TRow) => ReactNode;
}

interface WorkspaceDataTableProps<TRow> {
  ariaLabel: string;
  columns: readonly WorkspaceTableColumn<TRow>[];
  emptyDescription?: string;
  emptyTitle?: string;
  getRowId: (row: TRow) => string;
  onSelect?: (row: TRow) => void;
  rows: readonly TRow[];
  selectedId?: string;
}

export function WorkspaceDataTable<TRow>({
  ariaLabel,
  columns,
  emptyDescription,
  emptyTitle = "No items",
  getRowId,
  onSelect,
  rows,
  selectedId
}: WorkspaceDataTableProps<TRow>): React.JSX.Element {
  const selectedIndex = selectedId ? rows.findIndex(row => getRowId(row) === selectedId) : 0;
  const { focusIndex, getItemProps, registerItem } = useRovingFocus({
    initialIndex: Math.max(selectedIndex, 0),
    itemCount: rows.length
  });

  if (!rows.length) {
    return <WorkspacePanelEmptyState description={emptyDescription} icon="th" title={emptyTitle} />;
  }

  return (
    <div className="fmg-data-table-scroll">
      <table aria-label={ariaLabel} className="fmg-data-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th className={`fmg-data-table__cell--${column.align ?? "start"}`} key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowId = getRowId(row);
            const selected = rowId === selectedId;
            const rovingProps = onSelect ? getItemProps(index) : undefined;

            return (
              <tr
                {...rovingProps}
                aria-selected={onSelect ? selected : undefined}
                className={selected ? "fmg-data-table__row--selected" : undefined}
                key={rowId}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onKeyDown={onSelect ? event => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusIndex((index + 1) % rows.length);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusIndex((index - 1 + rows.length) % rows.length);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusIndex(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusIndex(rows.length - 1);
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row);
                  }
                } : undefined}
                ref={onSelect ? element => registerItem(index, element) : undefined}
              >
                {columns.map(column => (
                  <td className={`fmg-data-table__cell--${column.align ?? "start"}`} key={column.id}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
