# Translation

Interface text is written in English and translated where it is rendered. The plan and its
reasoning are in [the PRD](../prd/translation.md); this page is the contributor's checklist.

## Writing interface text

- Wrap every string a user reads in `t()` from `@/utils/i18n`: labels, tooltips, dialog titles and
  buttons, `tip()` messages, alerts. The key is the English text itself: `t("Rivers Overview")`.
- Keys must be **literal strings**. `t(label)` cannot be extracted; put the `t()` where the literal is.
- Never build a sentence from pieces. Use placeholders and pass the values:
  `t("Labels assigned to “{{group}}”: {{labels}}", { group, labels })`, not `` `${count} ${t("labels")}` ``.
- Avoid plurals: show a number as a counter (`t("Cells changed: {{cells}}")`) or in parentheses
  (`t("Remove burgs ({{burgs}})")`), which reads right for any number in any language. A `count`
  option picks a plural form; use it only when no such wording works.
- `t()` returns plain text. `{{name}}` is HTML-escaped; `{{- name}}` is only for a value going to a
  sink that escapes on its own (a jQuery UI dialog `title`, `textContent`).
- Use `tHtml()` only for an explicit prose key that needs inline rich text. The English and every
  locale value must have the same tags, nesting and attributes; translators change text nodes, not
  markup. A raw placeholder in `tHtml()` is code-owned markup, never markup from a catalog.
- The same English with two meanings gets a context: `t("Close", { context: "button" })`.
- Do not put markup in a `t()` key or catalog value. Markup around a translated string stays outside
  it: `` `<p class="empty">${t("No rules")}</p>` ``. Use `tHtml()` only when word order requires
  inline rich text.
- One string is one sentence or line. Join separate ones in code, so shared lines are translated once:
  `` `${t("Are you sure you want to remove the burg?")}<br>${t("This action cannot be reverted")}` ``.
  Sentences of one line join with `sentences()`: `sentences(t("State name"), t("Click to change"))`.
  A value that is the whole sentence (a name) goes in as it is, escaped, not as `t("{{name}}")`.
- A label never ends with a colon: write `` `${t("Name")}:` ``. Reuse a string before adding a
  near-copy: an ellipsis or `!` goes in code too, an all-caps badge is `t("sell").toUpperCase()`,
  and “Remove the X” is “Remove X”. Keep two variants only when a translation differs (an adjective's agreement, two meanings).
- Use “ ” rather than straight double quotes in visible text.
- `index.html` keeps only the shell; its text is set from the table in `components/shell.ts`.

## What stays English

Generated map content (names, legends, chronicles, battle reports), text sent to a language model,
file formats (CSV headers, export metadata), identifiers, CSS and log messages. Text that reads the
same in every language is not wrapped either: brand and OS names, file formats and extensions, color
spaces (`HEX`), SVG attribute names, example URLs and placeholders like `XIV`.

`t()` output never enters the map: nothing translated is stored in `pack`, `options.map` or the
`.map` file. An id the data stores in English (a feature subtype, a preset) keeps the id as its value
and shows a label from `src/data/id-labels.ts`.

## Catalogs

- `npm run extract-strings` rewrites `src/locales/en.json` from the sources, keeping existing English
  values. CI fails when it is stale.
- `src/locales/<code>.json` holds a shipped language; `src/data/languages.ts` lists it.
  `npm run lint-locales` (a CI step) checks every catalog: exactly the English keys, no empty
  values, no trailing colon, the same placeholders and valid `tHtml()` structure.
- Translations are written by AI in the pull request that adds or changes the English. A catalog is
  not added to the manifest until `npm run lint-locales -- --missing` reports zero missing keys; CI
  then rejects any missing translation. A copy edit renames the key, and the same pull request moves
  or redoes every translation.
- Users report a wrong translation in an issue; the fix is an edit to the catalog.
