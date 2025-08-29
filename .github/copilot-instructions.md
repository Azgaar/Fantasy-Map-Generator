# Fantasy Map Generator

Azgaar's Fantasy Map Generator is a client-side JavaScript web application for creating fantasy maps. It generates detailed fantasy worlds with countries, cities, rivers, biomes, and cultural elements.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

- **CRITICAL**: This is a static web application - NO build process needed. No npm install, no compilation, no bundling.
- Run the application using HTTP server (required - cannot run with file:// protocol):
  - `python3 -m http.server 8000` - takes 2-3 seconds to start
- Access at: `http://localhost:8000`

## Validation

- Always manually validate any changes by:
  1. Starting the HTTP server (NEVER CANCEL - wait for full startup)
  2. Navigate to the application in browser
  3. Click the "►" button to open the menu and generate a new map
  4. **CRITICAL VALIDATION**: Verify the map generates with countries, cities, roads, and geographic features
  5. Test UI interaction: click "Layers" button, verify layer controls work
  6. Test regeneration: click "New Map!" button, verify new map generates correctly
- **Known Issues**: Google Analytics and font loading errors are normal (blocked external resources)

## Repository Structure

### Core Files

- `index.html` - Main application entry point
- `main.js` - Core application logic
- `versioning.js` - Version management and update handling

### Key Directories

- `modules/` - core functionality modules:
  - `modules/ui/` - UI components (editors, tools, style management)
  - `modules/dynamic/` - runtime modules (export, installation)
  - `modules/renderers/` - drawing and rendering logic
- `utils/` - utility libraries (math, arrays, strings, etc.)
- `styles/` - visual style presets (JSON files)
- `libs/` - Third-party libraries (D3.js, TinyMCE, etc.)
- `images/` - backgrounds, UI elements
- `charges/` - heraldic symbols and coat of arms elements
- `config/` - Heightmap templates and configurations
- `heightmaps/` - Terrain generation data

## Common Tasks

### Making Code Changes

1. Edit JavaScript files directly (no compilation needed)
2. Refresh browser to see changes immediately
3. **ALWAYS test map generation** after making changes
4. Update version in `versioning.js` for all changes
5. Update file hashes in `index.html` for changed files (format: `file.js?v=1.108.1`)

### Debugging Map Generation

- Open browser developer tools console
- Look for timing logs, e.g. "TOTAL: ~0.76s"
- Map generation logs show each step (heightmap, rivers, states, etc.)
- Error messages will indicate specific generation failures

### Testing Different Map Types

- Use "New Map!" button for quick regeneration
- Access "Layers" menu to change map visualization
- Available presets: Political, Cultural, Religions, Biomes, Heightmap, Physical, Military

## Troubleshooting

### Application Won't Load

- Ensure using HTTP server (not file://)
- Check console for JavaScript errors
- Verify all files are present in repository

### Map Generation Fails

- Check browser console for error messages
- Look for specific module failures in generation logs
- Try refreshing page and generating new map

### Performance Issues

- Map generation should complete in ~1 second for standard configurations
- If slower, check browser console for errors

Remember: This is a sophisticated client-side application that generates complete fantasy worlds with political systems, geography, cultures, and detailed cartographic elements. Always validate that your changes preserve the core map generation functionality.
