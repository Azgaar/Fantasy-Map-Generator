import { requireWorkspaceCapability } from "@/application/workspace-mode";

export const RUN_REGENERATION_EVENT = "fmg-run-regeneration";

export interface RegenerationCommandDetail {
  buttonId: string;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface RegenerationCommandTarget {
  dispatchEvent: (event: Event) => boolean;
}

export function dispatchRegenerationCommand(
  buttonId: string,
  modifiers: Pick<MouseEvent, "ctrlKey" | "metaKey">,
  target: RegenerationCommandTarget = window
): boolean {
  if (!requireWorkspaceCapability("map:generate")) return false;
  return target.dispatchEvent(
    new CustomEvent<RegenerationCommandDetail>(RUN_REGENERATION_EVENT, {
      detail: { buttonId, ctrlKey: modifiers.ctrlKey, metaKey: modifiers.metaKey }
    })
  );
}
