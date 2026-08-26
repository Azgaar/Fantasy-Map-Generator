Part of the [FMG Q&A](Q&A). Related topics are listed there.

## States and politics

### How do I create a new country?
Tools → States → click the add-state button at the bottom, then click the map to place its capital. Expand its territory with the editor's brush. Rename it by clicking its name in the list.

### How do I change state, province, culture, or religion borders?
Open the matching editor in Tools, click the brush button at the bottom, then click and drag on the map to paint territory. Confirm the changes when done. Rivers cross cell centers while borders follow cell edges, so borders cannot exactly follow rivers.

### How do I merge countries?
Tools → States → "Merge several states into one" button at the bottom of the dialog, then select the states to merge. To absorb territory gradually instead, paint over it with the absorbing state's brush.

### How do I make a state bigger or smaller?
Paint territory with that state's brush in the States editor. Removing a state entirely reassigns its land to neighbors and turns its capital into a neutral burg.

### How do I represent an invasion or conquest?
There is no war simulation over time. Paint the invader's territory over the conquered land in the States editor, set Diplomacy relations to Enemy where appropriate, and adjust cultures, religions and burgs to match the story. Battles between regiments can be fought in the [Battle Simulator](Battle-Simulator).

### How do provinces work? Can I merge them or nest them?
Provinces exist inside states, one level deep — no provinces inside provinces. To merge: remove one province and paint its territory into another with the Provinces editor brush (both must be in the same state). To turn a state into a province of another state: paint it over in the States editor, or declare the province independent first via the Provinces editor.

### How do I keep states from filling the whole map?
Lower the Growth rate setting (it controls how far states and cultures expand into neutral land), reduce individual states' expansion values, or delete some states. "Size variety" controls how much state areas differ from each other.

### How do I stop a state from expanding across the sea?
Set the state's culture type to Nomad in the editor and regenerate states — nomads avoid crossing water. See [Culture types](Culture-types).

### How do I rename a state, or regenerate its name?
Tools → States → click the state's name. The book icon re-rolls the name from its culture's namebase; the refresh icon gives a random name. To get names in a specific style (e.g. Portuguese), first set the culture's namebase in Tools → Cultures.

### How do I change state colors?
Tools → States → click the color box next to a state and pick a new color.

### Which is my biggest country?
Tools → States → sort the table by Area; the first row is the largest.

### Can I remove a state's capital?
Every state needs a capital. Reassign capital status to another burg first, then delete the old one — or delete the whole state, which demotes its capital to a neutral burg. To only hide capitals, toggle the burg icons layer off or set the capitals group opacity to 0 in Style.

### Can borders regenerate automatically after my battles or story events?
No — border changes from events are manual work with the States editor brush.
