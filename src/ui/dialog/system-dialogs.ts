// The generic alert dialog, filled with its message by whoever opens it
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";

const TEMPLATE = /* html */ `
  <div id="alert" style="display: none" class="dialog">
    <p id="alertMessage">${t("Warning")}</p>
  </div>
`;

ensureEl("dialogs").insertAdjacentHTML("beforeend", TEMPLATE);
