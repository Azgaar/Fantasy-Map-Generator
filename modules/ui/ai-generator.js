"use strict";

const PROVIDERS = {
  openai: {
    keyLink: "https://platform.openai.com/account/api-keys",
    generate: generateWithOpenAI
  },
  anthropic: {
    keyLink: "https://console.anthropic.com/account/keys",
    generate: generateWithAnthropic
  }
};

const DEFAULT_MODEL = "gpt-4o-mini";

const MODELS = {
  "gpt-4o-mini": "openai",
  "chatgpt-4o-latest": "openai",
  "gpt-4o": "openai",
  "gpt-4-turbo": "openai",
  "o1-preview": "openai",
  "o1-mini": "openai",
  "claude-3-5-haiku-latest": "anthropic",
  "claude-3-5-sonnet-latest": "anthropic",
  "claude-3-opus-latest": "anthropic"
};

const SYSTEM_MESSAGE = "I'm working on my fantasy map.";

async function generateWithOpenAI({key, model, prompt, temperature, onContent}) {
  const headers = {
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

  const getContent = json => {
    const content = json.choices?.[0]?.delta?.content;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithAnthropic({key, model, prompt, temperature, onContent}) {
  const headers = {
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

  const getContent = json => {
    const content = json.delta?.text;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function handleStream(response, getContent) {
  if (!response.ok) {
    const json = await response.json();
    throw new Error(json?.error?.message || "Failed to generate");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, {stream: true});
    const lines = buffer.split("\n");

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const json = JSON.parse(line.slice(6));
          getContent(json);
        } catch (jsonError) {
          ERROR && console.error(`Failed to parse JSON:`, jsonError, `Line: ${line}`);
        }
      }
    }

    buffer = lines.at(-1);
  }
}

function generateWithAi(defaultPrompt, onApply) {
  updateValues();

  $("#aiGenerator").dialog({
    title: "AI Text Generator",
    position: {my: "center", at: "center", of: "svg"},
    resizable: false,
    buttons: {
      Generate: function (e) {
        generate(e.target);
      },
      Apply: function () {
        const result = byId("aiGeneratorResult").value;
        if (!result) return tip("No result to apply", true, "error", 4000);
        onApply(result);
        $(this).dialog("close");
      },
      Close: function () {
        $(this).dialog("close");
      }
    }
  });

  if (modules.generateWithAi) return;
  modules.generateWithAi = true;

  byId("aiGeneratorKeyHelp").on("click", function (e) {
    const model = byId("aiGeneratorModel").value;
    const provider = MODELS[model];
    openURL(PROVIDERS[provider].keyLink);
  });

  function updateValues() {
    byId("aiGeneratorResult").value = "";
    byId("aiGeneratorPrompt").value = defaultPrompt;
    byId("aiGeneratorTemperature").value = localStorage.getItem("fmg-ai-temperature") || "1";

    const select = byId("aiGeneratorModel");
    select.options.length = 0;
    Object.keys(MODELS).forEach(model => select.options.add(new Option(model, model)));
    select.value = localStorage.getItem("fmg-ai-model");
    if (!select.value || !MODELS[select.value]) select.value = DEFAULT_MODEL;

    const provider = MODELS[select.value];
    byId("aiGeneratorKey").value = localStorage.getItem(`fmg-ai-kl-${provider}`) || "";
  }

  async function generate(button) {
    const key = byId("aiGeneratorKey").value;
    if (!key) return tip("Please enter an API key", true, "error", 4000);

    const model = byId("aiGeneratorModel").value;
    if (!model) return tip("Please select a model", true, "error", 4000);
    localStorage.setItem("fmg-ai-model", model);

    const provider = MODELS[model];
    localStorage.setItem(`fmg-ai-kl-${provider}`, key);

    const prompt = byId("aiGeneratorPrompt").value;
    if (!prompt) return tip("Please enter a prompt", true, "error", 4000);

    const temperature = byId("aiGeneratorTemperature").valueAsNumber;
    if (isNaN(temperature)) return tip("Temperature must be a number", true, "error", 4000);
    localStorage.setItem("fmg-ai-temperature", temperature);

    try {
      button.disabled = true;
      const resultArea = byId("aiGeneratorResult");
      resultArea.disabled = true;
      resultArea.value = "";
      const onContent = content => (resultArea.value += content);

      await PROVIDERS[provider].generate({key, model, prompt, temperature, onContent});
    } catch (error) {
      return tip(error.message, true, "error", 4000);
    } finally {
      button.disabled = false;
      byId("aiGeneratorResult").disabled = false;
    }
  }
}
