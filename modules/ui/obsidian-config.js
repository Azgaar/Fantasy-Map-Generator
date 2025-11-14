"use strict";

// Obsidian Configuration UI

function openObsidianConfig() {
  // Load current config
  const {apiUrl, apiKey, vaultName, enabled} = ObsidianBridge.config;

  byId("obsidianApiUrl").value = apiUrl || "http://127.0.0.1:27123";
  byId("obsidianApiKey").value = apiKey || "";
  byId("obsidianVaultName").value = vaultName || "";

  updateObsidianStatus(enabled);

  $("#obsidianConfig").dialog({
    title: "Obsidian Vault Configuration",
    width: "600px",
    position: {my: "center", at: "center", of: "svg"}
  });
}

function updateObsidianStatus(enabled) {
  const statusEl = byId("obsidianStatus");
  if (enabled) {
    statusEl.textContent = "✅ Connected";
    statusEl.style.color = "#2ecc71";
  } else {
    statusEl.textContent = "❌ Not connected";
    statusEl.style.color = "#e74c3c";
  }
}

async function testObsidianConnection() {
  const apiUrl = byId("obsidianApiUrl").value.trim();
  const apiKey = byId("obsidianApiKey").value.trim();

  if (!apiUrl || !apiKey) {
    tip("Please enter both API URL and API Key", false, "error", 3000);
    return;
  }

  // Temporarily set config for testing
  Object.assign(ObsidianBridge.config, {apiUrl, apiKey});

  byId("obsidianStatus").textContent = "Testing connection...";
  byId("obsidianStatus").style.color = "#f39c12";

  try {
    await ObsidianBridge.testConnection();
    updateObsidianStatus(true);
    tip("Successfully connected to Obsidian!", true, "success", 3000);
  } catch (error) {
    updateObsidianStatus(false);
    tip("Connection failed: " + error.message, true, "error", 5000);
  }
}

function saveObsidianConfig() {
  const apiUrl = byId("obsidianApiUrl").value.trim();
  const apiKey = byId("obsidianApiKey").value.trim();
  const vaultName = byId("obsidianVaultName").value.trim();

  if (!apiUrl || !apiKey) {
    tip("Please enter both API URL and API Key", false, "error", 3000);
    return;
  }

  Object.assign(ObsidianBridge.config, {apiUrl, apiKey, vaultName});
  ObsidianBridge.saveConfig();

  $("#obsidianConfig").dialog("close");
  tip("Obsidian configuration saved", true, "success", 2000);
}
