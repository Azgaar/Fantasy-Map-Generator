Template is a set of actions to be applied to get a heightmap. Template can be pretty prescriptive and provide similar-looking heightmaps on each execution, but there is always a significant level of randomness that allow templates to produce different maps of the same type.

Possible actions are:
* Add a **hill** (raises surrounding land)
* Add a **pit** (lowers surrounding land)
* Add a **range** (a thin raised section)
* Add a **trough** (a thin lowered section)
* Add a **strait** (a vertical or horizontal lowered section)
* **Mask** heightmap (lower all cells along map edge or in map center)
* **Invert** heightmap (mirror by X, Y or both axes) 
* **Add** or subtract from all heights
* **Multiply** all heights
* **Smooth** all heights

Once you have given all the instructions, you can then run the template (process all instructions in sequence).
There are also options to download and upload templates.

When running a template, the map is cleared first. Undo / redo buttons can be used to check the heightmap on each step. In seed is locked, it will be used for heightmap generation, so the map will be the same on each execution.

Step can be skipped by clicking on the checkbox on the left. To execute the template click on the Execute button or just press <kbd>Enter</kbd>.

Step can have the following values:
* `n` - the number of times it must occur, can be a decimal value or range for random selection
* `h` - the height range, from 1-100 where 1 is deep ocean, and 100 is maximum height. 20 is land at sea level.
* `x` and `y` - percentage values (from 0-100), indicating where the change must take place, provide as a range
* * `x` is the horizontal axis, from 0 at the left, to 100 on the right.
* * `y` is the vertical axis, from 0 at the top, to 100 at the bottom.

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

### Add and Straits
Delete all the instructions and click on the + button to get the "Add" instruction.
The Add instruction adds height - it can have a negative value to lower height.

Change the V to 20 so your whole line looks like this:
* `Add     V:20    to all cells`

Run it and it will change to whole map to land at sea-level - remember that 20 is just above sea-level.
Add a Strait - it only has 2 values, width and direction:
* w - width 
* d - vertical or horizontal

Run it and you will see land divided by a river somewhere - note that you cannot control the location.

![Heightmap showing a strait](https://evolvedexperiment.github.io/FMGImages/images/template6.png)

## Multiply
Multiply works similar to add, except you have slightly better control to adjust small things, so multiplying by 1.1 
will make raise land slightly - smaller changes to low values, and larger changes to high values.  You can multiply 
by decimals as well, so multiply by 0.8 will lower everything a bit.

## Smooth
Smooth averages cell heights by their neighbors heights. This means land next to a pit will lower, and land next to a hill will rise. Smooth removes any spiky bits near land and makes FMG performance better.

![Heightmap showing a strait between two hilly areas.](https://evolvedexperiment.github.io/FMGImages/images/template7.png)

## Mask
Mask is a newer step so it was not included into the original guide. To see what is does lets assign maximum height (100) to all cells and then add Mask with default `1` fraction. It will gradually mask height of the cells along map edge to 0.

![image](https://user-images.githubusercontent.com/26469650/169668247-36d8d414-15bd-4feb-97ab-aa850faab972.png)

Fraction `2` will blend masked values with the original ones, so map edges will get `50` height. 

![image](https://user-images.githubusercontent.com/26469650/169668347-215fcf81-0626-4ad2-af2d-4eb2f0c786e4.png)

Negative fraction inverts the mask, so that cells in the map center are lowered.

![image](https://user-images.githubusercontent.com/26469650/169668348-a5474fee-92fc-47fa-b0f1-61eb0cb4bb82.png)

Fraction can even be a decimal value.

![image](https://user-images.githubusercontent.com/26469650/169668364-82dad6eb-2665-4cc6-aa80-fd4f66f72273.png)

## Invert

Invert is also a newer action. It mirrors the heightmap by X, Y or both axes. It is useful for maps that lean towards one side. In this case we can add invert with some probability (in 0-1 range) to mirror the map.

![image](https://user-images.githubusercontent.com/26469650/169668430-d64589c1-4e8f-44f6-bd92-69dcb2fc83c2.png)