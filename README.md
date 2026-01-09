# Azgaar Fantasy Map Generator - Enhanced Fork

# Note: I use AI to assist with my writing due to mild dyslexia and parkinson's. The ideas and I would say 50% of the code are mine; the formatting is assisted.


This is a personal fork of [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) with custom enhancements for D&D campaign management.

## Original Project

**Original Repository**: [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator)  
**Original Author**: Max Haniyeu (Azgaar)  
**License**: MIT License

Full credit to Azgaar for creating this incredible fantasy map generation tool. Please visit and star the original repository!

---

## Custom Enhancements in This Fork

### ✨ Grid Auto-Numbering Feature

Added sequential numbering to grid cells for easy location referencing in D&D campaigns.

**Features:**
- Sequential numbering (0001, 0002, 0003...) starting from top-left
- Customizable font size and color
- Toggle on/off in Style panel
- Perfect alignment for pointy hex, square, and truncated square grids

**Usage:**
1. Enable Grid layer (press `G`)
2. Open Style panel → Select "Grid"
3. Check "Show grid numbers"
4. Adjust size and color as desired

**Documentation:** See [`GRID-NUMBERING-README.md`](./GRID-NUMBERING-README.md) for full implementation details.

---

## Running Locally

```bash
# Clone this fork
git clone [your-fork-url]
cd Fantasy-Map-Generator

# Open in browser
# Just open index.html in your web browser
```

---

## Contributing Back to Original Project

If you're interested in the grid numbering feature, please check out the [original Azgaar repository](https://github.com/Azgaar/Fantasy-Map-Generator) and consider starring it! The feature could potentially be contributed upstream if there's interest.

---

## License

This fork maintains the original MIT License. See [LICENSE](./LICENSE) for full details.

**Copyright 2017-2024 Max Haniyeu (Azgaar)**  
Grid numbering enhancements © 2024

---

## Acknowledgments

- **Azgaar** - For creating and maintaining this fantastic map generator
- **Original Contributors** - Everyone who has contributed to the main project
- **D&D Community** - For inspiration and use cases

---

**Original README follows below:**

---

# Fantasy Map Generator

Azgaar's _Fantasy Map Generator_ is a free web application that helps fantasy writers, game masters, and cartographers create and edit fantasy maps.

Link: [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator).

Refer to the [project wiki](https://github.com/Azgaar/Fantasy-Map-Generator/wiki) for guidance. The current progress is tracked in [Trello](https://trello.com/b/7x832DG4/fantasy-map-generator). Some details are covered in my old blog [_Fantasy Maps for fun and glory_](https://azgaar.wordpress.com).

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/9502eae9-92e0-4d0d-9f17-a2ba4a565c01)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/11a42446-4bd5-4526-9cb1-3ef97c868992)

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/e751a9e5-7986-4638-b8a9-362395ef7583)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/e751a9e5-7986-4638-b8a9-362395ef7583)

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/b0d0efde-a0d1-4e80-8818-ea3dd83c2323)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/b0d0efde-a0d1-4e80-8818-ea3dd83c2323)

Join our [Discord server](https://discordapp.com/invite/X7E84HU) and [Reddit community](https://www.reddit.com/r/FantasyMapGenerator) to share your creations, discuss the Generator, suggest ideas and get the most recent updates.

Contact me via [email](mailto:azgaar.fmg@yandex.com) if you have non-public suggestions. For bug reports please use [GitHub issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues) or _#fmg-bugs_ channel on Discord. If you are facing performance issues, please read [the tips](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Tips#performance-tips).

Pull requests are highly welcomed. The codebase is messy and requires re-design. I will appreciate if you start with minor changes. Check out the [data model](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-model) before contributing.

You can support the project on [Patreon](https://www.patreon.com/azgaar).

_Inspiration:_

- Martin O'Leary's [_Generating fantasy maps_](https://mewo2.com/notes/terrain)

- Amit Patel's [_Polygonal Map Generation for Games_](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation)

- Scott Turner's [_Here Dragons Abound_](https://heredragonsabound.blogspot.com)

