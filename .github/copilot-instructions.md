# Fantasy Map Generator
Azgaar's Fantasy Map Generator is a client-side JavaScript web application for creating fantasy maps. It's a 41MB repository with 232 JavaScript files that generates detailed fantasy worlds with countries, cities, rivers, biomes, and cultural elements.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively
- **CRITICAL**: This is a static web application - NO build process needed. No npm install, no compilation, no bundling.
- Run the application using HTTP server (required - cannot run with file:// protocol):
  - **Python (Recommended)**: `python3 -m http.server 8000` - takes 2-3 seconds to start
  - **Alternative**: `./run_python_server.sh` or `./run_python_server.bat`
  - **Docker**: `docker build -t fmg . && docker run -p 8001:80 fmg` - build takes 3-5 minutes, run takes 3 seconds
- Access at: `http://localhost:8000` (Python) or `http://localhost:8001` (Docker)
- **Map Generation Time**: ~0.76 seconds for complete fantasy world generation. NEVER CANCEL generation.

## Validation
- Always manually validate any changes by:
  1. Starting the HTTP server (NEVER CANCEL - wait for full startup)
  2. Navigate to the application in browser
  3. Click the "►" button to generate a new map
  4. **CRITICAL VALIDATION**: Verify the map generates with countries, cities, roads, and geographic features
  5. Test UI interaction: click "Layers" button, verify layer controls work
  6. Test regeneration: click "New Map!" button, verify new map generates correctly
- **Expected Behavior**: Map generation shows console logs ending with "TOTAL: ~0.76s" and displays colorful political map with kingdoms, empires, cities, and geographic features
- **Known Issues**: Google Analytics and font loading errors are normal (blocked external resources)

## Repository Structure
### Core Files
- `index.html` - Main application entry point (589KB)
- `main.js` - Core application logic (1,268 lines)
- `versioning.js` - Version management and update handling

### Key Directories
- `modules/` - Core functionality modules:
  - `modules/ui/` - 44 UI components (editors, tools, style management)
  - `modules/dynamic/` - Runtime modules (export, installation)
  - `modules/renderers/` - Drawing and rendering logic
- `utils/` - 15 utility libraries (math, arrays, strings, etc.)
- `styles/` - 12 visual style presets (JSON files)
- `libs/` - Third-party libraries (D3.js, TinyMCE, etc.)
- `images/` - Icons, backgrounds, UI elements
- `charges/` - Heraldic symbols and coat of arms elements

### Configuration & Assets
- `config/` - Heightmap templates and configurations
- `heightmaps/` - Terrain generation data
- `components/` - UI component definitions

## Deployment Options
### Python HTTP Server (Recommended for Development)
```bash
cd /path/to/Fantasy-Map-Generator
python3 -m http.server 8000
# Access: http://localhost:8000
```

### Docker (Recommended for Production)
```bash
cd /path/to/Fantasy-Map-Generator
docker build -t fantasy-map-generator .  # Takes 3-5 minutes
docker run -p 8001:80 fantasy-map-generator  # Takes 3 seconds
# Access: http://localhost:8001
```

### Shell Scripts (Alternative)
```bash
# Linux/macOS
./run_python_server.sh

# Windows
./run_python_server.bat
./run_php_server.bat  # PHP alternative
```

## Common Tasks
### Making Code Changes
1. Edit JavaScript files directly (no compilation needed)
2. Refresh browser to see changes immediately
3. **ALWAYS test map generation** after making changes
4. Update version in `versioning.js` if making significant changes
5. Update file hashes in `index.html` for changed files (format: `file.js?v=1.108.1`)

### Debugging Map Generation
- Open browser developer tools console
- Look for timing logs: "TOTAL: ~0.76s"
- Map generation logs show each step (heightmap, rivers, states, etc.)
- Error messages will indicate specific generation failures

### Testing Different Map Types
- Use "New Map!" button for quick regeneration
- Access "Layers" menu to change map visualization
- Available presets: Political, Cultural, Religions, Biomes, Heightmap, Physical, Military

## Important Locations
### Frequently Modified Files
- `main.js` - Core map generation logic
- `modules/ui/layers.js` - Layer management and visualization
- `modules/heightmap-generator.js` - Terrain generation
- `modules/burgs-and-states.js` - Political entity generation
- `modules/ui/style.js` - Visual styling controls
- `versioning.js` - Update management

### Key Reference Files
```bash
# Repository structure
ls -la /path/to/repo
.
..
main.js           # Core application (1,268 lines)
index.html        # Entry point (589KB)
versioning.js     # Version management
modules/          # 25+ core modules
utils/            # 15 utility libraries
styles/           # 12 style presets
libs/             # Third-party dependencies
Dockerfile        # Container deployment
```

### Quick File Lookup
```bash
# Main application files
find . -name "main.js"                    # Core logic
find . -name "index.html"                 # Entry point
find . -name "versioning.js"              # Version info

# UI and editor files
find ./modules/ui -name "*editor.js"      # All editors
find ./modules/ui -name "layers.js"       # Layer controls
find ./modules/ui -name "style.js"        # Style controls

# Generation modules
find ./modules -name "*generator.js"      # All generators
find ./modules -name "heightmap-generator.js"  # Terrain
find ./modules -name "burgs-and-states.js"     # Politics
```

## Performance Notes
- Map generation: ~0.76 seconds typical
- Application startup: 2-3 seconds
- Repository size: 41MB total
- JavaScript files: 232 total
- NEVER CANCEL map generation or server startup processes

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
- Map generation should complete in ~1 second
- If slower, check browser console for errors
- Large maps or complex configurations may take longer

## DO NOT
- Do not attempt to build or compile the application
- Do not look for package.json or build tools (none exist)
- Do not cancel map generation process
- Do not run without HTTP server (will fail with security errors)

Remember: This is a sophisticated client-side application that generates complete fantasy worlds with political systems, geography, cultures, and detailed cartographic elements. Always validate that your changes preserve the core map generation functionality.