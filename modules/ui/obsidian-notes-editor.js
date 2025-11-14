"use strict";

// Modern Markdown Notes Editor with Obsidian Integration

function editObsidianNote(elementId, elementType, coordinates) {
  const {x, y} = coordinates;

  // Show loading dialog
  showLoadingDialog();

  // Try to find note by FMG ID first, then by coordinates
  findOrCreateNote(elementId, elementType, coordinates)
    .then(noteData => {
      showMarkdownEditor(noteData, elementType);
    })
    .catch(error => {
      ERROR && console.error("Failed to load note:", error);
      tip("Failed to load Obsidian note: " + error.message, true, "error", 5000);
      closeDialogs("#obsidianNoteLoading");
    });
}

async function findOrCreateNote(elementId, elementType, coordinates) {
  const {x, y} = coordinates;

  // First try to find by FMG ID
  let note = await ObsidianBridge.findNoteByFmgId(elementId);

  if (note) {
    INFO && console.log("Found note by FMG ID:", note.path);
    return note;
  }

  // Find by coordinates
  const matches = await ObsidianBridge.findNotesByCoordinates(x, y, 8);

  closeDialogs("#obsidianNoteLoading");

  if (matches.length === 0) {
    // No matches - offer to create new note
    return await promptCreateNewNote(elementId, elementType, coordinates);
  }

  if (matches.length === 1) {
    // Single match - load it
    const match = matches[0];
    const content = await ObsidianBridge.getNote(match.path);
    return {
      path: match.path,
      name: match.name,
      content,
      frontmatter: match.frontmatter
    };
  }

  // Multiple matches - show selection dialog
  return await showNoteSelectionDialog(matches, elementId, elementType, coordinates);
}

function showLoadingDialog() {
  alertMessage.innerHTML = `
    <div style="text-align: center; padding: 2em;">
      <div class="spinner" style="margin: 0 auto 1em;"></div>
      <p>Searching Obsidian vault for matching notes...</p>
    </div>
  `;

  $("#alert").dialog({
    title: "Loading from Obsidian",
    width: "400px",
    closeOnEscape: false,
    buttons: {},
    dialogClass: "no-close",
    position: {my: "center", at: "center", of: "svg"}
  });
}

