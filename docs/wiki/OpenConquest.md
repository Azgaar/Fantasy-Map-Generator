## OpenConquest: Atlas Invictus
_OpenConquest_ turns a generated world into a turn-based grand strategy campaign. The map you generated is the campaign map: its provinces become regions, its towns become settlements, its armies become strategic forces, and its states become factions that fight for them.

Open it from the **⚔ OpenConquest** button in the top bar of the generator, the **Conquest** view mode button in the bottom view-mode bar, or by typing "openconquest" in the omnibar (`F1`).

### Playing a campaign
1. Generate a world, or open one you already have.
2. Wait for the campaign to compile — the world is turned into a game map in the background, which takes a moment on a large map.
3. Open the ⚔ menu and choose **Start campaign**. The first faction becomes yours.
4. Move your armies, recruit units, and end the turn. The other factions act on their own.

The menu carries the whole campaign lifecycle: start, end turn, duplicate, detach, restore, and export.

### Map and settlements
Conquest renders directly through FMG's high-performance native layers:
- **Territory & Borders**: Provincial regions and state boundaries represent strategic ownership and taxation zones.
- **Settlement Hierarchy**: Major and minor burgs appear with specialized cartographic markers — state capitals are marked with circled stars (`burgs-atlas-star-circled`) and province capitals with smaller star icons (`burgs-atlas-star`).
- **Regiments & Armies**: Military forces on the map reflect each state's roster-native units.

### Battles: Tactical & Auto-Resolve
Engagements can be resolved either automatically using the deterministic Lanchester combat calculus, or played out round-by-round in the interactive **Battle Screen**. Issue tactical stances each round (Shock, Flank, Skirmish, Brace, Retreat), monitor unit morale and cohesion against the 25% rout line, and watch casualties synchronize directly back to surviving regiments on the map.

### The campaign log
The _Campaign log…_ entry in the menu shows every event of the campaign as it happens: battles, sieges, constructions, diplomacy, and the AI's decisions.

### Rules and factions
The rules the campaign plays by are editable while it runs: game config (turns, movement, battles, economy, military), faction forces (the units, buildings, and technology each people fields across 19 shipped fantasy and historical rosters, including full *Warhammer: The Old World* equivalent factions), and individual state assignments. Editing the rules re-runs the campaign's log under them — if the campaign cannot continue under the new rules, the edit is refused and the campaign keeps the rules it was born with.

### Saving and resuming
A campaign is a session over a world, not part of the world itself: it is stored in your browser, keyed to the map, and it is not written into the `.map` file. Use _Export campaign…_ to download it as a JSON file you can keep, share or re-import later.

A campaign survives a browser restart, and the mirror is written after every command, so a closed tab does not lose an hour of play. If a campaign goes missing, the ⚔ menu's _Restore from mirror_ brings it back.
