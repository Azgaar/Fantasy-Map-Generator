export const MAP_MUTATED_EVENT = "map:mutated";

export interface MapMutationDetail {
  source: string;
}

export function notifyMapMutation(source: string): void {
  window.dispatchEvent(new CustomEvent<MapMutationDetail>(MAP_MUTATED_EVENT, { detail: { source } }));
}
