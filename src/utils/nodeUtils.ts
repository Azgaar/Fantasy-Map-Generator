import {byId} from "./shorthands";

// get next unused id
export function getNextId(core: string, index = 1) {
  while (byId(core + index)) index++;
  return core + index;
}

export function getInputValue(id: string) {
  return (byId(id) as HTMLInputElement)?.value;
}

export function getInputNumber(id: string) {
  return (byId(id) as HTMLInputElement)?.valueAsNumber;
}

// apply drop-down menu option. If the value is not in options, add it
export function applyDropdownOption($select: HTMLSelectElement, value: string, name = value) {
  const isExisting = Array.from($select.options).some(o => o.value === value);
  if (!isExisting) $select.options.add(new Option(name, value));
  $select.value = value;
}
