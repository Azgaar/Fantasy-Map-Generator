import {byId} from "./shorthands";

// get next unused id
export function getNextId(core: string, index = 1) {
  while (byId(core + index)) index++;
  return core + index;
}

export function getInputValue(id: string) {
  const $element = byId(id);
  if (!$element) throw new Error(`Element ${id} not found`);
  if (!("value" in $element)) throw new Error(`Element ${id} is not an input`);

  return (byId(id) as HTMLInputElement)?.value;
}

export function getInputNumber(id: string) {
  const $element = byId(id);
  if (!$element) throw new Error(`Element ${id} not found`);
  if (!("value" in $element)) throw new Error(`Element ${id} is not an input`);

  return (byId(id) as HTMLInputElement)?.valueAsNumber;
}

export function setInputValue(id: string, value: string | number | boolean) {
  const $element = byId(id);
  if (!$element) throw new Error(`Element ${id} not found`);
  if (!("value" in $element)) throw new Error(`Element ${id} is not an input`);

  ($element as HTMLInputElement).value = String(value);
}

// apply drop-down menu option. If the value is not in options, add it
export function applyDropdownOption($select: HTMLSelectElement, value: string, name = value) {
  const isExisting = Array.from($select.options).some(o => o.value === value);
  if (!isExisting) $select.options.add(new Option(name, value));
  $select.value = value;
}
