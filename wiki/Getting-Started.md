# Getting Started

Welcome! This guide will help you get started with the Fantasy Map Generator, whether you're a user wanting to create maps or a developer wanting to contribute.

## Table of Contents

1. [For Users](#for-users)
2. [For Developers](#for-developers)
3. [Quick Start Tutorial](#quick-start-tutorial)
4. [Contributing](#contributing)
5. [Resources](#resources)

---

## For Users

### Using the Online Version

The easiest way to use the Fantasy Map Generator is through the web application:

**Link:** [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator)

**Requirements:**
- Modern web browser (Chrome, Firefox, Safari, or Edge)
- JavaScript enabled
- Recommended: Desktop or laptop (mobile works but with limitations)

**No installation needed!** Just open the link and start generating maps.

---

### Using the Desktop Version

For offline use or better performance, download the Electron desktop application:

**Download:** [GitHub Releases](https://github.com/Azgaar/Fantasy-Map-Generator/releases)

**Installation:**

1. Go to the releases page
2. Download the archive for your platform:
   - **Windows**: `FMG-windows-x64.zip`
   - **macOS**: `FMG-darwin-x64.zip`
   - **Linux**: `FMG-linux-x64.zip`
3. Extract the archive
4. Run the executable:
   - **Windows**: `FMG.exe`
   - **macOS**: `FMG.app`
   - **Linux**: `FMG`

**Benefits:**
- Works offline
- Better performance
- No browser limitations
- Easier file management

---

### Creating Your First Map

**Step 1: Open the Generator**

Visit the website or open the desktop app.

**Step 2: Generate**

Click the **"Generate New Map"** button (or it generates automatically on first load).

**Step 3: Explore**

Your map is ready! You'll see:
- Terrain with mountains, plains, and water
- Rivers and lakes
- Political boundaries (states)
- Cities and towns
- Labels and names

**Step 4: Customize**

Use the toolbar to:
- Toggle layers on/off
- Zoom and pan
- Open editors to modify the map
- Change visual style

**Step 5: Save**

Click **File → Save Map** to download your map as a `.map` file.

**Congratulations!** You've created your first fantasy map.

---

### Basic Controls

**Mouse Controls:**
- **Left Click**: Select elements
- **Right Click**: Context menu (in editors)
- **Drag**: Pan the map
- **Scroll**: Zoom in/out
- **Hover**: Show tooltips

**Keyboard Shortcuts:**
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Ctrl+S**: Save
- **Ctrl+O**: Open
- **F11**: Fullscreen
- **Space**: Toggle pan mode

---

### Common Tasks

#### Changing Terrain

1. Click **Layers → Heightmap**
2. Click **Edit Heightmap**
3. Use brush tools to raise/lower terrain
4. Click **Apply**

#### Adding a City

1. Click **Layers → Burgs**
2. Click **Add Burg**
3. Click on map where you want the city
4. Fill in name and details
5. Click **Add**

#### Customizing Colors

1. Click **Style → Edit Style**
2. Select element to customize (states, terrain, etc.)
3. Choose colors
4. Click **Apply**

#### Exporting

1. Click **File → Export**
2. Choose format (SVG, PNG, etc.)
3. Configure options
4. Click **Export**

---

### Learning Resources

**Official Resources:**
- [Wiki](https://github.com/Azgaar/Fantasy-Map-Generator/wiki) - Comprehensive guides
- [YouTube Channel](https://www.youtube.com/channel/UCb0_JfUg6t2k_dYuLBrGg_g) - Video tutorials
- [Blog](https://azgaar.wordpress.com) - Articles and tips

**Community:**
- [Discord](https://discordapp.com/invite/X7E84HU) - Live chat and support
- [Reddit](https://www.reddit.com/r/FantasyMapGenerator) - Share maps and discuss

**Examples:**
- [Gallery](https://www.reddit.com/r/FantasyMapGenerator/search?q=flair%3AShowcase&restrict_sr=1) - Community maps for inspiration

---

## For Developers

### Setting Up Development Environment

#### Prerequisites

- **Git** - Version control
- **Modern Browser** - Chrome/Firefox with DevTools
- **Text Editor** - VS Code, Sublime, Atom, etc.
- **Optional**: Node.js (for local server)

#### Clone the Repository

```bash
git clone https://github.com/Azgaar/Fantasy-Map-Generator.git
cd Fantasy-Map-Generator
```

#### Run Locally

**Option 1: Python Server**

```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

**Option 2: Node.js Server**

```bash
npx http-server -p 8080
```

**Option 3: VS Code Live Server**

1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

**Option 4: Direct File Access**

Open `index.html` directly in browser (some features may not work due to CORS).

#### Access the Application

Open your browser and navigate to:
```
http://localhost:8080
```

---

### Project Structure

```
Fantasy-Map-Generator/
├── index.html          # Main HTML file
├── index.css           # Main stylesheet
├── main.js             # Core application logic
├── versioning.js       # Map version migration
├── modules/            # Feature modules
│   ├── heightmap-generator.js
│   ├── river-generator.js
│   ├── cultures-generator.js
│   ├── burgs-and-states.js
│   ├── religions-generator.js
│   ├── routes-generator.js
│   ├── military-generator.js
│   ├── markers-generator.js
│   ├── names-generator.js
│   ├── coa-generator.js
│   ├── coa-renderer.js
│   ├── biomes.js
│   ├── lakes.js
│   ├── voronoi.js
│   ├── fonts.js
│   ├── relief-icons.js
│   ├── ocean-layers.js
│   ├── io/             # Save/load/export
│   ├── ui/             # 41+ editor dialogs
│   ├── renderers/      # Visualization
│   └── dynamic/        # On-demand utilities
├── libs/               # Third-party libraries
│   ├── d3.min.js
│   ├── delaunator.min.js
│   ├── jquery.min.js
│   └── jquery-ui.min.js
├── utils/              # Utility functions
├── config/             # Configuration files
├── styles/             # Additional stylesheets
├── images/             # Image assets
├── charges/            # Heraldic charges (200+)
└── heightmaps/         # Template heightmaps
```

---

### Making Your First Change

#### Example: Changing Default Sea Level

**File:** `modules/heightmap-generator.js`

**Find:**
```javascript
const seaLevel = 20; // Default sea level
```

**Change to:**
```javascript
const seaLevel = 25; // Raised sea level
```

**Save and reload** - Sea level is now higher.

---

### Development Workflow

#### 1. Create a Branch

```bash
git checkout -b feature/my-feature
```

#### 2. Make Changes

Edit files in your preferred editor.

#### 3. Test Changes

- Reload the browser
- Test affected features
- Check browser console for errors

#### 4. Commit Changes

```bash
git add .
git commit -m "Add description of changes"
```

#### 5. Push Branch

```bash
git push origin feature/my-feature
```

#### 6. Create Pull Request

1. Go to GitHub repository
2. Click "Pull Requests"
3. Click "New Pull Request"
4. Select your branch
5. Describe changes
6. Submit

---

### Code Style Guidelines

#### JavaScript Style

**Use strict mode:**
```javascript
"use strict";
```

**Module pattern:**
```javascript
window.MyModule = (function() {
  // Private
  function privateFunction() {}

  // Public
  function publicFunction() {}

  return { publicFunction };
})();
```

**Naming conventions:**
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Functions: `camelCase`
- Modules: `PascalCase`

**Comments:**
```javascript
// Single-line for brief explanations

/* Multi-line for
   longer explanations */
```

#### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Use them
- **Quotes**: Prefer double quotes
- **Line length**: ~100 characters

#### Best Practices

1. **No global pollution** - Use modules
2. **Use typed arrays** for cell data
3. **Cache DOM selections** - Don't query repeatedly
4. **Minimize D3 updates** - Batch when possible
5. **Comment complex logic** - Help future maintainers

---

### Understanding the Codebase

#### Key Concepts

**1. Global State**

```javascript
grid  // Voronoi diagram + terrain
pack  // Civilizations + derived data
seed  // Random seed
```

All modules access these globals.

**2. Generation Pipeline**

```javascript
generateGrid()
→ generateHeightmap()
→ markFeatures()
→ calculateClimate()
→ generateRivers()
→ defineBiomes()
→ generateCultures()
→ generateStates()
→ render()
```

Each step builds on the previous.

**3. Data Structures**

Heavily uses typed arrays:
```javascript
pack.cells.h = new Uint8Array(n);  // Heights
pack.cells.s = new Uint16Array(n); // State IDs
```

See [Data Model](Data-Model.md) for details.

**4. Rendering**

Uses D3.js for SVG manipulation:
```javascript
d3.select('#states').selectAll('path')
  .data(pack.states)
  .enter().append('path')
  .attr('d', drawStatePath)
  .attr('fill', d => d.color);
```

---

### Debugging Tips

#### Browser DevTools

**Console:**
- View errors and warnings
- Log values: `console.log(grid)`
- Inspect objects: `console.dir(pack.states[0])`

**Debugger:**
- Set breakpoints in sources
- Step through code
- Inspect variables

**Performance:**
- Profile generation
- Identify slow functions
- Monitor memory usage

#### Common Issues

**Problem: Changes not appearing**
- Hard refresh (Ctrl+Shift+R)
- Clear browser cache
- Check console for errors

**Problem: Map not generating**
- Check console for errors
- Verify module loading order
- Test with lower cell count

**Problem: Performance issues**
- Reduce cell count
- Profile in DevTools
- Check for infinite loops

---

### Testing

Currently, the project lacks automated tests. Manual testing is required:

#### Test Checklist

- [ ] Map generates successfully
- [ ] All layers render correctly
- [ ] Editors open without errors
- [ ] Changes persist after save/load
- [ ] Export formats work
- [ ] No console errors

#### Test Different Scenarios

- Different templates
- Different cell counts
- Edge cases (very high/low values)
- Browser compatibility

---

## Quick Start Tutorial

### Tutorial: Adding a Custom Biome

This tutorial shows how to add a new biome type called "Jungle".

**Step 1: Define Biome Data**

Edit `modules/biomes.js`:

```javascript
// Add to biomesData.i array
14  // New ID for Jungle

// Add to biomesData.name array
"Jungle"

// Add to biomesData.color array
"#2d5016"  // Dark green

// Add to biomesData.habitability array
50  // Medium habitability

// Add to other arrays...
```

**Step 2: Update Biome Matrix**

Add logic to assign "Jungle" biome:

```javascript
// In high temp + high precipitation
if (temp > 80 && prec > 200) {
  return 14; // Jungle
}
```

**Step 3: Test**

1. Reload the application
2. Generate a new map
3. Look for jungle biomes in hot, wet regions
4. Check if rendering works correctly

**Step 4: Add Icons (Optional)**

Add jungle-specific relief icons in `modules/relief-icons.js`.

**Congratulations!** You've added a custom biome.

---

### Tutorial: Creating a Simple Editor

This tutorial shows how to create a basic editor dialog.

**Step 1: Create Editor File**

Create `modules/ui/my-editor.js`:

```javascript
"use strict";

function editMyFeature() {
  // Create dialog
  $("#myEditor").dialog({
    title: "My Feature Editor",
    width: 400,
    height: 300,
    buttons: {
      Apply: applyChanges,
      Close: function() { $(this).dialog("close"); }
    }
  });

  function applyChanges() {
    // Implement your logic
    const value = $("#myInput").val();
    console.log("Applied:", value);
  }
}
```

**Step 2: Add HTML Dialog**

In `index.html`, add:

```html
<div id="myEditor" class="dialog">
  <label>My Setting:</label>
  <input id="myInput" type="text" />
</div>
```

**Step 3: Include Script**

In `index.html`, add:

```html
<script src="modules/ui/my-editor.js"></script>
```

**Step 4: Add Menu Item**

Add button to toolbar or menu to call `editMyFeature()`.

**Step 5: Test**

Click the button and verify dialog opens.

---

## Contributing

### Ways to Contribute

1. **Report Bugs** - Use [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues)
2. **Suggest Features** - Use [Discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions)
3. **Improve Documentation** - Submit PR with doc improvements
4. **Fix Bugs** - Pick an issue and submit a fix
5. **Add Features** - Implement new functionality
6. **Share Maps** - Inspire others on [Reddit](https://www.reddit.com/r/FantasyMapGenerator)

### Contribution Guidelines

#### Before Contributing

1. **Read the documentation**
   - [Data Model](Data-Model.md)
   - [Architecture](Architecture.md)
   - [Generation Process](Generation-Process.md)

2. **Check existing issues**
   - Avoid duplicates
   - Discuss major changes first

3. **Start small**
   - Begin with minor changes
   - Get familiar with codebase
   - Build up to larger features

#### Pull Request Process

1. **Fork the repository**
2. **Create a branch** (`feature/my-feature`)
3. **Make changes** with clear commits
4. **Test thoroughly**
5. **Update documentation** if needed
6. **Submit pull request** with clear description
7. **Respond to feedback**

#### Code Review

Maintainers will review your PR and may:
- Request changes
- Suggest improvements
- Merge if approved

Be patient and receptive to feedback!

---

### Community Guidelines

**Be respectful:**
- Kind and constructive communication
- Welcome newcomers
- Help others learn

**Stay on topic:**
- Keep discussions relevant
- Use appropriate channels

**Share knowledge:**
- Document your solutions
- Help others with issues
- Create tutorials

**Follow the Code of Conduct:**
See [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)

---

## Resources

### Documentation

- **[Home](Home.md)** - Wiki home
- **[Architecture](Architecture.md)** - System design
- **[Data Model](Data-Model.md)** - Data structures
- **[Generation Process](Generation-Process.md)** - How maps are created
- **[Modules Reference](Modules-Reference.md)** - Module documentation
- **[Features and UI](Features-and-UI.md)** - Feature guide

### External Resources

**Inspiration:**
- [Generating Fantasy Maps](https://mewo2.com/notes/terrain) - Martin O'Leary
- [Polygonal Map Generation](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation) - Amit Patel
- [Here Dragons Abound](https://heredragonsabound.blogspot.com) - Scott Turner

**Tools:**
- [D3.js Documentation](https://d3js.org/)
- [SVG Reference](https://developer.mozilla.org/en-US/docs/Web/SVG)
- [Delaunator](https://github.com/mapbox/delaunator)

### Getting Help

**Questions?**
- Ask on [Discord](https://discordapp.com/invite/X7E84HU)
- Post on [Reddit](https://www.reddit.com/r/FantasyMapGenerator)
- Search [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues)

**Bug Reports?**
- Use [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues)
- Include steps to reproduce
- Provide browser/version info
- Share console errors

**Feature Requests?**
- Use [Discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions)
- Describe use case
- Explain expected behavior

**Private Inquiries?**
- Email: azgaar.fmg@yandex.by

---

## Next Steps

### For Users

1. **Experiment** - Try different templates and options
2. **Explore editors** - Customize every aspect
3. **Share your maps** - Post to community
4. **Learn advanced features** - 3D view, submaps, etc.

### For Developers

1. **Read the codebase** - Explore key modules
2. **Make small changes** - Build confidence
3. **Fix a bug** - Pick from issues
4. **Add a feature** - Implement something new
5. **Improve docs** - Help others learn

---

## Welcome to the Community!

Whether you're creating maps for your D&D campaign, writing a fantasy novel, or contributing code, we're glad you're here!

**Happy mapping!** 🗺️

---

## FAQ

**Q: Is it really free?**
A: Yes! Completely free and open source.

**Q: Can I use maps commercially?**
A: Yes! The MIT license allows commercial use.

**Q: Do I need to credit the generator?**
A: Not required, but appreciated!

**Q: Can I run it offline?**
A: Yes, use the desktop version or host locally.

**Q: How do I report bugs?**
A: Use [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues).

**Q: Can I contribute if I'm new to coding?**
A: Absolutely! Start with documentation or small bug fixes.

**Q: Where can I see examples?**
A: Check the [Reddit community](https://www.reddit.com/r/FantasyMapGenerator) for amazing maps!

**Q: Is there a mobile app?**
A: Not currently, but the web version works on mobile browsers.

**Q: Can I import my own data?**
A: Yes, see export/import features for JSON data.

**Q: How can I support the project?**
A: [Patreon](https://www.patreon.com/azgaar) or contribute code!

---

For more questions, visit the community channels!
