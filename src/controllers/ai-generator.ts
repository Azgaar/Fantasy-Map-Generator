import { tip } from "@/components/tooltips";
import { openURL } from "@/utils";
import { destroyDialogIfExists, ensureEl } from "../utils";

type Provider = "openai" | "anthropic" | "ollama";

interface GenerationOptions {
  key: string;
  model: string;
  prompt: string;
  temperature: number;
  onContent: (content: string) => void;
}

const PROVIDERS: Record<Provider, { keyLink: string; generate: (options: GenerationOptions) => Promise<void> }> = {
  openai: {
    keyLink: "https://platform.openai.com/account/api-keys",
    generate: generateWithOpenAI
  },
  anthropic: {
    keyLink: "https://console.anthropic.com/account/keys",
    generate: generateWithAnthropic
  },
  ollama: {
    keyLink: "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Ollama-text-generation",
    generate: generateWithOllama
  }
};

const DEFAULT_MODEL = "gpt-5.6-luna";

const MODELS: Record<string, Provider> = {
  "gpt-5.6-luna": "openai",
  "gpt-5.6-terra": "openai",
  "gpt-5.6-sol": "openai",
  "gpt-5-mini": "openai",
  "gpt-5-nano": "openai",
  "claude-opus-4-8": "anthropic",
  "claude-sonnet-5": "anthropic",
  "claude-haiku-4-5": "anthropic",
  "ollama (local models)": "ollama"
};

const FIXED_TEMPERATURE_MODELS = new Set([
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5-mini",
  "gpt-5-nano",
  "claude-opus-4-8",
  "claude-sonnet-5"
]);

const SYSTEM_MESSAGE = "I'm working on my fantasy map.";

async function generateWithOpenAI({ key, model, prompt, temperature, onContent }: GenerationOptions): Promise<void> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`
  };

  const messages = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: prompt }
  ];

  const body: Record<string, unknown> = { model, messages, stream: true };
  if (!FIXED_TEMPERATURE_MODELS.has(model)) body.temperature = temperature;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const getContent = (json: StreamChunk): void => {
    const content = json.choices?.[0]?.delta?.content;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithAnthropic({ key, model, prompt, temperature, onContent }: GenerationOptions): Promise<void> {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };

  const messages = [{ role: "user", content: prompt }];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      system: SYSTEM_MESSAGE,
      messages,
      max_tokens: 4096,
      stream: true,
      ...(FIXED_TEMPERATURE_MODELS.has(model) ? {} : { temperature })
    })
  });

  const getContent = (json: StreamChunk): void => {
    const content = json.delta?.text;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithOllama({ key, model, prompt, temperature, onContent }: GenerationOptions): Promise<void> {
  const ollamaModelName = key; // for Ollama, 'key' is the actual model name entered by the user
  void model;

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModelName,
      prompt,
      system: SYSTEM_MESSAGE,
      options: { temperature },
      stream: true
    })
  });

  const getContent = (json: StreamChunk): void => {
    if (json.response) onContent(json.response);
  };

  await handleStream(response, getContent);
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
  delta?: { text?: string };
  response?: string;
}

async function handleStream(response: Response, getContent: (json: StreamChunk) => void): Promise<void> {
  if (!response.ok) {
    let errorMessage = `Failed to generate (${response.status} ${response.statusText})`;
    try {
      const json = await response.json();
      errorMessage = json.error?.message || json.error || errorMessage;
    } catch (error) {
      ERROR && console.error("Failed to parse AI provider error response", error);
    }
    throw new Error(errorMessage);
  }

  if (!response.body) throw new Error("Response has no body to stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line === "data: [DONE]") break;

      try {
        const parsed = line.startsWith("data: ") ? JSON.parse(line.slice(6)) : JSON.parse(line);
        getContent(parsed);
      } catch (error) {
        ERROR && console.error("Failed to parse line:", line, error);
      }
    }

    buffer = lines.at(-1) ?? "";
  }
}

function open(defaultPrompt: string, onApply: (result: string) => void): void {
  renderDialog();
  setInitialValues(defaultPrompt);

  $("#aiGenerator").dialog({
    title: "AI Text Generator",
    position: { my: "center", at: "center", of: "svg" },
    resizable: false,
    close: () => destroyDialogIfExists("aiGenerator"),
    buttons: {
      Generate: (e: Event) => {
        void generate(e.target as HTMLButtonElement);
      },
      Apply: function (this: HTMLElement) {
        const result = ensureEl<HTMLTextAreaElement>("aiGeneratorResult").value;
        if (!result) return tip("No result to apply", true, "error", 4000);
        onApply(result);
        $(this).dialog("close");
      },
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("aiGenerator");

  const html = /* html */ `<div id="aiGenerator" class="dialog stable">
    <div style="display: flex; flex-direction: column; gap: 0.3em; width: 100%">
      <textarea id="aiGeneratorResult" placeholder="Generated text will appear here" cols="30" rows="10"></textarea>
      <textarea id="aiGeneratorPrompt" placeholder="Type a prompt here" cols="30" rows="5"></textarea>
      <div style="display: flex; align-items: center; gap: 1em">
        <label for="aiGeneratorModel"
          >Model:
          <select id="aiGeneratorModel"></select>
        </label>
        <label
          for="aiGeneratorTemperature"
          data-tip="Temperature controls response randomness; higher values mean more creativity, lower values mean more predictability"
        >
          Temperature:
          <input id="aiGeneratorTemperature" type="number" min="-1" max="2" step=".1" class="icon-key" />
        </label>
        <label for="aiGeneratorKey"
          >Key:
          <input
            id="aiGeneratorKey"
            placeholder="Enter API key"
            class="icon-key"
            data-tip="Enter API key. Note: the Generator doesn't store the key or any generated data"
          />
          <button
            id="aiGeneratorKeyHelp"
            class="icon-help-circled"
            data-tip="Click to see the usage instructions"
          ></button>
        </label>
      </div>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("aiGeneratorKeyHelp").on("click", () => {
    const model = ensureEl<HTMLSelectElement>("aiGeneratorModel").value;
    const provider = MODELS[model];
    openURL(PROVIDERS[provider].keyLink);
  });
}

