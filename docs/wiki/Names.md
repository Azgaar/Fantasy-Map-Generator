Every burg, state, province, river and lake gets a name in the language of its culture. This page explains how those names are made, what you can do with them in the interface, and how to create or change the name bases that define each language.

## How naming works

### A meaning first, then a name

A name is made in two steps. First the generator decides what the name **means**, from what is at the place: a town by a birch forest may be "Birch Town", a farm founded by a man named Eadric "Eadric's Farm". Then the culture's **name base** says that meaning in its own language:

| Meaning       | English     | Ruthenian      |
| ------------- | ----------- | -------------- |
| Birch Town    | Birkton     | Berezin        |
| Birch Village | Birchby     | Berezovo       |
| Mouth of Exe  | Exmouth     | Ust-Ekse       |
| Red Hill City | Redhill     | Krasnogorsk    |
| Eadric's Farm | Eadricworth | Eadrikov Hutor |

The place keeps the meaning apart from its name. So the same place can be shown in any other name base, and a label can show what its name means.

Islands, seas, routes, markers and religions have no meanings. They get plain names that only sound like their language.

### Where a meaning comes from

The generator looks at the place: a river or a coast, a harbour, hills, forest, marsh, ore, cold or heat, how big the burg is, whether it is a capital. It picks words that fit and never words that contradict the place: a harbour only at a port, a mouth only where a river ends, a mine only where there is ore. A good produced at a burg is favoured, so a burg on salt is likelier to be a salt town.

Most burg names end in what the burg is by its group: a city, a town, a village or a hamlet, and a fort, an abbey, a market or a camp for forts, monasteries, trading posts and caravanserais. The rest are named for what stands at the place: a ford, a hill, a wood.

Rivers and lakes are named first, so a burg can be named after them: Exmouth. Capitals are named before other burgs, and states after their capitals.

### Kinds of names

Every name has one of nine shapes, called patterns. The Patterns tab of the Namesbase Editor lists them by these ids:

| Pattern            | A name made of                                  | Meaning       | English     | Ruthenian      | Used for                         |
| ------------------ | ----------------------------------------------- | ------------- | ----------- | -------------- | -------------------------------- |
| `simplex`          | a proper name with no meaning                   | Aldwick       | Aldwick     | Aldvik         | states, rivers, lakes, provinces |
| `feature`          | what stands at the place                        | The Ford      | Ford        | Brod           | burgs                            |
| `modifier-generic` | what the place is like, and what it is          | New Town      | Newton      | Novgorod       | burgs, rivers, lakes             |
| `owner-generic`    | a founder, and what the place is                | Eadric's Farm | Eadricworth | Eadrikov Hutor | burgs, lakes                     |
| `generic-of`       | what the place is, on a named river             | Mouth of Exe  | Exmouth     | Ust-Ekse       | burgs                            |
| `compound`         | a description of the land, and what the burg is | Red Hill City | Redhill     | Krasnogorsk    | burgs                            |
| `relative`         | another place's name told apart                 | New Barton    | New Barton  | Novyi Barton   | burgs, colony provinces          |
| `root-land`        | a name, and a word for a land                   | Land of Frank | Frankia     | Frankia        | states, provinces                |
| `modifier-land`    | a describing word and a land                    | East Realm    | Eastrealm   | Vostochnia     | states                           |

A number may stand where a describing word does: Three Towers, Tri Vezhi.

## Names in the interface

- **Burg, state, province, river and lake editors** show the meaning under the name. _See the name in other name bases_, the button next to it, lists the name in every base: click one to take it. _Generate culture-specific name_ coins a new meaning and its name in the culture's base; _Generate random name_ does the same in a random base.
- **A name you type is kept.** The name and the meaning are stored apart and neither overwrites the other, so a name may say something other than its meaning. Nothing renames a place behind your back: changing a burg's or state's culture, a culture's name base or a burg's group offers the new name and waits for a yes.
- **Cultures editor**: the _Namesbase_ column sets the base of each culture. The arrows beside it re-generate the names of the culture's burgs. _Edit a database used for names generation_, at the bottom, opens the Namesbase Editor.
- **Options** → **Advanced** → **Names on labels**: show names _As named_, as their _Meaning_, or as any name base would say them. Only the labels change, not the names.
- **Options** → **Advanced** → **Personal names**: founders that places are named after are _Generated_ anew, _Picked_ from the base's lists as they are, or _As the name base sets_.

