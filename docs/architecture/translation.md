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
- `{{name}}` is HTML-escaped. Use `{{- name}}` for a value that is markup (a link, an icon) or that
  goes to a sink which escapes on its own (a jQuery UI dialog `title`, `textContent`).
- The same English with two meanings gets a context: `t("Close", { context: "button" })`.
- Markup a sentence needs (`<b>`, `<i>`, a link with static attributes) stays inside the string.
  Markup around the whole text (a `<p>`, `<div>`, `<label>`, anything with a class, style, `id` or
  `data-*`) stays outside it: `` `<p class="empty">${t("No rules")}</p>` ``.
- One string is one sentence or line. Join separate ones in code, so shared lines are translated once:
  `` `${t("Are you sure you want to remove the burg?")}<br>${t("This action cannot be reverted")}` ``.
  Sentences of one line join with `sentences()`: `sentences(t("State name"), t("Click to change"))`.
  A value that is the whole sentence (a name) goes in as it is, escaped, not as `t("{{name}}")`.
- A label never ends with a colon: write `` `${t("Name")}:` ``. Reuse a string before adding a
  near-copy: an ellipsis or `!` goes in code too, an all-caps badge is `t("sell").toUpperCase()`,
  and “Remove the X” is “Remove X”. Keep two variants only when a translation differs (an adjective's agreement, two meanings).
- No straight double quotes in visible text: they break the attributes translations are put in. Use “ ”.
- `index.html` keeps only the shell; its text is set from the table in `components/shell.ts`.

## What stays English

Generated map content (names, legends, chronicles, battle reports), text sent to a language model,
file formats (CSV headers, export metadata), identifiers, CSS and log messages. Text that reads the
same in every language is not wrapped either: brand and OS names, file formats and extensions, color
spaces (`HEX`), SVG attribute names, example URLs and placeholders like `XIV`. Generated content is
translated by locale grammars, not by `t()` — see the PRD.

## Catalogs

- `npm run extract-strings` rewrites `src/locales/en.json` from the sources, keeping existing English
  values. CI fails when it is stale.
- `src/locales/<code>.json` holds a shipped language; `src/data/languages.ts` lists it.
  `npm run lint-locales` (a CI step) checks every catalog: no unknown keys, no empty values, no
  straight quotes outside tags, no trailing colon, the same placeholders as the English.
- Translations are written by AI in the pull request that adds or changes the English, so catalogs
  never lag: `npm run lint-locales -- --missing` lists each language's untranslated keys. A copy edit
  renames the key, and the lint fails on the old one until its translation moves to the new key.
- Users report a wrong translation in an issue; the fix is an edit to the catalog.
