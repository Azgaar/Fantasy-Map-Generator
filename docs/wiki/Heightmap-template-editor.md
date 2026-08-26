Template is a set of actions to be applied to get a heightmap. Template can be pretty prescriptive and provide similar-looking heightmaps on each execution, but there is always a significant level of randomness that allow templates to produce different maps of the same type.

The Template Editor is opened from the _Tools_ tab → _Heightmap_ → _Erase_ mode → _Template editor_.

Possible actions (buttons in the toolbar) are:

| Button | Action | Parameters |
| --- | --- | --- |
| **H** | **Hill** — a small blob that raises the surrounding land | `y`, `x`, `h`, `n` |
| **P** | **Pit** — a round depression | `y`, `x`, `h`, `n` |
| **R** | **Range** — an elongated elevation | `y`, `x`, `h`, `n` |
| **T** | **Trough** — an elongated depression | `y`, `x`, `h`, `n` |
| **S** | **Strait** — a vertical or horizontal depression across the map | `d`, `w` |
| **M** | **Mask** — lower cells near the edges or in the map center | `f` |
| **I** | **Invert** — mirror the heightmap along an axis | `by`, `n` |
| **+** | **Add** — add or subtract a value from heights in the selected range | `to`, `v` |
| **\*** | **Multiply** — multiply heights in the selected range by a factor | `to`, `v` |
| **~** | **Smooth** — replace cell heights with the average of their neighbors | `f` |

Parameter meanings:
* `n` — how many blobs to add. Use a hyphen to get a random number in a range, e.g. `2-5`. For _Invert_ it is instead the probability of inversion, in the `0-1` range
* `h` — the target height, from `0` (deep ocean) to `100` (maximum height); `20` is land at sea level. Use a hyphen for a random value in a range
* `x` and `y` — placement range as percentages of the map. `x` runs from 0 at the left to 100 at the right, `y` from 0 at the top to 100 at the bottom. Use a hyphen for a range, e.g. `65-75`
* `w` — strait width, capped at a third of the map width. Values below 1 act as the probability that the strait is created at all
* `d` — strait direction: vertical or horizontal
* `by` — the axis to mirror along: `x`, `y` or both
* `f` — fraction: `1` is the full effect, `2` blends the result half-way with the original, and so on. For _Mask_ a negative value inverts the effect
* `v` — the value to add (may be negative) or to multiply by
* `to` — which cells the change applies to: _all cells_, _land only_ (height 20 and above, and never pushed below 20), or _interval_, which prompts for a custom height range like `17-20`

A step can be skipped by clicking the check icon on its left, removed with the trash icon, and reordered by dragging the double-arrow handle.

To run the template click ▶ or press <kbd>Enter</kbd>. The heightmap is reset to zero before the run, so the template always starts from a blank map. The undo / redo buttons step through the result of each action. If you enter a _Seed_, the template produces the same heightmap on every execution; leave it empty for a new random seed each run.

The remaining buttons let you download the template as a text file, upload a previously saved one, and open the [Cartography Assets](https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/templates) portal to find or share templates.

The _Select template_ dropdown loads one of the built-in templates as a starting point: Volcano, High Island, Low Island, Continents, Archipelago, Atoll, Mediterranean, Peninsula, Pangea, Isthmus, Shattered, Taklamakan, Old World and Fractious. Selecting a template discards the current steps.

## Hill
When you open the Template Editor, the instruction is like this:
* `Hill    n:1    h:90-100   x:65-75   y:47-53`

This says to add 1 hill, of a random height between 90-100, somewhere in the center-right of the map.

To test it, change the Hill entry to:
* `Hill    n:1    h:20   x:50-50   y:50-50`

If you click Execute template, it will show a map with just a few land cells right in the map center.