## Name bases

A name base is one language. 43 are built in: 33 real-world languages, a generic human base and 9 fantasy ones. Every culture uses one, and several cultures may share one.

Name bases are saved with the map. Changing a base changes it for this map only; to use it in other maps, download it and upload it there.

### The Namesbase Editor

Open _Tools_ → _Namesbase_, or open it from the Cultures editor. At the top, select a base, rename it, and choose a base it **extends**: that base's lexicon, patterns and people stand in where this one has none. Each tab is one part of the base:

- **Places**: real place names, commas between. New names are generated to sound like these. A few hundred names give good results. Below them, the names of rivers and lakes: waters are named like these, and like places when the list is empty. **Length** sets the shortest and longest names to aim for; **Doubled** lists the letters that may stand twice in a row, as in Kalla.
- **People**: male and female personal names. Places are named after founders, such as Eadric's Farm. Names are either generated like the listed ones or picked as they are. Keep both lists full: how many founders are women is set on the Patterns tab, not by the lists' sizes.
- **Lexicon**: how the base says each concept: `town`, `ford`, `new`, `black` and so on. A concept left empty gets a generated form, shown in grey.
- **Patterns**: how often the base coins each kind of name, and how the parts are laid out.
- **Rules**: sound changes that make joined parts read naturally and bring foreign names into the language, and the grammar: noun classes, the endings that agree with them, and the rules that make a word's other forms.

Under the tabs, sample names show what the base makes; click them for new ones. The buttons at the bottom add a base, restore the built-in bases, download and upload bases, open the Cartography Assets portal to find bases others shared, and analyze the place names: how many there are, how varied, how long, and which endings they share.

### Making a new base

A base needs only its place names to work:

1. Press _Add_. A new base appears with a short example list.
2. Name it, and replace the example on the Places tab with real place names of the language, commas between. A few hundred is good, a hundred the least.
3. Set **Length** to the range of the names you listed. Fill **Doubled** if the language doubles letters.
4. Press _Analyze_ to check the list: too few names, odd characters and duplicates show there.
5. Add personal names on the People tab, so founders sound native too.
6. In the Cultures editor, pick the base for a culture and press the arrows to rename its burgs.

The names now sound like the language but mean nothing in it, as the German ones do. To make them mean what they say, write the base's words: see the next section.

To make a variant of a base that is already written, such as a dialect, set **Extends** to it. The new base takes its words, patterns and people until you write your own, and its own place names give it its sound.

### Sharing a base

Download the bases as `.json` from the editor to share or back them up; the same file uploads back. Upload either replaces all bases or adds to them.

## Teaching a base its words

A meaning is made of **concepts**: a fixed vocabulary such as `town`, `ford`, `new`, `black`, `birch` and `king`, each with its English word as its id. A base says each concept with **forms**, written on the Lexicon tab. Its **templates**, on the Patterns tab, put the forms in order. Its **rules**, on the Rules tab, smooth the joins.

### Writing a lexicon

Each line of the Lexicon tab gives one concept its forms, commas between:

```
town:   -ton 6, -ham 3, town
fort:   -bury 4, -borough~burgh 2, -chester 2, Keep
old:    old 2, ald-
king:   kings- 4, King, King's 3
```

A form is a piece that names are built of, spelled as it is inside a name. Marks around it say what kind of piece it is and how often it is taken.

#### Pieces and how they join

A name is one word or a few, and each word is either one form standing alone or two forms joined. There are two ways to join:

- **Compound**: a start and an end that are both real word parts: Ald + bury, Novo + grad.
- **Suffix**: a stem and a suffix: Berez + ov, Ivan + sk. A suffix is no word on its own, and a stem is the shape a word takes before one.

The mark says which piece a form is. A dash or an equals sign stands on the side where the other piece joins, a dash for a compound and `=` for a suffix. A capital first letter makes a whole word:

| Written    | Piece                               | Joins                    | Example             |
| ---------- | ----------------------------------- | ------------------------ | ------------------- |
| `Keep`     | a whole word                        | nothing, stands apart    | Deepwood Keep       |
| `-Gorodok` | a whole word that may follow a dash | apart, or a name and `-` | David-Gorodok       |
| `ald-`     | the start of a compound             | an end                   | Ald + bury: Aldbury |
| `-ton`     | the end of a compound               | a start                  | New + ton: Newton   |
| `berez=`   | a stem                              | a suffix                 | Berez + ov: Berezov |
| `=sk`      | a suffix                            | a stem or a proper name  | Ivan + sk: Ivansk   |
| `wood`     | any of whole word, start or end     | as the template needs    | Deepwood, Deep Wood |

