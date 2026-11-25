Every burg, state, province, river, lake and island gets a name in the language of its culture. This page explains how those names are made, what you can do with them in the interface, and how to create or change the name bases that define each language.

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

Seas, routes, markers and religions have no meanings. They get plain names that only sound like their language.

States, continents and the provinces not named after a burg are named as lands, with suffixes of their own that end no town: Frankland, Frankia. A big state is more often a realm named after a people, a small one or a province a march or a district named for what it is like. An island is named as an island.

### Where a meaning comes from

The generator looks at the place: a river or a coast, a harbour, hills, forest, marsh, ore, cold or heat, how big the burg is, whether it is a capital. It picks words that fit and never words that contradict the place: a harbour only at a port, a mouth only where a river ends, a mine only where there is ore. A good produced at a burg is favoured, so a burg on salt is likelier to be a salt town.

Most burg names end in what the burg is by its group: a city, a town, a village or a hamlet, and a fort, an abbey, a market or a camp for forts, monasteries, trading posts and caravanserais. The rest are named for what stands at the place: a ford, a hill, a wood.

Rivers and lakes are named first, so a burg can be named after them: Exmouth. Capitals are named before other burgs, and states after their capitals.

### Kinds of names

Every name has one of nine shapes, called patterns. The Patterns tab of the Namesbase Editor lists them by these ids:

| Pattern            | A name made of                                  | Meaning       | English     | Ruthenian      | Used for                         |
| ------------------ | ----------------------------------------------- | ------------- | ----------- | -------------- | -------------------------------- |
| `simplex`          | a proper name with no meaning                   | Aldwick       | Aldwick     | Aldvik         | rivers, lakes                    |
| `feature`          | what stands at the place                        | The Ford      | Ford        | Brod           | burgs                            |
| `modifier-generic` | what the place is like, and what it is          | New Town      | Newton      | Novgorod       | burgs, rivers, lakes, islands    |
| `owner-generic`    | a founder, and what the place is                | Eadric's Farm | Eadricworth | Eadrikov Hutor | burgs, lakes, islands            |
| `generic-of`       | what the place is, on a named river             | Mouth of Exe  | Exmouth     | Ust-Ekse       | burgs                            |
| `compound`         | a description of the land, and what the burg is | Red Hill City | Redhill     | Krasnogorsk    | burgs                            |
| `relative`         | another place's name told apart                 | New Barton    | New Barton  | Novyi Barton   | burgs, colony provinces          |
| `root-land`        | a name, and a word for a land                   | Land of Frank | Frankland   | Frankia        | states, provinces, continents    |
| `modifier-land`    | a describing word and a land                    | East Realm    | East Realm  | Vostochnia     | states, provinces, continents    |

A number may stand where a describing word does: Three Towers, Tri Vezhi.

## Names in the interface

- **Name Editor**: names are changed in one dialog. Open it with the pencil beside the name in a burg, river, lake or route editor, or with a click on the name of a state, a province or a feature in its table. The Burg Editor shows the meaning in small print under the name.
  - **Name**: type any name. Hover the field for the speaker, which reads it out loud; the crossed arrows say the same meaning another way.
  - **Meaning**: what the name says, as a pattern and its words, such as _Description + place_: birch, town. Select each word from its list; a founder's or another place's name is typed. _Proper name_ is a name that says nothing. The round arrows coin a new meaning that fits the place, and its name.
  - **Name base**: select a base to see how its people would say the name: Lipsko is Lipzku in German. Press the check mark to take it. New names are generated in the selected base too, so the crossed arrows say the meaning in its own words: a name of "new" and "town" may become Novgorod in Ruthenian.
  - **Full name**, for a state or province, is shown as it is; its pencil stores the name and opens the form dialog.
  - Nothing changes on the map until you press _Apply_.
  - A route, an ocean and a label's text have no meaning: their dialog has no Meaning row.
