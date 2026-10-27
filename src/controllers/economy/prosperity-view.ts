import { type Living, Prosperity } from "@/model/economy/prosperity";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

const LEVELS: Record<string, { label: () => string; color: string }> = {
  Desolate: { label: () => t("Desolate"), color: "#8a1f1f" },
  Destitute: { label: () => t("Destitute"), color: "#a33" },
  Poor: { label: () => t("Poor"), color: "#b65e1f" },
  Modest: { label: () => t("Modest"), color: "#9a7a1a" },
  Comfortable: { label: () => t("Comfortable"), color: "#6a8a2a" },
  Thriving: { label: () => t("Thriving"), color: "#3a8a3a" },
  Affluent: { label: () => t("Affluent"), color: "#2a7a6a" },
  Opulent: { label: () => t("Opulent"), color: "#2a5a9a" },
  Splendid: { label: () => t("Splendid"), color: "#5a3a9a" },
  Peerless: { label: () => t("Peerless"), color: "#8a2a8a" }
};

export const prosperityLevel = (prosperity: number) => LEVELS[Prosperity.getLevel(prosperity)].label();
export const prosperityColor = (prosperity: number) => LEVELS[Prosperity.getLevel(prosperity)].color;

/** "57% Thriving", colored by level */
export function renderProsperity(prosperity: number): string {
  return `<span style="color: ${prosperityColor(prosperity)}">${rn(prosperity * 100)}% ${prosperityLevel(prosperity)}</span>`;
}

/** "57%", colored by level, for narrow cells */
export function renderProsperityPercent(prosperity: number): string {
  return `<span style="color: ${prosperityColor(prosperity)}">${rn(prosperity * 100)}%</span>`;
}

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
