export interface AiGenerateOptions {
  key: string;
  model: string;
  prompt: string;
  temperature: number;
  onContent: (content: string) => void;
}

export interface AiProvider {
  keyLink: string;
  generate: (options: AiGenerateOptions) => Promise<void>;
}

const SYSTEM_MESSAGE = "I'm working on my fantasy map.";

async function generateWithOpenAI({key, model, prompt, temperature, onContent}: AiGenerateOptions) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`
  };

  const messages = [
    {role: "system", content: SYSTEM_MESSAGE},
    {role: "user", content: prompt}
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({model, messages, temperature, stream: true})
  });

  const getContent = (json: any) => {
    const content = json.choices?.[0]?.delta?.content;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithAnthropic({key, model, prompt, temperature, onContent}: AiGenerateOptions) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };

  const messages = [{role: "user", content: prompt}];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({model, system: SYSTEM_MESSAGE, messages, temperature, max_tokens: 4096, stream: true})
  });

  const getContent = (json: any) => {
    const content = json.delta?.text;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithOllama({key, model: _model, prompt, temperature, onContent}: AiGenerateOptions) {
  const ollamaModelName = key; // for Ollama, 'key' is the actual model name entered by the user
  const ollamaHost = localStorage.getItem("fmg-ai-ollama-host") || "http://localhost:11434";

  const response = await fetch(`${ollamaHost}/api/generate`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      model: ollamaModelName,
      prompt,
      system: SYSTEM_MESSAGE,
      options: {temperature},
      stream: true
    })
  });

  const getContent = (json: any) => {
    if (json.response) onContent(json.response);
  };

  await handleStream(response, getContent);
}

async function handleStream(response: Response, getContent: (json: any) => void) {
  if (!response.ok) {
    let errorMessage = `Failed to generate (${response.status} ${response.statusText})`;
    try {
      const json = await response.json();
      errorMessage = json.error?.message || json.error || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, {stream: true});
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

    buffer = lines.at(-1) || "";
  }
}

export const PROVIDERS: Record<string, AiProvider> = {
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

export const DEFAULT_MODEL = "gpt-4o-mini";

export const MODELS: Record<string, string> = {
  "gpt-4o-mini": "openai",
  "chatgpt-4o-latest": "openai",
  "gpt-4o": "openai",
  "gpt-4-turbo": "openai",
  o3: "openai",
  "o3-mini": "openai",
  "o3-pro": "openai",
  "o4-mini": "openai",
  "claude-opus-4-20250514": "anthropic",
  "claude-sonnet-4-20250514": "anthropic",
  "claude-3-5-haiku-latest": "anthropic",
  "claude-3-5-sonnet-latest": "anthropic",
  "claude-3-opus-latest": "anthropic",
  "ollama (local models)": "ollama"
};

export function getStoredModel(): string {
  const stored = localStorage.getItem("fmg-ai-model");
  if (stored && MODELS[stored]) return stored;
  return DEFAULT_MODEL;
}

export function getStoredProvider(): string {
  return MODELS[getStoredModel()];
}

export function getStoredKey(): string {
  const provider = getStoredProvider();
  return localStorage.getItem(`fmg-ai-kl-${provider}`) || "";
}

export function getStoredTemperature(): number {
  const stored = localStorage.getItem("fmg-ai-temperature");
  return stored ? parseFloat(stored) : 1;
}

export function hasApiKey(): boolean {
  return !!getStoredKey();
}

export function getLanguageOverride(): string {
  return localStorage.getItem("fmg-ai-language-override") || "";
}

export function getCustomPrompt(): string {
  return localStorage.getItem("fmg-ai-custom-prompt") || "";
}

export function getOllamaHost(): string {
  return localStorage.getItem("fmg-ai-ollama-host") || "http://localhost:11434";
}

export async function generateText(prompt: string): Promise<string> {
  const model = getStoredModel();
  const provider = getStoredProvider();
  const key = getStoredKey();
  const temperature = getStoredTemperature();

  if (!key) throw new Error("No API key configured. Please set up your AI provider first.");

  let result = "";
  await PROVIDERS[provider].generate({
    key,
    model,
    prompt,
    temperature,
    onContent: (content: string) => {
      result += content;
    }
  });

  return result.trim();
}
