import { type Living, Prosperity } from "@/model/economy/prosperity";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

const LEVELS: Record<string, () => string> = {
  Desolate: () => t("Desolate"),
  Destitute: () => t("Destitute"),
  Poor: () => t("Poor"),
  Modest: () => t("Modest"),
  Comfortable: () => t("Comfortable"),
  Thriving: () => t("Thriving"),
  Affluent: () => t("Affluent"),
  Opulent: () => t("Opulent"),
  Splendid: () => t("Splendid"),
  Peerless: () => t("Peerless")
};

// for charts of people by level only: prosperity itself is shown as text
const COLORS: Record<string, string> = {
  Desolate: "#8a1f1f",
  Destitute: "#a33",
  Poor: "#b65e1f",
  Modest: "#9a7a1a",
  Comfortable: "#6a8a2a",
  Thriving: "#3a8a3a",
  Affluent: "#2a7a6a",
  Opulent: "#2a5a9a",
  Splendid: "#5a3a9a",
  Peerless: "#8a2a8a"
};

export const prosperityLevel = (prosperity: number) => LEVELS[Prosperity.getLevel(prosperity)]();
export const prosperityColor = (prosperity: number) => COLORS[Prosperity.getLevel(prosperity)];

/** "57% Thriving" */
export const renderProsperity = (prosperity: number) => `${rn(prosperity * 100)}%, ${prosperityLevel(prosperity)}`;

/** "57%", for narrow cells */
export const renderProsperityPercent = (prosperity: number) => `${rn(prosperity * 100)}%`;

/** Its three parts, for one line next to the level */
export function renderProsperityParts(living: Living): string {
  return t("needs met {{needs}}%, comfort ×{{comfort}}, {{variety}} goods", {
    needs: rn(living.needs * 100),
    comfort: rn(living.comfort, 1),
    variety: rn(living.variety, 1)
  });
}

export function prosperityTip(prosperity: number): string {
  return t("Prosperity: {{level}}. Defined by consumption fulfillment, quality and variety", {
    level: prosperityLevel(prosperity)
  });
}