- **Form and full name** of a state or province are changed by a click on its form. The pencil beside the short name there opens the Name Editor.
- **A name you type is kept.** The name and the meaning are stored apart and neither overwrites the other, so a name may say something other than its meaning. Nothing renames a place behind your back: changing a burg's or state's culture, a culture's name base or a burg's group offers the new name and waits for a yes. A name changed that way is remembered: when the place comes back to its own name base, the name it had is offered, unless you renamed it meanwhile. A name set by the Assistant or uploaded from a CSV file is a proper name and the old meaning is cleared, unless a new one comes with it: ask the Assistant for one or fill in the [Meaning column](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-import#meanings).
- **Cultures editor**: the _Namesbase_ column sets the base of each culture. The arrows beside it re-generate the names of the culture's burgs, as the button of the Burgs overview does for the listed ones. Both skip locked burgs, and give each a new meaning with its name. _Edit a database used for names generation_, at the bottom, opens the Namesbases Overview.
- **Options** → **Advanced** → **Personal names**: founders that places are named after are _Generated_ anew, _Picked_ from the base's lists as they are, or _As the name base sets_.

## Name bases

A name base is one language. 67 are built in: 51 real-world languages, a generic human base and 15 fantasy ones. Every culture uses one, and several cultures may share one.

The built-in bases come with the app and get better with its updates. The bases you add or edit are saved with the map, and new maps start with them too. Opening another map brings its own.

Change a built-in base only with a good reason: your version stays as it is and gets no updates. It is nearly always better to edit a copy and give it to the cultures you want.

### Namesbases Overview

Open _Tools_ → _Namesbase_, press `Shift + N`, or open it from the Cultures editor. The table lists every base, whether it is built-in, edited or custom, and the cultures that use it. Search finds a base by its name or culture.

Click a base's name or its pencil to edit it. The bin removes a base of yours that no culture uses and no other base extends; a built-in base cannot be removed. The buttons at the bottom add a base, download all bases, upload bases and restore the built-in ones, which drops your own and edited bases. A culture that used a dropped base takes German.

### The Namesbase Editor

The editor shows one base. A built-in base opens locked: _Edit a copy_ makes a base of your own from it, _Edit anyway_ unlocks it. At the top, rename it and choose a base it **extends**: that base's lexicon, patterns and people stand in where this one has none. The **description** says where the base's data comes from and the idea behind it.

On the right are **Examples**, names the base makes: burgs and lands with their meanings, waters, people and names without meaning. They stay the same while you edit, so you see at once what a change does to them. The arrows beside the heading show others.

Each tab is one part of the base:

- **Names**: four lists of names, commas between. Beside each is how many it holds and the shortest and longest names to aim for; grey numbers are the default.
  - **Places**: real place names. New names are generated to sound like these. A few hundred names give good results. With _Picked_, burgs take these names as they are, with no meaning: each is used once, and when all are taken, new names are generated to sound like them.
  - **Rivers and lakes**: waters are named like these, and like places when the list is empty.
  - **Male** and **female names**: places are named after founders, such as Eadric's Farm. Keep both lists full: how many founders are women is set on the Patterns tab, not by the lists' sizes.
  - Each list is either _Generated_, new names like the listed ones, or _Picked_, the listed names as they are.
- **Lexicon**: how the base says each concept: `town`, `ford`, `new`, `black` and so on, with an example name of each. A concept left empty takes an inherited or a generated form, shown in grey. Search by a concept or a form, or show only the concepts of a kind, written or not written.
- **Patterns**: how often the base coins each kind of name, and how the parts are laid out, with an example of each. Below are the length of names to aim for and the shares of names that end in the burg's group and of founders who are women.
- **Rules**: sound changes that make joined parts read naturally and bring foreign names into the language, and the grammar: noun classes, the endings that agree with them, and the rules that make a word's other forms. **Doubled letters** lists the letters that may stand twice in a row, as in Kalla.

The buttons at the bottom analyze the place names (how many there are, how varied, how long, which endings they share), duplicate the base, download it, and restore a built-in base you have changed.

### Making a new base

A base needs only its place names to work:

1. Press _Add_ in the Namesbases Overview. A new base opens with a short example list.
2. Name it, and replace the example list of places on the Names tab with real place names of the language, commas between. A few hundred is good, a hundred the least.
3. Set the lengths beside the list to the range of the names you listed. Fill **Doubled letters** on the Rules tab if the language doubles letters.
4. Press _Analyze_ to check the list: too few names, odd characters and duplicates show there.
5. Add male and female names, so founders sound native too.
6. In the Cultures editor, pick the base for a culture and press the arrows to rename its burgs.

The names now sound like the language but mean nothing in it, as a built-in base does only for the few concepts it has no word for. To make them mean what they say, write the base's words: see the next section.

To make a variant of a base that is already written, copy it and change the copy. For a dialect that follows its parent, add a base and set **Extends** to the parent. It takes its parent's words, patterns and people until you write your own, and its own place names give it its sound.

### Sharing a base

Download one base from its editor, or all bases from the overview, as `.json` to share or back them up; the same file uploads back. Upload asks whether to add the bases of the file or to replace all your custom and edited ones with them. Built-in bases in the file that are as they ship are left out.

## Teaching a base its words

A meaning is made of **concepts**: a fixed vocabulary such as `town`, `ford`, `new`, `black`, `birch` and `king`, each with its English word as its id. A base says each concept with **forms**, written on the Lexicon tab. Its **templates**, on the Patterns tab, put the forms in order. Its **rules**, on the Rules tab, smooth the joins.

### Writing a lexicon

Each line of the Lexicon tab gives one concept its forms, commas between:

```
town:   +ton 6, +ham 3, town
fort:   +bury 4, +borough~burgh 2, +chester 2, Keep
old:    old 2, ald+
king:   kings+ 4, King, King's 3
```

A form is a piece that names are built of, spelled as it is inside a name. Marks around it say what kind of piece it is and how often it is taken.

#### Pieces and how they join

A name is one word or a few, and each word is either one form standing alone or two forms joined. There are two ways to join:

- **Compound**: a start and an end that are both real word parts: Ald + bury, Novo + grad.
- **Suffix**: a stem and a suffix: Berez + ov, Ivan + sk. A suffix is no word on its own, and a stem is the shape a word takes before one.

The mark stands on the side where the other piece joins: `+` for a compound, `^` for a suffix. A whole word has a capital first letter, or `!` before it in a script with no capitals, such as Arabic or Chinese. A dash is no mark: it is spelled in the name.

| Written           | Piece                                  | Joins                    | Example               |
| ----------------- | -------------------------------------- | ------------------------ | --------------------- |
| `Keep` or `!keep` | a whole word                           | nothing, stands apart    | Deepwood Keep         |
| `-Gorodok`        | a whole word that may follow a dash    | apart, or a name and `-` | David-Gorodok         |
| `ald+`            | the start of a compound                | an end                   | Ald + bury: Aldbury   |
| `+ton`            | the end of a compound                  | a start                  | New + ton: Newton     |
| `ust-+`           | the start of a compound, with its dash | an end or a name         | Ust- + Ekse: Ust-Ekse |
| `berez^`          | a stem                                 | a suffix                 | Berez + ov: Berezov   |
| `^sk`             | a suffix                               | a stem or a proper name  | Ivan + sk: Ivansk     |
| `wood`            | any of whole word, start or end        | as the template needs    | Deepwood, Deep Wood   |

The pieces must match: a stem needs a suffix after it and a suffix a stem before it; a start needs an end and an end a start. So `berez^` + `+grad` and `ald+` + `^sk` never happen. A form with marks on both sides, such as `+ton+`, is not read.

`-Gorodok` is a word, not the end of a compound: it stands apart, and only a template with a dash, `{root}-{generic}`, puts it after a name. An end would join any start, Novo + gorodok, which is why there is no `+-gorodok`.

A proper name, such as a founder's or a river's, joins like a stem: Ivansk, Davidov. Where the concept has suffixes, the name takes only those, and its whole words stand apart: Ivan-Gorod. Where the concept has none, the name joins its ends: Eadric + ton is Eadricton.

The template decides how many words a name has: `{modifier}{generic}` asks for one word of two pieces, `{modifier} {generic}` for two words (see [Patterns and templates](#patterns-and-templates)). Of the forms that fit, one is drawn by weight.

A whole line read through:

```
city:  ^sk 4, ^ovsk, +grad 2, -Gorod
```

A city is mostly a suffix, `-sk`, now and then `-ovsk`: Ivansk, Berezovsk. It is also the end of a compound, Novograd, and a whole word that may follow a dash: Novyi Gorod, Ivan-Gorod.

#### After the form

Three things may follow a form, all optional and in this order:

- `~burgh`: a shorter spelling, taken when the name runs too long. `+borough~burgh` is spelled -burgh in a name that would run too long.
- `/f`: the noun class, for languages whose words agree; see [Grammar](#grammar).
- `6`: the weight, a whole number after a space: how often the form is taken against the others of the concept, 1 when left out. `+ton 6, +ham 3` makes -ton twice as common as -ham.

A form may hold an apostrophe, `King's` for King's Landing, and a dash anywhere but first, `ust-+`. It may not hold `+ ^ ! _ / ~ @ :` or a comma. `*` and a bare `/n` belong to the grammar: `nov*` is a word that agrees with its noun, `/n` a noun left unsaid.

Use the forms real place names of the language are built of, in the spelling they have inside a name, not dictionary words: English towns end in -ton far more often than in -town.

### Settlements

The first four concepts, `city`, `town`, `village` and `hamlet`, are the most important. Every burg belongs to a group, and most burg names are one stem with the ending of the burg's group: a founder, a tree or a river, plus what the burg is. So these four set the sound of the whole map. Forts, monasteries, trading posts and caravanserais take `fort`, `abbey`, `market` and `camp`.

```
city:     ^sk 6, ^ovsk 2, +grad 2, Gorod
town:     ^ov 8, -Gorodok
village:  ^ovo 6, ^ovka 4, ^ichi 2, Selo
hamlet:   ^ka 5, ^ki 4, Hutor
```

Every concept a burg may be named for needs a stem, such as `berez^` for `birch`, or it never takes the suffixes; a grammar can make the stems (see below). A founder needs none: Davidov, Davidovsk and Davidovo are the rule, David-Gorodok and Davidov Gorodok the exception.

Keep the suffixes heavy and the full words light, or every other town is a Gorodok. A wider set of endings keeps a large map from repeating itself.

On the Patterns tab, **Names ending in the burg's group** sets how many burg names are built this way. The rest are named for what stands at the place: a ford, a hill, a wood. **Founders who are women** sets how often a burg named after a founder takes a woman's name; left empty, the two lists of people decide by their sizes.

### Grammar

Languages where words agree and change need a grammar, on the Rules tab, a line each.

#### Noun classes

First the classes of their nouns, `class: pattern`:

```
f: a$
n: [oe]$
pl: [iy]$
m:
```

A noun falls into the first class whose pattern it matches; the last line, with no pattern, takes the rest. Proper names are classed the same way. A noun the patterns get wrong is told its class after a `/`, and only such a noun:

```
hand:  Desnitsa, Ruka, Dlan/f
```

All three are feminine. Desnitsa and Ruka end in -a, so `f: a$` finds them; Dlan ends in a consonant and would fall to `m`, so it is marked. A class written on every noun hides the few that need it.

#### Describing words

Then the endings a describing word takes beside a noun of each class, `*: class ending, …`. Where the language has several kinds of describing word, each kind gets a set of its own, `*name: …`, under a name of your choosing. Ruthenian has five, after the kinds of the Russian adjective:

| Set      | For                                        | m, f, n, pl            | Example                     |
| -------- | ------------------------------------------ | ---------------------- | --------------------------- |
| `*`      | most words                                 | -yi, -aya, -oye, -ye   | Novyi Gorod, Novaya Sloboda |
| `*soft`  | a soft stem, mostly in -n                  | -iy, -yaya, -eye, -iye | Verhniy Brod, Sinyaya Gora  |
| `*hush`  | a stem in zh, ch, sh or sch                | -iy, -aya, -eye, -iye  | Plakuchiy, Plakuchaya       |
| `*firm`  | a word stressed on its ending              | -oy, -aya, -oye, -ye   | Krivoy, Krutaya, Pustoye    |
| `*owner` | a possessive of a stem in no hushing sound | -iy, -ya, -ye, -yi     | Lisiy, Lisya, Lisye         |

```
*: m yi, f aya, n oye, pl ye
*soft: m iy, f yaya, n eye, pl iye
```

A named set is spelled as it stands; the default endings go through the join rules, so `velik+yi` can become Velikiy. That is why Ruthenian needs `*hush`: after zh, ch and sh its join rules turn the default endings into the possessive ones, `volch*` into Volchiy, Volchya, Volchye, and a word such as `plakuch*hush` is no possessive.

- `nov*` is a describing word: `*` becomes the ending of the noun beside it. Novyi Gorod, Novaya Sloboda, Novoye Selo.
- `verhn*soft` takes its endings from the set named `soft`: Verhniy Brod, Verhnyaya Gora.
- `Verhniy/m, Verhnyaya/f` spells a word out for each class instead, where no set fits.
- `/n`, a class with no form before it, is a noun left unsaid. It stands in for the noun of its concept, and the describing word beside it becomes the whole name, with the ending of that class: with `village: …, /n` and `red: krasn*`, a red village is Krasnoye, "the red [village]"; with `river: …, /f`, a red river is Krasnaya. It is taken only beside a describing word, so a name never comes out empty.
- `*` works in a template as well: `{root}ov* {generic}` gives Borisov Brod and Olgina Gora. `ov` is the possessive suffix most names take; after a name in -a, the join rule `(?<=[^aeiou])y?a\+ov => +in` makes it -in, and `*` takes the ending of Gora: Olga + ov + aya is Olgina.

#### Stems and combining forms

Last, the rules that make a concept's other forms of the ones written, `stem: match => replace` and `first: match => replace`. The first rule of its kind that matches makes the form:

```
stem: (?:ey|ye|ya|[aoeyi])?$ =>
first: \*soft$ => e
first: \*$ => o
first: (?:ey|ye|ya|[aoeyi])?$ => o
```

- A place and a modifier get a stem of each of their words: `Most` makes `most^`, `Zaimka` makes `zaimk^`.
- A modifier gets a combining form of each of its stems, or of its words where it has none: `volk^` makes `volko+`, `nov*` makes `novo+`, `verhn*soft` makes `verhne+`.
- A rule sees the form without the marks of where it stands, but with its `*`. What still holds a `*` is no stem or combining form, so a describing word gets a stem only from a rule that says so.
- A form written for the concept takes the place of the grammar's: `kone+` beside `kon^` keeps the rules from making Kono-. Write the forms the rules get wrong, and the variants they cannot know, such as both `ryb^` and `ryba^`.

The lexicon tab shows what the grammar makes of each concept when you point at its field.

A stem written with its final `a`, such as `ryba^`, joins as a name ending in -a does: Rybin, Rybino, Rybinsk. A mark of your own inside a form, such as the `'` in `chert'ov*`, is there for a rule to find: the Ruthenian rules turn it into the short possessive endings of Chertov Most and Chertova Gora.

Spelling that depends on the letters at the join belongs to the rules, not here: write the regular ending and let a `join` rule turn `k+yi` into `kiy`. In the rules `+` marks every join, of a compound and of a suffix alike.

### Numbers

The numerals, `two` to `thousand`, stand where a describing word does: Three Towers, Seven Falls. A language that changes a noun beside a number needs a rule for it. Give the numeral a noun class and write rules that make a noun of that class, the first that matches:

```
three:  Three/pl

(?<=[sxz]|ch|sh)$ => es | as pl
$ => s | as pl
```

A noun already of the class stands as it is, so name the class in the grammar: `pl: [^s]s$` lets Seven Falls be. An irregular noun gets a rule of its own before the others: `tooth$ => teeth | as pl`.

A language may have several such classes. Ruthenian has one for a few, in two genders, and one for many: `Tri/few` gives Tri Ozera, `Dve/fewf` gives Dve Gory, `Sem/many` gives Sem Holmov. A numeral with a combining form joins the name instead and needs no rule: `pyati+` gives Pyatigorsk, `semi+` gives Semiluki.

### Patterns and templates

A template lays a pattern out. Slots are `{root}`, `{generic}` and `{modifier}`; anything else is kept as written:

```
modifier-generic:  {modifier}{generic} 4, {modifier} {generic} 5
owner-generic:     {root}{generic} 20, {root}ov* {generic} 2, {root}-{generic}
```

A dash or a space in a template starts a new word. Only a word written with a dash may follow one, so `{root}-{generic}` gives David-Gorodok but never David-Stan.

Every word of a name starts with a capital but the joining words between two others: of, the, de, del, della, di, da, do, du, des, la, le, les, sur, sous, en, am, der, ad, the Persian ezafe e and ye, the Swahili wa, ya and cha, the Hindustani ka and ki, and a few more. So `{generic}-sur-{root}` gives Pont-sur-Moselle and `{generic} de {root}` gives Puebla de Sanabria. After d', l', n' or dell' the next letter is a capital, as in Tizi n'Test: a rule that writes `di` as `d'` before a vowel gives Castel d'Ofanto.

The `compound` pattern has a third slot, `{settlement}`, after a describing word and a landform: `{modifier}{generic}{settlement}` gives Krasnogorsk, and `{modifier}{generic} {settlement}` gives Deepwood Keep. A template may leave a slot out: `{modifier}{generic}` alone gives Redhill.

Only what the burg is by its group, or a land, may be left out, never a name or what stands at the place. So `{root}` names a town after its river as it is, Dvina, and `{root}sk` gives Dvinsk, while a bridge on the Dvina still says so: Dvinskiy Most. In `root-land`, `{root}ien` gives Frankien and keeps -ien to names.

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
- `foreign`: applies to names borrowed from another base, before they are bent to the sounds of the place names
- `50%`: applies to that share of names, always the same ones

The **Try a name** box on the tab shows what the rules make of a name.

### Checking the result

The examples beside the tabs and on the Lexicon and Patterns tabs show an edit at once. The Lexicon tab counts the concepts written. To see whole names, open the Name Editor of a burg or state and select the base in _Name base_: it shows the name in that base.
