## OpenConquest: Atlas Invictus
_OpenConquest_ turns a generated world into a turn-based grand strategy campaign. The map you generated is the campaign map: its provinces become regions, its towns become settlements, its armies become strategic forces, and its states become factions that fight for them.

Open it from the **⚔ OpenConquest** button in the top bar of the generator, or by typing "openconquest" in the omnibar.

### Playing a campaign
1. Generate a world, or open one you already have.
2. Wait for the campaign to compile — the world is turned into a game map in the background, which takes a moment on a large map.
3. Open the ⚔ menu and choose **Start campaign**. The first faction becomes yours.
4. Move your armies, raise new ones, and end the turn. The other factions act on their own.

The menu carries the whole campaign lifecycle: start, end turn, duplicate, detach, restore, and export. It also lists the campaign's layers, so you can switch the strategic overlays on and off without hunting through the _Layers_ tab.

### The layers
Five layers draw the campaign on the map, and each of them is also in the generator's own _Layers_ tab with a hotkey:

| Layer | Draws |
|---|---|
| Regions | the strategic territories, coloured by their owner |
| Settlements | the towns and cities, sized by their tier |
| Armies | the forces on the map, with their banners |
| Move paths | where your armies are headed |
| Selection | the region or army under the pointer |

### The campaign log
The _Campaign log…_ entry in the menu shows every event of the campaign as it happens: battles, sieges, constructions, diplomacy, and the AI's decisions.

### Rules and factions
The rules the campaign plays by are editable while it runs: game config (turns, movement, battles, economy, military), faction forces (the units, buildings and technology each people fields), and the individual states' forces. Editing the rules re-runs the campaign's log under them — if the campaign cannot continue under the new rules, the edit is refused and the campaign keeps the rules it was born with.

### Saving and resuming
A campaign is a session over a world, not part of the world itself: it is stored in your browser, keyed to the map, and it is not written into the `.map` file. Use _Export campaign…_ to download it as a JSON file you can keep, share or re-import later.

A campaign survives a browser restart, and the mirror is written after every command, so a closed tab does not lose an hour of play. If a campaign goes missing, the ⚔ menu's _Restore from mirror_ brings it back.