The pieces must match: a stem needs a suffix after it and a suffix a stem before it; a start needs an end and an end a start. So `berez=` + `-grad` and `ald-` + `=sk` never happen. A form with marks on both sides, such as `-ton-`, is not read.

A proper name, such as a founder's or a river's, joins like a stem: Ivansk, Davidov. Where the concept has suffixes, the name takes only those, and its whole words stand apart: Ivan-Gorod. Where the concept has none, the name joins its ends: Eadric + ton is Eadricton.

The template decides how many words a name has: `{modifier}{generic}` asks for one word of two pieces, `{modifier} {generic}` for two words (see [Patterns and templates](#patterns-and-templates)). Of the forms that fit, one is drawn by weight.

A whole line read through:

```
city:  =sk 4, =ovsk, -grad 2, -Gorod
```

A city is mostly a suffix, `-sk`, now and then `-ovsk`: Ivansk, Berezovsk. It is also the end of a compound, Novograd, and a whole word that may follow a dash: Novyi Gorod, Ivan-Gorod.

#### After the form

Three things may follow a form, all optional and in this order:

- `~burgh`: a shorter spelling, taken when the name runs too long. `-borough~burgh` is spelled -burgh in a name that would run too long.
- `/f`: the noun class, for languages whose words agree; see [Grammar](#grammar).
- ` 6`: the weight, a whole number after a space: how often the form is taken against the others of the concept, 1 when left out. `-ton 6, -ham 3` makes -ton twice as common as -ham.

A form may hold an apostrophe: `King's` gives King's Landing. `*` and `_` belong to the grammar: `nov*` is a word that agrees with its noun, `_` a noun left unsaid.

Use the forms real place names of the language are built of, in the spelling they have inside a name, not dictionary words: English towns end in -ton far more often than in -town.

### Settlements

The first four concepts, `city`, `town`, `village` and `hamlet`, are the most important. Every burg belongs to a group, and most burg names are one stem with the ending of the burg's group: a founder, a tree or a river, plus what the burg is. So these four set the sound of the whole map. Forts, monasteries, trading posts and caravanserais take `fort`, `abbey`, `market` and `camp`.

```
city:     =sk 6, =ovsk 2, -grad 2, Gorod
town:     =ov 8, -Gorodok
village:  =ovo 6, =ovka 4, =ichi 2, Selo
hamlet:   =ka 5, =ki 4, Hutor
```

Every concept a burg may be named for needs a stem, such as `berez=` for `birch`, or it never takes the suffixes; a grammar can make the stems (see below). A founder needs none: Davidov, Davidovsk and Davidovo are the rule, David-Gorodok and Davidov Gorodok the exception.

Keep the suffixes heavy and the full words light, or every other town is a Gorodok. A wider set of endings keeps a large map from repeating itself.

On the Patterns tab, **Names ending in the burg's group** sets how many burg names are built this way. The rest are named for what stands at the place: a ford, a hill, a wood. **Founders who are women** sets how often a burg named after a founder takes a woman's name; left empty, the two lists of people decide by their sizes.

### Grammar

Languages where words agree and change need a grammar, on the Rules tab, a line each. First the classes of their nouns, `class: pattern`:

```
f: a$
n: [oe]$
pl: [iy]$
m:
```

A noun falls into the first class whose pattern it matches; the last line, with no pattern, takes the rest. Proper names are classed the same way. A noun the pattern gets wrong is told its class: `Pristan/f`.

Then the endings a describing word takes beside a noun of each class, `*: class ending, …`:

```
*: m yi, f aya, n oye, pl ye
*soft: m iy, f yaya, n eye, pl iye
```

- `nov*` is a describing word: `*` becomes the ending of the noun beside it. Novyi Gorod, Novaya Sloboda, Novoye Selo.
- `verhn*soft` takes its endings from the set named `soft`: Verhniy Brod, Verhnyaya Gora. A named set is spelled as it stands; the default endings go through the join rules, so `velik+yi` can become Velikiy.
- `Verhniy/m, Verhnyaya/f` spells a word out for each class instead, where no set fits.
- `_/n` is a noun left unsaid: the describing word stands alone and still agrees with it, as in Krasnoye for a village.
- `*` works in a template as well: `{root}ov* {generic}` gives Borisov Brod and Olgina Gora.

Last, the rules that make a concept's other forms of the ones written, `stem: match => replace` and `first: match => replace`. The first rule of its kind that matches makes the form:

```
stem: (?:ey|ye|ya|[aoeyi])?$ =>
first: \*soft$ => e
first: \*$ => o
first: (?:ey|ye|ya|[aoeyi])?$ => o
```

- A place and a modifier get a stem of each of their words: `Most` makes `most=`, `Zaimka` makes `zaimk=`.
- A modifier gets a combining form of each of its stems, or of its words where it has none: `volk=` makes `volko-`, `nov*` makes `novo-`, `verhn*soft` makes `verhne-`.
- A rule sees the form as written, `*` and all. What still holds a `*` is no stem or combining form, so a describing word gets a stem only from a rule that says so.
- A form written for the concept takes the place of the grammar's: `kone-` beside `kon=` keeps the rules from making Kono-. Write the forms the rules get wrong, and the variants they cannot know, such as both `ryb=` and `ryba=`.

The lexicon tab shows what the grammar makes of each concept when you point at its field.

A stem written with its final `a`, such as `ryba=`, joins as a name ending in -a does: Rybin, Rybino, Rybinsk. A mark of your own inside a form, such as the `'` in `chert'ov*`, is there for a rule to find: the Ruthenian rules turn it into the short possessive endings of Chertov Most and Chertova Gora.

Spelling that depends on the letters at the join belongs to the rules, not here: write the regular ending and let a `join` rule turn `k+yi` into `kiy`.

### Numbers

The numerals, `two` to `thousand`, stand where a describing word does: Three Towers, Seven Falls. A language that changes a noun beside a number needs a rule for it. Give the numeral a noun class and write rules that make a noun of that class, the first that matches:

```
three:  Three/pl

(?<=[sxz]|ch|sh)$ => es | as pl
$ => s | as pl
```

A noun already of the class stands as it is, so name the class in the grammar: `pl: [^s]s$` lets Seven Falls be. An irregular noun gets a rule of its own before the others: `tooth$ => teeth | as pl`.

A language may have several such classes. Ruthenian has one for a few, in two genders, and one for many: `Tri/few` gives Tri Ozera, `Dve/fewf` gives Dve Gory, `Sem/many` gives Sem Holmov. A numeral with a combining form joins the name instead and needs no rule: `pyati-` gives Pyatigorsk, `semi-` gives Semiluki.

### Patterns and templates

A template lays a pattern out. Slots are `{root}`, `{generic}` and `{modifier}`; anything else is kept as written:

```
modifier-generic:  {modifier}{generic} 4, {modifier} {generic} 5
owner-generic:     {root}{generic} 20, {root}ov* {generic} 2, {root}-{generic}
```

A dash or a space in a template starts a new word. Only a word written with a dash may follow one, so `{root}-{generic}` gives David-Gorodok but never David-Stan.

The `compound` pattern has a third slot, `{settlement}`, after a describing word and a landform: `{modifier}{generic}{settlement}` gives Krasnogorsk, and `{modifier}{generic} {settlement}` gives Deepwood Keep. A template may leave a slot out: `{modifier}{generic}` alone gives Redhill.

Only what the burg is by its group may be left out, never a name or what stands at the place. So `{root}` names a town after its river as it is, Dvina, and `{root}sk` gives Dvinsk, while a bridge on the Dvina still says so: Dvinskiy Most.

Text after a slot is a suffix of the template's own, and a stem may stand before it: `{modifier}{generic}'ye` gives Beloberezhye, with a rule that turns `g+'ye` into `zhye`.

A name is one word or two by which forms the base has. A suffix can only join, so `birch` + `town` is Berezov. A form written as a word, such as `Selo`, can only stand apart, so `red` + `village` is Krasnoye Selo. Where both are possible, the template's weight decides: a template is drawn first, then the forms that fit it.

A weight of 0 turns a pattern off for the base.

### Rules

A rule is a line, `match => replace`, where the match is a regular expression. Flags go after `|`:

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

### Checking the result

The sample names under the tabs are regenerated on a click. The Lexicon tab counts the concepts written. To see whole names, open a burg or state and press _See the name in other name bases_ next to its meaning: it lists the name in every base. To read a whole map in the base, set _Options_ → _Advanced_ → _Names on labels_ to it.
