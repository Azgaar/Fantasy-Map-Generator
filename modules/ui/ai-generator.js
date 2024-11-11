"use strict";

const GPT_MODELS = ["gpt-4o-mini", "chatgpt-4o-latest", "gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
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
    }
  });

  if (modules.generateWithAi) return;
  modules.generateWithAi = true;

  function updateValues() {
    byId("aiGeneratorResult").value = "";
    byId("aiGeneratorPrompt").value = defaultPrompt;
    byId("aiGeneratorKey").value = localStorage.getItem("fmg-ai-kl") || "";
    byId("aiGeneratorTemperature").value = localStorage.getItem("fmg-ai-temperature") || "1.2";

    const select = byId("aiGeneratorModel");
    select.options.length = 0;
    GPT_MODELS.forEach(model => select.options.add(new Option(model, model)));
    select.value = localStorage.getItem("fmg-ai-model") || GPT_MODELS[0];
  }

  async function generate(button) {
    const key = byId("aiGeneratorKey").value;
    if (!key) return tip("Please enter an OpenAI API key", true, "error", 4000);
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
          temperature: temperature,
          stream: true // Enable streaming
        })
      });

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
              const jsonData = JSON.parse(line.slice(6));
              const content = jsonData.choices[0].delta.content;
              if (content) resultArea.value += content;
            } catch (jsonError) {
              console.warn("Failed to parse JSON:", jsonError, "Line:", line);
            }
          }
        }

        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      return tip(error.message, true, "error", 4000);
    } finally {
      button.disabled = false;
      byId("aiGeneratorResult").disabled = false;
    }
  }
}
