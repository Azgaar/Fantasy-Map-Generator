"use strict";

const PROVIDERS = {
  openai: {
    keyLink: "https://platform.openai.com/account/api-keys",
    generate: generateWithOpenAI
  },
  anthropic: {
    keyLink: "https://console.anthropic.com/account/keys",
    generate: generateWithAnthropic
  },
  ollama: {
    keyLink: "https://ollama.com/library", // Link to Ollama model library
    generate: generateWithOllama
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
  "claude-3-opus-latest": "anthropic",
  "Ollama (enter model in key field)": "ollama" // Entry for Ollama
};

const SYSTEM_MESSAGE = "I'm working on my fantasy map.";

// Initialize a flag for one-time setup if it doesn't exist
if (typeof modules.generateWithAi_setupDone === 'undefined') {
  modules.generateWithAi_setupDone = false;
}

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

  await handleStream(response, getContent, "openai");
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

  await handleStream(response, getContent, "anthropic");
}

async function generateWithOllama({key, model, prompt, temperature, onContent}) {
  // For Ollama, 'key' is the actual model name entered by the user.
  // 'model' is the value from the dropdown, e.g., "Ollama (enter model in key field)".
  const ollamaModelName = key;

  const headers = {
    "Content-Type": "application/json"
  };

  const body = {
    model: ollamaModelName,
    prompt: prompt,
    system: SYSTEM_MESSAGE,
    options: {
      temperature: temperature
    },
    stream: true
  };

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const getContent = json => {
    // Ollama streams JSON objects with a "response" field for content
    // and "done": true in the final message (which might have an empty response).
    if (json.response) {
      onContent(json.response);
    }
  };

  await handleStream(response, getContent, "ollama");
}

async function handleStream(response, getContent, providerType) {
  if (!response.ok) {
    let errorMessage = `Failed to generate (${response.status} ${response.statusText})`;
    try {
      const json = await response.json();
      if (providerType === "ollama" && json?.error) {
        errorMessage = json.error;
      } else {
        errorMessage = json?.error?.message || json?.error || `Failed to generate (${response.status} ${response.statusText})`;
      }
    } catch (e) {
      // Error message is already set, or parsing failed.
      ERROR && console.error("Failed to parse error response JSON:", e)
    }
    throw new Error(errorMessage);
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
      if (providerType === "ollama") {
        if (line) { // Ollama sends JSON objects directly, hopefully one per line
          try {
            const json = JSON.parse(line);
            getContent(json);
          } catch (jsonError) {
            ERROR && console.error(`Failed to parse JSON from Ollama:`, jsonError, `Line: ${line}`);
          }
        }
      } else { // Existing logic for OpenAI/Anthropic (SSE)
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const json = JSON.parse(line.slice(6));
            getContent(json);
          } catch (jsonError) {
            ERROR && console.error(`Failed to parse JSON:`, jsonError, `Line: ${line}`);
          }
        }
      }
    }

    buffer = lines.at(-1);
  }
}

