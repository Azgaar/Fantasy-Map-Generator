export type DialogSort = {
  sortBy: string;
  alphabetically: boolean;
  direction: -1 | 1;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type DialogStateKey = "filters" | "sorting" | "columns";
type DialogEntry = Partial<Record<DialogStateKey, JsonValue>>;

const STORAGE_KEY = "fmg-dialog-state";
let entries = load();

export const dialogState = {
  get<Value extends JsonValue>(dialogId: string, key: DialogStateKey, defaults: () => Value): Value {
    const entry = getEntry(dialogId);
    const value = restoreValue(entry[key], defaults());
    entry[key] = value;
    return value;
  },

  set<Value extends JsonValue>(dialogId: string, key: DialogStateKey, value: Value): void {
    getEntry(dialogId)[key] = value;
    save();
  },

  remove(dialogId: string, key: DialogStateKey): void {
    const entry = getEntry(dialogId);
    delete entry[key];
    if (!Object.keys(entry).length) delete entries[dialogId];
    save();
  },

  clear(): void {
    entries = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
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

function restoreValue<Value extends JsonValue>(stored: JsonValue | undefined, fallback: Value): Value {
  if (stored === undefined) return fallback;
  if (fallback === null) return stored as Value;
  if (Array.isArray(fallback)) return (Array.isArray(stored) ? stored : fallback) as Value;
  if (!isRecord(fallback)) return (typeof stored === typeof fallback ? stored : fallback) as Value;
  if (!isRecord(stored)) return fallback;

  return Object.fromEntries(
    Object.entries(fallback).map(([key, defaultValue]) => {
      const value = stored[key];
      const valid = Array.isArray(defaultValue) ? Array.isArray(value) : typeof value === typeof defaultValue;
      return [key, valid ? value : defaultValue];
    })
  ) as Value;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
