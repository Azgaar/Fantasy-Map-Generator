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

type ElementMapKeys = keyof ElementMap;

interface ByIdOptions {
  throwOnNull?: boolean;
  // add more options as needed
}

// function definition with overloads to account for different options
export function byId<K extends ElementMapKeys>(id: string, options?: ByIdOptions & {throwOnNull: true}): ElementMap[K];
export function byId<K extends ElementMapKeys>(id: string, options: ByIdOptions & {throwOnNull: boolean}): ElementMap[K]|null;
/**
 * Retrieves an element from the DOM by its ID.
 * @template K - The key of the element in the ElementMap.
 * @param {string} id - The ID of the element to retrieve.
 * @param {ByIdOptions} [options] - The options for retrieving the element.
 * @param {boolean} [options.throwOnNull=true] - Whether to throw an error if the element is not found.
 * @returns {ElementMap[K] | null} The retrieved element or null if not found.
 * @throws {Error} If the element is not found and options.throwOnNull is true.
 */
export function byId<K extends ElementMapKeys>(id: string, options: ByIdOptions = {throwOnNull: true}) {
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