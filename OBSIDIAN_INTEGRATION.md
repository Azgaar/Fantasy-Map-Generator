# Obsidian Vault Integration for Fantasy Map Generator

## Overview

Fantasy Map Generator now supports deep integration with your Obsidian vault for managing map lore and notes! This allows you to:

- Store all your world lore in Markdown format
- Edit notes in a modern Markdown editor (no more Win95-style TinyMCE!)
- Automatically link map elements to Obsidian notes by coordinates
- Keep your notes in sync between FMG and Obsidian
- Use [[wikilinks]] to connect related notes
- Edit in either FMG or Obsidian - changes sync both ways

## Setup

### 1. Install Obsidian Local REST API Plugin

1. Open Obsidian
2. Go to **Settings** → **Community Plugins**
3. Click **Browse** and search for "Local REST API"
4. Install and **Enable** the plugin
5. Go to **Settings** → **Local REST API**
6. Copy your **API Key** (you'll need this!)
7. Note the **Server Port** (default: 27123)

### 2. Configure in Fantasy Map Generator

1. Open Fantasy Map Generator
2. Go to **Menu** → **Tools** → **⚙ Obsidian**
3. Enter your settings:
   - **API URL**: `http://127.0.0.1:27123` (default)
   - **API Key**: Paste from Obsidian plugin settings
   - **Vault Name**: Name of your Obsidian vault
4. Click **Test Connection** to verify
5. Click **Save Configuration**

## Usage

### Linking Map Elements to Notes

When you click on a **burg** or **marker** in FMG:

1. FMG searches your Obsidian vault for notes with matching coordinates in YAML frontmatter
2. Shows you the top 5-8 closest matches
3. You select the note you want, or create a new one

### Note Format

Notes in your vault should have YAML frontmatter like this:

```markdown
---
fmg-id: burg123
fmg-type: burg
coordinates:
  x: 234.5
  y: 456.7
  lat: 45.23
  lon: -73.45
tags:
  - capital
  - settlement
  - ancient
aliases:
  - Eldoria
  - The Ancient City
---

# Eldoria

The ancient capital sits upon the [[River Mystral]], founded in year 1203.

## History

The city was established by [[King Aldric the First]]...

## Notable Locations

- [[The Grand Library]]
- [[Temple of the Seven Stars]]
- [[Market Square]]
```

### Coordinate Matching

Since your burgs/markers may have been imported from PostgreSQL without FMG IDs, the system matches by **X/Y coordinates**:

- FMG extracts the coordinates from the clicked element
- Searches all `.md` files in your vault for matching `x:` and `y:` values
- Calculates distance and shows closest matches
- You pick the right one!

### Supported Coordinate Formats

The system recognizes these formats in YAML frontmatter:

```yaml
# Nested object (recommended)
coordinates:
  x: 123.4
  y: 567.8

# Or flat
x: 123.4
y: 567.8

# Case insensitive
X: 123.4
Y: 567.8
```

### Creating New Notes

If no matches are found:

1. FMG offers to create a new note
2. Enter a name (e.g., "Eldoria")
3. Optionally specify a folder (e.g., "Locations/Cities")
4. FMG generates a template with coordinates
5. Opens in the Markdown editor
6. Saved directly to your Obsidian vault!

### Editing Notes

The modern Markdown editor includes:

- **Live preview**: Toggle between edit/preview modes
- **[[Wikilinks]]**: Link to other notes in your vault
- **Syntax highlighting**: Clean monospace font
- **Open in Obsidian**: Button to jump to the note in Obsidian app
- **Save to Vault**: Changes sync immediately

### Using Wikilinks

Create connections between notes:

```markdown
The [[King Aldric the First]] ruled from [[Eldoria]].
The city controls access to [[River Mystral]].
```

When you save in FMG, these links work in Obsidian!

## Migration from PostgreSQL

If you have existing lore in PostgreSQL with coordinates:

1. Export your data to Markdown files with YAML frontmatter
2. Include `x`, `y`, `lat`, `lon` in the frontmatter
3. Place files in your Obsidian vault
4. FMG will auto-match by coordinates!

Example export script template:

```python
for location in locations:
    frontmatter = f"""---
fmg-type: {location.type}
coordinates:
  x: {location.x}
  y: {location.y}
  lat: {location.lat}
  lon: {location.lon}
tags: {location.tags}
---

# {location.name}

{location.description}
"""
    with open(f"vault/{location.name}.md", "w") as f:
        f.write(frontmatter)
```

## Tips & Tricks

### Organize Your Vault

Create folders for different types:

```
My Vault/
├── Locations/
│   ├── Cities/
│   ├── Landmarks/
│   └── Regions/
├── Characters/
├── History/
└── Lore/
```

### Use Templates

Create Obsidian templates for different element types:

- `Templates/City.md`
- `Templates/Landmark.md`
- `Templates/Character.md`

### Search and Graph

In Obsidian:

- Use **Search** (`Ctrl+Shift+F`) to find notes by coordinates
- Use **Graph View** to see connections between locations
- Use **Tags** to organize by type

### Sync Across Devices

Use Obsidian Sync or Git to keep your vault synced across computers!

## Troubleshooting

### Connection Failed

- Make sure Obsidian is running
- Verify the Local REST API plugin is enabled
- Check the port number (default 27123)
- Try restarting Obsidian

### No Matches Found

- Check that your notes have `x:` and `y:` fields in frontmatter
- Verify coordinates are numbers, not strings
- Try increasing the search radius

### Changes Not Appearing in Obsidian

- Obsidian should auto-detect file changes
- If not, try switching to another note and back
- Or close/reopen the note

## Advanced

### Custom Coordinate Systems

If you use a different coordinate system:

1. Map your coordinates to FMG's system
2. Store both in frontmatter:
```yaml
coordinates:
  x: 234.5        # FMG coordinates
  y: 456.7
  custom_x: 1000  # Your system
  custom_y: 2000
```

### Database Bridge

For the future PostgreSQL migration:

1. Keep coordinates in both Obsidian and database
2. Use coordinates as the join key
3. Sync changes via API
4. Eventually replace file storage with DB

## Future Features

Planned enhancements:

- [ ] Time slider - view notes across historical periods
- [ ] Automatic tagging by region/culture
- [ ] Bulk import from database
- [ ] Real-time collaboration
- [ ] Custom Markdown extensions

---

**Enjoy your modern, Markdown-powered world-building! 🗺️✨**
