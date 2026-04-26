# Azgaar Fantasy Map Generator — Enhanced Fork

> **⚠️ Maintenance Status**: Due to life engagements, I am unable to actively maintain this repository. The code is provided as-is for others to enjoy, learn from, and build upon. Feel free to fork and continue development!

This is a personal fork of [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) with custom enhancements for D&D campaign management.

## Original Project
**Original Repository**: [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator)  
**Original Author**: Max Haniyeu (Azgaar)  
**License**: MIT License

Full credit to Azgaar for creating this incredible fantasy map generation tool. Please visit and star the original repository!

---

## Custom Enhancements in This Fork

### ✨ Grid Auto-Numbering
Added sequential numbering to grid cells for easy location referencing in tabletop RPG campaigns.

**Features:**
- Sequential numbering (0001, 0002, 0003...) starting from top-left
- Customizable font size and color
- Toggle on/off in the Style panel
- Accurate alignment for pointy hex, flat hex, and square grid types

**Usage:**
1. Enable the Grid layer (press `G`)
2. Open Style panel → Select **Grid**
3. Check **Show grid numbers**
4. Adjust size and color as desired

**Documentation:** See [GRID-NUMBERING-README.md](./GRID-NUMBERING-README.md) for full implementation details.

---

### 🔍 Grid Search
Search for map elements (Markers, Burgs, Units, Notes) by their grid cell number.

**Features:**
- Search input in the **Tools → Search** section
- Results dialog lists every element found inside the specified grid cell
- Click any result to pan the map to that element and open its editor
- Tooltips on Markers, Burgs, and Armies show the current grid number when grid numbering is active

**Usage:**
1. Enable the Grid layer with numbering turned on
2. Open the **Tools** tab
3. Type a grid number (e.g. `1691`) in the **Search** field and click **Search Grid**
4. Click any result in the dialog to jump to it on the map

---

## Running Locally
```bash
