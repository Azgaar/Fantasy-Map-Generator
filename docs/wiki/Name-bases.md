A namesbase teaches the generator one language: the names it makes up, and how it says what a name means. Every base makes names out of the box; a base with a written lexicon makes names that read as that language, such as Newton and Blackwater for English or Novgorod for Ruthenian.

English and Ruthenian are written in full; `src/data/name-bases/ruthenian.ts` is the fullest example, with suffixes by burg group, genders and agreement. The other bases get by on forms the generator finds in their names, and are open for contribution.

## What a base holds

Open _Tools_ → _Namesbase_. Each tab is one part of the base:

- **Places**: real place names, commas between. New names are generated to sound like these. A few hundred names give good results.
- **People**: male and female personal names. Places are named after founders, such as Eadric's Farm. Names are either generated like the listed ones or picked as they are.
- **Lexicon**: how the base says each concept: `town`, `ford`, `new`, `black` and so on. A concept left empty gets a generated form, shown in grey.
- **Patterns**: how often the base coins each kind of name, and how the parts are laid out.
- **Rules**: sound changes that make joined parts read naturally and bring foreign names into the language, and the grammar: noun classes and the endings that agree with them.

## Writing a lexicon

A concept takes one or more forms, commas between. The most common form comes first or gets the largest weight:

```
town:   ton@last:6, ham@last:3, town
fort:   bury@last:4, borough~burgh:2, chester@last:2
new:    new
old:    old:2, ald@first:2
```

- `:6` is the weight: how often the form is taken against the others. 1 when left out.
- `@last` lets the form stand only at the end of a word, `@first` only at the start, `@word` only as a word of its own.
- `~burgh` is a shorter spelling, taken when the name runs too long.
- `+s` is a link put between the form and the part after it, as in `king+s` for Kingston.
- A form may hold an apostrophe: `king's@word` gives King's Landing.

Use the forms real place names of the language are built of, in the spelling they have inside a name, not dictionary words: English towns end in -ton far more often than in -town.

## Settlements

The first four concepts, `city`, `town`, `village` and `hamlet`, are the most important. Every burg belongs to a group, and most burg names are one stem with the ending of the burg's group: a founder, a tree or a river, plus what the burg is. So these four set the sound of the whole map. Forts, monasteries, trading posts and caravanserais take `fort`, `abbey`, `market` and `camp`.

```
city:     -sk:6, -ovsk:2, grad@last:2, gorod@word
town:     -ov:8, gorodok@word
village:  -ovo:6, -ovka:4, -ichi:2, selo@word
hamlet:   -ka:5, -ki:4, hutor@word
```

- `-sk` is a suffix. It ends a word and stands only after a stem or a proper name: Ivanovsk, Berezovsk.
- `berez@stem` is a stem: the form a word takes before a suffix. Write one for every concept a burg may be named for, or the concept gets no suffix.
- A form with no hyphen, such as `grad@last`, is a full word part and joins a combining form instead: Novograd.
- A proper name takes only the suffixes. The full words stand apart from it: Davidov, Davidovsk and Davidovo are the rule, David-Gorodok and Davidov Gorodok the exception.

Keep the suffixes heavy and the full words light, or every other town is a Gorodok. A wider set of endings keeps a large map from repeating itself.

On the Patterns tab, **Names ending in the burg's group** sets how many burg names are built this way. The rest are named for what stands at the place: a ford, a hill, a wood.

## Grammar

Languages where words agree need two more things: the classes of their nouns, and the ending a describing word takes beside each. On the Rules tab, a class a line, `class: pattern => ending`:

```
f: a$ => aya
n: [oe]$ => oye
pl: [iy]$ => ye
m: => yi
```

A noun falls into the first class whose pattern it matches; the last line, with no pattern, takes the rest. Proper names are classed the same way. A noun the pattern gets wrong is told its class: `pristan/f@word`.

- `nov*` is a describing word: `*` becomes the ending of the noun beside it. Novyi Gorod, Novaya Sloboda, Novoye Selo.
- `verhniy/m@word, verhnyaya/f@word` spells an irregular word out, a form for each class.
- `_/n@word` is a noun left unsaid: the describing word stands alone and still agrees with it, as in Krasnoye for a village.
- `*` works in a template as well: `{root}ov* {generic}` gives Borisov Brod and Olgina Gora.

A stem written with its final `a`, such as `ryba@stem`, joins as a name ending in -a does: Rybin, Rybino, Rybinsk. A mark of your own inside a form, such as the `'` in `chert'ov*`, is there for a rule to find: the Ruthenian rules turn it into the short possessive endings of Chertov Most and Chertova Gora.

Spelling that depends on the letters at the join belongs to the rules, not here: write the regular ending and let a `join` rule turn `k+yi` into `kiy`.

## Patterns and templates

A template lays a pattern out. Slots are `{root}`, `{generic}` and `{modifier}`; anything else is kept as written:

```
modifier-generic:  {modifier}{generic}:4, {modifier} {generic}:5
owner-generic:     {root}{generic}:6, {root}ov* {generic}:2, {root}-{generic}
```

A dash or a space in a template starts a new word, so `{root}-{generic}` gives David-Gorodok.

The `compound` pattern has a third slot, `{settlement}`, after a describing word and a landform: `{modifier}{generic}{settlement}` gives Krasnogorsk, and `{modifier}{generic} {settlement}` gives Deepwood Keep. A template may leave a slot out: `{modifier}{generic}` alone gives Redhill.

A name is one word or two by which forms the base has. A suffix can only join, so `birch` + `town` is Berezov. A form marked `@word` can only stand apart, so `red` + `village` is Krasnoye Selo. Where both are possible, the weights of the templates and of the forms decide together.

A weight of 0 turns a pattern off for the base.

## Rules

A rule is a line, `match => replace`, where the match is a regular expression. Flags go after ` | `:

```
(.)\1+ => $1
gorod$ => grad | long
kh => k | foreign
(?<=[gkh])\+yi => +iy | join
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
