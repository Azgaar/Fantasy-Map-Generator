import { getWorkspaceMode } from "@/application/workspace-mode";

export const MAP_MUTATED_EVENT = "map:mutated";

export interface MapMutationDetail {
  source: string;
}

export function notifyMapMutation(source: string): void {
  if (getWorkspaceMode() === "view") {
    console.error(`[Workspace mode] Document mutation reported while in View mode: ${source}`);
  }
  if (typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent<MapMutationDetail>(MAP_MUTATED_EVENT, { detail: { source } }));
  }
}
