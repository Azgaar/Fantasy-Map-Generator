// Development as the views show it: the level and its era, the era in the interface language
import { ERA_LABELS } from "@/data/id-labels";
import { Development } from "@/model/society/development-generator";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

/** The era of a development level, translated; 0 is no development */
export const eraLabel = (level: number): string =>
  rn(level) ? ERA_LABELS[Development.getEra(rn(level))] : t("No development");

/** A development level and its era, as "34, Commercial Revolution" */
export const renderDevelopment = (level: number): string =>
  rn(level) ? `${rn(level)}, ${eraLabel(level)}` : eraLabel(0);

export const developmentTip = (level: number): string =>
  rn(level) ? t("Development: {{level}}, {{era}}", { level: rn(level), era: eraLabel(level) }) : eraLabel(0);
