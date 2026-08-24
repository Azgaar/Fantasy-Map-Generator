The scale of a map refers to the ratio between a distance on the map in pixels and the corresponding distance in the world. In Azgaar's Fantasy Map Generator, you can customize this scale to fit the needs of your project.

The map generator operates on a scale that you can adjust through the `Units` settings. The scale impacts the way distances are measured and displayed on the map. This is used for states area, routes, zones and the size of the world.

## Units editor

The Units settings appear following the path Menu → Tools → Units, or using the shortcut <kbd>Shift</kbd> + <kbd>Q</kbd>. The Units Editor has four sections:
* Distance
* Altitude
* Temperature
* Population

The only button at the bottom of the Units Editor restores the default unit settings. Rulers and other measuring tools live in a separate **Measurers Editor** (Menu → Tools → Measurers, or <kbd>Shift</kbd> + <kbd>=</kbd>) — see the [Measurers](#measurers) section below.

### Distance

Here you can select the unit your maps are going to use. You can select from:
* Mile (mi). This is a land mile
* Kilometer (km)
* League (lg) this is a land league. Like all units, it will be used in all distances in the map, Whether sea or land
* Versta (vr). Old Russian length unit
* Nautical mile (nmi)
* Nautical league (nlg)
* Custom name

The **Area unit** field customizes the name of the area unit. Type `square` to get the distance unit with a superscript ² (e.g. `mi²`); type anything else to use that text verbatim.

### How to add a distance unit

When you click on "custom name" a popup appears A popup will appear that says "Provide a custom name for a distance unit" and has an input field that says "type a text". Type in the name of your unit and press confirm. If you want to exit this popup without saving, press cancel.

### How to change the scale of your map

The **1 map pixel** slider decides how many distance units one map pixel represents. The default is 3, and the input accepts values from 0.01 to 20. This value is unit-agnostic: the distance unit selected above defines how it is displayed. Increasing it makes the same map cover a larger world.

### Altitude

The altitude section has a dropdown to select the name of the unit used for height and a slider. This measures sea depth, mountains, lake depth and more. When you click on layers preset → heightmap, the map tooltip will show the heights in the unit that you choose in altitude.

The dropdown has these units to choose from:
* Feet (ft)
* Meters (m).
* Fathom (f).
* Custom name. It opens a pop with an input text field. Write your unit name and click confirm.

The height exponent goes from 1.5 to 2.2 and affects higher numbers more. The default value is 2. Altitude also affects temperature and hence biomes. Here is an example of heights with different exponents.

* Island coast. Exp: 1.5 → 11 m. 1.8 → 25 m. 2.2 → 34 m. An average of that cell above the sea level.
* Central lands. Exp: 1.5 → 225 m. 1.8 → 665 m. 2.2 → 2819 m.
* High mountain. Exp: 1.5 → 743 m. 1.8 → 2785 m. 2.2 → 16233 m.

These heigths can vary with each map and place and can be modified on the heightmap editor too.

### Temperature

It lets you choose the temperature unit.
* Degree Celsius (°C)
* Degree Fahrenheit (°F)
* Kelvin (K)
* Degree Rankine (°R)
* Degree Delisle (°De)
* Degree Newton (°N)
* Degree Réaumur (°Ré). The melting and boiling points of water are defined as 0 and 80 degrees.
* Degree Rømer (°Rø). The freezing point of pure water 7.5 degrees and the boiling point of water as 60 degrees.

### Population

Here you can change the amount of people and population ratio live in the map.
* 1 population point corresponds to... by default 1000. Min 10. Max 10000. This represents how many people are in the map. Any number of population in the map is represented in "population points" not in exact number of people.
* Urbanization rate. Burg population relative to all population. This does not modify the total population or decrease rural population. It only increases the people at burgs and makes the percentage of people living at burgs higher. By default: 1. Min: 0.01. Max: 5.
* Urban density. Average people per building in medieval fantasy city generator. By default: 10. Min: 1. Max: 200.

## Measurers

Measurers are placed and managed from the **Measurers Editor** (Menu → Tools → Measurers, or <kbd>Shift</kbd> + <kbd>=</kbd>). The dialog lists every measurer on the map with buttons to zoom to it or remove it, and the toolbar at the bottom adds a linear ruler, an opisometer, a route opisometer or a planimeter, or removes all measurers at once.

Measurers are drawn on the _Rulers_ layer (<kbd>=</kbd> to toggle), so you can hide them without deleting them.

### Linear rulers
When you click the ruler icon a new linear ruler is created in the middle of the screen.

* Drag the whole ruler clicking on the label and holding.
* Extend the ruler clicking on the dot at one of the two ends of the ruler. Hold the mouse button to extend and move the mouse to control the direction.
* Click anywhere inside the ruler to create a ruler anchor point. A circle appears at that anchor point to indicate it. Even if you move the ruler at the edges, it will remain fixed at the anchor point. This allows you to measure contours that are not straight. Click on the same point to delete that anchor point.
* You can hold <kbd>Ctrl</kbd> and drag the dot at one of the ends to keep the previous endpoint as an anchor point and extend the ruler.
* Click on the endpoint to delete that and return to previous, shorter length of the ruler.
* Click on an anchor point and hold <kbd>Shift</kbd> to move the anchor point only in horizontal or vertical of the origin point. This is called to "keep the axial direction".

### Curve ruler, opisometer

When you click the opisometer ruler you, your cursor changes to a cross. You need to click and hold on the origin of your ruler and draw the opisometer on the map.
* While the cursor is a cross, hold <kbd>Shift</kbd> to disallow path optimization.
* Click and hold on the label or the line to drag the opisometer.
* Click on the circle at the end to extend the opisometer.

### Route opisometer
When you click the opisometer ruler you, your cursor changes to a cross. You need to click and hold on the origin of your ruler and draw the opisometer on the map.
* Draw the opisometer to follow the length of a route.
* Click on the circle at the end to extend or shorten the opisometer.

### Planimeter
When you click the planimeter button, your cursor changes to a cross. You need to click and hold on the origin of your ruler and draw the planimeter on the map.
* The planimeter will cover a 2D area.
* While the cursor is a cross, hold <kbd>Shift</kbd> to disallow path optimization.
* The measured area is shown using the area unit set in Units Editor → Distance → Area unit. With the default settings that is `mi²`.

## Routes

In Layers → Routes you can show/hide routes on your map. In Style → select element "routes" you can change the how your routes look. Clicking on a route show their "edit route" menu. This have name, group, length and a row of buttons.

* Name. Write on the text field to rename. Click speaker icon to make the software speak the name in audio. Click earth globe to create a new random name.
* Group. Open the dropdown list to choose from a group. Click on pencil to open "edit route groups". You can add, remove and style route groups.
* Length. Automatically calculated length appears in the length unit that you choose in units editor.
* Pin. Create a new route selecting route cells.
* Chain. Click to join the route to another route that starts or ends at the same cell.
* Broken chain. Click on a control point to split the route there.
* Graphic. Show the elevation profile for the route.
* Edit free text notes (legend) for the route.
* Lockpad. Click to lock route and prevent changes to it by regeneration tools.
* Remove route. Shortcut: <kbd>Delete</kbd> key.

Menu → Tools → Routes (<kbd>Shift</kbd> + <kbd>U</kbd>) opens the "Routes Overview". This shows a list of all routes on a table with sortable headers. Sorted by default by length. Click on a table header to change the sorting criteria. The table shows: Target icon, route name, route group, length, edit, lock and remove icons.
* Clicking on the target icon focus the map on the selected route.
* Edit icon opens the "edit route" menu.

At the botton there is:
* Total routes number.
* Average length of a route in distance units.
* Refresh the editor.
* Pin. Create a new route selecting route cells.
* Save routes-related data as a text file (.csv).
* Lock or unlock all routes.
* Remove all routes.

## Scale bar

At the bottom of your map you can see a scale bar. The scale bar is automatically adjusted to the distance unit you are using, the size of your world and the zoom you have. You can customize it at: Style → select element → Scale Bar.

## Grids

Grid can be used to refer to several things. Grids due to the voronoi cells that create the map or aesthetic grids that are placed on top. Voronoi cell grids are discussed on another page, here we will talk about the aesthetic grids that can be activated and deactivated. These are called "overlay grids" or "grid overlay".

to show/hide the grid go to: menu → layers → grid. You can customize the look and features of your grid in style → select element → grid. In style you can customize:
* **Opacity** of the grid. From 0 invisible to 1 visible.
* **Type**. Ten tilings are available:
    * Hex grid (pointy). Hexagons joined horizontally at the sides, so they have two vertical vertices.
    * Hex grid (flat). Joined vertically at the sides, so they show two horizontal vertices.
    * Square grid. Squares parallel to the ground.
    * Square 45 degrees grid. The same squares rotated so the cells run diagonally.
    * Truncated square grid. Alternating octagons and small squares.
    * Tetrakis square grid. Each square divided into triangles.
    * Triangle grid (horizontal) and Triangle grid (vertical).
    * Trihexagonal grid. Alternating hexagons and triangles.
    * Rhombille grid. Rhombi arranged in a cube-like pattern.
* **Scale**. Default 1. Min: 0.1. Max: 10. Set the scale of the grid overlay.
* Next to the scale is the read-only **distance** between grid cell centers in map scale. At the default distance scale of 3, grid scale 1 corresponds to 75 distance units, scale 0.1 to 7.5 and scale 10 to 750. The selected distance unit is used for the label.
* **Shift by axes**. The input fields are shifting in X or Y axis in pixels. By default 0, 0.
* **Stroke color** of the grid. Color selector.
* **Stroke width**. The line that draws the grid. By default 0.5. Min: 0. Max: 5.
* **Stroke dash**. Write number on the input field to select a pattern. The first number is the length of the line, the second is the length of the blank space. Linecap is the border of the line. Choose from inherit, butt, round, square for linecap.
* **Filter**. Apply predefined filters on the grid element.
* **Clipping**. No clipping (appear everywhere), clip water (appear only on land), clip land (appear only on water).

### Scale on the grids

All grids have the same distance between cell centers. By default this scale is 1. You can change both "grid scale" and units editor → "distance scale" (how many units is one pixel) to fit your needs.

![Hex grid flat](https://github.com/user-attachments/assets/1877f0bb-829b-49ff-9caa-66e41d450329 "Hex grid (flat)")
![Hex grid pointy](https://github.com/user-attachments/assets/39b63f0b-e809-4589-aecc-72e17b04566c "Hex grid (pointy)")
![Square grid](https://github.com/user-attachments/assets/f22b0835-5ced-4685-9091-8274365a7e4a "Square grid")
![Square 45 degrees](https://github.com/user-attachments/assets/65c99617-a85b-43a3-9909-8d9ab96e4389 "Square rotated 45 degrees")

In a square grid rotated 45 degrees, the cells are in diagonal.

![Square grid truncated](https://github.com/user-attachments/assets/1e4ccc9b-d78f-4e4c-ad0f-18c02c73b2ca "Truncated square grid")

In this truncated square grid, the distance between two squares and two octagons is the same.

![Square tetrakis](https://github.com/user-attachments/assets/47033791-91e5-4bf7-b947-f277def3712d "Tetrakis square grid")

In this tetrakis square grid, each square is divided by four smaller squares and eight triangles.

![Triangular horizontal](https://github.com/user-attachments/assets/5f259831-f034-46ca-ad59-bb6d9eb48434 "Triangle grid (horizontal)")
![triangular vertical](https://github.com/user-attachments/assets/5cfb88ca-713c-45ee-b00e-4cb5ed0684e4 "Triangle grid (vertical)")
![Trihehagonal grid](https://github.com/user-attachments/assets/ea12005a-8151-4f01-ad06-78ca76746698 "trihexagonal grid")
![Rhombille grid](https://github.com/user-attachments/assets/aee10502-6b49-419f-be8f-2bdc1fce00fd "Rhombille grid")


The distance of the ruler is the same on all images. To know more about these tilings, you can read the [wikipedia page on euclidean uniform tilings.](https://en.wikipedia.org/wiki/List_of_Euclidean_uniform_tilings).
