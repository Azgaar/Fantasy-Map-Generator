// The Astral-view listener registry lives apart from view-mode so the renderers can subscribe
// before view-mode finishes evaluating its own (cyclic) imports.
const listeners = new Set<() => void>();

export function subscribeAstralView(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function notifyAstralView(): void {
  for (const listener of listeners) listener();
}
