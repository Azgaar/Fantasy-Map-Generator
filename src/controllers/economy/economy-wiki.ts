// The Economy wiki page, opened from the bottom of every economy dialog

import { wiki } from "@/utils/common-utils";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";

export const economyWikiButton = (id: string) =>
  /* html */ `<button id="${id}" type="button" data-tip="${t("Open the Economy wiki page")}" class="icon-info"></button>`;

/** Call once the button is in the page */
export const bindEconomyWiki = (id: string) => ensureEl(id).addEventListener("click", () => wiki("Economy"));
