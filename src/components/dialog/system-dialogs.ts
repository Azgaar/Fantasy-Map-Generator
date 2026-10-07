// The generic alert and prompt dialogs, filled with their message by whoever opens them
import { initializePrompt } from "@/utils/commonUtils";
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <div id="alert" style="display: none" class="dialog">
    <p id="alertMessage">Warning!</p>
  </div>
  <div id="prompt" style="display: none" class="dialog">
    <form id="promptForm">
      <div id="promptText"></div>
      <input id="promptInput" type="number" step=".01" placeholder="type value" autocomplete="off" />
      <button type="submit">Confirm</button>
      <button type="button" id="promptCancel" formnovalidate>Cancel</button>
    </form>
  </div>
`;

ensureEl("dialogs").insertAdjacentHTML("beforeend", TEMPLATE);
initializePrompt();
