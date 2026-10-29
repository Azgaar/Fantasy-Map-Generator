# Fantasy Map Generator: Glossary

This glossary covers core terminology, data structures, and concepts used throughout the Fantasy Map Generator project. It is intended as a reference for contributors, users, and developers. This glossary is a living document, update it as new features and terminology are added to the project.

## General Concepts

- **Map**: The generated world, including all terrain, features, and data layers.
- **Cell**: The smallest unit of the map grid, representing a piece of land or water. Voronoi cell.
- **Grid**: The underlying voronoi structure of cells that make up the map.
- **Sampling**: The lattice the Grid points sit on: `square`, `hexPointy`, `hexFlat`, `diamond` or `triangle`. Every sampling stores its points in rows of `cellsX`, so code reading the Grid by rows and columns works on all of them. _Avoid_: grid type, layout
- **Jitter**: How far a Grid point may move off its lattice position, from 0 (regular cells) to 0.9. The classic natural look is `square` sampling at 0.9.
- **Lattice preset**: A named Sampling and Jitter pair in Advanced options (Default, Organic hexes, Hex board, Square board, Isometric board). Derived from the two values, never stored. _Avoid_: cell type
- **Lattice slot**: The rectangle of the lattice a Grid point was placed in. On a jittered or offset lattice a position's slot can differ from the Cell it falls in.
- **Pack**: The main data object containing all world data (cells, burgs, states, cultures, etc.), created after 'repacking' the grid to discard most of ocean cells and add more cells along the coasts.
- **Layer**: A visual or logical overlay on the map (e.g., rivers, biomes, elevation).
- **SVG Layer**: A named group of SVG elements for a specific map feature.
- **Style element**: One top-level entry of the style store (`StyleElement`, a key of `stylesSchema`): a Layer's style, or `map` for whole-map filters. It is what the Style tab edits one at a time. Close to Layer, not equal: `map` is not a Layer, and parts of a Layer (burg anchors, the states halo) are not Style elements.
- **Seed**: The value used for random number generation (reproducibility). Not an identity: regenerating with the same seed makes a different Map.
- **Map id**: The identity of a Map: the moment it was generated. Carried in the `.map` file, so a saved map keeps its id when loaded again; every new generation gets a new one. _Avoid_: seed (as an identifier)

## Separation of Concerns

- **Generator**: A module that creates or simulates world data (e.g., heightmap-generator, cultures-generator). Lives in `src/model/`.
- **Controller**: The UI / interaction layer (`src/controllers/`). Broader than the textbook MVC "controller": it covers **editors** (user-driven mutations of world data, e.g. coastline-editor, namesbase-editor), **tools**, and read-only **overviews** (e.g. market-overview, charts-overview). The unifying rule: UI that wraps the map and either routes user interaction or presents map state in a dialog/panel. Does **not** hold static data, app-shell services, or serialization.
- **Editor**: A Controller that mutates world data (e.g., coastline-editor, states-editor). The "C" of the conceptual MVC model.
- **Overview**: A read-only Controller that presents world data without mutating it (e.g., production-overview, market-overview, charts-overview).
- **Renderer**: The system that visualizes world data as SVG or WebGL graphics (`src/renderers/`).
- **Service**: App-shell / platform & asset infrastructure, unrelated to map domain state (e.g., PWA installation, auto-update, the font catalog & loading). Cross-cutting (may be consumed by IO, UI, and rendering alike) but owns no world data. Lives in `src/services/`.
- **IO**: Serialization and persistence — save, load, export, cloud storage (`src/services/io/`).

## World Data & State