async function showNoteSelectionDialog(matches, elementId, elementType, coordinates) {
  return new Promise((resolve, reject) => {
    const matchList = matches
      .map(
        (match, index) => `
      <div class="note-match" data-index="${index}" style="
        padding: 12px;
        margin: 8px 0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
        <div style="font-weight: bold; margin-bottom: 4px;">${match.name}</div>
        <div style="font-size: 0.9em; color: #666;">
          Distance: ${match.distance.toFixed(1)} units<br/>
          Coordinates: (${match.coordinates.x}, ${match.coordinates.y})<br/>
          Path: ${match.path}
        </div>
      </div>
    `
      )
      .join("");

    alertMessage.innerHTML = `
    <div style="max-height: 60vh; overflow-y: auto;">
      <p style="margin-bottom: 1em;">Found ${matches.length} notes near this location. Select one:</p>
      ${matchList}
    </div>
  `;

    $("#alert").dialog({
      title: "Select Obsidian Note",
      width: "600px",
      buttons: {
        "Create New": async function () {
          $(this).dialog("close");
          try {
            const newNote = await promptCreateNewNote(elementId, elementType, coordinates);
            resolve(newNote);
          } catch (error) {
            reject(error);
          }
        },
        Cancel: function () {
          $(this).dialog("close");
          reject(new Error("Cancelled"));
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });

    // Add click handlers to matches
    document.querySelectorAll(".note-match").forEach((el, index) => {
      el.addEventListener("click", async () => {
        $("#alert").dialog("close");
        try {
          const match = matches[index];
          const content = await ObsidianBridge.getNote(match.path);
          resolve({
            path: match.path,
            name: match.name,
            content,
            frontmatter: match.frontmatter
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

async function promptCreateNewNote(elementId, elementType, coordinates) {
  return new Promise((resolve, reject) => {
    const element = getElementData(elementId, elementType);
    const suggestedName = element.name || `${elementType}-${element.i}`;

    alertMessage.innerHTML = `
      <p>No matching notes found. Create a new note in your Obsidian vault?</p>
      <div style="margin: 1em 0;">
        <label for="newNoteName" style="display: block; margin-bottom: 0.5em;">Note name:</label>
        <input id="newNoteName" type="text" value="${suggestedName}" style="width: 100%; padding: 8px; font-size: 1em;"/>
      </div>
      <div style="margin: 1em 0;">
        <label for="newNotePath" style="display: block; margin-bottom: 0.5em;">Folder (optional):</label>
        <input id="newNotePath" type="text" placeholder="e.g., Locations/Cities" style="width: 100%; padding: 8px; font-size: 1em;"/>
      </div>
    `;

    $("#alert").dialog({
      title: "Create New Note",
      width: "500px",
      buttons: {
        Create: async function () {
          const name = byId("newNoteName").value.trim();
          const folder = byId("newNotePath").value.trim();

          if (!name) {
            tip("Please enter a note name", false, "error");
            return;
          }

          const notePath = folder ? `${folder}/${name}.md` : `${name}.md`;

          $(this).dialog("close");

          try {
            const template = ObsidianBridge.generateNoteTemplate(element, elementType);
            await ObsidianBridge.createNote(notePath, template);

            const {frontmatter} = ObsidianBridge.parseFrontmatter(template);

            resolve({
              path: notePath,
              name,
              content: template,
              frontmatter,
              isNew: true
            });
          } catch (error) {
            reject(error);
          }
        },
        Cancel: function () {
          $(this).dialog("close");
          reject(new Error("Cancelled"));
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  });
}

function getElementData(elementId, elementType) {
  // Extract element data based on type
  if (elementType === "burg") {
    const burgId = parseInt(elementId.replace("burg", ""));
    return pack.burgs[burgId];
  } else if (elementType === "marker") {
    const markerId = parseInt(elementId.replace("marker", ""));
    return pack.markers[markerId];
  } else {
    // Generic element
    const el = document.getElementById(elementId);
    return {
      id: elementId,
      name: elementId,
      x: parseFloat(el?.getAttribute("cx") || 0),
      y: parseFloat(el?.getAttribute("cy") || 0)
    };
  }
}

function showMarkdownEditor(noteData, elementType) {
  const {path, name, content, frontmatter, isNew} = noteData;

  // Extract frontmatter and body
  const {content: bodyContent} = ObsidianBridge.parseFrontmatter(content);

  // Set up the dialog
  byId("obsidianNotePath").textContent = path;
  byId("obsidianNoteName").value = name;
  byId("obsidianMarkdownEditor").value = content;
  byId("obsidianMarkdownPreview").innerHTML = renderMarkdown(bodyContent);

  // Store current note data
  showMarkdownEditor.currentNote = noteData;
  showMarkdownEditor.originalContent = content;

  $("#obsidianNotesEditor").dialog({
    title: `Obsidian Note: ${name}`,
    width: Math.min(svgWidth * 0.9, 1200),
    height: svgHeight * 0.85,
    position: {my: "center", at: "center", of: "svg"},
    close: () => {
      showMarkdownEditor.currentNote = null;
      showMarkdownEditor.originalContent = null;
    }
  });

  // Update preview on edit
  updateMarkdownPreview();

  if (isNew) {
    tip("New note created in Obsidian vault", true, "success", 3000);
  }
}

function updateMarkdownPreview() {
  const content = byId("obsidianMarkdownEditor").value;
  const {content: bodyContent} = ObsidianBridge.parseFrontmatter(content);
  byId("obsidianMarkdownPreview").innerHTML = renderMarkdown(bodyContent);
}

function renderMarkdown(markdown) {
  // Simple Markdown renderer (will be replaced with marked.js)
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\_\_(.*?)\_\_/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/\_(.*?)\_/g, "<em>$1</em>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Wikilinks [[Page]]
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>');

  // Lists
  html = html.replace(/^\* (.*)$/gim, "<li>$1</li>");
  html = html.replace(/^\- (.*)$/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";

  // Clean up
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");

  return html;
}

async function saveObsidianNote() {
  if (!showMarkdownEditor.currentNote) {
    tip("No note loaded", false, "error");
    return;
  }

  const content = byId("obsidianMarkdownEditor").value;
  const {path} = showMarkdownEditor.currentNote;

  try {
    await ObsidianBridge.updateNote(path, content);
    showMarkdownEditor.originalContent = content;
    tip("Note saved to Obsidian vault", true, "success", 2000);
  } catch (error) {
    ERROR && console.error("Failed to save note:", error);
    tip("Failed to save note: " + error.message, true, "error", 5000);
  }
}

function openInObsidian() {
  if (!showMarkdownEditor.currentNote) return;

  const {path} = showMarkdownEditor.currentNote;
  const vaultName = ObsidianBridge.config.vaultName || "vault";
  const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(path)}`;

  window.open(obsidianUrl, "_blank");
  tip("Opening in Obsidian app...", false, "success", 2000);
}

function togglePreviewMode() {
  const editor = byId("obsidianMarkdownEditor");
  const preview = byId("obsidianMarkdownPreview");
  const isPreviewMode = editor.style.display === "none";

  if (isPreviewMode) {
    editor.style.display = "block";
    preview.style.display = "none";
    byId("togglePreview").textContent = "👁 Preview";
  } else {
    updateMarkdownPreview();
    editor.style.display = "none";
    preview.style.display = "block";
    byId("togglePreview").textContent = "✏ Edit";
  }
}
