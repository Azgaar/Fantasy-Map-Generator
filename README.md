# Azgaar Fantasy Map Generator — Enhanced Fork

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

**Documentation:** See [`GRID-NUMBERING-README.md`](./GRID-NUMBERING-README.md) for full implementation details.

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

### 🗺️ Custom Fantasy Icons

A collection of D&D-themed SVG marker icons is included in `images/fantasy-icons/`. These can be used directly as custom markers in the map editor.

**Available icons include:** alchemist, ambush, battlefield, blacksmith, boss, bridge, burial, camp, castle, cave, circus, city, coffin, crystal, dragon, dungeon, encounter, fair, forest, fort, gate, gold bar, graveyard, lighthouse, magic, milestone quest, monster, necropolis, nest, outpost, portal, quest, ruins, sacred tree, scorpion, ship, shop, skeleton, snake, spider, stable, tavern, town, trap, treasure, undead, village, wagon, wasp, web, wrecked wagon, zombie, and more.

> **PNG source art:** AI-generated PNG versions of these icons (used as creative references) are not included in this repo to keep the size manageable. If there is demand, they will be uploaded in a separate `images/fantasy-icons-png/` directory. Open an issue to request them.

---

## Running Locally

```bash
# Clone this fork
git clone https://github.com/rstandow/Fantasy-Map-Generator
cd Fantasy-Map-Generator

# Open in browser — no build step needed
# Simply open index.html in your web browser

# Or run via the included Docker setup
docker compose up -d
```

---

## Contributing Back

If you find any of these features useful, please consider:
- ⭐ Starring the [original Azgaar repository](https://github.com/Azgaar/Fantasy-Map-Generator)
- Opening a PR upstream if the feature might benefit the wider community

---

## License

This fork maintains the original MIT License. See [LICENSE](./LICENSE) for full details.

**Copyright 2017–2024 Max Haniyeu (Azgaar)**  
Fork enhancements © 2024–2025

---

## Acknowledgments

- **Azgaar** — For creating and maintaining this fantastic map generator
- **Original Contributors** — Everyone who has contributed to the main project
- **D&D Community** — For inspiration and use cases

---

> Azgaar's _Fantasy Map Generator_ is a free web application that helps fantasy writers, game masters, and cartographers create and edit fantasy maps.
>
> Link: [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator)
>
> Refer to the [project wiki](https://github.com/Azgaar/Fantasy-Map-Generator/wiki) for guidance. Pull requests are highly welcomed!
