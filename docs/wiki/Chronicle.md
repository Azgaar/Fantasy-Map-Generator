The **Chronicle** is the map's history: every war, battle, alliance and vassalage, and any event you write yourself, in order of time. Open it from _Tools_ → _Chronicle_, from the omnibar, or with the hourglass button of the Diplomacy overview. It replaces the old _Relations history_: a map made before keeps that text as one event named _Relations history_, which you can read, edit or split up.

## What it holds

- **Wars** have one record that both sides share, with every state that fights on each side, the leaders first. A war begins when two states are set to `Enemy` and ends when its leaders make peace. When a state that does not lead a war makes peace, the war goes on.
- **Alliances** and **vassalages** are kept the same way: each begins with the relation and ends when it changes. Alliances the generator rolls have no event; one you make by hand does.
- **Battles** you apply in the [Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator) are kept with their day and time, place, sides and result, as part of the war their states fight. States that are not at war get a war of that year for their battles; set them to `Enemy` and it goes on. The day is picked for you, after the war's earlier battles of that year, as the map has only a current year: change it in the battle's record. Their summary can be shown again and they can be [watched again](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator#watching-a-battle-again), from start to finish.
- **Political acts** write themselves down: a province declaring independence, states merged into one, a province given to another state and a capital moved. Doing the same act again right away corrects its event instead of adding another.
- **Your own events**: a war, a battle, an alliance, a vassalage or a plain event, added with the plus button and given its _Type_ in its record.

Trying relations out leaves no litter: a war, alliance or vassalage begun and dropped in the same sitting disappears, and one ended and set again right away is reopened with its name, note and battles. A new map starts with a short sample of history to build on: about three past wars for every five states (twenty at most), the wars going on and the vassalages. It has no battles yet: those are the ones you play in the Battle Simulator or write yourself.

## The list

The events are listed in order of time, with their _Start_, _End_, name and _Type_; click a column header to sort, the sliders button to show the _Tags_ and _States_ columns. _End_ reads _ongoing_ for an event still going on and is empty for one that happened at one time or within a day, such as a battle: hover its start to see its times and how long it took. An event with parts, such as a war with its battles, has an arrow before its name to open it; the arrows button under the list opens or closes all.

Each row ends with its buttons:

- the **play** button, which only battles have, opens a battle in the [Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator) to watch it again. It is active only for battles you played there: ones you wrote have no replay;
- the **book** opens the event's note in the Notes Editor;
- the **pencil** opens the event in the Chronicle Record Editor;
- the **bin** removes the event. It asks first and removes the event's parts with it.

Under the list, _Search_ finds events by name and tag (`#siege` for tags alone), _Type_ shows only wars, battles, alliances, vassalages or plain events, and _State_ shows one state's history; a battle found inside a closed war is shown under it. The refresh button draws the list again; the plus button adds an event of your own and opens its record, and the download button saves every event, with its parts, tags and note, as a CSV table.

## The Chronicle Record Editor

The pencil of a row opens the event's record, where every field is saved as you change it:

- **Name**, **Start** and **End**: a date is a year (negative before the era), and optionally a month, a day and a time. A year alone stays a year alone. Leave the end empty for an event still going on. While the end equals the start, changing the start moves both, and a battle that took some minutes or hours keeps its length when you move its start. A war, alliance or vassalage that is going on ends through the relation of its states, not here.
- **Type**: _Event_, _War_, _Battle_, _Alliance_ or _Vassalage_. The fields below the tags follow the type at once, and the event keeps its name, dates, note and states. For a battle you click its place on the map. A battle you played and a war, alliance or vassalage that is going on keep their type.
- **Part of**: the event it belongs to, found by name as you type, wars first; empty it for none.
- **Tags**: your own labels, typed as free text and comma-separated, as in other editors. What the app makes comes tagged with what it is (`war`, `battle`, `siege`…); a war is tagged `war` alone, as its sort is in its name; change or remove those tags as you like.
- **Attackers** and **Defenders**, **States** or **Suzerain** and **Vassal**: each state is shown with its emblem; add a state from the list, remove it with its cross. The leaders of an ongoing war cannot change; a played battle keeps what was fought.

The buttons under the fields: the **book** opens the event's note in the Notes Editor, which lists event notes too; the **target** zooms to a battle's place and marks it for a moment; the **pin** picks the place of a battle you wrote again; the **page** shows a played battle's summary and the **play** button replays it; the **bin** removes the event.

## Dates and the current year

The current year is shown under the list, beside the number of events. A year before the era is shown by the era: _45 BWE_ in the list, _45 before Winter Era_ in full when you hover it. Dates sort by time, not as text.

Setting the current year in the Lore editor moves the whole history by the same number of years, so a war that ended thirty years ago still did. The length of an event dated to the day is given in days, months or years; otherwise in years, and _under a year_ for one that began and ended in the same year.
