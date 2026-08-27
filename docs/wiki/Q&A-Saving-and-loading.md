Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Saving and loading

### How do I save my map?
Click Save (or <kbd>Ctrl+S</kbd>) and choose:
* Save to machine: downloads a .map file with the whole project — use this as your master copy.
* Save to browser storage: loads automatically on page refresh, but is lost if site data is cleared, and holds only one map.
* Save to Dropbox: save file stored in your cloud.

Save a .map file regularly — there is no full undo.

### How can I open a saved .gz or .map file?
Open the Generator, click on _Load_ and select the file. Or just drag and drop the file onto the Generator window.

### Is there an autosave?
Yes, to browser storage — but browser storage is not fully reliable and holds one map only. Download a .map backup from time to time and keep it safe.

### Is there an undo button?
There is no global undo. Some editors have their own history — the Heightmap editor has undo/redo buttons, and <kbd>Ctrl+Z</kbd> works where an undo control is visible. Save a .map file at least every 30 minutes of work.

### My saved map is not working properly. What should I do?
If your map is _obsolete_, and it's clearly stated on load, you may either use an [appropriate version](Changelog) of the Generator or re-create the map in the current version — there is no way to update it. If there is no version conflict, please [raise a defect](https://github.com/Azgaar/Fantasy-Map-Generator/issues/new). Also check that nothing (browser extension, popup policy) blocked the download in the first place.

### Can I manually edit the save file?
Yes, using any text editor — but carefully: if you break the formatting the file won't load. The common error is text editors automatically splitting the embedded svg into separate lines.

### Can I make the .map file smaller?
Not significantly. Turning off some layers helps a little, but size mostly depends on the points number. You can compress the file with an external zip tool for storage.

### Can I make the map open at a specific zoom and position?
Save the map to browser storage, set "Onload behavior" to "Open last saved map" in Options, then use [URL parameters](URL-parameters): `https://azgaar.github.io/Fantasy-Map-Generator/?scale=4&x=800&y=200`.

### Can I share my map with my players so it stays interactive?
There is no view-only mode. Share the .map file — others can open it in FMG. They will be able to edit their copy, so keep your own master file. You can also [embed the map on a website](https://sites.google.com/view/fantasy-map-generator-embedded/home).
