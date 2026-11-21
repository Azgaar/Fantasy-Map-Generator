# PRD — Events: Wars and Battles in the Map's History

## Problem Statement

A map has a past, but the data does not hold it in a form anything can use.

**Wars** are kept as `campaigns` on each state, and the lists do not agree with each other:

- A past war is stored only on the state that rolled it. The state named as its defender has no such war in its own list.
- An ongoing war is the same object pushed to the attacker and the defender. After a save and a load it is two separate copies.
- Allies and vassals who join a war are not in it. They appear only in the Relations history text and as `Enemy` relations.
- A war never ends. Signing peace writes "War termination" to the Relations history and leaves the campaign ongoing.
- Regenerating relations declares new wars on top of the old ongoing ones.
- The Relations history is free text kept in the neutral state's `diplomacy` field, with no dates and no link to the states it names.
- Start years are cut off at year 1, so on a map with a low current year the past wars pile up there; a negative current year breaks the range.

**Battles** leave no data at all. When a played battle is applied, the regiments lose their troops, a paragraph of English prose is appended to each regiment's note, and a marker gets a prose legend. Who won, at what cost, in which year and in which war exists only inside that text. Nothing can list the battles of a map, of a war or of a regiment, and the year written into the prose goes stale when the user sets another current year. The battle cannot be watched again or exported once its screen is closed.

## Solution

The map gets one list of dated **events**, `pack.events`. Wars, alliances, vassalages, battles and custom events written by hand are kinds of event. An event says what happened, when, to whom and, where it applies, where on the map. Battles point at the war they belong to.

For the user:

- **Wars are whole.** A war has one record with every state on each side, a start and, once peace is signed, an end. Both sides see the same war.
- **Alliances and vassalages are kept the same way.** Like a war, each has a start and, once the relation changes, an end.
- **Trying relations out leaves no litter.** Setting a relation, changing it and setting it again reopens the same event; a war, alliance or vassalage begun and dropped in the same sitting leaves nothing behind.
- **Battles are kept.** Applying a battle writes a battle event: the day and the time it was fought, the place, the states on each side and the result. A battle of states that are not at war begins a war of its own to be part of. Everything else about the battle is in its replay, the recipe it can be played again from. No marker is put on the map: battles are found in the Chronicle.
- **Every event has a note.** Any event can carry free text, written and formatted in the Notes Editor, opened from the event's record.
- **The Chronicle.** A new dialog lists every event in order of time, searched by name or tag and filtered by state. A row's buttons replay a played battle in the Battle Simulator, open the event's note, and open the event in the Chronicle Record Editor, where its type, its dates, its sides and its tags are edited. From the editor the user also opens a battle's summary or focuses its place on the map. It replaces the Relations history, whose old text is kept as one custom event.
- **Four political acts write themselves down.** A province declaring independence, states merged into one, a province passing to another state and a capital moved each leave an event.
- **The user writes history too.** In the Chronicle the user adds an event of their own, says in its record whether it is a war, a battle, an alliance, a vassalage or a plain event, and edits any event, generated ones included.
- **Tags.** Any event can carry the user's own tags, as other things on the map do, and the Chronicle's search finds them. Tags are what the user sorts and searches by, and they are optional. The type of an event, which decides its fields, is set in its record.
- **A small past to start from.** A new map gets a sample of history, not a full one: about fifteen past wars for 25 states, the wars going on and the vassalages. No battles are made up: a map's battles are those the user plays or writes. It is there so the Chronicle is not empty and shows what an event looks like; the rest is the user's to write.
- **A regiment has a history.** The regiment editor lists the battles the regiment fought.
- **Dates stay right.** Text about an event is written from the event when shown, so it follows the current year, the names and the language.
- **Dates can be exact.** The generator dates an event by its year. The user can then give any event a day and a time, so a war can be shown to have lasted 40 days, and two wars can fall in one year.
- **A battle can be watched again** and exported after it was applied, from its replay.

Events hold their dates as date-time text, as exact as was given: a year alone, or down to the minute. Setting the current year by hand moves every event by the same number of years, as campaigns move today. Years before the era are negative.

## User Stories

### Wars

1. As a map author, I want a war to be one record that both sides share, so that the two states never tell different stories.
2. As a map author, I want a war to list every state that fights on each side, so that I can see who its allies and vassals are.
3. As a map author, I want a war to end when its leaders sign peace, so that "ongoing" means the states are at war now.
4. As a map author, I want a war to begin when I set two states to `Enemy` by hand, so that painted relations and the list of wars agree.
5. As a map author, I want regenerating relations not to pile new wars on old ones, so that the list of wars stays true.
6. As a map author, I want past wars spread over the years before the present, including years before the era, so that a young calendar does not put half its history in year 1.
7. As a map author, I want wars that have battles I played to survive a regeneration of states or relations, so that my work is not thrown away.
8. As a map author, I want a saved and loaded map to have exactly the wars it was saved with.
9. As a map author, I want an old map's campaigns to become wars on load, with the duplicated ongoing ones merged, so that nothing is lost in the update.

10. As a map author, I want a new map to start with a short history, about fifteen past wars for 25 states, so that the Chronicle is an example to build on and not a log to clean up.
11. As a map author, I want one past war for two neighbouring states, not one from each side, so that their histories agree.
12. As a map author, I want a past war named so that both of its sides can read it as theirs.
13. As a map author, I want the generator to write wars alone and make up no battles, so that every battle in the Chronicle is one I played or wrote.
14. As a map author, I want a battle I wrote by hand told apart from the ones I played: no summary and no replay.
15. As a map author, I want the same seed to give the same map as before, apart from its wars.

### Alliances, vassalages and relations set by hand

16. As a map author, I want an alliance I make by hand to be an event with the date it began, and the alliances the generator rolls to add nothing to the Chronicle.
17. As a map author, I want every vassalage to be an event with its suzerain, its vassal and the year it began.
18. As a map author, I want an alliance or a vassalage to get an end when the relation changes, so that the history shows it is over.
19. As a map author, I want to change a relation back and forth as a trial without filling the history with events that never happened.
20. As a map author, I want a relation I restore right away to reopen the event it had, so that the event keeps its start, its name, its note and its battles.
21. As a map author, I want a war, alliance or vassalage I began and dropped right away, with nothing of mine in it, to disappear.
22. As a map author, I want the events left by any series of relation changes to be the same as if I had set the final relations at once.
23. As a map author, I want an event that began and ended in the same year, with no days given, shown as lasting under a year, not as zero years.
24. As a map author, I want an old map to get events for the wars and vassalages its relations already hold.

### Political acts

