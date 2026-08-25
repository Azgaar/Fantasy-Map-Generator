import type { WorkspaceMode } from "@/application/workspace-mode";

export interface DocumentDirtyState {
  clear: () => void;
  isDirty: () => boolean;
  mark: () => void;
}

export function createDocumentDirtyState(getWorkspaceMode: () => WorkspaceMode): DocumentDirtyState {
  let dirty = false;
  return {
    clear: () => {
      dirty = false;
    },
    isDirty: () => dirty,
    mark: () => {
      if (getWorkspaceMode() === "edit") dirty = true;
    }
  };
}
