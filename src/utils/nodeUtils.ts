import { pointer } from "d3";

/**
 * @param id - The ID of the element to retrieve
 * @typeParam T - The type of the element to retrieve, extending HTMLElement
 * @returns The element with the specified ID, cast to the specified type
 */
export const ensureEl = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) {
    // TODO: throw an error instead of logging it, and handle it properly in the caller
    ERROR && console.error(`Element with id "${id}" not found.`);
    // TOBE: throw new Error(`Element with id "${id}" not found.`);
  }
  return el as T;
};

/**
 * @param id - The ID of the element to retrieve
 * @typeParam T - The type of the element to retrieve, extending HTMLElement
 * @returns The element with the specified ID, cast to the specified type, or null if not found
 */
export const findEl = <T extends HTMLElement>(id: string): T | null => {
  return document.getElementById(id) as T | null;
};

/**
 * Remove an element, destroying its jQuery UI dialog widget first if it has one
 * @param {string} id - The ID of the element to remove
 */
export const destroyDialogIfExists = (id: string): void => {
  const el = findEl(id);
  if (!el) return;
  if (el.classList.contains("ui-dialog-content")) window.$(el).dialog("destroy");
  el.remove();
};

/**
 * Get the composed path of a node (including shadow DOM and window)
 * @param {Node | Window} node - The starting node or window
 * @returns {Array<Node>} - The composed path as an array
 */
export const getComposedPath = (node: any): Array<Node | Window> => {
  let parent: Node | Window | undefined;
  if (node.parentNode) parent = node.parentNode;
  else if (node.host) parent = node.host;
  else if (node.defaultView) parent = node.defaultView;
  if (parent !== undefined) return [node].concat(getComposedPath(parent));
  return [node];
};

/**
 * Get pointer coordinates relative to a node, supporting both mouse and touch events.
 * d3 v7 pointer() unwraps to the source event and reads clientX from it, which TouchEvents lack.
 * d3 v5 mouse() read changedTouches[0]; this helper restores that behavior.
 * @param {any} event - A native event or d3 event wrapper (e.g. a drag event)
 * @param {Element} node - The node to compute coordinates relative to
 * @returns {[number, number]} - The [x, y] coordinates relative to the node
 */
export const getPointer = (event: any, node?: Element | null): [number, number] => {
  let source = event;
  while (source.sourceEvent) source = source.sourceEvent;
  const touch = source.changedTouches?.[0] ?? source.touches?.[0];
  return pointer(touch ?? source, node ?? source.currentTarget);
};

/**
 * Generate a unique ID for a given core string
 * @param {string} core - The core string for the ID
 * @param {number} [i=1] - The starting index
 * @returns {string} - The unique ID
 */
export const getNextId = (core: string, i: number = 1): string => {
  while (document.getElementById(core + i)) i++;
  return core + i;
};

/**
 * Select a drop-down option by value, adding the option if it is not there yet
 * @param {HTMLSelectElement} select - The select element
 * @param {string} value - The value to select
 * @param {string} name - The label to use if the option has to be added
 */
export const applyOption = (element: HTMLElement, value: string, name = value): void => {
  const select = element as HTMLSelectElement;
  const isExisting = Array.from(select.options).some(option => option.value === value);
  if (!isExisting) select.options.add(new Option(name, value));
  select.value = value;
};

declare global {
  interface Window {
    getNextId: typeof getNextId;
    ensureEl: typeof ensureEl;
    findEl: typeof findEl;
  }
}