25. As a map author, I want a province I make independent to leave an event naming it and the state it left.
26. As a map author, I want a merge of states to leave an event naming who took whom.
27. As a map author, I want a province I give to another state to leave an event naming both states.
28. As a map author, I want a capital I move to leave an event naming the state and its new capital.
29. As a map author, I want these events to keep the names as they were, so that they still read right after a state is gone or renamed.
30. As a map author, I want doing the same act again right away to correct the event, not to add another.
31. As a map author, I want no event when the app itself moves a capital, as when the old one falls off a resampled map.
32. As a user of the assistant or of scripts, I want these acts logged the same when they are done for me.

### Battles

33. As a map author, I want an applied battle to be kept as data, so that the map remembers it.
34. As a map author, I want a battle to record the year, the place, the states on each side and the result.
35. As a map author, I want the regiments, the troops, the losses and the course of a battle kept with it as its replay, so that the details can be shown without being stored twice.
36. As a map author, I want a battle between states at war to be part of that war without my saying so.
37. As a map author, I want to move a battle to another war, or to none, when the guess was wrong.
38. As a map author, I want a battle between states that are not at war to begin a war of their own and be part of it, so that no battle I played hangs loose in the list.
39. As a map author, I want to open the summary of a past battle, the same summary I saw when it ended.

### No marker

40. As a map author, I want an applied battle to add no marker, so that the map is not filled with pins I did not place.
41. As a map author, I want to focus the map on the place of a battle from the Chronicle and see the spot marked for a moment, so that I can find it without a pin.
42. As a map author, I want the battlefield markers my old maps already have left as they are.

### Regiments

43. As a map author, I want a regiment's editor to list the battles it fought, with the year and the result.
44. As a map author, I want a regiment's battles to stay with it when its state is merged into another.
45. As a map author, I want the regiment's note to stay mine: no battle text appended to it.

### The Chronicle

46. As a map author, I want one dialog with everything that happened, in order of time.
47. As a map author, I want to search the Chronicle by tag with `#tag`, as in other overviews, so that I can see only wars, or only battles, or only what I tagged myself.
48. As a map author, I want to filter the Chronicle by state, so that I can read one state's history.
49. As a map author, I want to search the Chronicle by name.
50. As a map author, I want an event that has parts, such as a war with its battles, to open in the list and show them as rows under it, so that the list stays short and the parts stay together.
51. As a map author, I want to open or close all such events at once.
52. As a map author, I want a search or a filter to find a battle inside a closed war and show it under that war.
53. As a map author, I want to make any event part of another, so that I can group my own events as wars group their battles.
54. As a map author, I want to open an event from its row and see all of it in an editor of its own, so that the list stays a plain table.
55. As a map author, I want to write a note on any event.
56. As a map author, I want to format a note with headings, lists, links, images and tables, as in the Notes Editor.
57. As a map author, I want what I type saved as I type, as in the Notes Editor.
58. As a map author, I want to edit an event's name, its dates, its tags and its sides in one editor with a field for each.
59. As a map author, I want to leave an event's end empty to say it is still going on.
60. As a map author, I want to write an event of my own with a date and a text, so that the history is not limited to warfare.
61. As a map author, I want to remove an event, and to be asked first.
62. As a map author, I want removing an event that has parts to remove its parts too, and the question to say how many will go and whether battles I played are among them.
63. As a map author, I want to tag any event with words of my own, so that I can sort my history my way.
64. As a map author, I want to type tags as free text, comma-separated, as in the other editors.
65. As a map author, I want every war, battle, alliance and vassalage to come tagged with what it is, and a battle also with its type, such as siege, so that tags alone are enough to sort the list. A war is tagged `war` and nothing more: its sort is already in its name.
66. As a map author, I want to change or remove those tags like my own, and to leave an event with no tags at all.
67. As a map author, I want to add a war of the past with its sides and dates, so that I can write history the generator did not.
68. As a map author, I want to add a battle with a place I pick on the map, its sides and its winner, so that I can record a battle I did not play.
69. As a map author, I want to add an alliance or a vassalage of the past with its states and dates.
70. As a map author, I want to add a plain event when it is none of these.
71. As a map author, I want to add an event with one button and choose its type in its record, the fields changing with it, so that I can also put right a type I chose wrongly.
72. As a map author, I want to change the sides of a war, also of a generated one, so that I can put right who fought.
73. As a map author, I want nothing I wrote or changed to be removed by a regeneration or by a change of relations.
74. As a map author, I want to say which states an event of my own concerns, so that it shows under those states' histories.
75. As a map author, I want the Chronicle to stay quick with thousands of events.
76. As a map author, I want to focus the map on an event that has a place.
77. As a map author, I want to open a battle's summary from its event, and to watch a played battle again and open any event's note straight from its row.
78. As a map author, I want to see an event's note in the Notes Editor too, listed with the notes of other things.
79. As a map author, I want to download the Chronicle as a table, notes included.
80. As a map author, I want the text of my old Relations history kept when the map is updated, as one event I can read, edit or split up.
81. As a map author, I want the Diplomacy overview's history button to open the Chronicle.
82. As a map author, I want to find the Chronicle from the tools menu and from the omnibar.

### Dates

83. As a map author, I want setting the current year to move the whole history with it, so that a war that ended thirty years ago still did.
84. As a map author, I want a year before the era shown as such, "45 before Winter Era" or "45 BWE" for short, not as a negative number.
85. As a map author, I want to give a past event a month, a day and a time, so that my history is as exact as I know it.
86. As a map author, I want an event dated only by its year shown with the year alone, so that the map does not pretend to know a day nobody set.
87. As a map author, I want the length of an event I dated to the day given in days, months or years.
88. As a map author, I want two wars between the same states in one year, once I have dated the first one's end.
89. As a map author, I want events of the same year in the order of their days.
90. As a user of the JSON export, I want event dates in one plain text form that is easy to read and to parse.
91. As a map author, I want changing an event's year to put it in its right place in the list.

### Watching again

92. As a map author, I want to watch a past battle again from its start.
93. As a map author, I want to export a past battle as an animation or a report long after it was fought.
94. As a map author, I want to be told when a battle no longer plays out as it was recorded, because the ground, the units or the rules changed, and I want the record to stand.
95. As a map author, I want watching a battle again to change nothing on the map.

### Tools

96. As a script author, I want events on the scripting surface, so that I can read and add them from the console.
97. As a user of the assistant, I want it to know the wars and battles of my map.
98. As a user of the JSON export, I want the events in it.

## Implementation Decisions

### The event

`pack.events` is map state: a regeneration of the map wipes it, and it is saved with the map. The list is kept in order of time. `i` is the event's id, the highest id plus one, and not its place in the list, as with markers.

Every event has the base fields; each kind adds its own.

