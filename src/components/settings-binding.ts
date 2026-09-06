// The DOM adapter for the settings table: `data-stored` names the setting a control edits, and
// these two functions are the whole of the wiring a panel needs.
// See docs/architecture/configuration.md
import { isPinnable, parseInput, read, type SettingKey, write } from "@/components/settings";
import { lock } from "@/utils/preferences";

// anything that carries a value: an input, a select, an <output>, or a <slider-input>
type Field = Element & { value: string };

const isField = (element: Element | null): element is Field => Boolean(element) && "value" in (element as Field);

/** Every control that shows this setting: the ones that say so, plus the `<key>Input`/`Output` pair */
function fieldsFor(key: string): Field[] {
  const found = new Set<Element>(document.querySelectorAll(`[data-stored="${key}"]`));
  for (const id of [`${key}Input`, `${key}Output`, key]) {
    const element = document.getElementById(id);
    if (element) found.add(element);
  }
  return [...found].filter(isField);
}

/** Push what the object holds into every control that shows it, leaving the one being edited alone */
export function syncSetting(key: string, editing?: EventTarget | null): void {
  const value = read(key);
  if (value === null || value === undefined) return; // nothing chosen yet: the control keeps its own
  for (const field of fieldsFor(key)) if (field !== editing) field.value = String(value);
}

export function syncSettings(keys: readonly SettingKey[]): void {
  for (const key of keys) syncSetting(key);
}

/**
 * Wire every `data-stored` control under `root`: the value goes to the object its setting names,
 * its twin control follows, and a value the user set by hand is pinned. `after` is the panel's own
 * redraw - the derivation the value implies is the setting's, and has already run. It is told
 * whether the drag has `settled`, so a panel can preview live or wait for the gesture to end.
 */
export function bindSettings(root: Element, after?: (key: SettingKey, settled: boolean) => void): void {
  const onChange = (event: Event) => {
    const target = event.target as (HTMLElement & { value?: string }) | null;
    const key = target?.dataset?.stored;
    if (!key) return;

    // an input event is a drag in progress: apply it, but wait for the change event to pin it
    const value = parseInput(key, target.value ?? "");
    if (value === undefined) return;

    const settled = event.type === "change";
    write(key, value);
    syncSetting(key, target);
    if (settled) {
      if (isPinnable(key)) lock(key); // a value the user set by hand: keep it on the next map
      Options.persist();
    }
    after?.(key as SettingKey, settled);
  };

  root.addEventListener("input", onChange);
  root.addEventListener("change", onChange);
}
