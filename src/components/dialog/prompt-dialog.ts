import { showDomDialog } from "@/components/ui/dom-dialog";
import type { PromptOptions } from "@/utils/commonUtils";

type PromptCallback = (value: number | string) => void;

export function showPrompt(text: string, options: PromptOptions, callback?: PromptCallback): void {
  if (options.default === undefined) {
    ERROR && console.error("Prompt: options object does not have default value defined");
    return;
  }

  const type = typeof options.default === "number" ? "number" : "text";
  const content = document.createElement("form");
  content.id = "promptDialog";
  content.innerHTML = /* html */ `
    <div class="prompt-dialog__text"></div>
    <input class="prompt-dialog__input" autocomplete="off" />
    <button type="submit">Confirm</button>
    <button type="button">Cancel</button>`;
  const promptText = content.querySelector<HTMLElement>(".prompt-dialog__text")!;
  const input = content.querySelector<HTMLInputElement>(".prompt-dialog__input")!;
  const cancel = content.querySelector<HTMLButtonElement>('button[type="button"]')!;
  promptText.innerHTML = text;
  input.type = type;
  if (options.step !== undefined) input.step = String(options.step);
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  input.required = options.required !== false;
  input.placeholder = `type a ${type}`;
  input.value = String(options.default);
  input.style.width = text.length > 10 ? "100%" : "auto";

  const dialog = showDomDialog({
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Input",
    width: "fit-content"
  });
  content.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      const value = type === "number" ? Number(input.value) : input.value;
      dialog.close();
      callback?.(value);
    },
    { once: true }
  );
  cancel.addEventListener("click", () => dialog.close(), { once: true });
  queueMicrotask(() => input.focus());
}