```ts
interface EventBase {
  i: number;
  type: string;
  name: string;
  start: string; // when it happened or began: "120", "120-03-14" or "120-03-14T10:00"
  end?: string; // when it ended, in the same form; none: still going on
  parent?: number; // the event it is part of: a battle's war
  note?: string; // free text of the user's, HTML, as other notes; every kind has it
  tags?: string[]; // the user's own labels, as on other entities
  auto?: true; // made by the app and not touched by the user since
}

interface War extends EventBase {
  type: "war";
  attackers: number[]; // state ids, the first led it
  defenders: number[]; // empty for a vanished foe
}

interface Alliance extends EventBase {
  type: "alliance";
  states: [number, number];
}

interface Vassalage extends EventBase {
  type: "vassalage";
  suzerain: number;
  vassal: number;
}

interface Battle extends EventBase {
  type: "battle";
  cell: number;
  x: number;
  y: number;
  attackers: number[]; // state ids, the first led the side
  defenders: number[];
  winner: Side | null; // null: no victor
  status: [string, string]; // as the attackers and the defenders see it; from the winner alone for a battle written by hand
  replay?: BattleReplay;
  regiments?: { state: number; i: number }[]; // the regiments that fought, as they are now
}

interface Custom extends EventBase {
  type: "custom"; // written by hand
  act?: string; // a political act and its subject, such as "cession:12", while the app's: done again, the act rewrites it
  states?: number[]; // the states it concerns, for the state filter
}

type MapEvent = War | Alliance | Vassalage | Battle | Custom;
```

Any event may last, so `end` is a base field. An event with no `end` is still going on; an event that happened at one time has an `end` equal to its `start`. An applied battle gets the time it began at as its start and the time it was applied at as its end, on a day of the current year. A custom event gets both too unless the user leaves it open.

A battle event holds only what matters to the history. The place is its cell: the burg, the river or the province is read from the map when shown. The battle type, the regiments, their troops and losses, the tactics and the course of the battle are not event fields: they are in the replay or come out of playing it.

### Kinds and tags

The kinds of event are a closed list, and a short one on purpose. A kind exists only where the app treats an event differently: it has fields of its own or rules of its own.

| Kind | Why it is a kind |
| --- | --- |
| War, alliance, vassalage | Sides, and they follow the relations of the states |
| Battle | A place, a result and a replay |
| Custom | Everything else: no rules of its own |

**The kind is the Type field of the record.** It is the `type` field in the data and decides which fields the Chronicle Record Editor shows for an event (sides, a place, a result, a Summary button) and which rules apply to it. A new event is a plain one; the user sets its type in its record, and the fields follow at once. The list shows it as a column and filters by it; tags sort what the type does not tell apart.

- **A change of type keeps what every kind has**: the name, the dates, the parent, the note, and the tags but for the tag of the old kind, which gives way to the new one's. The states are carried over: the first to the attackers, the suzerain or the first ally, the others to the other side.
- **A battle needs its place**: on a change to a battle the user clicks its place on the map, and it is a battle once it has one.
- **Some events keep their type**: a played battle, whose replay is a battle, and a war, an alliance or a vassalage that is going on, which follows a relation. A change to one of those three needs an end, as one set by hand is over.

**Tags are the classification the user works with**, and they are optional. What users will want to add (a coronation, a plague, a founding, a treaty, a schism, an earthquake) differs from any other custom event only in what it is called, so nobody has to foresee these: they are tags.

- **Tags are the map's existing tags**: `tags` on the event, handled by the `Tags` model like those of burgs, markers and regiments. Lower case, free text, any number, or none.
- **The app tags what it makes**, so that tags alone sort the list:

  | Event | Tags it gets |
  | --- | --- |
  | A war | `war`. The sort a generated war rolled (conquest, rebellion, crusade and so on) is in its name and is not repeated as a tag |
  | A battle | `battle`, and its type unless it is a plain field battle: `siege`, `naval`, `ambush`, `landing`, `bombardment`, `air` |
  | An alliance | `alliance` |
  | A vassalage | `vassalage` |
  | A plain event | none |

  This holds however the event came to be: generated, begun by relations set by hand, played, or added by hand in the Chronicle. With its type as a tag, a battle's type is known without its replay.
- **The tags the app writes are English words**, as the names it generates are ("Siege of Ashford"), whatever the user's language. A map then reads the same for everyone it is shared with.
- **These tags are the user's to change.** They can be removed or replaced like any other. The app does not put them back, and never reads them: it goes by the kind.
- **No suggestions.** The tags input is plain free text, as in the other editors.
- A tag the app wrote does not make an event the user's; a tag the user changes does (see [Whose an event is](#whose-an-event-is)).

A new kind later is one more member of the union, added when an event needs fields or rules of its own. Nothing more general is built now: no free-form payload and no effects.

### Rules every event keeps

- **An event records what happened; it never holds the present state.** Relations stay on the states, troops on the regiments, borders on the cells.
- **An event refers to states by id.** What must read as it was at the time, the regiments of a battle with their names and troops, is in the battle's replay.
- **One writer.** Only the `Events` model adds, changes and removes events.

### Dates

`start` and `end` are date-times as text, in the shape of ISO 8601 but with the year as a plain number, and with as many parts as are known:

| Stored | Means | Shown as |
| --- | --- | --- |
| `120` | some time in the year 120 | 120 WE |
| `120-03` | March 120 | March 120 WE |
| `120-03-14` | 14 March 120 | 14 March 120 WE |
| `120-03-14T10:00` | 14 March 120, 10:00 | 14 March 120 WE, 10:00 |
| `-45` | some time in the year 45 before the era | 45 BWE |
| `10123-03-14` | 14 March 10123 | 14 March 10123 WE |

