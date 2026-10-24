// Asking for one value in the app's own dialog: the native prompt does not work in Electron
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";

interface PromptOptions {
  default: number | string;
  step?: number;
  min?: number;
  max?: number;
  required?: boolean;
}

/** Built on open and removed on close; `callback` gets the value only when the user confirms */
export function promptDialog<T extends number | string>(
  text: string,
  options: PromptOptions & { default: T },
  callback: (value: T) => void
): void {
  findEl("prompt")?.remove(); // a new question replaces an unanswered one
  const type = typeof options.default === "number" ? "number" : "text";
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="prompt" class="dialog">
      <form id="promptForm">
        <div id="promptText"></div>
        <input id="promptInput" type="${type}" autocomplete="off" />
        <button type="submit">${t("Confirm")}</button>
        <button type="button" id="promptCancel" formnovalidate>${t("Cancel")}</button>
      </form>
    </div>`
  );

  const dialog = ensureEl("prompt");
  const input = ensureEl<HTMLInputElement>("promptInput");
  ensureEl("promptText").innerHTML = text;
  if (options.step !== undefined) input.step = String(options.step);
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  input.required = options.required !== false;
  input.placeholder = `type a ${type}`;
  input.value = String(options.default);
  input.style.width = text.length > 10 ? "100%" : "auto";

  ensureEl("promptCancel").addEventListener("click", () => dialog.remove());
  ensureEl<HTMLFormElement>("promptForm").addEventListener("submit", event => {
    event.preventDefault();
    dialog.remove();
    callback((type === "number" ? +input.value : input.value) as T);
  });
}