- **Culture**: A group of cells sharing cultural traits and modifiers.
- **Burg**: A settlement or city on the map, with population, culture, production, and so on.
- **State**: A political entity (country, kingdom, etc.) grouping multiple burgs.
- **Province**: A political or administrative subdivision of a State.
- **Religion**: A belief system and organization spreading across cells and burgs.
- **Biome**: A type of environment (e.g., desert, forest, tundra) assigned to cells.
- **Heightmap**: A grid of elevation values used to generate terrain.
- **Feature**: A contiguous area of cells enclosed by a coastline or the map border: an island, a lake or an ocean. Features are produced by the heightmap and can only be added or removed through it.
- **Feature Type**: What a Feature fundamentally is: `island`, `lake` or `ocean`. Derived from geography, never user-editable.
- **Feature Subtype**: The Feature's classification within its type (`continent`/`island`/`isle`/`lake_island`; `freshwater`/`salt`/`dry`/`sinkhole`/`frozen`/`lava`; `ocean`/`sea`/`gulf`). Domain-meaningful: generators read it. User-editable, regeneration classifies it again. _Avoid_: kind, class
- **Feature Group**: The SVG group a Feature is drawn in. Purely a rendering choice with no domain meaning, independent of the Subtype. Lakes may use stock or user-created groups; islands are fixed to `sea_island` / `lake_island`. _Avoid_: style group, layer group
- **River**: A water flow starting from a source cell and following the heightmap down to a lake or ocean.
- **Lake**: A fresh or salt water body contained entirely within land cells.
- **Route**: A road, trail, or sea lane connecting burgs.
- **Marker**: A specific point of interest placed on the map (e.g., volcano, battlefield, ruin).
- **Journey**: A route travelled by a party — a quest, a caravan run, a raid — made of ordered Segments. Distinct from a [[Route]], which is a road on the ground that a Journey may follow. Stored in `pack.journeys`.
- **Zone**: An arbitrary highlighted area of the map defined for custom purposes (e.g., danger zone, magic zone).
- **Diplomacy**: The system of political relationships (allies, enemies, neutral, vassals) between different States.
- **Regiment / Military**: The armed forces belonging to States or Burgs, represented by units.
- **Good**: A resource or product (e.g., wood, iron, grain) with properties like value, demand, and recipes. Raw goods have a `distribution`; manufactured goods have `recipes`.
- **Market**: A regional economic hub anchored at a burg. Owns per-good stock and price, mediates all flows between rural cells, burgs, and other markets.
- **Deal**: A burg's trades with one market in one good and kind (sale, input purchase, demand purchase or kept), summed over a production run: the tuple `[burg, market, good, kind, units, price, tax, tariff, carriage]` in `pack.deals`. A purchase from a market of another state is an **import**; a purchase from another market of the same state is not. Consumed by the trade animation, the trade and market views and tax collection; `tax` goes to the seller's state treasury, `tariff` to the state of the burg's own market.
- **Treasury**: Per-state accumulated balance in currency units. Fed each cycle by [[Sales Tax]] on deals where the seller belongs to the state, [[Tariff]] on imports by burgs of the state's markets, the [[Poll Tax]] its people paid and the [[Market License]] fees of markets centered in it, less [[Corruption]]. Stored as `state.economy.treasury`. Neutrals (state 0) keep treasury at 0.
- **Sales Tax**: Per-state rate (`state.economy.salesTax`, `0–1`) levied on every sale whose seller is of the state: a burg selling to its market pays it out of its revenue; a market selling to a burg, its own or another, adds it to the burg's price, so high-tax markets lose buyers from other markets. Base rate per [[State Form]]: Monarchy 0.1, Union 0.1, Theocracy and Republic 0.05, Anarchy 0.
- **Poll Tax**: Per-state flat fee (`state.economy.pollTax`) per population point. A burg pays it first, from its first sales, and may end the day in debt; rural people pay it from what their produce earned, as far as it goes, so a state may collect less than it is owed. Base rate per [[State Form]]: Monarchy 0.1, Theocracy 0.1, Republic 0.05, Union and Anarchy 0.
- **Market License**: Per-state fee a day (`state.economy.marketFee`) that the center burg of each market in the state pays its state first, with the poll tax, whatever its trade: a quiet market can end the day in debt. Whole numbers. Dear licenses make a state's burgs less likely to become market centers, spread its markets wider apart and raise their margin, as merchants pass the fee on. Base fee per [[State Form]]: Monarchy 25, Theocracy 50, Republic 10, Union and Anarchy 0.
- **Corruption**: Per-state percent (`state.economy.corruption`, 0–100) of collected taxes that officials pocket before they reach the [[Treasury]]. Generated from the [[State Form]] (Monarchy 10, Theocracy 7.5, Republic 5, Union 2.5, Anarchy 0; doubled for despotic form names), plus up to 15 for size in cells and up to 10 for people of other cultures and faiths than the state's and its capital's.
- **Tariff**: Per-state policy (`state.economy.tariffs: TariffRule[]`) applied to imports: goods that burgs of the state's markets buy from markets of other states (`Markets.getTradeTerms`). Increases the delivered price and adds the import deal's tariff `units × tariffPerUnit` to the importing state's treasury. Seeded procedurally with a `0%` baseline for all states/goods, `0%` for allies, `20%` for suspicion, and `30%` for rivals.
- **Embargo**: A trade sanction rule (`rate: "embargo"`) eliminating trade between two states for specific or all goods. Bidirected: if either state sets an embargo towards the other on a good, trade of that good between their markets is blocked in both directions. Seeded automatically between warring nations (`Enemy`).

