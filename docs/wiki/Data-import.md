Most of the Generator's data can be exported, but only some of it can be uploaded back. This page lists every upload and the file format each one expects. The safest way to get a valid file is to download it from the same place first, edit it and upload it again.

Uploads change the open map at once and cannot be undone, so save the map as a `.map` file before a big import.

# Map files

| What | Where | File |
| --- | --- | --- |
| Whole map | _Load_ → machine, Dropbox or browser storage, or the `maplink` [URL parameter](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/URL-parameters) | `.map` or `.gz` saved by the Generator |

A `.map` file holds everything. Use it to move a map between browsers or to share it; the uploads below change parts of a map that is already open.

# Table data (CSV)

The editors in _Tools_ that download their table as a CSV file can upload it back: States, Cultures, Religions, Provinces, Burgs, Rivers, Routes, Markers, Zones, Biomes and Features. The upload button sits next to the download button in the bottom line (_Upload data from a CSV file_). A CSV is a plain text table: edit it in a spreadsheet (LibreOffice Calc, Excel, Google Sheets) and save it as CSV with UTF-8 encoding (in Excel: _CSV UTF-8_). Downloads are marked as UTF-8, so spreadsheets open names with accents and other letters correctly. Keep the header row and the column names as they are in the downloaded file. A value with a comma inside must be quoted; spreadsheets do this on their own.

Before anything is changed, the upload checks the file and stops with a message when:

- the values are not separated by commas. Only comma-separated files are supported: a spreadsheet set up for a language that writes decimals with a comma (German, French, Russian and others) may save with semicolons instead, so pick the comma as the field separator when saving;
- the file has no data rows or no `Id` column;
- an `Id` does not belong to anything on the map (it never existed, or it was removed). Nothing is changed and the missing ids are listed. To add entries, create them in the editor first, download the CSV again to see their ids, fill them in and upload.

Names and other shown text cannot contain `"`, `<` or `>`. A changed value with them is skipped and listed; a name that already has them is kept as it is.

## How an update works

Nothing changes until you confirm. The upload first works out what the file would do and shows an _Upload preview_: each value to update with its current and new value, and each value that will not be applied with the reason (a wrong color, an unknown culture, a name with `"`, `<` or `>`, and so on). The map cannot be edited while the preview is open. _Apply_ makes the changes, _Cancel_ leaves the map as it is. A file that changes nothing says so instead, and an upload that cannot start (see above) explains why in a message.

All uploads **update existing entries only**. Every row is matched by `Id`, and entries left out of the file are kept unchanged.

- An empty cell keeps the current value, and a value equal to the current one is not touched (a number the spreadsheet reformatted, such as `2.50` for `2.5`, counts as equal). The exception is a column of flags or tags (`Tags`, and the building and `Port` columns of burgs): there an empty cell clears the value, so remove the column to keep them.
- Columns are matched ignoring letter case and spaces around them; a column the upload does not know (a typo, for example) is listed in the message.
- Columns calculated from the map (cells, area, burgs, length and so on) are ignored. Territory is not part of the file: re-draw it with the editor's brush.
- A name in a cell that refers to something else (a capital, culture, state or origin) must match an existing name exactly.
- A value that cannot be applied is skipped and listed in the preview. After _Apply_, a message appears only if something failed that the preview did not expect.
- Population cells are people. A changed total is split between rural and urban as the entry has them now; when the rural and urban columns are both filled in and one of them changed, they are used instead. Burg and cell populations scale to match.

Tags are separated by `;`. Colors are HEX like `#a1b2c3`; a hatched fill is kept when its cell is left as downloaded.

## What each upload sets

| Editor | Columns |
| --- | --- |
| States | `State`, `Full Name` (rebuilt from a new name or form unless changed too), `Form`, `Color`, `Capital` (a burg of the state), `Culture`, `Type`, `Expansionism` (0 to 99, takes effect on _Recalculate_), population, `Sales Tax` (0 to 1), `Poll Tax`, `Treasury`, `Tags`. `Id` 0 is the neutral lands, which take only a name and population |
| Cultures | `Name`, `Ancestry`, `Color`, `Expansionism` (0 to 99, takes effect on _Recalculate_), `Type`, `Population`, `Namesbase` (a namesbase name), `Emblems Shape`, `Origins` (culture names separated by commas, empty for none), `Tags` |
| Religions | `Name`, `Color`, `Type`, `Form`, `Supreme Deity`, `Potential`, `Expansionism`, `Believers` (population), `Origins` (religion names separated by commas, empty for none), `Tags` |
| Provinces | `Province`, `Full Name`, `Form`, `Color`, `State` (moves the province), `Capital` (a burg of the province), population, `Tags` |
| Burgs | `Burg`, `Culture`, `Group`, `Type`, `Population`, `Treasury`, `Capital` (makes it the state capital), `Port`, `Citadel`, `Walls`, `Plaza`, `Temple`, `Shanty Town` (any text adds it, empty removes it), `Preview link`, `Tags` |
| Rivers | `River`, `Type`, `Tags` |
| Routes | `Route`, `Group` (roads, trails, searoutes or a custom group), `Tags` |
| Markers | `Name`, `Type`, `Tags`. Marker notes are uploaded in the Notes editor |
| Zones | `Description`, `Color`, `Type`, `Population`, `Tags` |
| Biomes | `Biome`, `Color`, `Habitability` (percent) |
| Features | `Name`, `Subtype`, `Group` (lakes only), `Tags` |

# Text data

| What | Where | Format |
| --- | --- | --- |
| Notes (legends) | _Tools_ → _Notes_ → _Upload notes from PC_ | `.csv` with a `type,id,note` header, as downloaded by _Download notes to PC_. Each row sets the note of an object on the map; rows for objects that are not on the map are skipped |
| Namesbases | _Tools_ → _Namesbase_ → upload, either extending or replacing the current set | `.txt`, one namesbase per line: `name\|min length\|max length\|doubled letters\|multi-word rate\|names separated by commas`, as downloaded by the editor |
| Heightmap templates | _Tools_ → _Heightmap_ → _Erase_ → _Template editor_ → upload | `.txt`, one step per line with 5 values separated by spaces, e.g. `Hill 1 90-99 44-56 40-60`. See the [Heightmap template editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor) |
| Style presets | _Style_ → the plus button next to the style preset → _Style Saver_ → _Open previously downloaded style file_ | `.json` saved by the same dialog |

# Images

| What | Where |
| --- | --- |
| Heightmap from an image | _Tools_ → _Heightmap_ → _Erase_ → _Image converter_. See [Heightmap customization](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization) |
| Emblems | Click an emblem or open _Tools_ → _Emblems_, then upload a PNG, JPG or SVG. See [Emblems](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Emblems) |
| Icons (burgs, markers, goods, regiments, relief) | The icon picker → _Custom_. See [Icons](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons) |

# What cannot be uploaded

Military, regiments, diplomacy, goods and markets have a CSV download but no upload. GeoJSON and JSON exports (_Tools_ → _Export_) are for other tools such as [GIS](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export) and cannot be loaded back.
