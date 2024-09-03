export type ElementMap = {
  a: HTMLAnchorElement;
  button: HTMLButtonElement;
  div: HTMLDivElement;
  img: HTMLImageElement;
  input: HTMLInputElement;
  output: HTMLOutputElement;
  select: HTMLSelectElement;
  canvas: HTMLCanvasElement;
  // add more types as needed
};

// function definition with overloads to account for different options
export function byId<K extends keyof ElementMap>(id: string): ElementMap[K];
export function byId<K extends keyof ElementMap>(id: string, options?: {throwOnNull: false}): ElementMap[K] | null;
export function byId<K extends keyof ElementMap>(id: string, options = {throwOnNull: true}) {
  const element = document.getElementById(id);
  if (!element && options.throwOnNull) {
    throw new Error(`Element ${id} not found`);
  } 
  return element as ElementMap[K] | null;
}

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

export function getSelectedOption(id: string) {
  const $element = byId(id);
  if (!$element) throw new Error(`Element ${id} not found`);

  return ($element as HTMLSelectElement).selectedOptions[0];
}

// apply drop-down menu option. If the value is not in options, add it
export function applyDropdownOption($select: HTMLSelectElement, value: string, name = value) {
  const isExisting = Array.from($select.options).some(o => o.value === value);
  if (!isExisting) $select.options.add(new Option(name, value));
  $select.value = value;
}