- **Demand Category**: One of `food | utilities | construction | military | luxury`, evaluated in `DEMAND_PRIORITY` order during production and demand fill.
- **Namesbase**: A collection of linguistic rules, prefixes, and suffixes used to procedurally generate names for map entities.
- **Emblem**: The sign of a State, Province or Burg: either a Heraldic emblem or a Picture emblem.
- **Heraldic emblem**: A blazon drawn from its field, divisions, ordinaries and Charges; editable in Armoria and recoloured by its tinctures.
- **Picture emblem**: An Emblem that holds an Icon reference and shows it whole, with no field: a pasted image or Armoria render, or a Charge shown without a shield.
- **Charge**: A figure placed on a field, tinted by its tincture: a built-in charge by name, or any Icon Library icon by its Icon reference. Built-in Charges also form the Heraldry Icon Sets and can be used in any Icon slot.
- **Note**: User-defined html text describing a map entity, stored on the entity as `note?: string`. Shown in the notes box when the entity's element is hovered, and edited from that entity's editor or from the Notes Editor. A note cannot exist without an entity to own it.
- **Icon**: A small picture drawn for a map entity or a style — a good, burg, marker, regiment, unit type, relief feature.
- **Icon Library**: Every icon a slot can use, in three sources: the Icon Sets, Glyphs and the map's Custom icons. What the icon picker shows, listed by source.
- **Icon Set**: A catalogue of icons the app ships, such as `goods`, `burgs` or a relief set. _Avoid_: collection
- **Glyph**: Short text drawn as an icon — an emoji, a symbol such as `⟱`, or letters such as `XIV`. Glyphs form a virtual Icon Set: derived from the text, never stored. _Avoid_: emoji (only one kind of glyph), text icon
- **Custom icon**: A picture the map carries — SVG art, a raster image or a link to an image hosted elsewhere — known by an id rather than a name. Part of the map's setup, like transport types: saved with the map, replaced when another map is loaded, carried over to a new map. Replacing its picture keeps the id, so every slot follows; identical pictures added twice are two icons. _Avoid_: upload, user icon
- **Icon reference**: The bare symbol id (`goods-wood`, `glyph-1f3f0`, `custom-1a2b3c4d`) through which a slot points at an icon from any source. An empty reference means no icon; a reference to an icon that no longer exists draws nothing. _Avoid_: image URL, inline image
- **Icon slot**: A place that holds one icon reference: a good's icon, a marker's icon, a regiment's or unit type's icon, a burg group's icon, the market marker style, a relief icon, a relief pool entry, a Charge or a Picture emblem. Every slot accepts every source. Removing a Custom icon reports how many slots use it.
- **Relief pool**: A weighted list of what relief is generated from: a biome's for its lowland relief, a relief rule's for the cells it claims. Each entry is a relief type, drawn in the style's relief set, or an icon reference, with a positive weight and a size relative to the pool's icon size. _Avoid_: weighted icons, icon list
- **Relief density**: How packed a pool's relief is; 0 places none.
- **Relief rule**: A height range, an optional temperature range and an optional set of biomes that claim land cells for a relief pool, with an icon size that grows with height. Rules are checked in order and the first match wins; the defaults are snowy mountains, mountains and hills. Part of the map's setup, kept across regeneration. _Avoid_: highland zone, elevation band
- **Lowland relief**: The relief a biome's pool places, on land no relief rule claims — below height 50 with the default rules.
- **Icon frame**: The box around an icon's visible content, owned by the picture: fixing it fixes every use at once. Only Custom icons can be repositioned. Size and placement at a use (a marker's pin, a good's circle, a burg's anchor) belong to that use, never to the frame. _Avoid_: viewBox (the implementation), crop
- **Anchored icon**: An icon drawn around a point rather than inside its frame — the burg and port sets, whose art stands on the burg. Any other icon on a burg is centred on the point.
- **Label**: Display text owned by a map entity — a State, Province, Burg, River, Route, or Added Label. Every label is anchored at its entity's position and drawn as positioned text there, unless it has path points — then the text is curved along them. Any label can be switched between the two in the Label Editor.
- **Added Label**: A free-standing map entity created by the user, whose only purpose is to carry a Label. It supplies the position that other label owners get from their own geometry.
- **Label Group**: An ordered, reusable label policy and visual style. Policy fields live in `options.map.labels.groups`; typography and offsets live in `style.labels.groups`. Any label type can use any Label Group without changing how that entity is rendered.
- **Label Group type**: The Label Group's organizational category (`states`, `burgs`, `provinces`, or `added`). It controls defaults and UI grouping, not rendering compatibility.
- **Label Group layer dependency**: An optional layer-toggle id that makes a Label Group visible only while that layer is on.
- **Label name mode**: A Label Group policy selecting automatic, short, or full names for generated State and Province labels.
- **Label zoom bounds**: Optional inclusive minimum and maximum map scales at which a Label Group is visible.

