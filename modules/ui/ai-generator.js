"use strict";

const LLMS = ["gpt-4o-mini", "chatgpt-4o-latest", "gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-3-5-sonnet-20240620"];
const SYSTEM_MESSAGE = "I'm working on my fantasy map.";

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
    },
    open: function() {
      initialize();
    },
    close: function() {
      const helpLink = byId("aiGeneratorKey").nextElementSibling;
      helpLink.removeEventListener("mouseover", showDataTip);
    }
  });

  if (modules.generateWithAi) return;
  modules.generateWithAi = true;

  function initialize() {
    byId("aiGeneratorModel").addEventListener("change", function(e) {
      updateKeyHelp(e.target.value);
    });
    
    updateValues();
  }

  function updateValues() {
    byId("aiGeneratorResult").value = "";
    byId("aiGeneratorPrompt").value = defaultPrompt;
    byId("aiGeneratorKey").value = localStorage.getItem("fmg-ai-kl") || "";
    byId("aiGeneratorTemperature").value = localStorage.getItem("fmg-ai-temperature") || "1.2";

    const select = byId("aiGeneratorModel");
    select.options.length = 0;
    LLMS.forEach(model => select.options.add(new Option(model, model)));
    select.value = localStorage.getItem("fmg-ai-model") || LLMS[0];
    
    updateKeyHelp(select.value);
  }

  function updateKeyHelp(model) {
    const keyInput = byId("aiGeneratorKey");
    const helpLink = keyInput.nextElementSibling;
    
    helpLink.removeEventListener("mouseover", showDataTip);
    
    if (model.includes("claude")) {
      keyInput.placeholder = "Enter Anthropic API key";
      helpLink.href = "https://console.anthropic.com/account/keys";
      helpLink.dataset.tip = "Get the key at Anthropic's website. The key will be stored in your browser and send to Anthropic API directly. The Map Generator doesn't store the key or any generated data";
    } else {
      keyInput.placeholder = "Enter OpenAI API key";
      helpLink.href = "https://platform.openai.com/account/api-keys";
      helpLink.dataset.tip = "Get the key at OpenAI website. The key will be stored in your browser and send to OpenAI API directly. The Map Generator doesn't store the key or any generated data";
    }
    
    helpLink.addEventListener("mouseover", showDataTip);
  }

  async function generate(button) {
    const key = byId("aiGeneratorKey").value;
    if (!key) return tip("Please enter an API key", true, "error", 4000);
    localStorage.setItem("fmg-ai-kl", key);

    const model = byId("aiGeneratorModel").value;
    if (!model) return tip("Please select a model", true, "error", 4000);
    localStorage.setItem("fmg-ai-model", model);

    const prompt = byId("aiGeneratorPrompt").value;
    if (!prompt) return tip("Please enter a prompt", true, "error", 4000);

    const temperature = parseFloat(byId("aiGeneratorTemperature").value);
    if (isNaN(temperature) || temperature < 0 || temperature > 2) {
      return tip("Temperature must be a number between 0 and 2", true, "error", 4000);
    }
    localStorage.setItem("fmg-ai-temperature", temperature.toString());

    try {
      button.disabled = true;
      const resultArea = byId("aiGeneratorResult");
      resultArea.value = "";
      resultArea.disabled = true;

      if (model.includes("claude")) {
        await generateWithClaude(key, model, prompt, temperature, resultArea);
      } else {
        await generateWithGPT(key, model, prompt, temperature, resultArea);
      }
    } catch (error) {
      return tip(error.message, true, "error", 4000);
    } finally {
      button.disabled = false;
      byId("aiGeneratorResult").disabled = false;
    }
  }

  async function generateWithClaude(key, model, prompt, temperature, resultArea) {
    const baseUrl = "https://api.anthropic.com/v1/messages";
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        messages: [{role: "user", content: prompt}],
        stream: true,
        max_tokens: 4096,
        temperature
      })
    });

    if (!response.ok) {
      const json = await response.json();
      throw new Error(json?.error?.message || "Failed to generate with Claude");
    }

    await handleStream(response, resultArea, true);
  }

  async function generateWithGPT(key, model, prompt, temperature, resultArea) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {role: "system", content: SYSTEM_MESSAGE},
          {role: "user", content: prompt}
        ],
        temperature,
        stream: true
      })
    });

    if (!response.ok) {
      const json = await response.json();
      throw new Error(json?.error?.message || "Failed to generate with GPT");
    }

    await handleStream(response, resultArea, false);
  }

  async function handleStream(response, resultArea, isClaude) {
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
        if (line.startsWith("data: ") && (!isClaude && line !== "data: [DONE]")) {
          try {
            const jsonData = JSON.parse(line.slice(6));
            const content = isClaude 
              ? jsonData.delta?.text 
              : jsonData.choices[0].delta.content;
            
            if (content) resultArea.value += content;
          } catch (jsonError) {
            console.warn(
              `Failed to parse ${isClaude ? "Claude" : "OpenAI"} JSON:`,
              jsonError,
              "Line:",
              line
            );
          }
        }
      }

      buffer = lines[lines.length - 1];
    }
  }
}