_River Editor_ lets you edit an existing river or start creating a new one. To open the Editor, click on any river on the map (the _Rivers_ layer must be visible).

## Editing the course

Control points are shown as circles along the river. Drag a point to move the river course, click a point to remove it, or click the river itself to insert a new point at that position.

## Fields

* **Name** — river name. Use the book icon to generate a culture-specific name, the globe icon for a fully random one, or the speaker icon to hear it
* **Type** — free text such as _river_, _fork_, _creek_, _brook_ or _stream_. It is appended to the name on the map label
* **Group** — the style group the river is drawn in: _regular_, _frozen_, _dry_, _lava_ or a custom one. It changes only the look. The Generator picks one by the whole river course: _frozen_ when it is below freezing all along, _dry_ when it is hot and arid all along, rarely _lava_ for a river that never leaves the highlands. A river fed by a tributary of another group stays _regular_. Rivers generated again (unless locked) get a new pick. The pencil icon opens the _River groups_ dialog to add groups, edit their style or remove custom ones; rivers of a removed group return to _regular_
* **Mainstem** — the parent river this one flows into
* **Basin** — the drainage basin (watershed) the river belongs to. Read-only
* **Discharge** — the river flux power. Read-only
* **Length** — river length in the selected units. Read-only
* **Mouth width** — river width at the mouth in the selected units. Read-only
* **Source width** — additional width at the river source, `0` by default
* **Width modifier** — multiplier applied to the whole river width, `1` by default

## Buttons

* **Create a new river** — switch to selecting cells for a new river
* **Edit style** — open the Style Editor for the river's group
* **Elevation profile** — show the river elevation profile
* **Legend** — edit free text notes (legend) for the river
* **Lock** — keep the river as it is when rivers are generated again: by _Regenerate rivers_, a change in the World Configurator or a heightmap edit in Risk mode with water erosion. Its course, name and other data stay, and the new rivers flow around it, ending where they reach it. Rivers can also be locked in the _Rivers Overview_
* **Remove** — delete the river (also bound to <kbd>Delete</kbd>)

Close the Editor when customization is done.
