import type { WorkspaceDialogPlacement } from "./dialog-position";

const placementOverrides: { placement: WorkspaceDialogPlacement; token: symbol }[] = [];

export function getDialogPlacementOverride(): WorkspaceDialogPlacement | undefined {
  return placementOverrides.at(-1)?.placement;
}

export function withDomDialogPlacement<T>(placement: WorkspaceDialogPlacement, openDialog: () => T): T {
  const override = { placement, token: Symbol(placement) };
  placementOverrides.push(override);
  const removeOverride = () => {
    const index = placementOverrides.findIndex(item => item.token === override.token);
    if (index !== -1) placementOverrides.splice(index, 1);
  };

  try {
    const result = openDialog();
    if (result instanceof Promise) return result.finally(removeOverride) as T;
    removeOverride();
    return result;
  } catch (error) {
    removeOverride();
    throw error;
  }
}
