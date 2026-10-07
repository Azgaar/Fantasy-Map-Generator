# PRD — Translation

## Problem Statement

FMG is English-only. A large share of its users write, run games and draw maps in other languages,
and today they have two poor options:

- **The interface.** The Options tab offers a Google Translate widget. It machine-translates the
  live DOM, mangles hotkey underlines, misses dialogs rendered after it ran, and cannot be reviewed
  or corrected by the community.
- **The map itself.** Generated text is English no matter what: "Kingdom of Ardalia", "Ardalian
  Empire", "Ardalia Province", "Faith of the Sun", "Neutrals", "Wildlands", burg and unit types,
  biome and good names. A Russian user has to rename hundreds of entities by hand to get a map in
  Russian — retyping every Latin-script name in Cyrillic on the way — and English grammar ("X of Y", adjective-before-noun) doesn't fit most other languages
  anyway.

A community proof of concept
([Azgaar/Fantasy-Map-Generator#1354](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1354))
showed the demand and produced ~1,600 French and Chinese UI strings, but its mechanism no longer
fits the codebase: it annotated static `index.html` markup that has since moved into Controllers,
walked the DOM to replace text, hard-coded French grammar into shared formatters, and changed the
random draw sequence per language — the same seed produced a different world in French.

## Solution

Two independent language settings:

- **UI language** — the language of menus, dialogs, tooltips and messages. A preference of this
  browser. A change applies after a reload.
- **Content language** — the language generated text is written in. A property of the Map: saved in
  the `.map` file, so a Russian map stays Russian when opened with an English interface. A new Map
  takes the UI language by default.

Interface text is translated where it is rendered: every Controller writes its labels and tooltips
through `t()`. Translations are written by AI alongside the code and corrected from user reports;
anything not yet translated falls back to English, so a language can ship partially and improve over time. Google Translate stays available for languages FMG doesn't ship.

Generated text is produced by a **Locale grammar** per content language — vocabulary for the terms
the generators pick (state forms, burg types, …) plus the rules that compose them into names
(adjectives, "Kingdom of X", gender agreement, the script names are written in). Generators pick ids at random and the grammar turns
them into words without any randomness, so **the seed decides the world and the language only
decides the words**.

**Russian is the first language after English**, for both the interface and generated content. It
exercises every hard part early: three grammatical genders with adjective agreement, three plural
forms in the interface, and a different script, so names from Latin-script namebases have to be
transliterated. A design that handles Russian handles French and Chinese, which follow.

## User Stories

### Interface language

1. As a non-English user, I want to choose the interface language in Options, so that I can use FMG
   in my own language.
2. As a first-time user, I want FMG to start in my browser's language when it is available, so that
   I don't have to find the setting in a language I can't read.
3. As a user, I want my interface language remembered across sessions, so that I choose it only once.
4. As a user, I want changing the interface language to apply everywhere at once, so that I never see
   a mix of old and new language in already-opened dialogs.
5. As a user, I want strings that aren't translated yet to appear in English, so that a partially
   translated language is still fully usable.
6. As a user, I want tooltips, dialog titles, buttons, table headers, alerts and prompts translated,
   so that the whole interface speaks one language.
7. As a user, I want counts phrased correctly for my language ("1 burg", "5 burgs", Russian's three
   plural forms), so that the interface reads naturally.
8. As a user, I want sentences with values in them ("3 of 12 rivers") to follow my language's word
   order, so that they are not English sentences with translated words.
9. As a user, I want hotkey hints to remain visible in any language, so that I can still learn the
   shortcuts when the translated word doesn't contain the hotkey letter.
10. As a user of a language FMG doesn't ship, I want the Google Translate option to remain, so that
    I am not worse off than today.
11. As a desktop-app user, I want the same language choice and translations as on the web, so that
    both behave the same.
12. As a user, I want the long help texts (About, font help) translated with their links intact, so
    that the guidance works in my language.

### Content language

13. As a user, I want to generate a map whose state, province and religion names are in my language,
    so that I don't have to rename everything by hand.
14. As a Russian user, I want "Королевство Ардалия" and "Ардалийская республика" rather than
    "Kingdom of Ardalia" and "Ardalian Republic", so that names follow Russian grammar (word order,
    adjective agreeing with the form's gender).
15. As a Russian user, I want every generated name — burgs, states, cultures, rivers — in Cyrillic,
    so that the map doesn't mix scripts.
16. As a Chinese user, I want names without articles or "of" constructions, so that they read
    naturally in Chinese.
17. As a user, I want the content language saved in the `.map` file, so that the map keeps its
    language whoever opens it.
18. As a user, I want to open a Russian map with an English interface without its names changing, so
    that the map is content and the interface is a preference.
19. As a user, I want a new map to default to my interface language, so that I don't need to set two
    things in the common case.
20. As a user, I want to pick a content language different from my interface language, so that I can
    write an English campaign while using a German interface.
21. As a user, I want the same seed to produce the same world (terrain, burgs, states, borders) in
    every content language, so that sharing a seed works across languages.
22. As an English user, I want existing seeds to produce exactly the same maps as before this
    feature, so that nothing I rely on changes.
23. As a user, I want entities added after generation (a new state, province, burg or regiment) named
    in the map's content language, so that the map stays consistent.
24. As a user, I want renaming a state to update its full name grammatically in the map's language,
    so that "Ардалийская империя" becomes "Лорванская империя" — not "Лорван империя" — and gender
    agreement follows the form.
25. As a user, I want the default names of definition sets (biomes, goods, military unit types,
    burg types) in the content language when a new map is created, so that legends and overviews
    match the names.
26. As a user, I want my own edits to names never to be overwritten by translation, so that
    customization is safe.
27. As a user, I want place names from namebases to stay in their culture's style, only written in
    my language's script, so that an Elvish culture still sounds Elvish whatever the content
    language.
28. As a user opening a map saved before this feature, I want it treated as English, so that old maps
    load unchanged.
29. As a user, I want reserved entities ("Neutrals", "Wildlands", "No religion") named in the content
    language, so that overviews don't show English leftovers.

### Translators and contributors

30. As a user, I want to report a wrong translation in an issue, so that I can fix my language without
    Git or code knowledge.
31. As a translator, I want context for ambiguous words ("Close" the dialog vs. "close" distance), so
    that I translate the right meaning.
32. As a maintainer, I want a list of each language's untranslated keys, so that AI can translate them
    in the pull request that adds them.
33. As a maintainer, I want a changed English string to fail CI until its translations follow, so that
    a copy edit never silently drops a language back to English.
34. As a grammar contributor, I want one module per language implementing a small typed interface, so
    that adding a language's naming rules doesn't touch other languages.
35. As a grammar contributor, I want the type checker to tell me which vocabulary terms my language is
    missing, so that I can complete it.
36. As a developer, I want to write `t("Rivers Overview")` directly in a template, so that adding UI
    text costs nothing and the template stays readable.
37. As a developer, I want an extraction command that collects every `t()` string into the English
    catalog, so that I never maintain it by hand.
38. As a developer, I want CI to reject broken locale files (empty values, raw double quotes,
    malformed placeholders), so that a bad translation can't break markup.
39. As a developer, I want a test that fails if a content language changes the random draw sequence,
    so that seed reproducibility can't regress silently.
40. As a maintainer, I want the bundle to load only the active locale, so that adding languages
    doesn't slow everyone's startup.
41. As a maintainer, I want no new production dependency, so that the bundle stays lightweight.

## Implementation Decisions

### Modules

**1. Catalog** — a small, deep module that owns all UI text lookup.

- Interface: load one locale before the app modules are evaluated, then a synchronous
  `t(key, { context?, count?, ...values })`.
- No library: a hand-written lookup of ~50 lines on top of `Intl.PluralRules`. The catalog files use
  the i18next v4 JSON shape (flat keys, `key_context`, `key_one`/`key_other`, `{{value}}`
  placeholders), so that standard translation tools read them.
- It lives in `utils/`: interface labels also sit in `data/` modules (layer names, presets), and
  `data/` may only import `utils/`. A `data/` module calling `t()` at import time is fine, because
  the catalog is loaded before any app module is evaluated.
- Keys are the English text itself (`t("Rivers Overview")`). Lookup order: active locale → English
  catalog → the key. Direct strings therefore need no English entry.
- Exceptions to direct strings:
  - **Ambiguous words** get a `context` ("Close" + `button` / `distance`).
  - **Long prose** (multi-sentence help, paragraphs with links) uses explicit keys
    (`about.intro`); its English lives in the English catalog.
- Keys are string literals only, so extraction can find them. Never build sentences by
  concatenation; use placeholders.
- Interpolated values are HTML-escaped by default (they may be user data such as state names);
  translated text itself may contain the limited markup its English source has.
- Every locale, English included, is a separately loaded chunk; English loads alongside the
  active one because plurals and explicit-key prose need it.

**2. Language settings** — follow the configuration rules (`options.app` vs `options.map`).

- UI language: `options.app.language`; `""` (the default) follows the browser's first shipped
  language, else English. A change is stored at once and applies after a reload, offered right
  away or left for the next visit. The map isn't carried across: browser storage can fail and would
  overwrite the user's stored map, so the user is told to save first. Controllers never re-render for
  a language change.
- Content language: `options.map.language`. Marker, name and state generation keep using it long
  after generation, so it is map config, not a generation request. A new Map takes the UI language
  (like the seed, it is carried into the new map); the validation boundary sets missing values to
  English.
- A language manifest lists the shipped locales with their native names for both pickers. The
  Google Translate option remains for unlisted languages.

**3. Locale grammar** — one module per content language behind one typed interface; a registry
selects it by `options.map.language`.

- **Vocabulary**: typed dictionaries keyed by the ids the data already uses (state forms, province
  forms, burg types, religion types, unit types, reserved entity names, default biome/good names).
  Each term carries the grammatical attributes its language needs (e.g. gender). Missing terms are
  a type error, not a runtime fallback.
- **Composition**: `adjective(name, gender, rolls)`, `stateFullName(name, form)`,
  `provinceFullName(name, form)`, `religionName(pattern, parts)` and the like. Articles, elision,
  agreement and word order live here, in code — not as formatter syntax inside catalog strings.
- **Script**: `script(name)` writes a namebase name in the locale's script — identity for Latin
  locales, rule-based Latin→Cyrillic transliteration for Russian (digraphs first: *sh*→ш, *ch*→ч,
  *zh*→ж, *kh*→х, *th*→т, *ph*→ф, *ts*→ц, then single letters; _y_ and _j_ by position). It is
  applied where namebase output enters the Map, so every generated name is written once in the
  map's script. Pure, like everything else in the grammar.
- **Pure**: no grammar function draws random numbers. Where variation is needed (adjective
  variants) the generator passes in the rolls.
- The English grammar is today's code moved behind the interface, unchanged in output. Russian is
  the first non-English grammar; French and Chinese follow, starting from the proof of concept's rules.

**4. Generator integration** — the seed-invariance contract.

- Every random choice is made on ids, in exactly today's draw order. Words are produced afterwards
  by the grammar.
- The one known trap is adjectivization: today each rule draws `P(probability)` before its
  condition is tested, so the number of draws depends on the rule list. The generator keeps
  today's English draw sequence, records the rolls and hands them to the active grammar, which may
  use them but never draws more.
- Generated text is written into the Map in the content language at creation time (`fullName`,
  default names in definition sets), like any other generated content. Later edits follow the
  existing rename paths, which call the grammar of the map's language.
- Namebase names are not translated — namebases are the culture's voice, not the reader's — only
  written in the content language's script.

**5. Controllers** — `t()` at render time, inside the templates Controllers already insert.

- The remaining static dialogs in the page template (export, save, load, PNG tiles, alert, prompt)
  move to Controllers as part of the ongoing markup migration, so no attribute-based or DOM-walking
  translation mechanism is ever built.
- Hotkey hints render from the existing shortcut metadata instead of `<u>` markup inside labels, so
  a translated label never has to contain the hotkey letter.
- Rollout is per Controller; untranslated Controllers simply show English.

**6. Tooling and workflow**

- A small extraction script on the TypeScript compiler API (already a dev dependency) collects
  `t()` literals into the English catalog, expanding contexts and plurals and keeping existing
  English values; `npm run extract-strings` writes it, and its `--check` mode fails CI when the
  catalog is stale. Chosen over `i18next-cli`, which would add a native-binary dependency tree for
  a job this narrow.
- A locale lint script, run in CI over every shipped and seed catalog, rejects empty values, raw `"`
  (would break attribute markup), placeholders missing from or added to the source, and keys absent
  from the English catalog.
- Translations are written by AI in the pull request that changes the English, not through a
  translation platform: a machine translation reviewed against the code is as good as a volunteer's
  for most strings, and catalogs never lag behind the code. `lint-locales --missing` lists each
  language's untranslated keys; user-reported mistakes are fixed in the catalog.

## Implementation Plan

Each milestone is one or a few mergeable PRs that leave `master` shippable. English output never
changes along the way; a non-English language becomes visible only once its picker lands.

### M0 — Groundwork

**Status: done.**

1. **Golden English names.** Seeded unit tests pin what the naming code produces today: adjectives
   and the number of random draws they take over a fixed list of names, state full names for every
   form, and religion names for every naming method. They must pass unchanged through every later
   milestone; they are the proof that the refactor is byte-identical in English. (A whole generation
   needs the browser, so the full-seed comparison arrives with M4's seed-invariance test.)
2. **Hotkey hints from metadata.** The Layers tab renders its hotkey from the existing shortcut
   metadata instead of `<u>` inside the label, so labels become plain translatable text.
3. **Static dialogs to their modules.** Move export, save, load and PNG tiles into the module that
   already drives them, and the generic alert and prompt into the dialog helpers (already on the
   markup-migration roadmap). After this the page template holds only the shell.

### M1 — Catalog and bootstrap (tracer bullet: Layers tab in Russian)

1. **Catalog module** with `load(locale)` and `t()` as specified above, plus its unit tests.
2. **Language manifest**: shipped locales (`en`, `ru` first; `fr` and `zh` in M5) with
   native names; each backed by a lazily loaded locale file.
3. **Bootstrap split.** Many tabs and Controllers evaluate their templates at import time, before
   `boot()` runs, so `t()` must work before the app module graph is evaluated. The entry point
   becomes: resolve the UI language → `await` the catalog → dynamically import the app → `boot()`.
   Resolving reads the stored `app.language` from the options storage key without the rest of
   `Options` (falls back to the best match in `navigator.languages`, then English) and validates
   it against the manifest. `Options.restore` later parses the same value through the schema as
   usual.
4. **`options.app.language`** in the options schema (`""` or a manifest code). Picker in the
   Options tab next to the Google Translate button; on change it persists the choice and offers
   a reload, reminding the user to save unsaved changes.
5. **Extraction**: the extraction script and its `--check` step in CI.
6. **Locale lint** script with fixture tests, run in CI over every shipped catalog.
7. Wrap the Layers tab and add its Russian strings.

Done when: choosing Russian and reloading shows the Layers tab in Russian,
everything else is English, and the lint and catalog tests are green. Plural forms are proven by
the catalog tests; the Layers tab has no counts.

**Status: done.**

### M2 — Interface rollout

1. **Shell and shared components first** — the menu tab and sticky buttons, the loading screen and
   map overlay texts (set by the shell module), dialog buttons, table headers and column visibility, tooltips,
   alerts, prompts, confirmations — because one wrap there covers dozens of Controllers.
2. **Then by reach**: the remaining menu tabs (Style, Options, Tools, About); the main editors and
   overviews (states, provinces, burgs, cultures, religions, biomes, markers, notes, military); then
   the rest as they are touched. Run extraction in each PR.
3. **Runtime strings**: messages built in code (`tip()` texts, alert bodies, generated table
   footers like "3 of 12") are wrapped with placeholders and `count`, never concatenated.
4. **Contributor rules** (direct strings, context, explicit keys for prose, literal keys only) added to
   the architecture docs.

**Status: done.** All interface text was wrapped in one pass rather than "as touched": 3,454 strings,
with a complete Russian catalog. `{{- value}}` was added for raw values (markup, or sinks that
escape on their own). Contributor rules: `docs/architecture/translation.md`. A browser audit with
every editor and Style element open found no untranslated interface text beyond map content
(default goods, units, namebases, culture sets and user-named groups, left to M3), brand names and
icon-picker category names. Labels for ids the data stores in English (feature subtypes, shields,
filters, presets) live in `src/data/id-labels.ts`; Style tab labels derived from schema keys live in
`controllers/style-editor/field-labels.ts`, with a test keeping every key listed. Known gap: long
Russian labels wrap in the narrow menu tabs.

### M3 — Locale grammar seam (English only, no output change)

1. **Interface and registry** keyed by `options.map.language`; English is the only entry.
2. **Content language setting**: `options.map.language` in the map schema, defaulting to English at
   the validation boundary, so maps saved before this feature load as English. A new Map takes the UI
   language when a grammar exists for it, otherwise English. No picker yet.
3. **Vocabulary types**: union types for the id sets the generators pick from (state forms, province
   forms, religion types, reserved entities, default biome / good / unit names), derived from the
   existing data so they can't drift.
4. **Split adjectivization**: a generator-side roll step that reproduces today's draw sequence
   exactly (one `P()` per rule evaluated, stopping at the first match) and returns the rolls; the
   grammar's `adjective(name, gender, rolls)` is pure. The English grammar applies today's rules to the
   recorded rolls.
5. **Script hook**: namebase output passes through the grammar's `script()` where it enters the
   Map (identity in English).
6. **Move composition behind the grammar**: state full names, province full names, religion name
   patterns, reserved entity names and the default names of definition sets. Generators and editors
   call the grammar of the map's language.
7. **Prose callers stay English**: markers, routes, zones, journeys and the battle screen call the
   English grammar explicitly, since generated prose is out of scope.

Done when: the golden English test from M0 passes untouched.

### M4 — Russian content (tracer bullet: a Russian map end to end)

1. **Russian grammar**:
   - Vocabulary with gender (m/f/n) for every form and reserved entity: _королевство_ (n),
     _империя_ (f), _союз_ (m), …
   - Adjective-forms agree with the form's gender: _Ардалийская империя_, _Ардалийское
     королевство_, _Ардалийский союз_. Adjective derivation by ending (_-ия_ → _-ийский_, _-а_ →
     _-ский_, consonant → _-ский_), choosing between variants with the shared rolls.
   - "Of"-forms use nominative apposition, which needs no declension of foreign names: _Королевство
     Ардалия_, _Провинция Лорван_.
   - `script()` transliterates Latin namebase output to Cyrillic.
2. **Content-language picker** in the Options tab. It changes the Map's language for everything
   generated afterwards; a new map or regeneration applies it to the whole Map.
3. **Renames**: when a stored full name equals the grammar's composition of the old short name,
   recompose it with the new name; otherwise (the user customized it) keep today's whole-word
   replacement.
4. **Seed-invariance test**: one seed, English vs Russian, identical Map apart from text.

Done when: a new Russian Map has Cyrillic names throughout, Russian state, province and religion
names and reserved entities, the same seed in English gives the same world, and renames stay
grammatical.

### M5 — French, Chinese and onward

1. **French grammar**: gender, elision (_d'Ardalie_ / _de Lorvan_), articles, noun–adjective order
   and agreement. Start from the proof of concept's rules, with its bugs fixed (e.g. the `/e$/` rule
   that shadowed all later ones).
2. **Chinese grammar**: no articles or "of", modifier-before-noun; `script()` needs a
   syllable-based transcription to Hanzi, which is a separate, harder piece of work — until then
   Chinese maps keep Latin names.
3. **Interface catalogs**: `fr.json` and `zh.json` translated by AI in full and added to the
   language manifest.
4. Each further language is one grammar module plus its vocabulary, which the type checker lists
   as missing, and an AI-translated catalog.

### M6 — Close-out

1. Glossary terms (UI language, Content language, Locale grammar, Vocabulary).
2. A wiki page for grammar contributors and for reporting a wrong translation.
3. Close [Azgaar/Fantasy-Map-Generator#1354](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1354)
   with thanks and a link here.

## Testing Decisions

A good test here asserts what a user or translator would observe — the text `t()` returns, the
name a grammar composes, the world a seed produces — never how lookup or rules are implemented
internally.

- **Golden English names** (M0, highest priority). Seeded unit tests snapshot today's adjectives
  with their draw counts, state full names for every form and religion names for every method; the
  refactor must leave the snapshots untouched. Prior art: the states and religions generator tests.
- **Seed invariance.** Generate the same seed with English and with Russian content language and
  assert the Map is identical in everything but text: cells, features, burg positions and counts,
  state/province/religion assignment, ids. A whole generation needs the browser, so this is the one
  new e2e test. Prior art: the existing seeded e2e specs and the per-stage fingerprint technique used
  when localizing seed drift.
- **Locale grammar.** Table-driven unit tests per locale: adjectives, state and province full names,
  religion names, renames, script. Russian covers gender agreement across all three genders,
  apposition and transliteration (digraphs, _y_/_j_ by position); French covers elision; Chinese
  covers the absence of articles and "of"; English reproduces today's outputs.
  Prior art: the generator unit tests for states, provinces and religions.
- **Catalog.** Fallback chain (locale → English → key), context, plural categories through
  `Intl.PluralRules` (Russian's three forms), placeholder interpolation and escaping of
  interpolated values. Prior art: the utils unit tests.
- **Locale lint.** The CI check itself is tested against small fixture catalogs: it fails on an empty
  value, a raw quote, a dropped or extra placeholder and an unknown key, and passes a clean file.
- Existing DOM and e2e tests run with English and are unaffected, because English output is
  unchanged.

## Out of Scope

- **Generated prose**: marker legends, journey stories, diplomacy chronicles and other Notes stay
  English. They are long templated sentences, user-editable, and the least read; translating them
  well is a separate project (on-demand translation through the Azgaar Assistant is a candidate).
- Translating namebases or generating culture names in the content language (transliterating
  them into the content language's script is in scope).
- Re-translating an existing map when its content language changes; changing it affects only text
  generated afterwards.
- Switching the interface language without a reload.
- Right-to-left layouts.
- Locale-aware number, date and unit formatting.
- The wiki and the Assistant's knowledge base.
- Map label fonts: a label font without Cyrillic or CJK glyphs falls back to a system font. Choosing
  fonts that cover the script stays with the user's style settings; a content-language-aware default
  style is a possible follow-up.

## Further Notes

- New glossary terms to add when this lands: **UI language**, **Content language**, **Locale
  grammar**, **Vocabulary**.
- The proof-of-concept PR should be closed with thanks and a link to this PRD; its grammar rules are
  reused, its strings are not: AI translates the full catalog.
- English-as-key means a copy edit orphans that string's translations. That's intended — the
  translation really is stale — and the lint fails on the orphaned key, so the same pull request
  moves or redoes it.
