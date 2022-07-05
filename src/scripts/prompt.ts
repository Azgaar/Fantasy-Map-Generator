interface IPromptStringOptions {
  default: string;
  required?: boolean;
}

interface IPromptNumberOptions {
  default: number;
  step?: number;
  min?: number;
  max?: number;
  required?: boolean;
}

const isNumerical = (options: {default: number | string}): options is IPromptNumberOptions =>
  typeof options.default === "number";

// prompt replacer (prompt does not work in Electron)
const $prompt: HTMLElement = document.getElementById("prompt")!;
const $form: HTMLFormElement = $prompt.querySelector("#promptForm")!;
const $input: HTMLInputElement = $prompt.querySelector("#promptInput")!;
const $text: HTMLDivElement = $prompt.querySelector("#promptText")!;
const $cancel: HTMLButtonElement = $prompt.querySelector("#promptCancel")!;

const defaultText = "Please provide an input";
const defaultOptions = {default: 1, step: 0.01, min: 0, max: 100, required: true};

export function prompt(
  promptText: string = defaultText,
  options: IPromptStringOptions | IPromptNumberOptions = defaultOptions,
  callback?: (value: string | number) => void
): void {
  const numerical = isNumerical(options);
  if (numerical) {
    $input.type = "number";
    if (options.step !== undefined) $input.step = String(options.step);
    if (options.min !== undefined) $input.min = String(options.min);
    if (options.max !== undefined) $input.max = String(options.max);
    if (callback) callback("rw");
  } else {
    $input.type = "text";
  }

  $text.innerHTML = promptText;

  $input.required = options.required === false ? false : true;
  $input.placeholder = "type a " + $input.type;
  $input.value = String(options.default);
  $prompt.style.display = "block";

  $form.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      $prompt.style.display = "none";

      if (callback) {
        if (isNumerical(options)) {
          const value = Number($input.value);
          callback(value);
        } else {
          const value = $input.value;
          callback(value);
        }
      }
    },
    {once: true}
  );
}

$cancel.addEventListener("click", () => {
  $prompt.style.display = "none";
});
