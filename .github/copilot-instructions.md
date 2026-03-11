# Fantasy Map Generator

Azgaar's Fantasy Map Generator is a client-only web application for creating fantasy maps. It generates detailed fantasy worlds with countries, cities, rivers, biomes, and cultural elements.

Always reference these instructions first.

# Architecture

The codebase is gradually transitioning from **vanilla JavaScript to TypeScript** while maintaining compatibility with the existing generation pipeline and legacy `.map` user files.

The expected **future architecture** is based on a separation between **world data**, **procedural generation**, **interactive editing**, and **rendering**.

The application is conceptually divided into four main layers:

- **State** — world data and style configuration, the single source of truth
- **Generators** — procedural world simulation (model)
- **Editors** — user-driven mutations of the world state (controllers)
- **Renderer** — map visualization (view)

Flow:
settings → generators → world data → renderer
UI → editors → world data → renderer

### Layer responsibilities

**State (world data)**  
Stores all map data and style configuration.  
The data layer must contain **no logic and no rendering code**.

**Generators**  
Implement the procedural world simulation and populate or update world data based on generation settings.

**Editors**  
Implement interactive editing tools used by the user.  
Editors perform controlled mutations of the world state and can be viewed as **interactive generators**.

**Renderer**  
Converts the world state into **SVG or WebGL graphics**.  
Rendering must be a **pure visualization step** and must **not modify world data**.

# Working Effectively

The project uses **NPM**, **Vite**, and **TypeScript** for development and building.

## Setup

Install dependencies: `npm install`

Requirements: Node.js **>= 24.0.0**

## Development

Start the development server: `npm run dev`

Access the application at: http://localhost:5173

## Build

Create a production build: `npm run build`

Build steps:

1. TypeScript compilation (`tsc`)
2. Vite build
3. Output written to `dist/`
