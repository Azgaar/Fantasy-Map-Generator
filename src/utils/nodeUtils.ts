/**
 * Get the composed path of a node (including shadow DOM and window)
 * @param {Node | Window} node - The starting node or window
 * @returns {Array<Node>} - The composed path as an array
 */
export const getComposedPath = function(node: any): Array<Node | Window> {
  let parent;
  if (node.parentNode) parent = node.parentNode;
  else if (node.host) parent = node.host;
  else if (node.defaultView) parent = node.defaultView;
  if (parent !== undefined) return [node].concat(getComposedPath(parent));
  return [node];
}

/**
 * Generate a unique ID for a given core string
 * @param {string} core - The core string for the ID
 * @param {number} [i=1] - The starting index
 * @returns {string} - The unique ID
 */
export const getNextId = function(core: string, i: number = 1): string {
  while (document.getElementById(core + i)) i++;
  return core + i;
}

declare global {
  interface Window {
    getComposedPath: typeof getComposedPath;
    getNextId: typeof getNextId;
  }
}