function setInitialValues(defaultPrompt: string): void {
  ensureEl<HTMLTextAreaElement>("aiGeneratorResult").value = "";
  ensureEl<HTMLTextAreaElement>("aiGeneratorPrompt").value = defaultPrompt;
  ensureEl<HTMLInputElement>("aiGeneratorTemperature").value = localStorage.getItem("fmg-ai-temperature") || "1";

  const select = ensureEl<HTMLSelectElement>("aiGeneratorModel");
  select.options.length = 0;
  Object.keys(MODELS).forEach(model => {
    select.options.add(new Option(model, model));
  });
  select.value = localStorage.getItem("fmg-ai-model") ?? "";
  if (!select.value || !MODELS[select.value]) select.value = DEFAULT_MODEL;

  const provider = MODELS[select.value];
  ensureEl<HTMLInputElement>("aiGeneratorKey").value = localStorage.getItem(`fmg-ai-kl-${provider}`) || "";
}

async function generate(button: HTMLButtonElement): Promise<void> {
  const key = ensureEl<HTMLInputElement>("aiGeneratorKey").value;
  if (!key) return tip("Please enter an API key", true, "error", 4000);

  const model = ensureEl<HTMLSelectElement>("aiGeneratorModel").value;
  if (!model) return tip("Please select a model", true, "error", 4000);
  localStorage.setItem("fmg-ai-model", model);

  const provider = MODELS[model];
  localStorage.setItem(`fmg-ai-kl-${provider}`, key);

  const prompt = ensureEl<HTMLTextAreaElement>("aiGeneratorPrompt").value;
  if (!prompt) return tip("Please enter a prompt", true, "error", 4000);

  const temperature = ensureEl<HTMLInputElement>("aiGeneratorTemperature").valueAsNumber;
  if (Number.isNaN(temperature)) return tip("Temperature must be a number", true, "error", 4000);
  localStorage.setItem("fmg-ai-temperature", String(temperature));

  try {
    button.disabled = true;
    const resultArea = ensureEl<HTMLTextAreaElement>("aiGeneratorResult");
    resultArea.disabled = true;
    resultArea.value = "";
    const onContent = (content: string): void => {
      resultArea.value += content;
    };

    await PROVIDERS[provider].generate({ key, model, prompt, temperature, onContent });
  } catch (error) {
    const message = (error instanceof Error && error.message) || String(error) || "Failed to generate text";
    return tip(message, true, "error", 4000);
  } finally {
    button.disabled = false;
    ensureEl<HTMLTextAreaElement>("aiGeneratorResult").disabled = false;
  }
}

export const AiGenerator = { open };
