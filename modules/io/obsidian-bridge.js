"use strict";

// Obsidian Vault Integration for Fantasy Map Generator
// Uses Obsidian Local REST API plugin
// https://github.com/coddingtonbear/obsidian-local-rest-api

const ObsidianBridge = (() => {
  // Configuration
  const config = {
    apiUrl: "http://127.0.0.1:27123",
    apiKey: "", // Set via UI
    enabled: false,
    vaultName: ""
  };

  // Initialize from localStorage
  function init() {
    const stored = localStorage.getItem("obsidianConfig");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        Object.assign(config, parsed);
      } catch (error) {
        ERROR && console.error("Failed to load Obsidian config:", error);
      }
    }
  }

  // Save configuration
  function saveConfig() {
    localStorage.setItem("obsidianConfig", JSON.stringify(config));
  }

  // Test connection to Obsidian
  async function testConnection() {
    if (!config.apiKey) {
      throw new Error("API key not set. Please configure in Options.");
    }

    try {
      const response = await fetch(`${config.apiUrl}/`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status}`);
      }

      const data = await response.json();
      INFO && console.log("Obsidian connection successful:", data);
      config.enabled = true;
      saveConfig();
      return true;
    } catch (error) {
      ERROR && console.error("Obsidian connection failed:", error);
      config.enabled = false;
      saveConfig();
      throw error;
    }
  }

  // Get all markdown files from vault
  async function getVaultFiles() {
    if (!config.enabled) {
      throw new Error("Obsidian not connected");
    }

    try {
      const response = await fetch(`${config.apiUrl}/vault/`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vault files: ${response.status}`);
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      ERROR && console.error("Failed to get vault files:", error);
      throw error;
    }
  }

  // Get note content by path
  async function getNote(notePath) {
    if (!config.enabled) {
      throw new Error("Obsidian not connected");
    }

    try {
      const response = await fetch(`${config.apiUrl}/vault/${encodeURIComponent(notePath)}`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "text/markdown"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch note: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      ERROR && console.error("Failed to get note:", error);
      throw error;
    }
  }

  // Update note content
  async function updateNote(notePath, content) {
    if (!config.enabled) {
      throw new Error("Obsidian not connected");
    }

    try {
      const response = await fetch(`${config.apiUrl}/vault/${encodeURIComponent(notePath)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "text/markdown"
        },
        body: content
      });

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status}`);
      }

      INFO && console.log("Note updated successfully:", notePath);
      return true;
    } catch (error) {
      ERROR && console.error("Failed to update note:", error);
      throw error;
    }
  }

  // Create new note
  async function createNote(notePath, content) {
    if (!config.enabled) {
      throw new Error("Obsidian not connected");
    }

    try {
      const response = await fetch(`${config.apiUrl}/vault/${encodeURIComponent(notePath)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "text/markdown"
        },
        body: content
      });

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
      }

      INFO && console.log("Note created successfully:", notePath);
      return true;
    } catch (error) {
      ERROR && console.error("Failed to create note:", error);
      throw error;
    }
  }

  // Parse YAML frontmatter from markdown content
  function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return {frontmatter: {}, content};
    }

    const frontmatterText = match[1];
    const bodyContent = content.slice(match[0].length).trim();

    // Simple YAML parser (handles basic key-value pairs and nested objects)
    const frontmatter = {};
    const lines = frontmatterText.split("\n");
    let currentKey = null;
    let currentObj = frontmatter;
    let indentLevel = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const indent = line.search(/\S/);
      const colonIndex = trimmed.indexOf(":");

      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (indent === 0) {
        currentObj = frontmatter;
        currentKey = key;

        if (value) {
          // Simple value
          frontmatter[key] = parseValue(value);
        } else {
          // Nested object or array
          frontmatter[key] = {};
          currentObj = frontmatter[key];
        }
      } else if (currentObj && key) {
        // Nested property
        currentObj[key] = parseValue(value);
      }
    }

    return {frontmatter, content: bodyContent};
  }

  // Parse YAML value (handle strings, numbers, arrays)
  function parseValue(value) {
    if (!value) return null;

    // Array
    if (value.startsWith("[") && value.endsWith("]")) {
      return value
        .slice(1, -1)
        .split(",")
        .map(v => v.trim())
        .filter(v => v);
    }

    // Number
    if (!isNaN(value) && value !== "") {
      return parseFloat(value);
    }

    // Boolean
    if (value === "true") return true;
    if (value === "false") return false;

    // String (remove quotes if present)
    return value.replace(/^["']|["']$/g, "");
  }

  // Calculate distance between two coordinates
  function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Find notes by coordinates
  async function findNotesByCoordinates(x, y, limit = 8) {
    TIME && console.time("findNotesByCoordinates");

    try {
      const files = await getVaultFiles();
      const mdFiles = files.filter(f => f.endsWith(".md"));

      const matches = [];

      for (const filePath of mdFiles) {
        try {
          const content = await getNote(filePath);
          const {frontmatter} = parseFrontmatter(content);

          // Check for coordinates in frontmatter
          let noteX, noteY;

          // Support various coordinate formats
          if (frontmatter.coordinates) {
            noteX = frontmatter.coordinates.x || frontmatter.coordinates.X;
            noteY = frontmatter.coordinates.y || frontmatter.coordinates.Y;
          } else {
            noteX = frontmatter.x || frontmatter.X;
            noteY = frontmatter.y || frontmatter.Y;
          }

          if (noteX !== undefined && noteY !== undefined) {
            const distance = calculateDistance(x, y, noteX, noteY);

            matches.push({
              path: filePath,
              name: filePath.replace(/\.md$/, "").split("/").pop(),
              frontmatter,
              distance,
              coordinates: {x: noteX, y: noteY}
            });
          }
        } catch (error) {
          // Skip files that can't be read
          DEBUG && console.debug("Skipping file:", filePath, error);
        }
      }

      // Sort by distance and return top matches
      matches.sort((a, b) => a.distance - b.distance);
      const results = matches.slice(0, limit);

      TIME && console.timeEnd("findNotesByCoordinates");
      INFO && console.log(`Found ${results.length} nearby notes for (${x}, ${y})`);

      return results;
    } catch (error) {
      ERROR && console.error("Failed to find notes by coordinates:", error);
      TIME && console.timeEnd("findNotesByCoordinates");
      throw error;
    }
  }

  // Find note by FMG ID in frontmatter
  async function findNoteByFmgId(fmgId) {
    try {
      const files = await getVaultFiles();
      const mdFiles = files.filter(f => f.endsWith(".md"));

      for (const filePath of mdFiles) {
        try {
          const content = await getNote(filePath);
          const {frontmatter} = parseFrontmatter(content);

          if (frontmatter["fmg-id"] === fmgId || frontmatter.fmgId === fmgId) {
            return {
              path: filePath,
              name: filePath.replace(/\.md$/, "").split("/").pop(),
              content,
              frontmatter
            };
          }
        } catch (error) {
          DEBUG && console.debug("Skipping file:", filePath, error);
        }
      }

      return null;
    } catch (error) {
      ERROR && console.error("Failed to find note by FMG ID:", error);
      throw error;
    }
  }

  // Generate note template for FMG element
  function generateNoteTemplate(element, type) {
    const {x, y} = element;
    const lat = pack.cells.lat?.[element.cell] || 0;
    const lon = pack.cells.lon?.[element.cell] || 0;

    const frontmatter = {
      "fmg-id": element.id || `${type}${element.i}`,
      "fmg-type": type,
      coordinates: {x, y, lat, lon},
      tags: [type],
      created: new Date().toISOString()
    };

    if (element.name) {
      frontmatter.aliases = [element.name];
    }

    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (typeof value === "object" && !Array.isArray(value)) {
          const nested = Object.entries(value)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join("\n");
          return `${key}:\n${nested}`;
        } else if (Array.isArray(value)) {
          return `${key}:\n  - ${value.join("\n  - ")}`;
        }
        return `${key}: ${value}`;
      })
      .join("\n");

    const title = element.name || `${type} ${element.i}`;

    return `---
${yaml}
---

# ${title}

*This note was created from Fantasy Map Generator*

## Description

Add your lore here...

## History

## Notable Features

## Related
`;
  }

  // Search notes by text query (searches in filename and frontmatter)
  async function searchNotes(query) {
    if (!query || query.trim() === "") {
      return [];
    }

    const allFiles = await getVaultFiles();
    const searchTerm = query.toLowerCase();
    const results = [];

    for (const filePath of allFiles) {
      const fileName = filePath.split("/").pop().replace(".md", "").toLowerCase();

      // Check if filename matches
      if (fileName.includes(searchTerm)) {
        try {
          const content = await getNote(filePath);
          const {frontmatter} = parseFrontmatter(content);

          results.push({
            path: filePath,
            name: filePath.split("/").pop().replace(".md", ""),
            frontmatter,
            matchType: "filename"
          });
        } catch (error) {
          WARN && console.warn(`Could not read file ${filePath}:`, error);
        }
      }
    }

    return results;
  }

  // List all notes with basic info
  async function listAllNotes() {
    const allFiles = await getVaultFiles();
    const notes = [];

    for (const filePath of allFiles) {
      try {
        const content = await getNote(filePath);
        const {frontmatter} = parseFrontmatter(content);

        notes.push({
          path: filePath,
          name: filePath.split("/").pop().replace(".md", ""),
          frontmatter,
          folder: filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : ""
        });
      } catch (error) {
        WARN && console.warn(`Could not read file ${filePath}:`, error);
      }
    }

    // Sort by path
    notes.sort((a, b) => a.path.localeCompare(b.path));
    return notes;
  }

  return {
    init,
    config,
    saveConfig,
    testConnection,
    getVaultFiles,
    getNote,
    updateNote,
    createNote,
    parseFrontmatter,
    findNotesByCoordinates,
    findNoteByFmgId,
    generateNoteTemplate,
    searchNotes,
    listAllNotes
  };
})();

// Initialize on load
ObsidianBridge.init();
