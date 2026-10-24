export type DialogSort = {
  sortBy: string;
  alphabetically: boolean;
  direction: -1 | 1;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type DialogStateKey = "filters" | "sorting" | "columns" | "position" | "legend";
type DialogEntry = Partial<Record<DialogStateKey, JsonValue>>;

const STORAGE_KEY = "fmg-dialog-state";
const RESET_KEYS: DialogStateKey[] = ["position", "columns", "sorting"];
let entries = load();
const resetHandlers = new Map<string, Map<string, () => void>>();
const changeHandlers = new Map<string, () => void>();

export const dialogState = {
  /** Stored value validated against the defaults; defaults themselves are never stored */
  get<Value extends JsonValue>(dialogId: string, key: DialogStateKey, defaults: () => Value): Value {
    return restoreValue(entries[dialogId]?.[key], defaults());
  },

  set<Value extends JsonValue>(dialogId: string, key: DialogStateKey, value: Value): void {
    getEntry(dialogId)[key] = value;
    save();
    changeHandlers.get(dialogId)?.();
  },

  remove(dialogId: string, key: DialogStateKey): void {
    removeKey(dialogId, key);
    save();
    changeHandlers.get(dialogId)?.();
  },

  /** Whether the dialog has a remembered layout that reset would drop */
  hasLayout(dialogId: string): boolean {
    return RESET_KEYS.some(key => entries[dialogId]?.[key] !== undefined);
  },

  /** Called after any stored value of the dialog changes; re-registering replaces the handler */
  onChange(dialogId: string, handler: () => void): void {
    changeHandlers.set(dialogId, handler);
  },

  /** Register what a dialog part redraws once its remembered layout is dropped; re-registering a key replaces the handler */
  onReset(dialogId: string, key: string, handler: () => void): void {
    const handlers = resetHandlers.get(dialogId) ?? new Map<string, () => void>();
    handlers.set(key, handler);
    resetHandlers.set(dialogId, handlers);
  },

  /** Forget the dialog's remembered layout and let its parts redraw with defaults */
  reset(dialogId: string): void {
    for (const key of RESET_KEYS) removeKey(dialogId, key);
    save();
    changeHandlers.get(dialogId)?.();
    for (const handler of resetHandlers.get(dialogId)?.values() ?? []) handler();
  },

  /** Drop the handlers of a destroyed dialog so its detached elements are released */
  forget(dialogId: string): void {
    changeHandlers.delete(dialogId);
    resetHandlers.delete(dialogId);
  },

  clear(): void {
    entries = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    for (const handler of changeHandlers.values()) handler();
  }
};

function getEntry(dialogId: string): DialogEntry {
  const entry = entries[dialogId];
  if (entry) return entry;
  const created: DialogEntry = {};
  entries[dialogId] = created;
  return created;
}

function removeKey(dialogId: string, key: DialogStateKey): void {
  const entry = entries[dialogId];
  if (!entry) return;
  delete entry[key];
  if (!Object.keys(entry).length) delete entries[dialogId];
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
