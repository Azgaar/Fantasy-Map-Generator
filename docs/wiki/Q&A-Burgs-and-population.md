Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Burgs and population

### What is a "burg"?
Burg is FMG's internal name for all settlements, from hamlets to capitals. It comes from the Germanic "burg", a fortified settlement.

### How do I add a city or town (burg)?
Hold <kbd>Shift+1</kbd> and click the map to place a burg, or add one from the Burgs overview in Tools. Change its group (e.g. to Cities) in the burg editor.

### How do I edit a burg — name, size, type?
Click the burg on the map to open its editor: rename, change population, group, features and emblem there. The Burgs overview in Tools lists and edits all burgs in a table.

### What do the icons next to a burg mean?
They mark burg features (port, capital, walls, temple, shanty town...). Hover an icon to see its meaning in the tooltip at the bottom of the page. A "shanty town" marks informal, low-income housing — a worldbuilding attribute with no mechanical effect.

### How is population calculated?
Mainly from area and biome habitability, adjusted by factors like a nearby river or lake, a river estuary, a safe sea harbor, elevation, and burg status. Population scale settings live in Tools → Units.

### Can I upload a custom icon for cities?
Custom burg icons are not supported. Marker icons, however, accept any external image or data-URI pasted into the Icon Selector — placing a marker at the burg is a common workaround.

### Can I have underwater towns or kingdoms?
Not supported. Popular workaround: style the ocean to look like land and the land like ocean, then roleplay the inversion.

### Can I underline capital names?
Not via the UI. In the browser console (<kbd>F12</kbd>): `d3.select('#burgLabels > #cities').style('text-decoration', 'underline')`