function generateWithAi(defaultPrompt, onApply) {
  // Helper function to update dialog UI elements
  function updateDialogElements() {
    byId("aiGeneratorResult").value = "";
    byId("aiGeneratorPrompt").value = defaultPrompt;
    byId("aiGeneratorTemperature").value = localStorage.getItem("fmg-ai-temperature") || "1";

    const select = byId("aiGeneratorModel");
    const currentModelVal = select.value; // Preserve current selection if possible before clearing
    select.options.length = 0;
    Object.keys(MODELS).forEach(model => select.options.add(new Option(model, model)));
    
    const storedModel = localStorage.getItem("fmg-ai-model");
    if (storedModel && MODELS[storedModel]) {
      select.value = storedModel;
    } else if (currentModelVal && MODELS[currentModelVal]) {
      select.value = currentModelVal;
    } else {
      select.value = DEFAULT_MODEL;
    }
    if (!select.value || !MODELS[select.value]) select.value = DEFAULT_MODEL; // Final fallback

    const provider = MODELS[select.value];
    const keyInput = byId("aiGeneratorKey"); // Define keyInput here
    if (keyInput) { // Check if keyInput exists
        keyInput.value = localStorage.getItem(`fmg-ai-kl-${provider}`) || "";
        if (provider === "ollama") {
          keyInput.placeholder = "Enter Ollama model name (e.g., llama3)";
        } else {
          keyInput.placeholder = "Enter API Key";
        }
    } else {
        ERROR && console.error("AI Generator: Could not find 'aiGeneratorKey' element in updateDialogElements.");
    }
  }

  // Async helper function for the "Generate" button
  async function doGenerate(button) {
    const key = byId("aiGeneratorKey").value;
    const modelValue = byId("aiGeneratorModel").value;
    const provider = MODELS[modelValue];

    if (provider !== "ollama" && !key) {
      return tip("Please enter an API key", true, "error", 4000);
    }
    if (provider === "ollama" && !key) {
      return tip("Please enter the Ollama model name in the key field", true, "error", 4000);
    }
    if (!modelValue) return tip("Please select a model", true, "error", 4000);
    
    localStorage.setItem("fmg-ai-model", modelValue);
    localStorage.setItem(`fmg-ai-kl-${provider}`, key);

    const promptText = byId("aiGeneratorPrompt").value;
    if (!promptText) return tip("Please enter a prompt", true, "error", 4000);

    const temperature = byId("aiGeneratorTemperature").valueAsNumber;
    if (isNaN(temperature)) return tip("Temperature must be a number", true, "error", 4000);
    localStorage.setItem("fmg-ai-temperature", temperature);

    try {
      button.disabled = true;
      const resultArea = byId("aiGeneratorResult");
      resultArea.disabled = true;
      resultArea.value = "";
      const onContentCallback = content => (resultArea.value += content);

      await PROVIDERS[provider].generate({key: key, model: modelValue, prompt: promptText, temperature, onContent: onContentCallback});
    } catch (error) {
      tip(error.message, true, "error", 4000);
    } finally {
      button.disabled = false;
      byId("aiGeneratorResult").disabled = false;
    }
  }

  $("#aiGenerator").dialog({
    title: "AI Text Generator",
    position: {my: "center", at: "center", of: "svg"},
    resizable: false,
    width: Math.min(600, window.innerWidth - 20),
    modal: true,
    open: function() {
      // Perform one-time setup for event listeners if not already done
      if (!modules.generateWithAi_setupDone) {
        const keyHelpButton = byId("aiGeneratorKeyHelp");
        if (keyHelpButton) {
          keyHelpButton.addEventListener("click", function () {
            const modelValue = byId("aiGeneratorModel").value;
            const provider = MODELS[modelValue];
            if (provider === "ollama") {
              openURL(PROVIDERS.ollama.keyLink);
            } else if (provider && PROVIDERS[provider] && PROVIDERS[provider].keyLink) {
              openURL(PROVIDERS[provider].keyLink);
            }
          });
        } else {
          ERROR && console.error("AI Generator: Could not find 'aiGeneratorKeyHelp' element for event listener.");
        }

        const modelSelect = byId("aiGeneratorModel");
        if (modelSelect) {
          modelSelect.addEventListener("change", function() {
              const newModelValue = this.value;
              const newProvider = MODELS[newModelValue];
              const keyInput = byId("aiGeneratorKey");
              if (keyInput) {
                if (newProvider === "ollama") {
                    keyInput.placeholder = "Enter Ollama model name (e.g., llama3)";
                } else {
                    keyInput.placeholder = "Enter API Key";
                }
                // Load the stored key for the newly selected provider
                keyInput.value = localStorage.getItem(`fmg-ai-kl-${newProvider}`) || "";
              } else {
                ERROR && console.error("AI Generator: Could not find 'aiGeneratorKey' element during model change listener.");
              }
          });
        } else {
          ERROR && console.error("AI Generator: Could not find 'aiGeneratorModel' element for event listener.");
        }
        modules.generateWithAi_setupDone = true;
      }

      // Always update dialog elements when dialog is opened
      updateDialogElements();
    },
    buttons: {
      "Generate": function (e) {
        // The button passed to doGenerate is the DOM element itself, not the jQuery event object.
        doGenerate(e.currentTarget || e.target);
      },
      "Apply": function () {
        const result = byId("aiGeneratorResult").value;
        if (!result) return tip("No result to apply", true, "error", 4000);
        onApply(result);
        $(this).dialog("close");
      },
      "Close": function () {
        $(this).dialog("close");
      }
    }
  });
}

// Expose the generateWithAi function
modules.generateWithAi = generateWithAi;
window.generateWithAi = generateWithAi;