- **The year is a plain whole number**, of any length, negative before the era, with no padding: `34`, `-14`, `10123`. The month, day, hour and minute have two digits each. This is not strict ISO 8601, which asks for four digits or a signed six, and the browser's `Date` misreads short and negative years in either form. Nothing in the app depends on it: only the dates module reads this text.
- **A year before the era is worded, not signed.** It is stored as a negative number and shown by the era: "45 before Winter Era" in full, "45 BWE" for short. Tables show the short form, with the full one as a tooltip, and sort dates as numbers.
- **Missing parts count as the first.** For order and for lengths, a date with no month, day or time stands at 1 January, 00:00 of its year. It is shown only as exact as it was given, so a year alone never reads as a day nobody set.
- **The calendar is the common one for now**: twelve months of their usual lengths, no leap day, 24 hours. Month names come from the user's language. A calendar of the map's own, with its months and their lengths, is a later feature; the stored form already carries what it will need.
- **The generator dates by the year.** A generated event gets the current year minus an age found at generation, as a year alone. Years are not cut off at 1.
- **The user sets the rest.** Any event's start and end can be edited to a month, a day and a time in the Chronicle.
- **The present is the current year**, as a year alone: the map has no current day yet. A relation set by hand begins or ends its event at it. An applied battle is dated finer, to a day of that year (see [Battles](#battles)).
- **Generation never starts a war, an alliance or a vassalage in the current year**: its age is a year at least.
- **Setting the current year by hand** shifts the year of every `start` and `end` by the same amount and leaves the month, day and time. This is the only tie between an event and the current year after it is written.
- **Order**: by `start`; events with the same start keep the order they were added in.
- **A start and an end are compared only as exactly as the less exact of the two.** A war begun on `120-03-01` and ended by hand in `120` did not end before it began: at the exactness of the year the two are equal. An `end` earlier than its `start`, compared so, is refused.
- **Lengths**: when both dates have a day, the length is given in days, months or years, and under a day in hours or minutes when both have a time. Otherwise it is given in years, and "under a year" when the years are the same, never zero.

### Dates module (new)

A small module of pure functions, the only code that reads or writes the date text: read a date into its parts and write it back, compare two dates, give the year, shift by years, give the length between two dates, and word a date or a length for the user. It never puts an event's year into the browser's `Date`, which misreads years below 100 and words years before the era its own way. Month names may still come from the browser's own wording of a fixed, ordinary year.

### `Events` model (new)

A singleton in the story part of the model, the whole interface to `pack.events`:

- add an event and get its id; the event is placed by its start, after others of the same date;
- get by id; list through one query, every condition given met: by kind, state, parent, regiment (the battles it fought) and whether it is going on; a query by kind is typed as that kind; the parts of an event, to any depth;
- update an event; a changed start moves it in the list; a parent that is the event itself or one of its own parts is refused;
- remove an event: its parts are removed with it, to any depth;
- shift every date by years, for `Lore.setYear`;
- follow the relations: bring the wars, alliances and vassalages of given pairs of states in line with the relations those states hold now (see below);
- remap or drop state ids, for a regeneration of states;
- move a battle's regiment links when regiments take new ids (states merged, a regiment attached to another) and drop them when regiments are disbanded or raised anew;
- describe an event in a line or two of text, from its data and the present names. Every screen that words an event uses this.

It must stay quick with thousands of events: finding an event by id and listing the parts of one do not scan the whole list each time, and adding one does not sort it anew. How it does so is its own business.

It is a deep module: the rules above live behind these few calls, and it is tested alone.

### Events of relations

Three relations have an event each: `Enemy` a war, `Ally` an alliance, `Vassal` with `Suzerain` a vassalage. The other relations (friendly, neutral, suspicion, rival, unknown) leave no event.

A pair of states **has** the event of its relation when an ongoing alliance or vassalage names the two, or an ongoing war has them on opposite sides.

**Generation**

How wars are generated today, and what does not fit one shared list:

- **Each state rolls a war against each neighbour, alone.** So a neighbouring pair gets two unrelated wars, one from each side, that may overlap in time, and a map of 25 states gets about a hundred.
- **One time in five the war is named after the state's own culture** and still lists the neighbour as its defender, so the name and the sides disagree.
- **A war is named from the attacker's view** ("Tirian War" is Angria's war against Tiria), which reads wrong in Tiria's own history.
- **The dates know nothing of each other.** An ongoing war can begin before the last war between the same two states has ended.
- **All the rolls come from the map's one sequence**, which is not seeded anew between the steps of generation. Any change in their number changes the routes, religions, regiments, markers and zones of every existing seed.

So the rolls stay exactly as they are, and what is made of them changes:

- **One past war for a neighbouring pair.** Each state still rolls against each neighbour. Of the two wars a pair rolls, the one rolled by the more expansionist state can be kept, with that state as the attacker; when the two are equal, the one with the lower id.
- **A vanished foe.** A war rolled with the culture's name is a war of that state against a foe that is gone: its defenders are empty.
- **A sample is kept, not all.** Of these wars the generator keeps three for every five states, twenty at most: fifteen for 25 states. Which ones is picked by the history generator (see below), so every state has the same chance and many states have no past war: the states, in a random order, take one war of theirs each in turns, a state already in a picked war waiting for the next round. A state's chance does not grow with the wars it rolled. The rest are dropped.
- **A name both sides can read.** A kept pair war is named by both states and the kind that was rolled ("Angria-Tirian Conquest"), as ongoing wars already are.
- **Ongoing wars**: one war with every state that joined on each side, the leaders first. It begins after the last war between its two leaders has ended.
- **Vassalages**: one event for each vassal once relations are settled, begun some years ago and after the last war between the two has ended.
- **Alliances get no event at generation.** The relations roll dozens of them, far more than the wars. An alliance has an event only once it is made or restored by hand; one the generator rolled and the user ends leaves none, since nothing says when it began.
- **No notes.** The generator writes no note on any event. From stage 2, the lines the Relations history got at a declaration of war (who joined, who stayed out) are no longer written: who joined is in the war's sides.

**No past battles.** The generator writes wars and no battles for them. A battle needs a burg's walls and a river's name, which come later in the generation than the states do, so making them up took a step of its own; the map's battles are left to the user, who plays them or writes them by hand.

The pick of the wars that are kept and the ages of vassalages are rolled from the history generator, a generator of their own, seeded by the map's seed, so they are the same every time and take nothing from the map's sequence.

#### Whose an event is

The app removes events on its own in three places: a relation tried and dropped, a regeneration of relations, a regeneration of states. It must never remove what the user made. So every event the app makes carries `auto`, and loses it for good the first time the user changes anything of it: its name, a date, its sides, its place, its note, its tags, what it is part of.

- **The app's**: an event with `auto`. The generator's wars, battles and vassalages, the wars cut from old maps' campaigns, and the wars, alliances and vassalages begun by a relation set by hand.
- **The user's**: an event without `auto`. One added in the Chronicle, a battle that was played, the old Relations history, and any event the user has edited.
- **An event holds the user's work** when it is the user's or has an event of the user's beneath it, at any depth.

Where the rules below say the app removes an event, they mean one that holds none of the user's work; its parts, all the app's too, go with it.

**Relations set by hand** (set for a pair, or painted and applied): the events follow the relations the pairs hold afterwards, by two rules.

- **A pair holds one of the three relations and has no event for it.** If an event of that kind for the same pair has the present as its `end`, the current year alone, it is reopened: its `end` is removed. Otherwise a new event begins at the present.
- **A pair has an event and no longer holds the relation.** If the event has the present as its `start` and holds none of the user's work, it is removed: it was a trial. Otherwise it ends at the present.

So what is left depends only on the events before and the relations after, not on the steps between: any series of changes leaves what one change to the final relations would. An old war ended and declared again is the same war; a new alliance made and dropped leaves nothing; a war begun today that has a battle is kept and ended.

A date the user has set to the month or the day is no longer the present, so it settles the event: a war whose end is dated is not reopened, and a new war between the same states begins beside it, in the same year if need be. A war whose start is dated is ended, not removed.

For wars, which have more than two states:

- a war ends, and is reopened, by its two leaders;
- when a state that does not lead makes peace, the war goes on and its sides stay as recorded;
- two states set to `Enemy` that no ongoing war has on opposite sides begin a war of their own.

**Regeneration**

- **Regenerating relations** first removes every ongoing war, alliance and vassalage that holds none of the user's work and ends, at the present, those that do. The new relations then get their events as at generation.
- **Regenerating states** remaps the state ids in events as locked states are renumbered, and drops ids of states that are gone. A war or a logged act left with no state that holds none of the user's work is removed, as is an alliance or a vassalage that lost a state. Past wars and their battles are then generated only for pairs that have none, and only up to the size of the sample, counting the wars that were kept, so the history of locked states is not rolled twice and the list does not grow with each regeneration.

**A state removed or merged into another** holds no relation any more: its ongoing wars, alliances and vassalages follow by the two rules above, so they are ended or, if they were trials, removed. Its ended events stay.

`state.campaigns` and its type are deleted. The invasion zone, the regiment's founding note, the battlefield marker generator and `Lore.setYear` read wars through `Events`.

The battlefield marker generator is otherwise unchanged: it writes a plain marker with a legend, and no event. Its date is written by the dates module, which mends two defects of the present helper: for an ongoing war it takes year 1000 as the war's end, and it reads years below 100 as the 1900s.

### Political acts

Four acts of the model each write one event. No other edit does.

| Act | Event name | States | Tag |
| --- | --- | --- | --- |
| A province declares independence | Independence of Vel from Angria | the new state, the old one | `independence` |
| States are merged into one | Annexation of Tiria by Angria; with several, all are named | the ruling state, the merged ones | `annexation` |
| A province is given to another state | Cession of Vel from Angria to Tiria | the old state, the new one | `cession` |
| A state's capital is moved | Angria moves its capital to Ashford | the state | `capital` |

- **A plain event.** Each is a custom event, begun and ended at the present, with its states and its tag, and marked `auto`. It needs no kind of its own.
- **The name holds the names of the day.** It is written once, in English like other generated names, and is not rebuilt, so it still reads right when a state is renamed or gone.
- **Logged in the model**, so it is the same whoever asks for the act: an editor, a table import, the assistant, a script.
- **Once for an act.** What the act does inside (a merged state losing its capital, a new state getting one) writes nothing more.
- **Not for the app's own doing.** Map restoration moves a capital when the old one is lost; that is no event.
- **Done again right away, it corrects.** When the same act is done for the same province or state while its event is still the app's and dated the present, that event is rewritten, not joined by a second. The event carries the act and its subject, so this holds after the map is saved and loaded. The app cannot tell that an act was undone, so an act taken back leaves its event for the user to remove.
- **Not history, so not logged**: founding, removing or renaming a state, burg, religion or culture; a change of a state's form; walls and ports; anything painted; taxes, budgets and other settings; regiments, routes, rivers, labels and markers. A user who means one of these as history writes the event.

### Battles

Applying a battle:

- writes a battle event with the cell and position, the states of each side, the result and the replay;
- dates it to the minute: its `start` is the hour the battle began at, on the battle's clock, and its `end` the time it had run to when it was applied. The map has no current day, so the day is one of the current year rolled from the battle's seed: not before its war began, and after the war's parts already dated to a day of that year, so that battles are listed in the order they were fought. The user sets another in the record;
- sets its `parent` to the ongoing war that has the leading states of the two sides on opposite sides, the latest begun if there are several;
- when there is no such war, puts it in a war of the two leaders that ended in the current year, and failing that begins one: named as a war begun by a relation is ("Angria-Tirian War"), with the states of the battle's sides, begun and ended at the present, tagged `war` and marked `auto`. It is over, as the states are not enemies; set to `Enemy` in the same year, their relation reopens it. Further battles of the two in that year join it. Regiments of one state fighting each other begin no war;
- adds no marker: the battlefield marker with its prose legend, added today, is dropped;
- links every regiment that fought, by its state and id, in the event's `regiments`;
- reduces the regiments' troops as today;
- appends nothing to the regiments' notes.

The battle event is the only record of which regiments fought it: a regiment holds no list of its battles, and its battles are those whose `regiments` name it. The links follow the regiments, through `Events`:

- **States merged**: each merged regiment takes a new id in the ruling state, and the links follow it.
- **A regiment attached to another**: its links pass to the regiment it joined.
- **A regiment disbanded**, by hand, by losing all its troops or by a regeneration of the military: its links are dropped, so an id given again later inherits no battles.
- **A state removed**: its regiments' links are dropped. **A regeneration of states** renumbers them as it renumbers the states.
- **Map restoration** drops the links of regiments left off the new map.

The replay's regiments are a different thing: the regiments as they joined, with their names and troops, the recipe the battle is played again from. They are never read to find a regiment of today.

### Replay

The replay is the recipe of the battle: the battle type, the seed, the hour, the axis of the attack, the weather and ground conditions, the simulation settings, the units as they were, the regiments of both sides as they joined, everything done by hand on the way with its tick, what the generals settled on, the tick the battle was applied at, and the version of the app. The field is not stored; it is built again from the map at the battle's position.

It is written with the event from stage 2, because it is where the details of a battle live.

- **A replay stops at the tick the battle was applied at.** A battle can be applied before it is over, and played further it would go on to another end.
- **The summary of a past battle** is made by building the battle from its replay and playing it to that tick without drawing it; the summary is then the one the battle screen shows today. It takes a moment and shows its progress.
- **Watching again** (stage 3) opens the battle screen on the replay in a mode that only watches: no orders, no apply, nothing on the map moves. For this the screen must run without the map's own regiments, which it uses today.
- **The recorded result is the truth.** A replay matches it only while the ground at the place, the units and the simulation rules are unchanged. When the replay ends differently from the event, the screen says so and the event is not touched.
- **A battle without a replay**, one written by hand, shows only what its event holds.

### No battle markers

Events and markers are not tied together. Applying a battle adds no marker, a marker has no link to an event, and events get no layer of their own. A battle is found in the Chronicle and its place is shown by focusing the map on it.

Battlefield markers that old maps have, generated or left by played battles, stay as plain markers.

### Entities

`event` is registered as an entity type in the map's entity lookup, with its name, a context line (its date and tags), its position when it has one, its note and the Chronicle as its editor. Notes, search and focus then work for events as for other entities, and the Notes Editor lists event notes under their own group.

### The Chronicle (new controller)

A plain overview like the others: a table of events with the filters, the count and the buttons under it. An event is edited in a dialog of its own, the Chronicle Record Editor.

```
 Chronicle                                                  ✕
 Start ⇅     End       Event                  Type         ⚙
 45 BWE      38 BWE      Tirian Conquest      War          ✉ ✎ 🗑
 62          66        ▸ Morlandian Rebelli…  War          ✉ ✎ 🗑
 98          ongoing     Tiria under Angria   Vassalage    ✉ ✎ 🗑
 117         ongoing   ▾ Angria-Tirian War    War          ✉ ✎ 🗑
 14 Mar 119                Battle of the Lo…  Battle     ▷ ✉ ✎ 🗑
 2 Jun 120                 Siege of Ashford   Battle     ▶ ✉ ✎ 🗑
 120                     The long winter      Event        ✉ ✎ 🗑
 Search: [            ]  Type: [ all ▾ ]  State: [ all ▾ ]
 Events: 8 of 36
 [ ⟳ ] [ + ] [ ↕ ] [ ⤓ ]
```

`▸` and `▾` open and close an event that has others as its parts; `↕` under the list opens or closes all.

The order under the list is the one other overviews have: the filters, then the line with the number shown, then the buttons.

**The list** is the editor table other overviews use: sortable columns, columns that can be hidden, pages.

- Columns: start, end, event, type, tags, states, then the row's buttons: replay, note, edit, remove. Tags and states are hidden by default to keep the list narrow. There is no column for the sides or the result: those are read in the record.
- **Start and end** are shown short: "14 Mar 120", a year before the era as "45 BWE". The date in full, "14 March 45 before Winter Era", and the length of an event that lasted are the cell's tooltip. Both columns sort as numbers, an event going on after every end.
- **End** reads "ongoing" for an event going on and is empty for one that happened at one time or within one day, such as a played battle: its times and its length are then in the tooltip of its start.
- **Event** is the name alone; it is indented under its parent.
- **Replay** opens the Battle Simulator on the battle, to watch it again. Only a battle has the button; it is disabled for one with no replay, written by hand, and a click then says why.
- **Note** opens the Notes Editor on the event's note.
- **Edit** opens the event in the Chronicle Record Editor. The row of the event being edited is marked.
- **Remove** always asks first. For an event with parts the question says how many events will go with it and how many of them are battles the user played, because all of them are removed. To keep a part, its "Part of" is emptied before.
- Filters, under the list in one row: a search, the type and the state. The search matches names and tags and takes `#tag` for tags alone, as in other overviews, through the `Tags` model. Sorted by time by default.

**The list is nested.** An event that is part of another (its `parent`) is not a row of its own at the top: it is a row under its parent, shown when the parent is opened.

- **The top level** holds the events with no parent. An event with parts has a toggle before its name.
- **Opened**, its parts follow it as rows of the same columns, indented, in order of time. A part that has parts of its own opens the same way, to any depth; one level, battles under a war, is the usual case.
- **Closed by default.** A button under the list opens or closes all. What is open is remembered while the app runs.
- **Sorting** orders the top level and, the same way, the parts under each parent. A part never leaves its parent.
- **Pages** count top-level rows; an opened event and its parts are never split over two pages.
- **Filters and search** look at every event. One that matches is shown in its place: its parents are shown and opened even when they do not match themselves, and are then drawn muted.
- **The line with the number shown** counts every matching event, parts included, and gives the current year beside it, for reference.
- **Opened on an event** from elsewhere, such as a battle from the regiment editor, the list opens that event's parents and the event's record is opened for editing.
- Nesting is new to the shared editor table, which draws flat rows. The table keeps doing what it does for the top level (columns, sorting, pages); the Chronicle draws the parts of an opened event under its row.

The buttons at the bottom:

- **Refresh** draws the list and the open record again. Editors that change events elsewhere press it for the user: relations applied, a battle applied, the year or the era set, an operation of the assistant.
- **Add** is one button. It adds a plain event dated the present and opens it in the Chronicle Record Editor with its name ready to type; what it is, the user sets with the record's Type. A war, an alliance and a vassalage made so are over, with the present as their end, and with empty sides to fill in.
- **Open or close all** events that have parts.
- **Download** saves the events as a flat CSV, with columns for what each is part of and for its tags, notes included and no column for the kind.

### The Chronicle Record Editor (new controller)

A small dialog with a labelled field for each thing an event holds, as the marker editor has. Every change is saved as it is made, and the list follows.

```
 Chronicle Record Editor                  ✕
 Name:      [ Siege of Ashford            ]
 Type:      [ Battle                    ▾ ]
 Start:     [ 120 ] [ June ▾ ] [ 2 ] [10:00]
 End:       [ 120 ] [ June ▾ ] [ 2 ] [10:00]
 Part of:   [ Angria-Tirian War           ]
 Tags:      [ battle, siege               ]
 Attackers: Angria
 Defenders: Tiria
 Winner:    [ Defenders ▾ ]
 [ ✎ notes ] [ ◎ ] [ ▤ ] [ ▶ ] [ 🗑 ]
```

- **Name**: a text input.
- **Type**: a select: Event, War, Battle, Alliance, Vassalage. The fields and buttons under the tags are those of the type and change with it (see [Kinds and tags](#kinds-and-tags)). Disabled for an event that keeps its type.
- **Start and end**: a year (a number, negative before the era), a month (a select with an empty choice), a day (a number) and a time (the browser's time input), on one line of even height. Empty parts are left out of the stored date, so a year alone stays a year alone; a day can be given only once the month is, and a time once the day is. An empty end year means the event is still going on.
  - A war, an alliance or a vassalage that is going on is tied to the relation of its states: it begins and ends through the relations, not here. So its end cannot be set here, the end of one that is over can be dated but not emptied, and one added by hand is always over: it is added with an end. Otherwise the list would show a war going on between states at peace.
  - While an event's end is the same as its start, a change of the start moves the end with it, so a battle is dated in one step. An event that took under a day, such as a played battle, keeps its length when its start moves; once the start gives no time, it ends as it begins.
- **Part of**: a text input that suggests events by name as the user types, wars first, and is emptied for none. A select of every event would not do with thousands of them. Any event can be part of any other, except itself and its own parts. Changing it moves the row under its new parent at once.
- **Tags**: a plain text input, comma-separated as in other editors.
- **States**, for a custom event: the states it concerns, added from a select and removed one by one.
- **Who**, where the event has sides, with state names as they are now, each with its emblem. A state is added from a select and removed one by one.
  - A war: the attackers and the defenders. The first of each side leads it. The two leaders of a war that is going on cannot be changed, as the war follows their relation; the others can, which is also how a state that left a war is taken out of it.
  - An alliance: its two states. A vassalage: its suzerain and its vassal. Both are fixed while it is going on.
  - A battle: its sides and its winner. A played battle's are what was fought and are not edited.
- **Buttons** under the fields, icons as in other editors:
  - **Notes** opens the Notes Editor on the event's note. It is not opened with the record; when it is already open, it follows the record being edited.
  - **Locate** (events with a place): the map zooms to it and the spot is marked for a moment.
  - **Place**, for a battle written by hand: its place is picked again by a click on the map. A played battle's place is not moved: its replay is built on it.
  - **Summary** and **Replay** (battles with a replay): the summary of the battle, and the Battle Simulator opened on it.
  - **Remove**, asked first as from the row.

Notes on the build:

- A change keeps the fields and writes the new values into them, so the field the user moved on to keeps the focus.
- A place awaited from the map is for the record that asked for it: opening another record or closing the editor drops the wait.
- A remembered filter that names a state the map has not is dropped on open, and a filter that would hide an event just added is cleared.
- The Chronicle Record Editor belongs to the Chronicle: it closes with it. Both forget the event on close, as other dialogs do.
- An event's note is edited only in the Notes Editor, so the two dialogs never hold the same text.
- An opened event draws all of its parts on its page. One with hundreds of parts makes a long page; that is accepted for now.
- Only the rows of the page shown are drawn, so the length of the list does not slow the dialog; filters and search run over all events.
- It is opened from the tools menu, from the omnibar, and from the Diplomacy overview's history button.

The regiment editor lists the regiment's battles: name, date and result. A row opens the Chronicle on that battle.

### Save, load and migration

- `pack.events` is created empty with the pack, before states are generated. It is a new record at the end of the map file; a map without it loads with an empty list. The JSON export carries it.
- Stage 1 migration, in the block of the version it ships in: gather `campaigns` from every state; campaigns with the same name, start, attacker and defender are one war, its start and end years written as dates; a defender of 0 gives empty defenders; delete `campaigns` from the states. An old ongoing war names only its two leaders; a state at war with one leader and not with the other is added to the other's side. Past wars are then cut to the same sample as on a new map, three for every five states and twenty at most, picked from the map's seed: an old map carries about a hundred, and nobody wrote them. Ongoing wars are all kept, but old versions never ended a war when peace was signed: one whose leaders are no longer `Enemy` ends at the present. Wars are tagged `war` and carry `auto`; the event made of the Relations history does not. Last, every vassalage and every war between two states that has no event gets one, begun some years ago, a year at least; alliances get none.
- The Relations history is converted in the block of stage 2, when the Chronicle is there to show it: all its entries become the note of one custom event named "Relations history", tagged `relations`, dated the present, each entry a paragraph with its title in bold. An empty history adds nothing. The text in the neutral state's `diplomacy`, its accessor, its dialog and the model operation that edits an entry (which the assistant and the scripting surface call today) are removed; the operations of `Events` take its place there.
- Migrations convert data only. No generator is run on load.
- Prose already appended to regiment notes and marker legends by earlier versions stays as it is.
- Map restoration, which rebuilds the cells after a heightmap edit or a resample, carries events over as it carries markers: a battle's position is projected and its cell found again; a battle whose place falls off the new map is removed; a state that did not survive is treated as removed: its wars, alliances and vassalages end, and the events keep its id.
- The integrity check on load finds a battle's cell again from its position when the two disagree, and drops links that lead nowhere: a `parent` and a battle's link to a regiment that is gone.

### Reproducibility

The map's sequence of rolls is not seeded anew between the steps of generation, so the number and the order of rolls in the states step do not change. A seed gives the same map except for what this feature means to change:

- which past wars exist: a sample of them, one for a neighbouring pair at most;
- war years, which are no longer cut off at 1, and the start of an ongoing war, which is a year ago at least and after the pair's last war;
- the war picked for the invasion zone, for a regiment's founding note and for a battlefield marker, because the wars to pick from are other than before. Many states now have no past war, and these readers must draw the same rolls for such a state as for one that has: the founding note is dated without a war, as it already can be, and a battlefield marker's legend names none.

Everything new, the pick of the wars and the ages of vassalages, is rolled from the history generator.

### Modules touched

- `Events` model: new. Dates module: new.
- States generator: past and ongoing wars, alliances and vassalages, events following relations set by hand, regeneration, removal of `campaigns` and of the Relations history.
- Lore: the year shift.
- Provinces, states and burgs models: the four political acts write their events.
- Zones, military and markers generators: read wars through `Events`.
- Battle screen: apply, the replay written and read, the summary of a past battle, the watching mode.
- Chronicle and Chronicle Record Editor controllers: new. Diplomacy overview: the Relations history dialog removed, its button opens the Chronicle. Battle site model: the name of a place moves there from the battle screen. Regiment editor: changed. Diplomacy editor: its apply hands the changed pairs to `Events`.
- Entity lookup, Notes Editor (events as a group of notes), map commands, scripting surface, assistant context.
- Save, load, auto-update, map repair, map restoration, JSON export.
- Docs: the data model, the glossary (Event, War, Alliance, Vassalage, Battle, Replay), the battles domain page, the wiki pages on military and the battle simulator, and a new one on the Chronicle.

### Delivery stages

1. **Events of relations.** `pack.events`, the `Events` model, wars, alliances and vassalages, events following the relations, the migration, the readers, the year shift, save and load. No new screen yet.
2. **Battle events and the Chronicle.** The four political acts, the event and its replay on apply, no marker, the regiment links, the summary of a past battle, the Chronicle dialog and its record editor with notes and custom events, the Relations history retired into it, the regiment's battles.
3. **Watching again.** The watching mode of the battle screen, exports from a past battle.

Each stage leaves the map file and the app whole. Translation of the new text into the locales is one pass after the last stage.

## Testing Decisions

A good test here checks what a caller or a user can observe: the events a call leaves in `pack.events`, the regiments a battle links, the text shown. It does not check how the list is kept or which helper did the work.

- **Dates module**, alone: a year before the era is worded "45 BWE" and "45 before Winter Era"; every form in the table is read and written back unchanged; order across forms, with missing parts as the first; negative years, year 0, years below 100 and above 9999; a shift by years keeps the month, day and time; lengths in days, months and years, and "under a year" for two bare equal years; 29 February is refused; an end is compared with its start at the exactness of the less exact one.
- **`Events` model**, alone, on a small hand-made pack: order by date with ties in order of adding; an update of the start moves the event; removal takes the parts with it to any depth; with 5,000 events, adding, finding by id, listing parts and filtering stay within a generous bound, set to catch a scan of the whole list on each call and not to measure speed; the shift moves `start` and `end`; the war between two states is found from either side; an event cannot be made part of itself or of one of its parts; remapping and dropping state ids, with the war that is left empty removed. Prior art: the model edit tests and the tags tests.
- **Past wars from the generator**: a map of 25 states has fifteen past wars and one of 40 has twenty; a neighbouring pair has one past war at most, attacked by the more expansionist state; a state with no past war still gets its founding notes and battlefield markers; a culture-named war has no defenders; no two wars of a pair overlap; no battle is generated; the same seed gives the same wars; the rest of the map is the same with and without them.
- **Events of relations from the generator**: every ongoing war has both sides, each attacker is `Enemy` to each defender, no war is listed twice; every vassal has one ongoing vassalage and no alliance has an event; none begins in the current year; regenerating relations twice leaves no stale ongoing event. Prior art: the states generator tests.
- **Relations by hand**: one of the three relations begins an event and a change from it ends the event; restored right away, the event is reopened with its id, start and battles; an event begun and dropped right away that holds none of the user's work is gone, one that does is ended; an event whose end the user dated to the day is not reopened, and a second one begins in the same year. As a property: for series of random relation changes on a small pack, the events left equal those left by one change to the final relations.
- **Migration**: an old map's campaigns, with an ongoing war duplicated on two states, a past war on one and a defender of 0, become the expected wars and `campaigns` are gone; an old Relations history becomes one custom event with every entry in its note, and an empty one adds nothing; a state at war with one leader joins the other's side; past wars are cut to the sample and ongoing ones kept; every vassal gets an event and no `Ally` pair does, and the update run twice on the same data gives the same years. Prior art: the auto-update tests.
- **Regiment links**: a merged regiment's battles follow its new id, an attached one's pass to the regiment it joined, a disbanded one's are dropped and a regiment raised later with its id has none, a removed state's are dropped.
- **Save and load**: a map with wars, a battle with its regiment links, and notes on events of each kind, come back equal. Prior art: the save tests and the map restoration tests.
- **Applying a battle**: a battle driven to its end through the model and applied leaves one battle event with the right parent, sides and result, a replay, linked regiments and no new marker; it begins at the battle's hour on a day of the current year and lasts as long as it was fought; a battle of states not at war begins a war of this year, and their next battle of the year joins it. Prior art: the battle tests.
- **Replay**: the replay of an applied battle, played again on the same map, ends with the recorded result and the same losses, and a battle applied before its end stops at the tick it was applied at; a replay played after the units change is reported as differing and leaves the event alone.
- **Tags on events**: tags set on an event are normalized and matched by the `Tags` model as on other entities; every war, battle, alliance and vassalage the app makes carries the tag of what it is, a war `war` alone and a battle also its type; an event the user adds carries none; a removed tag is not put back.
- **Notes on events**: a note set on an event of each kind is read back through the notes store and listed by the Notes Editor; removing the event removes it.
- **Whose an event is**: an event the app made carries `auto` and loses it on any change by the user; a war begun by a relation and dropped is removed when it holds none of the user's work, and kept and ended when the user renamed it, tagged it, wrote a note on it, played a battle in it or put an event of their own under it; regenerating relations and states removes no event of the user's.
- **Political acts**: each of the four acts leaves one event with its name, states and tag; the act done twice for the same subject leaves one; an event the user edited is not rewritten by a later act; a merge writes one event however many capitals it unseats; map restoration moving a capital writes none; the name stands after the state is renamed.
- **Events added by hand**: an event is added plain and given its type in its record, which brings the tag and the fields of the type; a change of type keeps the name, the dates, the parent, the note and the states; a war, an alliance and a vassalage set so are over and cannot be made ongoing; a battle takes its place from a click on the map; a played battle and an ongoing relation keep their type; a hand-written war is picked for a regiment's founding note like any other.
- **Reproducibility**: a per-stage fingerprint of a seeded map against a worktree of the base branch differs only in the places listed under Reproducibility.
- **The Chronicle** is checked in the browser: it lists, filters, searches and sorts, with the filters in one row under the list, the type as a column and a filter, and the tags hidden until asked for; a year before the era reads "45 BWE" with the full wording as its tooltip and sorts before year 1; a war opens to show its battles and closes again; a search finds a battle in a closed war and shows it under that war; the count includes parts; Edit opens the record and marks its row; a name and a date typed there are in `pack.events` at once, the row follows, and the next field keeps the focus; a changed "Part of" moves the row; an emptied end makes the event ongoing; a custom event is added, tagged, given states and removed; a `#tag` search finds it; removing a war asks first and takes its battles with it; only battles have a Replay button, disabled but for a played one, which it opens in the Battle Simulator; the Note button of a row opens the Notes Editor on the event; an added event opens as a plain one and its record changes its fields with its Type; a battle opens its summary and focuses the map; the Notes button opens the Notes Editor on the event.

## Out of Scope

- Events for the relations that do not last (friendly, neutral, suspicion, rival, unknown). A change of such a relation is no longer written down anywhere.
- Events for the alliances the generator rolls, and past alliances and vassalages that ended before the present.
- A full generated history. What the generator writes is a sample to start from.
- Kinds of event defined by the user. Tags cover what users call their events.
- A place for a custom event.
- Battles on the map: no marker and no layer. A battle is found in the Chronicle and its place shown by focusing on it.
- Making a war, an alliance or a vassalage that is going on by hand in the Chronicle. That is done by setting the relation.
- Time progression and simulation over time. This PRD only keeps the format open for it: a future "advance time" raises the current year and adds events, and changes none that exist.
- Looking at the map as it was in an earlier year.
- A calendar of the map's own: month names and lengths, weeks, leap years, more than one era.
- A current date finer than the year, and time passing between two edits. Until then a relation set by hand dates its event by the year, an applied battle gets a rolled day of it, and the user sets the days.
- Days and times for generated events.
- Consequences of battles and wars beyond troops lost: burgs taken, borders moved, wars ended by their battles.
- Events for edits other than the four political acts, and telling that an act was undone.
- Generated history outside warfare: foundations, rulers, disasters. The custom event covers what the user writes by hand.
- Turning the prose that earlier versions wrote into notes and legends into events.

## Further Notes

- A new map of 25 states starts with about 20 events: fifteen past wars, the few wars going on and the vassalages. The three-for-five share and the cap of twenty are the numbers to turn if that is still too many or too few.
- Generated battlefield markers are not events. A marker's legend still names a war and a date of its own.
- A removed state keeps only its id, so an event shows it as a former state without a name. Merged states keep their names. Keeping the name on a removed state would fix it and is a separate small change.
- The version that gates each migration is the version the stage ships in. If that version is already released when a stage lands, the gate moves to the next one.
- The replay of a long battle with many moves made by hand is the largest part of an event. A battle without it keeps its event and loses its summary and the chance to be watched.
- When a calendar of the map's own comes, stored months and days stay valid as numbers: the calendar gives them names and lengths. A calendar with fewer months or shorter months than a stored date needs will have to move that date, which is that feature's work.
- Time progression, when it comes, needs one more decision this PRD does not make: whether events alone must be enough to rebuild an earlier state of the map. Nothing here assumes they are.
