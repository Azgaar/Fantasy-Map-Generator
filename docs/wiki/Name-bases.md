A namesbase teaches the generator one language: the names it makes up, and how it says what a name means. Every base makes names out of the box; a base with a written lexicon makes names that read as that language, such as Newton and Blackwater for English or Novgorod for Ruthenian.

English and Ruthenian are written in full. The other bases get by on forms the generator finds in their names, and are open for contribution.

## What a base holds

Open _Tools_ → _Namesbase_. Each tab is one part of the base:

- **Places**: real place names, commas between. New names are generated to sound like these. A few hundred names give good results.
- **People**: male and female personal names. Places are named after founders, such as Eadric's Farm. Names are either generated like the listed ones or picked as they are.
- **Lexicon**: how the base says each concept: `town`, `ford`, `new`, `black` and so on. A concept left empty gets a generated form, shown in grey.
- **Patterns**: how often the base coins each kind of name, and how the parts are laid out.
- **Rules**: sound changes that make joined parts read naturally and bring foreign names into the language.

## Writing a lexicon

A concept takes one or more forms, commas between. The most common form comes first or gets the largest weight:

```
town:   ton@last:6, town
fort:   bury@last:4, borough~burgh:2, chester@last:2
new:    new
old:    old:2, ald@first:2
```

- `:6` is the weight: how often the form is taken against the others. 1 when left out.
- `@last` lets the form stand only at the end of a word, `@first` only at the start, `@word` only as a word of its own.
- `~burgh` is a shorter spelling, taken when the name runs too long.
- `+o` is a link put between the form and the part after it, as in `nov+o` for Novo-.

Use the forms real place names of the language are built of, in the spelling they have inside a name, not dictionary words: English towns end in -ton far more often than in -town.

## Patterns and templates

A template lays a pattern out. Slots are `{root}`, `{generic}` and `{modifier}`; anything else is kept as written:

```
owner-generic:  {root}{generic}:3, {root}s{generic}
generic-of:     {generic} {root}, {root}{generic}
```

A weight of 0 turns a pattern off for the base.

## Rules

A rule is a line, `match => replace`, where the match is a regular expression. Flags go after ` | `:

```
(.)\1+ => $1
gorod$ => grad | long
kh => k | foreign
a\+o => o | join
e\+(?=[aeiou]) => + | 50%
```

- no flag: applies to every name the base generates
- `join`: applies where parts meet; `+` marks each join
- `long`: applies only while the name is longer than the base allows
- `foreign`: applies to names borrowed from another base
- `50%`: applies to that share of names, always the same ones

The **Try a name** box on the tab shows what the rules make of a name.

## Checking the result

The examples under the tabs are regenerated on a click. The lexicon tab counts the concepts written. To see whole names, open a burg or state and press the translations button next to its meaning: it lists the name in every base. To read a whole map in the base, set _Options_ → _Names on labels_ to it.

## Sharing a base

Download the bases as `.json` from the editor to share or back them up; the same file uploads back.

To add a base to the generator, put its data in `src/data/name-bases/<id>.ts` in the form the other files there have, list it in `src/data/name-bases/index.ts` and open a pull request. Names of real places and people must come from a source that allows reuse.
