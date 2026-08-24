import type { WorkspaceDialogPlacement } from "./dialog-position";

export type DomDialogPresentation = "dialog" | "panel";

const placementOverrides: { placement: WorkspaceDialogPlacement; token: symbol }[] = [];
const presentationOverrides: { presentation: DomDialogPresentation; token: symbol }[] = [];

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

export function getDialogPresentationOverride(): DomDialogPresentation | undefined {
  return presentationOverrides.at(-1)?.presentation;
}

export function withDomDialogPresentation<T>(presentation: DomDialogPresentation, openDialog: () => T): T {
  const override = { presentation, token: Symbol(presentation) };
  presentationOverrides.push(override);
  const removeOverride = () => {
    const index = presentationOverrides.findIndex(item => item.token === override.token);
    if (index !== -1) presentationOverrides.splice(index, 1);
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
