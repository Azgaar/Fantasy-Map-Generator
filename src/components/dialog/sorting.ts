import { ensureEl } from "@/utils";
import { type DialogSort, dialogState } from "./state";
import type { EditorColumn } from "./table";

type SortAccessors<T> = Record<string, (item: T) => string | number>;

/** Make every .sortable header in the container sort the lines below it */
export function applySortingByHeader(dialogId: string, headerContainerId = `${dialogId}Header`): void {
  const container = document.getElementById(headerContainerId);
  if (!container) return;

  restoreSortState(dialogId, container);
  applySorting(container);
  for (const header of Array.from(container.querySelectorAll<HTMLElement>(".sortable"))) {
    header.addEventListener("click", () => sortLines(dialogId, header));
  }
}

function toggleSortIcon(dialogId: string, header: HTMLElement): void {
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
  saveSortState(dialogId, headers);
}

/** Toggle the sorting order of the clicked header and re-sort the lines */
export function sortLines(dialogId: string, header: HTMLElement): void {
  toggleSortIcon(dialogId, header);
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

function getActiveSort(headers: HTMLElement): DialogSort | null {
  const header = headers.querySelector<HTMLElement>("div[class*='icon-sort']");
  if (!header) return null;
  return {
    sortBy: header.dataset.sortby as string,
    alphabetically: header.classList.contains("alphabetically"),
    direction: header.className.includes("-down") ? -1 : 1
  };
}

function saveSortState(dialogId: string, headers: HTMLElement): void {
  const sort = getActiveSort(headers);
  if (sort) dialogState.set(dialogId, "sorting", sort);
}

function restoreSortState(dialogId: string, headers: HTMLElement): void {
  const sort = dialogState.get(dialogId, "sorting", () => getActiveSort(headers));
  if (!sort) return;

  const header = Array.from(headers.querySelectorAll<HTMLElement>(".sortable")).find(
    cell => cell.dataset.sortby === sort.sortBy
  );
  if (!header) {
    dialogState.remove(dialogId, "sorting");
    return;
  }

  for (const sortable of Array.from(headers.querySelectorAll<HTMLElement>(".sortable"))) {
    for (const className of Array.from(sortable.classList)) {
      if (className.includes("icon-sort")) sortable.classList.remove(className);
    }
  }

  const type = header.classList.contains("alphabetically") ? "name" : "number";
  const order = sort.direction === -1 ? "down" : "up";
  header.classList.add(`icon-sort-${type}-${order}`);
}

export function sortData<T>(data: T[], sort: DialogSort, accessors: SortAccessors<T>): T[] {
  const get = accessors[sort.sortBy];
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
  restoreSortState(dialogId, headers);
  for (const cell of Array.from(headers.querySelectorAll<HTMLElement>(".sortable"))) {
    cell.addEventListener("click", () => {
      toggleSortIcon(dialogId, cell);
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
