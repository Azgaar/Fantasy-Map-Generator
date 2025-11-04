# Fantasy Map Generator Wiki

Welcome to the Fantasy Map Generator documentation! This wiki provides comprehensive information about how the generator works, its architecture, and how to use and contribute to the project.

## What is Fantasy Map Generator?

Azgaar's Fantasy Map Generator is a free web application that helps fantasy writers, game masters, and cartographers create and edit fantasy maps. It uses procedural generation to create realistic-looking maps with terrain, water features, climates, civilizations, and much more.

**Live Application:** [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator)

## Key Features

- **Procedural Terrain Generation** - Realistic heightmaps, mountains, hills, and valleys
- **Water Simulation** - Rivers flow naturally based on elevation, lakes form in depressions
- **Climate System** - Temperature and precipitation affect biome distribution
- **Civilization Generation** - Cultures, states, religions, towns, and political boundaries
- **Extensive Customization** - 41+ specialized editors for every aspect of the map
- **Export Options** - Save/load maps, export to various formats
- **Procedural Naming** - Realistic place names using Markov chains
- **Coat of Arms** - Procedurally generated heraldry for states

## Documentation Structure

This wiki is organized into the following sections:

### Core Concepts

- **[Architecture](Architecture.md)** - High-level system architecture and design patterns
- **[Data Model](Data-Model.md)** - Data structures, objects, and relationships
- **[Generation Process](Generation-Process.md)** - How maps are generated step-by-step

### Reference Documentation

- **[Modules Reference](Modules-Reference.md)** - Detailed documentation of all modules
- **[Features and UI](Features-and-UI.md)** - Complete feature list and UI capabilities
- **[Getting Started](Getting-Started.md)** - Quick start guide for developers

### Additional Resources

- **[GitHub Repository](https://github.com/Azgaar/Fantasy-Map-Generator)** - Source code
- **[Discord Community](https://discordapp.com/invite/X7E84HU)** - Join the community
- **[Reddit Community](https://www.reddit.com/r/FantasyMapGenerator)** - Share your maps
- **[Trello Board](https://trello.com/b/7x832DG4/fantasy-map-generator)** - Development progress
- **[Patreon](https://www.patreon.com/azgaar)** - Support the project

## Quick Overview

### How It Works

The generator creates maps through a multi-stage process:

1. **Grid Generation** - Creates a Voronoi diagram from jittered points
2. **Terrain Creation** - Generates heightmap using templates or images
3. **Climate Simulation** - Calculates temperature and precipitation
4. **Water Features** - Generates rivers and lakes based on elevation
5. **Biomes** - Assigns vegetation types based on climate
6. **Civilization** - Places cultures, states, and settlements
7. **Infrastructure** - Creates roads and trade routes
8. **Rendering** - Draws all elements to an SVG canvas

### Technology Stack

- **Pure JavaScript** - No build system required
- **D3.js** - Data visualization and SVG manipulation
- **Delaunator** - Fast Delaunay triangulation
- **jQuery/jQuery UI** - UI components and interactions
- **SVG** - Vector graphics rendering
- **Typed Arrays** - Efficient data storage

### Data Model Overview

The generator maintains two main data structures:

- **`grid`** - Initial Voronoi graph (~10,000 cells) with terrain and climate data
- **`pack`** - Packed graph with civilizations, settlements, and derived features

All map data is stored in these objects, enabling save/load functionality and full editability.

## Contributing

Pull requests are highly welcomed! Before contributing:

1. Read the [Data Model](Data-Model.md) documentation
2. Review the [Architecture](Architecture.md) guide
3. Start with minor changes to familiarize yourself with the codebase
4. Check existing [issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues) and [discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions)

## Getting Help

- **Bug Reports** - Use [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues) or Discord #bugs channel
- **Questions** - Ask on [Discord](https://discordapp.com/invite/X7E84HU) or [Reddit](https://www.reddit.com/r/FantasyMapGenerator)
- **Performance Issues** - See [Performance Tips](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Tips#performance-tips)
- **Private Inquiries** - Email: azgaar.fmg@yandex.by

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Acknowledgments

This project was inspired by:

- Martin O'Leary's [Generating fantasy maps](https://mewo2.com/notes/terrain)
- Amit Patel's [Polygonal Map Generation for Games](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation)
- Scott Turner's [Here Dragons Abound](https://heredragonsabound.blogspot.com)
