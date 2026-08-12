// Sorting of editor lines by clicking a column header — shared by every table-shaped editor

import { ensureEl } from "@/utils";
import type { EditorColumn } from "./table";

/** Make every .sortable header in the container sort the lines below it */
export function applySortingByHeader(headerContainerId: string): void {
  const container = document.getElementById(headerContainerId);
  if (!container) return;

  for (const header of Array.from(container.querySelectorAll<HTMLElement>(".sortable"))) {
    header.addEventListener("click", () => sortLines(header));
  }
}

function toggleSortIcon(header: HTMLElement): void {
  const type = header.classList.contains("alphabetically") ? "name" : "number";
  const isSorted = header.className.includes("icon-sort");
  let order = header.className.includes("-down") ? "-up" : "-down";
  if (!isSorted && type === "name") order = "-up";

  const headers = header.parentNode as HTMLElement;
  for (const sortable of Array.from(headers.querySelectorAll<HTMLElement>("div.sortable"))) {
    for (const className of Array.from(sortable.classList)) {
      if (className.includes("icon-sort")) sortable.classList.remove(className);
    }
  }
  header.classList.add(`icon-sort-${type}${order}`);
}

/** Toggle the sorting order of the clicked header and re-sort the lines */
export function sortLines(header: HTMLElement): void {
  toggleSortIcon(header);
  applySorting(header.parentNode as HTMLElement);
}

/** Sort the lines below the headers by the currently sorted header */
export function applySorting(headers: HTMLElement): void {
  const header = headers.querySelector<HTMLElement>("div[class*='icon-sort']");
  if (!header) return;

  const sortBy = header.dataset.sortby as string;
  const alphabetically = header.classList.contains("alphabetically");
  const direction = header.className.includes("-down") ? -1 : 1;

  const list = headers.nextElementSibling as HTMLElement;
  const lines = Array.from(list.children) as HTMLElement[];

  lines
    .sort((a, b) => {
      const aValue = alphabetically ? a.dataset[sortBy] : Number(a.dataset[sortBy]);
      const bValue = alphabetically ? b.dataset[sortBy] : Number(b.dataset[sortBy]);
      if (aValue === undefined || bValue === undefined) return 0;
      return (aValue > bValue ? 1 : aValue < bValue ? -1 : 0) * direction;
    })
    .forEach(line => {
      list.appendChild(line);
    });
}

type SortState = { sortby: string; alphabetically: boolean; direction: -1 | 1 };
type SortAccessors<T> = Record<string, (item: T) => string | number>;

function getActiveSort(headers: HTMLElement): SortState | null {
  const header = headers.querySelector<HTMLElement>("div[class*='icon-sort']");
  if (!header) return null;
  return {
    sortby: header.dataset.sortby as string,
    alphabetically: header.classList.contains("alphabetically"),
    direction: header.className.includes("-down") ? -1 : 1
  };
}

export function sortData<T>(data: T[], sort: SortState, accessors: SortAccessors<T>): T[] {
  const get = accessors[sort.sortby];
  if (!get) return data;
  return data.sort((a, b) => {
    const aValue = get(a);
    const bValue = get(b);
    if (sort.alphabetically) {
      const aString = String(aValue);
      const bString = String(bValue);
      return (aString > bString ? 1 : aString < bString ? -1 : 0) * sort.direction;
    }
    return (Number(aValue) - Number(bValue)) * sort.direction;
  });
}

export function bindColumnSorting(dialogId: string, onSort: () => void): void {
  const headers = ensureEl(`${dialogId}Header`);
  for (const cell of Array.from(headers.querySelectorAll<HTMLElement>(".sortable"))) {
    cell.addEventListener("click", () => {
      toggleSortIcon(cell);
      onSort();
    });
  }
}

export function sortDataByColumns<T>(dialogId: string, data: T[], columns: EditorColumn<T>[]): T[] {
  const headers = ensureEl(`${dialogId}Header`);
  const sort = getActiveSort(headers);
  if (!sort) return data;
  const accessors: SortAccessors<T> = {};
  for (const column of columns) {
    if (column.sortBy) accessors[column.key] = column.sortBy;
  }
  return sortData(data, sort, accessors);
}