## UI & User Interaction

- **Editor Tool**: Any interactive UI for editing map features (e.g., rivers-editor, provinces-editor).
- **Overview Tool**: A summary UI for a particular system (e.g., production-overview, market-overview).
- **Configurator**: A UI for setting up world generation parameters.
- **Map context menu**: The right-click list of everything at a spot on the Map, across all Layers: what is drawn there, what its Cell holds and the territories it belongs to. Right-click on the map belongs to it alone. _Avoid_: popup, right-click menu
- **Submap**: A tool to generate a new, more detailed map strictly from a selected area of the current map.
- **UI language**: The language the interface is shown in (`options.app.language`, a browser preference applied after a reload). It never changes the Map: generated content stays English and the `.map` file is identical whatever it is. _Avoid_: locale, language (for the map's content)

## Azgaar Assistant

- **Azgaar Assistant**: The in-app chat that answers questions about the generator and about the open Map. "The Assistant" for short. _Avoid_: Azgaar Bot, Azgaar Agent, AI Chat, Help assistant, Map assistant
- **Chat**: One exchange of questions and answers with the Assistant. It belongs to exactly one Map (by Map id) from the moment it is created and is kept only in this browser, never in the `.map` file. _Avoid_: conversation, session, thread
- **Tier**: The Assistant's level of access for this user: Guest, Member or Key. Derived from two independent facts — signed in or not, key connected or not — never chosen. Where none applies (a self-hosted copy or the desktop app without a key) the Assistant asks for a key. _Avoid_: mode, plan
- **Guest**: The Tier of a user who is neither signed in nor has a key connected: a small daily allowance of documentation answers. _Avoid_: free, anonymous
- **Member**: The Tier of a user signed in with Discord and without a key: a larger daily allowance. Guest and Member together are the free tiers.
- **Key**: The Tier of a user with their own AI provider key (or a local model) connected. "Connected" means set and not disconnected; a key the provider rejects keeps the Tier. Wins over sign-in; disconnecting the key returns the user to Guest or Member. _Avoid_: own key, BYOK, Pro
- **Operation**: A named, well-scoped edit a model class owns as a public method (e.g. `Burgs.rename`, `Notes.write`) and that is registered for the Assistant. The editors call the same methods, so an edit follows the same rules whoever makes it.
- **Proposal**: A batch of Operations the Assistant asks for, shown in the Chat as one card and applied, undone or discarded as a whole by the user. The Assistant never changes the Map without one. _Avoid_: suggestion, pending edit
- **Change**: A Proposal's recorded before and after values of everything it touches, side effects included. Apply is allowed only while every "before" value still holds, Undo only while every "after" value does.
- **Widget**: An interactive part of an Assistant answer tied to the Map: an entity or command link written in its Markdown, or an item (an entity list, a card, a chart, an inset…) the Assistant places in the Chat. Widgets hold references, never copies, and work only while their Map is open. _Avoid_: embed, attachment
- **Azgaar server**: The project's own server (ask.azgaarsfmg.com) that answers Guest and Member questions from the documentation. Owns the daily allowance, Discord sign-in and its own Chat memory; cannot see the Map. _Avoid_: gateway, hosted engine, documentation service, help service
- **Provider**: The AI company (Anthropic, OpenAI, …) or local model server that answers Key-tier questions with the user's own key. _Avoid_: engine, agent
