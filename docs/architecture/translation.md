# Translation

Interface text is written in English and translated where it is rendered. The plan and its
reasoning are in [the PRD](../prd/translation.md); this page is the contributor's checklist.

## Writing interface text

- Wrap every string a user reads in `t()` from `@/utils/i18n`: labels, tooltips, dialog titles and
  buttons, `tip()` messages, alerts. The key is the English text itself: `t("Rivers Overview")`.
- Keys must be **literal strings**. `t(label)` cannot be extracted; put the `t()` where the literal is.
- A string is plain text: no markup and no outer spaces. Markup goes around it in code
  (`` `<p class="empty">${t("No rules")}</p>` ``) or into a raw placeholder; a link inside a sentence
  is a placeholder with its own translated label:
  `t("Check out {{- wiki}} for guidance.", { wiki: link(url, t("wiki")) })`. The lint rejects markup.
- Texts combine in code. Separate sentences join with `sentences()`, which handles CJK punctuation:
  `sentences(t("State name"), t("Click to change"))`. A value inside a sentence is a placeholder, so a
  translation can move it: `t("Labels assigned to “{{group}}”: {{labels}}", { group, labels })`.
- Avoid plurals: show a number as a counter (`t("Cells changed: {{cells}}")`) or in parentheses
  (`t("Remove burgs ({{burgs}})")`), which reads right for any number in any language. A `count`
  option picks a plural form; use it only when no such wording works.
- `{{name}}` is HTML-escaped; `{{- name}}` is for markup built in code (a link, `<code>`) or a value
  going to a sink that escapes on its own (a jQuery UI dialog `title`, `textContent`).
- The same English with two meanings gets a context: `t("Close", { context: "button" })`.
- A label placed into one sentence may be translated in the form that sentence needs (a case, an
  article). Give a label used in several places a separate key for each grammatical role.
- A label never ends with a colon: write `` `${t("Name")}:` ``. Reuse a string before adding a
  near-copy: an ellipsis or `!` goes in code too, an all-caps badge is `t("sell").toUpperCase()`,
  and “Remove the X” is “Remove X”. Keep two variants only when a translation differs (an adjective's agreement, two meanings).
  The same control in every dialog shares one tooltip that does not name its subject (“Locate on map”,
  “Save data as a CSV file”), and a numbered name is composed: `` `${t("Blur")} 3` ``.
- Use “ ” rather than straight double quotes in visible text.
- `index.html` keeps only the shell; its text is set from the table in `components/shell.ts`.

## What stays English

Generated map content (names, legends, chronicles, battle reports), text sent to a language model,
file formats (CSV headers, export metadata), identifiers, CSS and log messages. Text that reads the
same in every language is not wrapped either: third-party brand and OS names (Discord, Google Fonts),
file formats and extensions, color spaces (`HEX`), SVG attribute names, example URLs and placeholders
like `XIV`. The product names are translated: “Fantasy Map Generator”, “Azgaar's Fantasy Map
Generator” and “Azgaar Assistant” follow each language's glossary.

`t()` output never enters the map: nothing translated is stored in `pack`, `options.map` or the
`.map` file. An id the data stores in English (a feature subtype, a preset) keeps the id as its value
and shows a label from `src/data/id-labels.ts`.

## Catalogs

- `npm run extract-strings` rewrites `src/locales/en.json` from the sources, keeping existing English
  values. CI fails when it is stale.
- `src/locales/<code>.json` holds a shipped language; `src/data/languages.ts` lists it.
  `npm run lint-locales` (a CI step) fails a catalog with a key English lacks, an empty value, a
  trailing colon or outer spaces, a line break, markup, a raw `"` or different placeholders.
- A missing translation shows the English and only warns in CI; `npm run lint-locales -- --missing`
  lists them. Translations are written by AI in the pull request that adds or changes the English, or
  in a follow-up. A copy edit renames the key, so its old translations are dropped with it.
- A catalog joins the manifest once it is complete.
- Terms per language are in `src/locales/glossary/<code>.md`; a new term goes there before any catalog.
- Users report a wrong translation in an issue; the fix is an edit to the catalog.
