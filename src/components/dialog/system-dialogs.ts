// The generic alert and prompt dialogs, filled with their message by whoever opens them
import { initializePrompt } from "@/utils/commonUtils";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <div id="alert" style="display: none" class="dialog">
    <p id="alertMessage">${t("Warning")}</p>
  </div>
  <div id="prompt" style="display: none" class="dialog">
    <form id="promptForm">
      <div id="promptText"></div>
      <input id="promptInput" type="number" step=".01" placeholder="${t("type value")}" autocomplete="off" />
      <button type="submit">${t("Confirm")}</button>
      <button type="button" id="promptCancel" formnovalidate>${t("Cancel")}</button>
    </form>
  </div>
`;

ensureEl("dialogs").insertAdjacentHTML("beforeend", TEMPLATE);
initializePrompt();
