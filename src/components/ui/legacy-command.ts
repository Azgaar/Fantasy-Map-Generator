export interface LegacyCommandTarget {
  disabled?: boolean;
  click: () => void;
}

export interface LegacyCommandRoot {
  getElementById: (id: string) => LegacyCommandTarget | null;
}

export type LegacyCommandResult = "executed" | "disabled" | "missing";

/**
 * Compatibility adapter for UI commands that are still owned by legacy controls.
 * Replace individual uses with typed controller commands as their workflows migrate.
 */
export function executeLegacyCommand(targetId: string, root: LegacyCommandRoot = document): LegacyCommandResult {
  const target = root.getElementById(targetId);
  if (!target) return "missing";
  if (target.disabled) return "disabled";

  target.click();
  return "executed";
}
