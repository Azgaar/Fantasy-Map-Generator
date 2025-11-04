# Features and User Interface

This document describes all features available in the Fantasy Map Generator and how to use the user interface.

## Table of Contents

1. [Main Interface](#main-interface)
2. [Generation Features](#generation-features)
3. [Editing Features](#editing-features)
4. [Visualization Features](#visualization-features)
5. [Export and Save Features](#export-and-save-features)
6. [Advanced Features](#advanced-features)

---

## Main Interface

### Map Canvas

The central SVG canvas displays your generated map with multiple layers:

**Layer Controls:**
- Toggle layers on/off using toolbar buttons
- Adjust layer opacity
- Reorder layers (z-index)

**Interaction:**
- **Pan**: Click and drag
- **Zoom**: Mouse wheel or pinch gesture
- **Select**: Click on elements to select
- **Info**: Hover for tooltips

### Toolbar

Located at the top of the screen, provides quick access to:

**File Operations:**
- New map
- Open map
- Save map
- Export

**Tools:**
- Edit mode toggle
- Layer visibility
- Zoom controls
- Fullscreen

**Options:**
- Generation options
- Style settings
- Editor access

### Tools Panel

Expandable side panel with:
- Quick generation options
- Layer toggles
- Minimap
- Statistics

---

## Generation Features

### Initial Map Generation

**Access:** File → Generate New Map

**Options:**

#### Seed Settings
- **Seed**: Text string for reproducible generation
  - Leave blank for random
  - Share seeds to recreate maps
- **Random Button**: Generate random seed

#### Template Selection
- **Heightmap Template**: Choose terrain type
  - Pangea - Single large continent
  - Continents - Multiple landmasses
  - Archipelago - Many islands
  - Atoll - Ring-shaped coral island
  - Mediterranean - Central sea
  - Peninsula - Land projection
  - Isthmus - Narrow land bridge
  - Volcano - Volcanic island
  - High/Low Island - Island types
  - Custom - Upload your own heightmap image

#### World Settings
- **Cell Count**: Map detail level (1,000 - 100,000)
  - Lower = faster, less detailed
  - Higher = slower, more detailed
  - Default: ~10,000
- **Map Size**: Width and height in pixels
- **Latitude**: North/south positioning (affects climate)

#### Culture Settings
- **Culture Count**: Number of cultures (1-20)
- **Name Bases**: Select language/naming styles

#### State Settings
- **State Count**: Number of political entities
- **Expansionism**: How aggressively states expand
- **Neutral Lands**: Percentage of unclaimed territory

#### Population Settings
- **Urban Density**: Frequency of cities/towns
- **Rural Density**: Population distribution
- **Urban Growth**: City size multiplier

**Generate Button**: Start map generation with selected options

---

### Quick Regeneration

**Access:** Tools → Regenerate

Quickly regenerate specific map aspects:

- **Regenerate Cultures**: New culture distribution
- **Regenerate States**: New political boundaries
- **Regenerate Religions**: New religious landscape
- **Regenerate Burgs**: New settlement locations
- **Regenerate Rivers**: New river networks
- **Regenerate Routes**: New road networks

Useful for refining maps without starting over.

---

## Editing Features

The generator includes 41+ specialized editors for fine-tuning every aspect of your map.

### Terrain Editing

#### Heightmap Editor

**Access:** Layers → Heightmap → Edit Heightmap

**Features:**
- **Brush Tool**: Paint elevation
  - Adjustable size and strength
  - Raise or lower terrain
- **Smooth Tool**: Soften elevation changes
- **Flatten Tool**: Create plateaus
- **Add/Remove Land**: Change coastlines
- **Templates**: Apply heightmap patterns to regions
- **Import Image**: Load custom heightmap

**Usage:**
1. Select tool (brush, smooth, etc.)
2. Adjust size and strength
3. Click and drag on map
4. Changes update in real-time

#### Biomes Editor

**Access:** Layers → Biomes → Edit Biomes

**Features:**
- Change biome type for cells/regions
- View biome distribution
- Adjust climate parameters
- Customize biome colors and properties

**Biome Types:**
- Marine, Hot Desert, Cold Desert
- Savanna, Grassland
- Tropical Forest, Temperate Forest, Rainforest
- Taiga, Tundra, Glacier
- Wetland

#### Relief Editor

**Access:** Layers → Relief → Edit Relief

**Features:**
- Add/remove terrain icons (mountains, hills, forests)
- Adjust icon density
- Change icon styles
- Customize hill shading

---

### Water Features Editing

#### Rivers Editor

**Access:** Layers → Rivers → Edit Rivers

**Features:**
- **Add River**: Click to create river source
- **Remove River**: Delete rivers
- **Regenerate River**: Recalculate specific river path
- **Edit Path**: Modify river course
- **Name Rivers**: Assign custom names
- **Adjust Width**: Change river width

**River Properties:**
- Name
- Source and mouth
- Length
- Width
- Type (river, stream, creek)
- Parent (for tributaries)

#### Lakes Editor

**Access:** Layers → Lakes → Edit Lakes

**Features:**
- Create new lakes
- Remove lakes
- Resize lakes
- Name lakes
- Adjust lake elevation

#### Coastline Editor

**Access:** Tools → Edit Coastline

**Features:**
- Reshape coastlines
- Add/remove coastal details
- Create bays and peninsulas
- Smooth jagged coasts

---

### Civilization Editing

#### Cultures Editor

**Access:** Layers → Cultures → Edit Cultures

**Features:**
- **Add Culture**: Create new culture
- **Remove Culture**: Delete culture
- **Expand/Contract**: Adjust territory
- **Properties**:
  - Name
  - Color
  - Name base (language)
  - Type (Generic, River, Lake, etc.)
  - Expansionism rate
  - Shield shape

**Culture List:**
- View all cultures
- See population and area
- Filter by properties

#### States Editor

**Access:** Layers → States → Edit States

**Features:**
- **Add State**: Create new state
- **Remove State**: Delete state
- **Merge States**: Combine multiple states
- **Split State**: Divide into multiple states
- **Change Capital**: Assign new capital city
- **Adjust Borders**: Reshape boundaries

**State Properties:**
- Name
- Color
- Capital burg
- Government type (Kingdom, Empire, Republic, etc.)
- Government form (Monarchy, Theocracy, etc.)
- Culture
- Religion
- Expansionism
- Military units
- Diplomacy (relations with other states)

**Diplomacy:**
- Set relations (Ally, Friendly, Neutral, Unfriendly, Enemy)
- View diplomatic map

#### Burgs Editor (Settlements)

**Access:** Layers → Burgs → Edit Burgs

**Features:**
- **Add Burg**: Place new settlement
- **Remove Burg**: Delete settlement
- **Move Burg**: Relocate settlement
- **Properties**:
  - Name
  - Type (City, Town, Village)
  - Population
  - State
  - Culture
  - Capital status
  - Port/harbor
  - Citadel/fortress

**Settlement Types:**
- **Capital**: State capital (largest)
- **City**: Major urban center (10,000+)
- **Town**: Smaller settlement (1,000-10,000)
- **Village**: Small settlement (<1,000)

**Population:**
- Manually set population
- Auto-calculate based on surroundings
- View urban vs. rural population

#### Religions Editor

**Access:** Layers → Religions → Edit Religions

**Features:**
- **Add Religion**: Create new religion
- **Remove Religion**: Delete religion
- **Expand/Contract**: Adjust territory
- **Properties**:
  - Name
  - Color
  - Type (Folk, Organized, Cult, Heresy)
  - Form (Cult, Church, Temple, etc.)
  - Origin culture
  - Deity name (if applicable)
  - Expansion strategy

#### Provinces Editor

**Access:** Layers → Provinces → Edit Provinces

**Features:**
- Add/remove provinces
- Adjust provincial boundaries
- Assign provincial capitals
- Name provinces
- View province statistics

**Province Properties:**
- Name
- Form name (Duchy, County, Prefecture, etc.)
- State
- Capital burg
- Area
- Population

---

### Infrastructure Editing

#### Routes Editor

**Access:** Layers → Routes → Edit Routes

**Features:**
- **Add Route**: Create road/trail/sea route
- **Remove Route**: Delete route
- **Regenerate Routes**: Recalculate optimal paths
- **Edit Path**: Modify route course

**Route Types:**
- **Roads**: Major land routes (black lines)
- **Trails**: Minor paths (dashed lines)
- **Sea Routes**: Maritime trade routes (blue lines)

**Properties:**
- Connected burgs
- Length
- Width/importance
- Path points

#### Military Overview

**Access:** Tools → Military

**Features:**
- View all military units
- Add/remove units
- Assign units to burgs
- Calculate military strength

**Unit Properties:**
- Name
- Type (Infantry, Cavalry, Archers, Artillery, Fleet)
- Strength (number of soldiers)
- State
- Location (burg)

---

### Annotations and Markers

#### Markers Editor

**Access:** Layers → Markers → Edit Markers

**Features:**
- **Add Marker**: Place custom markers
- **Remove Marker**: Delete markers
- **Properties**:
  - Type (volcano, ruins, mine, bridge, etc.)
  - Icon
  - Size
  - Associated note

**Marker Types:**
- Volcanoes 🌋
- Ruins 🏛️
- Battlefields ⚔️
- Mines ⛏️
- Bridges 🌉
- Monuments 🗿
- Shrines ⛩️
- Castles 🏰
- Capitals ⭐

#### Notes Editor

**Access:** Tools → Notes

**Features:**
- **Add Note**: Create text annotation
- **Edit Note**: Modify note text
- **Pin to Location**: Associate with marker/location
- **Categories**: Organize notes by type

**Note Properties:**
- Title
- Description (rich text)
- Legend text
- Associated markers

#### Zones Editor

**Access:** Layers → Zones

**Features:**
- Define custom zones/regions
- Outline areas for campaigns
- Mark territories
- Add zone labels

---

## Visualization Features

### Style Editor

**Access:** Style → Edit Style

**Features:**

#### Color Schemes
- **Terrain**: Heightmap coloring
- **States**: Political boundaries
- **Cultures**: Cultural regions
- **Religions**: Religious distribution
- **Biomes**: Vegetation zones

#### Presets
- Default
- Antique
- Monochrome
- Watercolor
- And more...

#### Customization
- Background color
- Ocean color
- Land gradient
- Border styles
- Label fonts and sizes

### Label Settings

**Access:** Style → Labels

**Features:**
- **Show/Hide Labels**: Toggle label types
  - State names
  - Burg names
  - Province names
  - River names
  - Region names
- **Font Settings**:
  - Font family
  - Font size
  - Font style (bold, italic)
  - Text color
  - Stroke color and width
- **Label Positioning**: Auto or manual placement

### Layer Visibility

**Access:** Toolbar layer buttons

**Toggleable Layers:**
- Terrain (heightmap)
- Biomes
- States
- Cultures
- Religions
- Provinces
- Borders
- Rivers
- Lakes
- Coastline
- Routes (roads, trails, sea routes)
- Burgs (settlements)
- Icons (relief icons)
- Markers
- Labels
- Temperature (overlay)
- Precipitation (overlay)
- Population (density overlay)
- Grid
- Coordinates
- Scale bar
- Compass
- Legend

---

### Temperature and Precipitation

**Access:** Layers → Temperature / Precipitation

**Features:**
- View temperature distribution
- View precipitation patterns
- Adjust climate parameters
- See climate effects on biomes

**Display:**
- Heat map overlay
- Gradient visualization
- Isolines

---

### 3D View

**Access:** Tools → 3D View

**Features:**
- 3D terrain visualization
- Rotate and zoom
- Adjust elevation exaggeration
- Change lighting angle
- Export 3D view

**Controls:**
- Mouse drag to rotate
- Scroll to zoom
- Sliders for parameters

---

### Emblems and Heraldry

**Access:** Click on state/burg/province

**Features:**
- View coat of arms
- Regenerate heraldry
- Customize elements:
  - Shield shape
  - Divisions
  - Charges (symbols)
  - Tinctures (colors)

**Heraldic Elements:**
- 200+ charges (lions, eagles, crowns, etc.)
- Multiple shield shapes
- Standard heraldic rules
- Export as SVG/PNG

---

## Export and Save Features

### Save Map

**Access:** File → Save Map

**Formats:**
- **.map** - Native format (includes all data)
- Compressed JSON
- Can be loaded later

**Features:**
- Auto-save to browser storage
- Manual save to file
- Save to cloud (Dropbox integration)

---

### Load Map

**Access:** File → Load Map

**Sources:**
- Local file
- URL
- Dropbox
- Browser storage (auto-saved)

**Compatibility:**
- Automatic version migration
- Handles old map formats
- Validates data integrity

---

### Export Options

**Access:** File → Export

#### Export SVG

- Vector format
- Scalable without quality loss
- Edit in Inkscape, Illustrator, etc.
- Options:
  - All layers or selected layers
  - Embedded fonts
  - Optimized output

#### Export PNG

- Raster format
- High resolution available
- Options:
  - Resolution (DPI)
  - Size (width × height)
  - Quality
  - Transparent background

#### Export JSON

- Raw data export
- All map data in JSON format
- Use for custom processing
- Import into other tools

#### Export Other Formats

- **PDF**: Print-ready format
- **CSV**: Data tables (burgs, states, etc.)
- **GeoJSON**: Geographic data format

---

### Print Map

**Access:** File → Print

**Features:**
- Print-optimized layout
- Paper size selection
- Scale adjustment
- Layer selection
- Preview before printing

---

## Advanced Features

### Submaps

**Access:** Tools → Create Submap

**Purpose:** Generate detailed map of a specific region

**Features:**
- Select region on main map
- Generate high-detail submap
- Inherit terrain and features
- Independent editing

**Use Cases:**
- Zooming into a kingdom
- Detailed city surroundings
- Regional campaigns

---

### Focus Mode

**Access:** Tools → Focus

**Features:**
- **Focus on Cell**: Zoom to specific cell
- **Focus on Burg**: Center on settlement
- **Focus on Coordinates**: Go to X, Y position

---

### Elevation Profile

**Access:** Tools → Elevation Profile

**Features:**
- Draw line on map
- View elevation graph along line
- Measure distance
- Identify peaks and valleys

---

### Battle Screen

**Access:** Tools → Battle Screen

**Features:**
- Tactical battle map view
- Hexagonal grid overlay
- Unit placement
- Terrain effects

---

### Customization

#### Custom Name Bases

**Access:** Tools → Name Bases

**Features:**
- Add custom language/naming
- Provide example names
- Generator learns patterns
- Apply to cultures

#### Custom Biomes

**Access:** Biomes → Customize

**Features:**
- Define new biome types
- Set climate parameters
- Assign colors and icons
- Adjust habitability

---

### Versioning

**Access:** Automatic

**Features:**
- Maps store version info
- Auto-upgrade on load
- Maintains compatibility
- Migration scripts for old maps

Handled by `versioning.js`.

---

### Undo/Redo

**Access:** Edit menu or Ctrl+Z / Ctrl+Y

**Features:**
- Undo recent changes
- Redo undone changes
- History tracking
- Multiple undo levels

---

### Keyboard Shortcuts

**Common Shortcuts:**
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Ctrl+S**: Save map
- **Ctrl+O**: Open map
- **F11**: Fullscreen
- **Space**: Pan mode
- **+/-**: Zoom in/out
- **Esc**: Cancel current operation

---

### Map Statistics

**Access:** Tools → Statistics

**Features:**
- Total land area
- Total population
- Number of states
- Number of burgs
- Culture distribution
- Religion distribution
- Biome distribution
- And more...

**Export:** Export statistics as CSV/JSON

---

### Randomization Tools

**Access:** Tools → Randomize

**Features:**
- Randomize names (burgs, states, etc.)
- Randomize colors
- Randomize coats of arms
- Randomize any specific aspect

Useful for quickly generating variations.

---

## Tips and Tricks

### Performance Optimization

1. **Lower cell count** for faster generation
2. **Disable unused layers** for better rendering
3. **Use simple styles** for complex maps
4. **Close editors** when not in use

### Best Practices

1. **Save frequently** to avoid data loss
2. **Use seeds** for reproducibility
3. **Start with templates** then customize
4. **Layer edits** progressively (terrain → cultures → states)
5. **Backup important maps**

### Common Workflows

#### Creating a Campaign Map

1. Generate base map with template
2. Adjust terrain with heightmap editor
3. Refine rivers and lakes
4. Edit culture and state boundaries
5. Add important cities/locations
6. Place markers for quest locations
7. Add notes for lore
8. Style and export

#### Creating a World Map

1. Use "Continents" template
2. Generate with medium cell count
3. Focus on large-scale features
4. Simplify details (fewer burgs)
5. Adjust states for empires/kingdoms
6. Export at high resolution

#### Creating a Regional Map

1. Use "Peninsula" or custom template
2. High cell count for detail
3. Add many burgs
4. Detailed provinces
5. Add markers for every point of interest
6. Extensive notes and lore

---

## Troubleshooting

### Common Issues

**Map Won't Generate:**
- Check browser console for errors
- Try lower cell count
- Use different template
- Clear browser cache

**Performance Issues:**
- Reduce cell count
- Disable complex layers
- Close other browser tabs
- Use modern browser

**Export Not Working:**
- Check browser permissions
- Try different format
- Reduce export size
- Update browser

**Data Loss:**
- Check auto-save in browser storage
- Look for backup files
- Enable cloud save

For more help:
- [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues)
- [Discord Community](https://discordapp.com/invite/X7E84HU)
- [Reddit Community](https://www.reddit.com/r/FantasyMapGenerator)

---

## Further Reading

- [Generation Process](Generation-Process.md) - How maps are created
- [Data Model](Data-Model.md) - Understanding the data
- [Modules Reference](Modules-Reference.md) - Technical details
- [Architecture](Architecture.md) - System design
