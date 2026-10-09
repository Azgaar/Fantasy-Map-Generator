# PRD — Interface Translation

## Problem Statement

FMG is English-only. A large share of its users write, run games and draw maps in other languages.
The only option today is a Google Translate widget in the Options tab: it machine-translates the
live DOM, mangles hotkey underlines, misses dialogs rendered after it ran, and cannot be reviewed or
corrected by the community.

A community proof of concept
([Azgaar/Fantasy-Map-Generator#1354](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1354))
showed the demand and produced ~1,600 French and Chinese UI strings, but its mechanism no longer
fits the codebase: it annotated static `index.html` markup that has since moved into Controllers,
walked the DOM to replace text, hard-coded French grammar into shared formatters, and changed the
random draw sequence per language — the same seed produced a different world in French.

## Solution

Translate the **interface** only: menus, dialogs, tooltips and messages. The **map is untouched**:
generated content stays English, and the `.map` format does not change.

- The **UI language** is a preference of this browser (`options.app.language`). A change applies
  after a reload.
- Interface text is translated where it is rendered: every Controller writes its labels and tooltips
  through `t()`. Text returned by `t()` is display-only and is never written into the Map, so a map
  made with a Russian interface is byte-identical to one made with an English interface.
- Translations are written by AI alongside the code and corrected from user reports. A language is
  added to the manifest only when its catalog is complete; afterwards CI warns about any string it
  lacks, which shows in English until translated.
- The Google Translate widget is retired once the shipped languages cover about 95% of non-English
  users (see [Language coverage](#language-coverage)). Browsers' built-in page translation serves the
  rest.

Russian went first because it exercises the hard parts of interface text early: three plural forms,
word order different from English, a different script and longer words. The language manifest is
the source of truth for the set of shipped languages.

## User Stories

### Interface language

1. As a non-English user, I want to choose the interface language in Options, so that I can use FMG
   in my own language.
2. As a first-time user, I want FMG to start in my browser's language when it is available, so that
   I don't have to find the setting in a language I can't read.
3. As a user, I want my interface language remembered across sessions, so that I choose it only once.
4. As a user, I want changing the interface language to apply everywhere at once, so that I never see
   a mix of old and new language in already-opened dialogs.
5. As a user, I want a missing or unavailable locale resource to fall back to English, so that the
   application remains usable if its catalog cannot load.
6. As a user, I want tooltips, dialog titles, buttons, table headers, alerts and prompts translated,
   so that the whole interface speaks one language.
7. As a user, I want counts phrased correctly for my language ("1 burg", "5 burgs", Russian's three
   plural forms), so that the interface reads naturally.
8. As a user, I want sentences with values in them ("3 of 12 rivers") to follow my language's word
   order, so that they are not English sentences with translated words.
9. As a user, I want hotkey hints to remain visible in any language, so that I can still learn the
   shortcuts when the translated word doesn't contain the hotkey letter.
10. As a user of a language FMG doesn't ship, I want my browser's page translation to still work, so
    that I am not worse off than with the Google Translate widget.
11. As a desktop-app user, I want the same language choice and translations as on the web, so that
    both behave the same.
12. As a user, I want the long help texts (About, font help) translated with their links intact, so
    that the guidance works in my language.
13. As a user, I want built-in choices the map stores as ids (feature types, culture sets, label
    modes, presets) shown in my language, so that selects and filters read naturally.

### The map stays as it is

14. As a user, I want my interface language never to change my map, so that a map I make with a
    Russian interface opens identically for someone using English.
15. As a user, I want the same seed to produce the same map whatever my interface language, so that
    sharing a seed works across languages.
16. As a user, I want maps saved before and after this feature to load unchanged, so that nothing I
    rely on breaks.

### Translators and contributors

17. As a user, I want to report a wrong translation in an issue, so that I can fix my language without
    Git or code knowledge.
18. As a translator, I want context for ambiguous words ("Close" the dialog vs. "close" distance), so
    that I translate the right meaning.
19. As a maintainer, I want a list of each language's untranslated keys, so that AI can translate them
    in the pull request that adds them.
20. As a maintainer, I want CI to warn when an English string has no translation yet, so that a copy
    edit never silently drops a language back to English, without blocking the pull request.
21. As a developer, I want to write `t("Rivers Overview")` directly in a template, so that adding UI
    text costs nothing and the template stays readable.
22. As a developer, I want an extraction command that collects every `t()` string into the English
    catalog, so that I never maintain it by hand.
23. As a developer, I want CI to reject incomplete or broken locale files (empty values, malformed
    placeholders or markup), so that a bad translation can't break the interface.
24. As a maintainer, I want the bundle to load only the active locale, so that adding languages
    doesn't slow everyone's startup.
25. As a maintainer, I want no new production dependency, so that the bundle stays lightweight.

## Languages

`src/data/languages.ts` is the source of truth for shipped interface languages and their native
names. A language uses a base code: browser preferences are matched on the base code, so `pt-PT`
can select `pt`. Add a regional variant only when its wording materially differs and users need it.

Right-to-left languages remain out of scope until the layout supports them.

### Language coverage

GA4 active users by browser language, 11 Sep – 8 Oct 2026: 189,316 users, 70% English and 56,239
non-English. The shipped catalogs cover 81.4% of non-English users (94.5% of all users).

| Next language | Share of non-English | Cumulative coverage |
| ------------- | -------------------: | ------------------: |
| Turkish       |                 3.7% |               85.1% |
| Indonesian    |                 1.8% |               87.0% |
| Korean        |                 1.7% |               88.7% |
| Czech         |                 1.4% |               90.1% |
| Swedish       |                 1.4% |               91.4% |
| Hungarian     |                 1.0% |               92.4% |
| Thai          |                 0.9% |               93.3% |
| Vietnamese    |                 0.8% |               94.1% |
| Danish        |                 0.8% |               94.8% |

Every language after these has under 0.7% of non-English users; the right-to-left ones (Arabic,
Hebrew, Persian) add 1.2% together. These nine catalogs are therefore the bar for retiring the Google
Translate widget. GA4 reports Chinese without the script; its region split decides whether
Traditional Chinese is worth a regional variant.

## Implementation Decisions

### Modules

**1. Catalog** — a small, deep module that owns all UI text lookup.

- Interface: load one locale before the app modules are evaluated, then synchronous
  `t(key, { context?, count?, ...values })` lookups.
- No library: a hand-written lookup of ~50 lines on top of `Intl.PluralRules`. The catalog files use
  the i18next v4 JSON shape (flat keys, `key_context`, `key_one`/`key_other`, `{{value}}`
  placeholders), so that standard translation tools read them.
- It lives in `utils/`: interface labels also sit in `data/` modules (layer names, presets), and
  `data/` may only import `utils/`. A `data/` module calling `t()` at import time is fine, because
  the catalog is loaded before any app module is evaluated.
- Keys are the English text itself (`t("Rivers Overview")`). Lookup order: active locale → English
  catalog → the key. Direct strings therefore need no English entry. **Ambiguous words** get a
  `context` ("Close" + `button` / `distance`).
- Keys are string literals only, so extraction can find them. Texts may be combined in code;
  a value inside a sentence is a placeholder, so a translation can move it.
- `t()` is plain text: interpolated values are HTML-escaped by default and catalog entries may not
  contain markup, so they remain safe in text and attribute sinks. Markup is code-owned: a link or
  `<code>` inside a sentence is built in code and passed as a raw `{{- value}}` placeholder, its label
  translated as a string of its own. `{{- value}}` also serves a sink that escapes on its own. No
  rich-text lookup (`tHtml()`) is needed.
- Every locale, English included, is a separately loaded chunk; English loads alongside the
  active one because plurals need it.

**2. Language setting** — a browser preference, following the configuration rules.

- `options.app.language`: `""` (the default) follows the browser's first shipped language, else
  English. It is never part of `options.map`, so it never enters a `.map` file.
- A change is stored at once and applies after a reload, offered right away or left for the next
  visit. The map isn't carried across the reload: browser storage can fail and would overwrite the
  user's stored map, so the user is told to save first. Controllers never re-render for a language
  change.
- A language manifest (`src/data/languages.ts`) lists the shipped locales with their native names.
  Unlisted languages rely on the browser's own page translation.

**3. The map boundary** — what keeps the `.map` unchanged.

- `t()` output is display-only. Generators, models and anything that writes into `pack`,
  `options.map` or the saved file never store translated text; a generator may call `t()` only for
  the alerts and tips it shows.
- Values the map stores as English ids (feature subtypes, religion types, label modes, culture sets,
  style presets) stay English in the data. Their display labels live in `src/data/id-labels.ts` (or
  next to the select that shows them): a select shows the label and keeps the id as its value.
- Names stored in the map — generated names, default names of definition sets (biomes, goods, unit
  and burg types), reserved entities ("Neutrals", "Wildlands") and user-named groups — are content
  and stay as they are, in English unless the user renames them.

**4. Controllers** — `t()` at render time, inside the templates Controllers already insert.

- The static dialogs in the page template (export, save, load, PNG tiles, alert, prompt) moved to
  Controllers, so no attribute-based or DOM-walking translation mechanism is ever built.
- Hotkey hints render from the existing shortcut metadata instead of `<u>` markup inside labels, so
  a translated label never has to contain the hotkey letter.
- The lookup falls back to English for a failed locale resource and for a string a catalog has not
  translated yet.

**5. Tooling and workflow**

- A small extraction script on the TypeScript compiler API (already a dev dependency) collects
  `t()` literals into the English catalog, expanding contexts and plurals and keeping
  existing English values; `npm run extract-strings` writes it, and its `--check` mode fails CI when
  the catalog is stale. Chosen over `i18next-cli`, which would add a native-binary dependency tree
  for a job this narrow.
- A locale lint script, run in CI over every shipped catalog, rejects empty values, placeholders
  missing from or added to the source, keys absent from the English catalog, markup and raw double
  quotes. Missing translations are a CI warning, not a failure.
- Translations are written by AI in the pull request that changes the English, not through a
  translation platform: a machine translation reviewed against the code is as good as a volunteer's
  for most strings, and catalogs never lag behind the code. `lint-locales --missing` lists each
  language's untranslated keys; user-reported mistakes are fixed in the catalog.

Contributor rules are in [docs/architecture/translation.md](../architecture/translation.md).

## Implementation Plan

Each milestone is one or a few mergeable PRs that leave `master` shippable. English output never
changes along the way.

### M0 — Groundwork

**Status: done.**

1. **Golden English names.** Seeded unit tests pin what the naming code produces: adjectives and
   the number of random draws they take, state full names for every form, religion names for every
   naming method. Written for a grammar refactor that is now out of scope; they stay as a guard that
   interface work never touches generated names.
2. **Hotkey hints from metadata.** The Layers tab renders its hotkey from the shortcut metadata
   instead of `<u>` inside the label, so labels are plain translatable text.
3. **Static dialogs to their modules.** Export, save, load and PNG tiles moved into the module that
   drives them, and the generic alert and prompt into the dialog helpers. The page template holds
   only the shell.

### M1 — Catalog and bootstrap (tracer bullet: Layers tab in Russian)

**Status: done.**

1. **Catalog module** with `load(locale)` and `t()` as specified above, plus its unit tests.
2. **Language manifest**: `en` and `ru`, each backed by a lazily loaded locale file.
3. **Bootstrap split.** Many tabs and Controllers evaluate their templates at import time, so the
   entry point resolves the UI language → `await`s the catalog → dynamically imports the app →
   `boot()`. Resolving reads the stored `app.language` from the options storage key without the
   rest of `Options` (falls back to the best match in `navigator.languages`, then English) and
   validates it against the manifest. `Options.restore` later parses the same value through the
   schema as usual.
4. **`options.app.language`** in the options schema. Picker in the Options tab next to the Google
   Translate button; on change it persists the choice and offers a reload, reminding the user to
   save unsaved changes.
5. **Extraction** script and its `--check` step in CI.
6. **Locale lint** script with fixture tests, run in CI over every shipped catalog.
7. The Layers tab wrapped, with its Russian strings.

### M2 — Interface rollout

**Status: done.** All interface text was wrapped in one pass: 3,782 catalog entries, with a complete
Russian catalog. A browser audit with every editor and Style element open found no untranslated
interface text beyond map content (out of scope), brand names and icon-picker category names.
Labels for ids the data stores in English live in `src/data/id-labels.ts`; Style tab labels derived
from schema keys live in `controllers/style-editor/field-labels.ts`, with a test keeping every key
listed.

### M3 — Additional catalogs

**Status: done.** Fourteen catalogs ship: af, de, es, fr, it, ja, nl, pl, pt, pt-BR, ru, tr, uk, zh.

1. **No markup in catalogs.** The markup-bearing entries were split into plain sentences with link
   placeholders and translated labels, and the lint rejects markup, so `tHtml()` was not built.
2. Each catalog is translated in full from English, cross-checked against Russian for meaning, and
   added to the manifest only after CI reports no missing keys. The proof of concept's French and
   Chinese strings are terminology references, not a source.
3. A glossary per language for recurring domain terms (burg, state, province, culture,
   namebase, heightmap, …), written first and reused by every batch, so a term is translated the
   same way across 3,800 strings.
4. Plural forms come from `Intl.PluralRules` with no code change; a catalog supplies every category
   its language requires.

### M4 — Localization QA

1. **Layout fit**: long labels wrap in the narrow menu tabs (Russian today; German is the worst
   case). Fix the layout (widths, wrapping, shorter wording where the meaning survives) rather than
   per-language CSS.
2. **CJK and Thai text**: check the interface font's fallback renders Chinese, Japanese and Thai
   cleanly and that nothing relies on spaces to wrap or truncate.
3. **Icon-picker category names**: done for the groups and emoji themes; the names of built-in set
   subfolders (“Relief · Simple”) still come from folder names in English.
4. **Map invariance test** (done): one e2e test generates the same seed with the UI in English and in
   Russian and asserts the saved `.map` files are identical. It turns the map boundary from a rule
   into a check.
5. A browser pass in each language with every editor open, as done for Russian in M2.

### M5 — Coverage catalogs and widget retirement

1. Catalogs for tr, id, ko, cs, sv, hu, th, vi and da, each with its glossary first, as in M3.
2. Remove the Google Translate button, its script loader and its strings from the Options tab, and
   its mentions from the wiki (User Interface, Knowledge Base, Q&A, Quick Start, Policy).

### M6 — Release

1. Glossary term: **UI language** (done).
2. Wiki: the Q&A, Knowledge Base, User Interface, Quick Start, Policy and Reporting pages describe
   the language picker, the shipped languages, the fallback for other languages and how to report a
   wrong translation. Written; published with the release.
3. Close [Azgaar/Fantasy-Map-Generator#1354](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1354)
   with thanks and a link here.

## Testing Decisions

A good test here asserts what a user or translator would observe — the text `t()` returns, the map a
seed produces — never how lookup is implemented internally.

- **Catalog.** Fallback chain (locale → English → key), context, plural categories through
  `Intl.PluralRules` (Russian's three forms), placeholder interpolation and escaping of
  interpolated values. The fallback test simulates an unavailable locale resource, not a partial
  shipped catalog. Prior art: the utils unit tests.
- **Locale lint and extraction.** Both CI checks are tested against small fixture catalogs and
  sources: the lint fails on an empty value, a dropped or extra placeholder, an unknown key or
  markup, lists missing keys with each language's plural forms, and passes a clean file.
- **Catalog files.** A locale file exists for exactly the shipped languages.
- **Labels for ids.** Tests keep `id-labels` and the Style field labels covering every id and schema
  key, so a new id cannot silently show raw.
- **Map invariance** (M4). Same seed, English vs Russian UI, identical `.map`. A whole generation
  needs the browser, so this is an e2e test. Prior art: the existing seeded e2e specs.
- **Golden English names** (M0) stay green: interface work never changes generated names.
- Existing DOM and e2e tests run with English and are unaffected.

## Out of Scope

- **Map content in other languages.** Everything generated into the map stays English: state,
  province, religion and culture names and their forms ("Kingdom of X", "X Empire"), burg and unit
  types, reserved entities, the default names of biomes, goods, military units and burg types.
  This includes the whole "content language" design: a per-map language saved in the `.map`, a
  locale grammar per language (vocabulary, gender agreement, word order) and transliteration of
  namebase output into other scripts. No `.map` format change is made.
- **Generated prose**: marker legends, journey stories, diplomacy chronicles, battle reports and
  other Notes stay English.
- Translating namebases, culture-set contents or user-named groups.
- Text sent to a language model, file formats (CSV headers, export metadata), identifiers and logs.
- Switching the interface language without a reload.
- Locale-aware number, date and unit formatting.
- Translating the wiki and the Azgaar Assistant's knowledge base; both stay English.
- Right-to-left languages (Arabic, Hebrew, Persian) until right-to-left layouts are supported.

### If map content is translated later

It needs its own PRD. Lessons already learned, so they aren't rediscovered:

- The language would be map config (`options.map.language`, saved in the `.map`): adding entities
  and renames still need it long after generation, and a map must keep its language whoever opens
  it. `Options.randomize()` would have to carry it into the next map.
- The seed must decide the world and the language only the words: generators pick ids, a pure
  grammar turns them into words. The trap is adjectivization, which draws one `P()` per rule before
  testing its condition, so a grammar must reuse the English rolls and never draw more.
- Renames recompose a full name only when it still equals the grammar's composition of the old
  name; otherwise the user's edit wins.

## Further Notes

- English-as-key means a copy edit orphans that string's translations. That's intended — the
  translation really is stale. The lint fails on the orphaned key, so the pull request drops or moves
  it; the new key shows in English, with a CI warning, until it is translated.
- Russian interface with English map content is the expected result of this scope: a biome list
  reads "Grassland" under a Russian column header until the user renames it.
