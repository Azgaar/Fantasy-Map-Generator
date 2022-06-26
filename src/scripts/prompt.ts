import {ERROR} from "/src/config/logging";

// prompt replacer (prompt does not work in Electron)
const $prompt: HTMLElement = document.getElementById("prompt")!;
const $form: HTMLFormElement = $prompt.querySelector("#promptForm")!;
const $input: HTMLInputElement = $prompt.querySelector("#promptInput")!;
const $text: HTMLDivElement = $prompt.querySelector("#promptText")!;
const $cancel: HTMLButtonElement = $prompt.querySelector("#promptCancel")!;

const defaultText = "Please provide an input";
const defaultOptions = {default: 1, step: 0.01, min: 0, max: 100, required: true};

export function prompt(promptText = defaultText, options = defaultOptions, callback: (value: number | string) => void) {
  if (options.default === undefined)
    return ERROR && console.error("Prompt: options object does not have default value defined");

  $text.innerHTML = promptText;
  $input.type = typeof options.default === "number" ? "number" : "text";

  if (options.step !== undefined) $input.step = String(options.step);
  if (options.min !== undefined) $input.min = String(options.min);
  if (options.max !== undefined) $input.max = String(options.max);

  $input.required = options.required === false ? false : true;
  $input.placeholder = "type a " + $input.type;
  $input.value = String(options.default);
  $prompt.style.display = "block";

  $form.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      $prompt.style.display = "none";

      const value = $input.type === "number" ? Number($input.value) : $input.value;
      if (callback) callback(value);
    },
    {once: true}
  );
}

$cancel.addEventListener("click", () => {
  $prompt.style.display = "none";
});
