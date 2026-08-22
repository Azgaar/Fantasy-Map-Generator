export interface DialogSort {
  sortBy: string;
  alphabetically: boolean;
  direction: -1 | 1;
}

type DialogFilters = Record<string, unknown>;
type DialogEntry = { filters?: unknown; sorting?: unknown };

const STORAGE_KEY = "fmgDialogState";
let entries = load();

export const dialogState = {
  getFilters<Filters extends DialogFilters>(dialogId: string, defaults: () => Filters): Filters {
    const entry = getEntry(dialogId);
    const filters = restoreFilters(entry.filters, defaults());
    entry.filters = filters;
    return filters;
  },

  setFilters<Filters extends DialogFilters>(dialogId: string, filters: Filters): void {
    getEntry(dialogId).filters = filters;
    save();
  },

  getSorting(dialogId: string, defaults?: () => DialogSort | null): DialogSort | undefined {
    const entry = getEntry(dialogId);
    if (isDialogSort(entry.sorting)) return entry.sorting;

    const sorting = defaults?.() || undefined;
    entry.sorting = sorting;
    if (sorting) save();
    return sorting;
  },

  setSorting(dialogId: string, sorting: DialogSort | null): void {
    getEntry(dialogId).sorting = sorting || undefined;
    save();
  },

  clear(): void {
    entries = {};
    localStorage.removeItem(STORAGE_KEY);
  }
};

function getEntry(dialogId: string): DialogEntry {
  const entry = entries[dialogId];
  if (entry) return entry;
  const created: DialogEntry = {};
  entries[dialogId] = created;
  return created;
}

function load(): Record<string, DialogEntry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return isRecord(parsed) ? (parsed as Record<string, DialogEntry>) : {};
  } catch {
    return {};
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

function restoreFilters<Filters extends DialogFilters>(stored: unknown, defaults: Filters): Filters {
  if (!isRecord(stored)) return defaults;
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = stored[key];
      const valid = Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback;
      return [key, valid ? value : fallback];
    })
  ) as Filters;
}

function isDialogSort(value: unknown): value is DialogSort {
  return (
    isRecord(value) &&
    typeof value.sortBy === "string" &&
    typeof value.alphabetically === "boolean" &&
    (value.direction === -1 || value.direction === 1)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
