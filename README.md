# Azgaar Fantasy Map Generator - D&D Grid Enhancement

**Note on Tooling & Accessibility:**
I have mild dyslexia and use LLMs/Antigravity AI as technical prosthetics for writing and implementation. I architect the logic, design the structure, and define the best practices; the AI assists with the Java/JavaScript syntax and grammar formatting. If the documentation style seems overly structured, it is an intentional accessibility choice. I am always the one directing the logic and the "why" behind the code.

---

## Project Overview
This is a personal fork of [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator). 

As a long-time DM and SysAdmin/DevOps engineer, I needed a way to reference specific locations during tabletop sessions without manual tagging. This fork adds a **Grid Auto-Numbering** system designed for D&D campaign management and map indexing.

## Features: Grid Auto-Numbering
This enhancement adds sequential coordinate numbering to grid cells (0001, 0002, 0003, etc.) starting from the top-left of the map.

* **Dynamic Logic:** Numbers align automatically to Pointy Hex, Square, and Truncated Square grids.
* **Style Control:** Font size and color are fully adjustable via the Style panel to ensure readability against different map backgrounds.
* **Integration:** Toggle functionality is built directly into the existing "Grid" layer settings within the Style panel.
* **Documentation:** Technical implementation details and logic can be found in GRID-NUMBERING-README.md.

## Local Setup
```bash
# Clone the repository
git clone [https://github.com/rstandow/Fantasy-Map-Generator](https://github.com/rstandow/Fantasy-Map-Generator)
cd Fantasy-Map-Generator

# Launch
# This is a client-side application. Open index.html in any modern web browser.
```

## Contributing / Upstream
This feature was built to solve a specific table-top gaming need for my own D&D world. If there is interest from the main project or other contributors, I am happy to discuss contributing the grid logic back to the original repository.

## Credits & License
* **Original Author:** Max Haniyeu (Azgaar) - [Original Repository](https://github.com/Azgaar/Fantasy-Map-Generator)
* **License:** MIT License
* **Fork Enhancements:** rstandow (2024)
