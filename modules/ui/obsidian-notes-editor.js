"use strict";

// Modern Markdown Notes Editor with Obsidian Integration

function editObsidianNote(elementId, elementType, coordinates) {
  const {x, y} = coordinates;

  // Show loading dialog
  showLoadingDialog();

  // Try to find note by FMG ID first, then by coordinates
  findOrCreateNote(elementId, elementType, coordinates)
    .then(noteData => {
      showMarkdownEditor(noteData, elementType, elementId, coordinates);
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

    // Build context info for the element
    let contextInfo = "";
    if (element.state) {
      contextInfo += `<div style="color: #666; font-size: 0.9em;">State: ${element.state}</div>`;
    }
    if (element.province) {
      contextInfo += `<div style="color: #666; font-size: 0.9em;">Province: ${element.province}</div>`;
    }

    // Pre-fill search with state or element name
    const defaultSearch = element.state || element.name || "";

    alertMessage.innerHTML = `
      <div style="margin-bottom: 1.5em;">
        <p><strong>${element.name || elementId}</strong></p>
        ${contextInfo}
        <p style="margin-top: 0.5em;">No matching notes found by coordinates.</p>
      </div>

      <div style="margin: 1.5em 0; padding: 1em; background: #f5f5f5; border-radius: 4px;">
        <label for="obsidianSearch" style="display: block; margin-bottom: 0.5em; font-weight: bold;">Search your vault:</label>
        <input id="obsidianSearch" type="text" placeholder="Type to search..." value="${defaultSearch}" style="width: 100%; padding: 8px; font-size: 1em; margin-bottom: 8px;"/>
        <button id="obsidianSearchBtn" style="padding: 6px 12px;">Search</button>
        <button id="obsidianBrowseBtn" style="padding: 6px 12px; margin-left: 8px;">Browse All Notes</button>
        <div id="obsidianSearchResults" style="margin-top: 1em; max-height: 200px; overflow-y: auto;"></div>
      </div>

      <div style="margin-top: 1.5em; padding-top: 1.5em; border-top: 1px solid #ddd;">
        <p style="font-weight: bold; margin-bottom: 1em;">Or create a new note:</p>
        <div style="margin: 1em 0;">
          <label for="newNoteName" style="display: block; margin-bottom: 0.5em;">Note name:</label>
          <input id="newNoteName" type="text" value="${suggestedName}" style="width: 100%; padding: 8px; font-size: 1em;"/>
        </div>
        <div style="margin: 1em 0;">
          <label for="newNotePath" style="display: block; margin-bottom: 0.5em;">Folder (optional):</label>
          <input id="newNotePath" type="text" placeholder="e.g., Locations/Cities" style="width: 100%; padding: 8px; font-size: 1em;"/>
        </div>
      </div>
    `;

    $("#alert").dialog({
      title: "Find or Create Note",
      width: "600px",
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
            const template = ObsidianBridge.generateNoteTemplate(element, elementType, elementId);
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

    // Add event handlers for search and browse
    const searchBtn = byId("obsidianSearchBtn");
    const browseBtn = byId("obsidianBrowseBtn");
    const searchInput = byId("obsidianSearch");
    const resultsDiv = byId("obsidianSearchResults");

    const performSearch = async () => {
      const query = searchInput.value.trim();
      if (!query) {
        resultsDiv.innerHTML = "<p style='color: #999;'>Enter a search term</p>";
        return;
      }

      resultsDiv.innerHTML = "<p>Searching...</p>";

      try {
        const results = await ObsidianBridge.searchNotes(query);

        if (results.length === 0) {
          resultsDiv.innerHTML = "<p style='color: #999;'>No matching notes found</p>";
          return;
        }

        resultsDiv.innerHTML = results
          .map(
            (note, index) => `
          <div class="search-result" data-index="${index}" style="
            padding: 8px;
            margin: 4px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            background: white;
          " onmouseover="this.style.background='#e8e8e8'" onmouseout="this.style.background='white'">
            <div style="font-weight: bold;">${note.name}</div>
            <div style="font-size: 0.85em; color: #666;">${note.path}</div>
          </div>
        `
          )
          .join("");

        // Add click handlers
        document.querySelectorAll(".search-result").forEach((el, index) => {
          el.addEventListener("click", async () => {
            $("#alert").dialog("close");
            try {
              const note = results[index];
              const content = await ObsidianBridge.getNote(note.path);
              resolve({
                path: note.path,
                name: note.name,
                content,
                frontmatter: note.frontmatter
              });
            } catch (error) {
              reject(error);
            }
          });
        });
      } catch (error) {
        resultsDiv.innerHTML = `<p style='color: red;'>Search failed: ${error.message}</p>`;
      }
    };

    const showBrowse = async () => {
      resultsDiv.innerHTML = "<p>Loading file list...</p>";

      try {
        // Use fast path-only listing (doesn't read file contents)
        const allNotes = await ObsidianBridge.listAllNotePaths();

        if (allNotes.length === 0) {
          resultsDiv.innerHTML = "<p style='color: #999;'>No notes in vault</p>";
          return;
        }

        INFO && console.log(`Displaying ${allNotes.length} notes in folder tree`);

        // Build folder tree
        const tree = buildFolderTree(allNotes);
        resultsDiv.innerHTML = renderFolderTree(tree, allNotes);

        // Add click handlers to files
        document.querySelectorAll(".tree-file").forEach(el => {
          el.addEventListener("click", async () => {
            const index = parseInt(el.dataset.index);
            $("#alert").dialog("close");
            try {
              const note = allNotes[index];
              // Read the file content only when clicked
              const content = await ObsidianBridge.getNote(note.path);
              const {frontmatter} = ObsidianBridge.parseFrontmatter(content);

              resolve({
                path: note.path,
                name: note.name,
                content,
                frontmatter
              });
            } catch (error) {
              reject(error);
            }
          });
        });

        // Add click handlers to folder toggles
        document.querySelectorAll(".tree-folder-toggle").forEach(el => {
          el.addEventListener("click", e => {
            e.stopPropagation();
            const folder = el.parentElement.nextElementSibling;
            const isCollapsed = folder.style.display === "none";
            folder.style.display = isCollapsed ? "block" : "none";
            el.textContent = isCollapsed ? "▼" : "▶";
          });
        });
      } catch (error) {
        resultsDiv.innerHTML = `<p style='color: red;'>Failed to load notes: ${error.message}</p>`;
      }
    };

    searchBtn.addEventListener("click", performSearch);
    browseBtn.addEventListener("click", showBrowse);
    searchInput.addEventListener("keypress", e => {
      if (e.key === "Enter") performSearch();
    });
  });
}

function buildFolderTree(notes) {
  const root = {folders: {}, files: []};

  INFO && console.log(`buildFolderTree: Processing ${notes.length} notes`);

  notes.forEach((note, index) => {
    const parts = note.path.split("/");
    const fileName = parts[parts.length - 1];

    DEBUG && console.log(`Processing note ${index}: ${note.path} (${parts.length} parts)`);

    if (parts.length === 1) {
      // Root level file
      root.files.push({name: fileName, index, path: note.path});
      DEBUG && console.log(`  -> Added to root files: ${fileName}`);
    } else {
      // Navigate/create folder structure
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        if (!current.folders[folderName]) {
          current.folders[folderName] = {folders: {}, files: []};
          DEBUG && console.log(`  -> Created folder: ${folderName}`);
        }
        current = current.folders[folderName];
      }
      // Add file to final folder
      current.files.push({name: fileName, index, path: note.path});
      DEBUG && console.log(`  -> Added to folder: ${fileName}`);
    }
  });

  INFO && console.log("Folder tree structure:", root);

  return root;
}

function renderFolderTree(node, allNotes, indent = 0) {
  let html = "";
  const indentPx = indent * 20;

  // Render folders
  for (const [folderName, folderData] of Object.entries(node.folders || {})) {
    html += `
      <div style="margin-left: ${indentPx}px;">
        <div style="padding: 4px; cursor: pointer; user-select: none;">
          <span class="tree-folder-toggle" style="display: inline-block; width: 16px; font-size: 12px;">▼</span>
          <span style="font-weight: bold;">📁 ${folderName}</span>
        </div>
        <div class="tree-folder-content" style="display: block;">
          ${renderFolderTree(folderData, allNotes, indent + 1)}
        </div>
      </div>
    `;
  }

  // Render files in current folder
  html += renderFiles(node.files || [], indent);

  return html;
}

function renderFiles(files, indent) {
  const indentPx = indent * 20;
  return files
    .map(
      file => `
    <div class="tree-file" data-index="${file.index}" style="
      margin-left: ${indentPx}px;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 3px;
    " onmouseover="this.style.background='#e8e8e8'" onmouseout="this.style.background='transparent'">
      <span style="font-size: 12px;">📄</span> ${file.name.replace(".md", "")}
    </div>
  `
    )
    .join("");
}

function getElementData(elementId, elementType) {
  // Extract element data based on type
  if (elementType === "burg") {
    const burgId = parseInt(elementId.replace("burg", ""));
    const burg = pack.burgs[burgId];

    // Enhance with state and province names
    const stateId = burg.state;
    const provinceId = burg.province;

    return {
      ...burg,
      state: stateId && pack.states[stateId] ? pack.states[stateId].name : null,
      province: provinceId && pack.provinces[provinceId] ? pack.provinces[provinceId].name : null
    };
  } else if (elementType === "marker") {
    const markerId = parseInt(elementId.replace("marker", ""));
    const marker = pack.markers[markerId];

    // Enhance with state and province if marker has a cell
    if (marker.cell) {
      const cell = pack.cells;
      const stateId = cell.state[marker.cell];
      const provinceId = cell.province[marker.cell];

      return {
        ...marker,
        state: stateId && pack.states[stateId] ? pack.states[stateId].name : null,
        province: provinceId && pack.provinces[provinceId] ? pack.provinces[provinceId].name : null
      };
    }

    return marker;
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

function showMarkdownEditor(noteData, elementType, elementId, coordinates) {
  const {path, name, content, frontmatter, isNew} = noteData;

  // Extract frontmatter and body
  const {content: bodyContent} = ObsidianBridge.parseFrontmatter(content);

  // Set up the dialog
  byId("obsidianNotePath").textContent = path;
  byId("obsidianNoteName").value = name;
  byId("obsidianMarkdownEditor").value = content;
  byId("obsidianMarkdownPreview").innerHTML = renderMarkdown(bodyContent);

  // Store current note data and FMG element info
  showMarkdownEditor.currentNote = noteData;
  showMarkdownEditor.originalContent = content;
  showMarkdownEditor.elementId = elementId;
  showMarkdownEditor.elementType = elementType;
  showMarkdownEditor.coordinates = coordinates;

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

  let content = byId("obsidianMarkdownEditor").value;
  const {path} = showMarkdownEditor.currentNote;
  const elementId = showMarkdownEditor.elementId;
  const coordinates = showMarkdownEditor.coordinates;

  // Update/add frontmatter with FMG ID and coordinates
  if (elementId && coordinates) {
    content = updateFrontmatterWithFmgData(content, elementId, coordinates);
  }

  try {
    await ObsidianBridge.updateNote(path, content);
    showMarkdownEditor.originalContent = content;
    // Update the editor to show the new frontmatter
    byId("obsidianMarkdownEditor").value = content;
    tip("Note saved to Obsidian vault (linked to FMG element)", true, "success", 3000);
  } catch (error) {
    ERROR && console.error("Failed to save note:", error);
    tip("Failed to save note: " + error.message, true, "error", 5000);
  }
}

function updateFrontmatterWithFmgData(content, elementId, coordinates) {
  const {x, y} = coordinates;
  const {frontmatter, content: bodyContent} = ObsidianBridge.parseFrontmatter(content);

  // Update frontmatter with FMG data
  frontmatter["fmg-id"] = elementId;
  frontmatter["x"] = Math.round(x * 100) / 100;
  frontmatter["y"] = Math.round(y * 100) / 100;

  // Rebuild frontmatter
  let frontmatterLines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === "object" && value !== null) {
      // Handle nested objects
      frontmatterLines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        frontmatterLines.push(`  ${nestedKey}: ${nestedValue}`);
      }
    } else {
      frontmatterLines.push(`${key}: ${value}`);
    }
  }
  frontmatterLines.push("---");

  return frontmatterLines.join("\n") + "\n" + bodyContent;
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
