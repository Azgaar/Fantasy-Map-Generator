// src/viewer/main.js

import '../engine/utils/polyfills.js';

import { generate as generateMapEngine } from '../engine/main.js';
import { 
    buildConfigFromUI, 
    applyConfigToUI,
    buildConfigFromJSON,
    saveConfigToJSON,
    buildConfigFromPreset
} from './config-builder.js';
import { 
    getPreset, 
    getPresetNames, 
    getPresetDescriptions 
} from './config-presets.js';
import { 
    validateConfig, 
    sanitizeConfig, 
    validateAndFix,
    getValidationReport 
} from './config-validator.js';

// We will create the renderer and UI modules later
// import { renderMap } from './render.js'; 
// import { initializeUI } from './ui.js';

/**
 * Handle map generation with validation
 */
function handleGenerateClick() {
    console.log("Building config from UI and calling engine...");
    
    // Build configuration from current UI state
    const config = buildConfigFromUI();
    
    // Validate and fix configuration
    const { fixed, originalValidation, fixedValidation, wasFixed } = validateAndFix(config);
    
    // Log validation results
    if (originalValidation.errors.length > 0) {
        console.error("Configuration errors found:", originalValidation.errors);
    }
    
    if (originalValidation.warnings.length > 0) {
        console.warn("Configuration warnings:", originalValidation.warnings);
    }
    
    if (wasFixed) {
        console.log("Configuration was auto-fixed");
    }
    
    // If still invalid after fixing, show error
    if (!fixedValidation.valid) {
        const report = getValidationReport(fixedValidation);
        console.error("Configuration cannot be fixed:\n" + report);
        alert("Configuration validation failed. Check console for details.");
        return;
    }
    
    // Save configuration to localStorage for session persistence
    try {
        localStorage.setItem('fmg-last-config', saveConfigToJSON(fixed));
    } catch (e) {
        console.warn("Could not save config to localStorage:", e);
    }
    
    // Single, clean call to the engine with validated config
    const mapData = generateMapEngine(fixed);

    console.log("Engine finished. Map data generated:", mapData);
    // The renderer will take over from here
    // renderMap(mapData);
}

/**
 * Handle preset selection
 */
function handlePresetChange(presetName) {
    if (!presetName || presetName === 'custom') return;
    
    console.log(`Loading preset: ${presetName}`);
    const preset = getPreset(presetName);
    
    if (preset) {
        // Apply preset to UI
        applyConfigToUI(preset);
        console.log(`Preset "${presetName}" applied to UI`);
    } else {
        console.error(`Preset "${presetName}" not found`);
    }
}

/**
 * Save current configuration to file
 */
function saveConfiguration() {
    const config = buildConfigFromUI();
    const validation = validateConfig(config);
    
    if (!validation.valid) {
        if (confirm("Configuration has validation issues. Save anyway?")) {
            downloadConfig(config);
        }
    } else {
        downloadConfig(config);
    }
}

/**
 * Download configuration as JSON file
 */
function downloadConfig(config) {
    const jsonString = saveConfigToJSON(config);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fmg-config-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Configuration downloaded");
}

/**
 * Load configuration from file
 */
function loadConfigurationFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = buildConfigFromJSON(e.target.result);
            if (config) {
                const { fixed, fixedValidation } = validateAndFix(config);
                
                if (!fixedValidation.valid) {
                    alert("Invalid configuration file. Check console for details.");
                    console.error(getValidationReport(fixedValidation));
                    return;
                }
                
                applyConfigToUI(fixed);
                console.log("Configuration loaded from file");
            }
        } catch (error) {
            console.error("Failed to load configuration:", error);
            alert("Failed to load configuration file");
        }
    };
    reader.readAsText(file);
}

/**
 * Initialize preset selector if it exists
 */
function initializePresetSelector() {
    const selector = byId("presetSelector");
    if (!selector) {
        console.log("No preset selector found, creating one...");
        // You could create a preset selector here if needed
        return;
    }
    
    // Clear existing options
    selector.innerHTML = '<option value="custom">Custom</option>';
    
    // Add all presets
    const presetNames = getPresetNames();
    const descriptions = getPresetDescriptions();
    
    presetNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        option.title = descriptions[name];
        selector.appendChild(option);
    });
    
    // Add change handler
    selector.addEventListener('change', (e) => {
        handlePresetChange(e.target.value);
    });
}

/**
 * Restore last session configuration if available
 */
function restoreLastSession() {
    try {
        const savedConfig = localStorage.getItem('fmg-last-config');
        if (savedConfig) {
            const config = buildConfigFromJSON(savedConfig);
            if (config) {
                const validation = validateConfig(config);
                if (validation.valid) {
                    applyConfigToUI(config);
                    console.log("Last session configuration restored");
                }
            }
        }
    } catch (e) {
        console.warn("Could not restore last session:", e);
    }
}

// This will be the main entry point for the viewer application
window.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing FMG Viewer with new configuration system...");
    
    // Initialize preset selector
    initializePresetSelector();
    
    // Restore last session if available
    if (byId("restoreSession")?.checked) {
        restoreLastSession();
    }
    
    // Wire up the generate button
    const generateBtn = byId("newMapButton") || byId("generateButton");
    if (generateBtn) {
        generateBtn.addEventListener("click", handleGenerateClick);
    }
    
    // Wire up save/load configuration buttons if they exist
    const saveConfigBtn = byId("saveConfigButton");
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener("click", saveConfiguration);
    }
    
    const loadConfigInput = byId("loadConfigInput");
    if (loadConfigInput) {
        loadConfigInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                loadConfigurationFile(e.target.files[0]);
            }
        });
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save config
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && e.shiftKey) {
            e.preventDefault();
            saveConfiguration();
        }
        
        // Ctrl/Cmd + G to generate
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            handleGenerateClick();
        }
    });
    
    // Log available presets for debugging
    console.log("Available presets:", getPresetNames());
    console.log("Configuration system initialized successfully");
});