![Heightmap showing a single hill of height 20](https://evolvedexperiment.github.io/FMGImages/images/template1.png)

I suggest you enable "Render ocean cells" option to see the effect it has on the ocean depths.

Now change n:1 to n:2

You will see massive change — this is because the land has been raised by 40 height in total.

![Heightmap showing two hills of height 20 at the same place](https://evolvedexperiment.github.io/FMGImages/images/template2.png)

Hills are main 'bricks' that construct a heightmap.

## Pit
Pit is the opposite of Hill, it creates a "hole".

To test it, add a Pit so your instructions look like this:
* `Hill    n:2    h:20   x:50-50   y:50-50`
* `Pit     n:1    h:20   x:50-50   y:50-50`

Run it and you will see a hole — the exact look will vary a bit.

![Heightmap showing two hills and pit at the same place](https://evolvedexperiment.github.io/FMGImages/images/template3.png)

## Range
Add a range and disable the Hill and Pit entries.

You will see it makes an elongated raised area.
* `Range   n:1    h:40-50   x:15-85   y:20-80`

![Heightmap showing a single range](https://evolvedexperiment.github.io/FMGImages/images/template4.png)

If you change the Range and enable the Hill and Pit, you will see that it combines:
* `Hill    n:2    h:20   x:50-50   y:50-50`
* `Pit     n:1    h:20   x:50-50   y:50-50`
* `Range   n:1    h:40-50   x:50-60   y:50-50`

![Heightmap showing two hills, a pit, and a range.](https://evolvedexperiment.github.io/FMGImages/images/template5.png)

## Trough
Trough works exactly like Range, except that it lowers height.

## Add and Strait
Delete all the instructions and click the **+** button to get the _Add_ instruction. Add changes height by a fixed value — a negative value lowers it.

Change `v` to 20 so the line looks like this:
* `Add    to:all cells    v:20`

Run it and the whole map becomes land at sea level — remember that 20 is the minimum land height.

Now add a Strait. It has only two values, direction `d` (vertical or horizontal) and width `w`.

Run it and you will see the land divided by a channel somewhere — note that you cannot control the exact location, only the direction.

![Heightmap showing a strait](https://evolvedexperiment.github.io/FMGImages/images/template6.png)

## Multiply
Multiply works like Add, except it scales the existing height, which gives finer control: multiplying by 1.1 raises land slightly, with smaller changes to low values and larger changes to high ones. Values below 1 lower the heights, so multiplying by 0.8 flattens everything a bit. With `to:land only` the scaling is applied relative to the sea level of 20, so land never drops below the coastline.

## Smooth
Smooth averages cell heights with their neighbors' heights. The fraction `f` controls the strength: `1` replaces the height with the plain average, `2` blends it half-way, and so on. This means land next to a pit will lower, and land next to a hill will rise. Smooth removes any spiky bits near land and makes FMG performance better.

![Heightmap showing a strait between two hilly areas.](https://evolvedexperiment.github.io/FMGImages/images/template7.png)

## Mask
To see what Mask does, assign maximum height (100) to all cells and then add a Mask with the default fraction `f:1`. It gradually masks the height of the cells along the map edge down to 0.

![image](https://user-images.githubusercontent.com/26469650/169668247-36d8d414-15bd-4feb-97ab-aa850faab972.png)

Fraction `2` blends the masked values with the original ones, so map edges keep a height of `50`.

![image](https://user-images.githubusercontent.com/26469650/169668347-215fcf81-0626-4ad2-af2d-4eb2f0c786e4.png)

A negative fraction inverts the mask, so cells in the map center are lowered instead.

![image](https://user-images.githubusercontent.com/26469650/169668348-a5474fee-92fc-47fa-b0f1-61eb0cb4bb82.png)

The fraction can also be a decimal value.

![image](https://user-images.githubusercontent.com/26469650/169668364-82dad6eb-2665-4cc6-aa80-fd4f66f72273.png)

## Invert

Invert mirrors the heightmap along the X, Y or both axes. It is useful for maps that lean towards one side. Set `n` to the probability of the mirroring happening, in the `0-1` range, so that only some of the generated maps get flipped.

![image](https://user-images.githubusercontent.com/26469650/169668430-d64589c1-4e8f-44f6-bd92-69dcb2fc83c2.png)
