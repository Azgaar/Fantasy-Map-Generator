import { ERA_LABELS } from "@/data/id-labels";
import { Development } from "@/model/society/development-generator";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

/** An era's name as shown: a default one translates, the user's own stays as typed */
export const eraName = (name: string): string => ERA_LABELS[name] ?? name;

/** The era of a development level, as shown; 0 is no development */
export const eraLabel = (level: number): string =>
  rn(level) ? eraName(Development.getEra(rn(level))) : t("No development");

/** A development level and its era, as "34, Commercial Revolution" */
export const renderDevelopment = (level: number): string =>
  rn(level) ? `${rn(level)}, ${eraLabel(level)}` : eraLabel(0);

export const developmentTip = (level: number): string =>
  rn(level) ? t("Development: {{level}}, {{era}}", { level: rn(level), era: eraLabel(level) }) : eraLabel(0);
