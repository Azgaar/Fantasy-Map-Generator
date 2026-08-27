By default, when you open the software, a random map is generated (according to the saved, customizable settings).

This can be changed, so that when the software is opened, it will display the last saved map (instead of generating a new one).

What is shown to the user when opening the software, is the map (with a certain composition of layers that will be described later), its scale, as well as a button that allows opening the tab menu of fmg.

The first time the software is activated, the layers shown on the map are of the predefined layer group "Political Map".
The following times what will be active is the predefined group of layers that you selected last time.

# Controls
Understanding the different types of controls that make up the user interface can contribute to a general understanding of fmg.

For example, the paint brush button appears in many windows, and in all of them it has a similar meaning - opening the element in the design tab. Instead of explaining every time what this button does, in each separate window, you can describe the operation of the button once, for all the places where it appears.

## General controls
These elements appear in many places in the UI, for example in the various windows.

### Windows
Such as the various editors.

### Legends 
A panel that displays a description of a certain element.

This is a non-closeable window. Instead, it closes automatically when the mouse cursor leaves the element to which the legend belongs.

For example, when going over a regiment, it will be displayed for example:

### Tables
Such as the tables that appear in the overview windows.

#### Features
##### Sorting
If the element has a numerical value, it will be possible to sort in ascending or descending order.

If the element has an alphabetical value, it will be possible to sort alphabetically, in ascending or descending order.

The sorting criterion will appear next to the column of the table, for example:

![image](https://github.com/user-attachments/assets/5e4e133e-01d7-4941-9ea0-cef7df0c6f84)

Here the biome column in the biomes table is shown, with the table sorted by biome names, in alphabetical order.

### Buttons
#### Adding an element
![image](https://github.com/user-attachments/assets/2ccbfb57-d902-436e-810f-c61acd5883d6)

#### Deleting an element
![image](https://github.com/user-attachments/assets/493af060-3d18-420a-9d07-2c32d26cb032)

#### Play an element name
![image](https://github.com/user-attachments/assets/5786f119-11dc-4024-9db8-8bcd65f580d4)

#### Opening a style editor for an element
![image](https://github.com/user-attachments/assets/3aa4cb9f-ae2e-47cd-866f-1e7763d6a9b3)

#### Focus on an element
![image](https://github.com/user-attachments/assets/f0e2a635-cfaf-46d9-b3f7-a5f830910091)

#### Opening a wiki guide for an element
![image](https://github.com/user-attachments/assets/7ef572ad-d0c6-42f5-b658-0bc8b6b8295e)

#### Lock buttons
![image](https://github.com/user-attachments/assets/8dc84a92-a4fb-4d86-a95e-936530493261)

If you want the next map to have a fixed value, and not regenerated, you can lock a certain value using a lock button. The button is found, for example, in the options tab, but also in some editors.

In general, whoever wants to generate a map with fixed characteristics, he should lock everything possible.
## Unique controls
### Map
The map, that can be presented in several view mode.
### Bottom label tooltip
When moving over a certain element (on the map or in the windows), a description of it will appear below.

In addition, if it is relevant, a description of what can be done with the control will appear.

In addition, if it is relevant, a shortcut for activating the control will appear.

For example, when going over the layer control of the rivers:

![image](https://github.com/user-attachments/assets/edc9e00f-70a0-4e6a-89cd-f8bf0545a0c3)

### Opening the tab menu
By clicking on the upper left triangle.

Or by the keyboard shortcut Tab.

![image](https://github.com/user-attachments/assets/9c405153-520b-4d16-8b3e-6e38064f4a1e)

### New map generators

By hovering over the upper left triangle, a new map generator command will open.
or by the shortcut F2.

![image](https://github.com/user-attachments/assets/544497f4-4fa1-4a8f-88c0-31a8fc8c7282)

## Zooming

There are several way to zoom:

Using the mouse by Double click,

Using the keyboard by Pressing + (plus) and - (minus), or press numbers (from 0-9, The higher the number, the higher its zoom level).

There is also support for touch screen and mouse pad.

## Moving on the map

By dragging the mouse, or by the navigation keys (right, left, up and down).

# Menu

FMG menu contains 5 tabs: Layers, Style, Options, Tools and About.

Any of the tabs contain the Lower Menu Section.

## Changing the menu size

Use the _Interface size_ slider in the Options tab.

## Tabs shortcuts

### Layers Tabs shortcuts

Ctrl + click on a certain toggle will turn on the layer and will also navigate to the style editor tab configured for the element of the layer.

For example, if you click on the rivers layer with ctrl pressed, you will navigate to:

![image](https://github.com/user-attachments/assets/87cff977-2385-4626-a97c-6ec5dc59db6c)

## Lower section 

The buttons on the Lower Menu Section is in any of the menu tabs.

## New Map

Generates a new map (according to the settings in the Options tab).

The map size depends on the screen size, as fmg tries to fill the entire screen. Alternatively, you can edit the resolution in the "options" tab.

## Export

Export the map to a certain format.

### Download image

There are several buttons for downloading images in different formats (svg, png, jpeg).

Note: Generator uses pop-up window to download files. Please ensure your browser does not block popups.

There is also a buttons to download a zip of several tiles (in a separate png file) of the map. After click the tile button, a new window will pop up, allowing the user to select number of Columns and Rows.

### Export to GeoJSON

There are several buttons for downloading data in GeoJSON format: cells, routes, rivers, markers, or zones.

### Export To JSON

There are several buttons for downloading some data in JSON formats.

## Save

Saving a file in .map format, which contains the current state of the map, so that we can load it in the future using the load button.

### Save options

#### Machine

Save to local PC.

#### Dropbox

Saving to the dropbox account, if connected.

#### Browser

Saving to the browser's memory.

## Load

Loading a previously saved map.

The buttons correspond to those of the save window.

## Reset Zoom

Reset zoom to its initial position.

# Layers

Additional layers of information can be displayed on the map to enrich it.

A map without layers will be a completely white map, only showing the land on the surface of the ocean, and lakes if there are any.

Each layer is a toggle, which means that clicking on a certain layer will cause it to be displayed or removed from the map.

For example, the "Rivers" layer will display the rivers on the map. Clicking again on the rivers layer will hide them.

Some full-map layers, such as Heightmap, Biomes, and Texture, compete for the same visual area; opacity, clipping, and layer order determine how they combine.

You can drag the different layers and thus change their display order.

When a certain layer is pressed, and you hover over some element in the map that is relevant to the layer, the lower label will display relevant information. For example, if the Heightmap layer is on, hovering over a cell will display its height.

In addition, you can press ctrl and a certain layer, to navigate to the style tab when it is configured to customize the display of the layer you clicked on. For example, if you click on the rivers layer, you will navigate to:

![image](https://github.com/user-attachments/assets/87cff977-2385-4626-a97c-6ec5dc59db6c)

## Layers classification

### Full-map layers

Texture, Heightmap, Biomes.

These layers cover the map area and can obscure other layers depending on their current opacity and clipping settings.

The one that will be displayed is the one that appears last in the order of the layers (to change, you can drag the layers and change their display order).

The other layers can hide parts of other layers, but they cannot hide the entire map.

Note: their opacity and clipping can be changed in the Style tab.

### semi opaque layers

Religion, Cultures, States, and Temperature are generally semi-opaque overlays and can be combined, subject to their styles and layer order.

These layers are drawn on the entire map, but they do not completely hide the above 3 layers, and they can work with each other without full hiding.

## Presets

A dropdown that displays a set of predefined layers.

For example, the group of layers called "political map", contains (and toggle) the layers of the states, borders, rivers, etc.

Available presets: Political map, Cultural map, Religions map, Provinces map, Biomes map, Heightmap, Physical map, Places of interest, Goods map, Trade animation, Military map, Emblems and Pure landmass.

## Biomes

This layer shows the division of the land into biomes.

When this layer is on, when hovering a cell, its biome will be displayed in the tooltip. Biome is a term from the field of ecology that describes a large-scale ecosystem that is characterized by environmental conditions such as climate, the type of soil, and the flora and fauna that characterize it. For example, tropical rainforests, deserts, tundra, savannas, etc. Each of the biomes is characterized by a unique ecosystem of living species found in it naturally and in the environmental conditions that prevail there.

Default biomes, in generator order:
* Marine (id 0, water cells)
* Hot desert
* Cold desert
* Savanna
* Grassland
* Tropical seasonal forest
* Temperate deciduous forest
* Tropical rainforest
* Temperate rainforest
* Taiga
* Tundra
* Glacier
* Wetland

Biomes, their colors, habitability and movement cost can be edited in the Biomes Editor (<kbd>Shift</kbd> + <kbd>B</kbd>).

In general, the biomes are derived from the topographical map (which can be edited in tools or options), and from the temperature (which can be edited in configure world).

## Icons

This layer shows the icons of the burgs. When this layer is on, when hovering a burg icon, an offer to edit it will be displayed, along with its name and its population will be displayed in the tooltip.

## Heightmap

This layer shows the topographical map. When this layer is on, when hovering a cell, its height will be displayed in the tooltip. A topographic map describes the height (relative to sea level) of the map at the various points (cells). All secondary data (rivers, cities, countries, markers, etc.) depend on the topographical map, so it is of great importance.

Each cell is associated with a height, which is a number between 0 and 100.

# Style tab

The style tab allows applying design settings, both in general to the entire map, and privately to certain elements, such as the color of elements, their degree of opacity, etc.

This is the final stage in the preparation of the map, after all its logic is ready.

After choosing an element for design (eg Anchor Icons or biomes), you can customize its design with a variety of controls.

For many of the elements there are the same design controls with the same functionality, below is their breakdown:

![image](https://github.com/user-attachments/assets/f4277f5d-e45a-440c-83f6-52f2e02cab71)

Sometimes, elements are divided into groups. For example, by default, lakes are divided into 6 groups: fresh water, salt water, dry, etc.

You can customize the display of each of the groups separately, for example, a freshwater lake can be drawn in blue, and a saltwater lake can be drawn in red.

Note that next to the group, there is a number that records how many elements there are from the group.


### Opacity 

![image](https://github.com/user-attachments/assets/df451f6d-70f1-4ee7-9599-31f5f4839d23)

A slider that determines the degree of opacity of the element (value between 0 and 1).

If equal to 0, the color of the element will (mostly) be the color of what is below it, for example the color of the river will be the color of the land on which it flows (and if there is a layer that colors the land, it will be the army). Note that there are exceptions, for example for a lake, the color of the element will be the color of the sea.

### Shift by axes

Allows you to shift the layer on the x-axis and the y-axis.

### Filter 

![image](https://github.com/user-attachments/assets/9ae43d89-f729-4ef2-b554-653d295afd5a)

Contains additional display settings on the element, according to a filter. Each filter has certain display settings.

For example, Blur 1 creates a light blur around the element, while Blur 3 creates a heavier blur, while Blur 10 completely blurs the element, effectively hiding it.

This is known as a filter, because you put a "lens" over the object that makes a visual effect on it, for example a blur, or a wrinkled look. It could be called "effect" (on the element).

Filters: none, Blur 0.2, Blur 1, Blur 3, Blur 5, Blur 7, Blur 10, Splotch, Blurred Splotch, Shadow 2, Shadow 0.1, Shadow 0.5, Outline, Pencil, Turbulence, Paper, Crumpled, Grayscale, Sepia, Dingy and Tint.

### Clipping 

![image](https://github.com/user-attachments/assets/333f4c01-e7b6-4282-9518-b7f2da6433a2)

Dropdown that allows you to choose whether the layer will apply to the land, the sea, or both.
#### No clipping 
The layer will apply to the entire map, including the sea and including the land.
#### Clip water 
The layer will only apply to the land.
#### Clip land 
The layer will only apply to the sea.

### Common style controls (Fill related)

#### Fill color

![image](https://github.com/user-attachments/assets/d4a949b7-2336-4ac7-a50f-fbc402be9bb7)

Sets the element's fill color.

### Common style controls (Stroke related)

Stroke is the line that surrounds the element.

#### Stroke color

![image](https://github.com/user-attachments/assets/7890332c-1d38-402a-b1c5-6967ee451142)

Sets the fill color of the stroke.

#### Stroke width 

![image](https://github.com/user-attachments/assets/9b3cf590-42ec-4f4b-adce-952aae223698)

Slider that determines the width of the stroke.

The lower the value, the thinner the line will be, to the point of non-existence, and conversely, the higher the value, the thicker the line will be.

### Common style controls (Font related)

#### Font size

![image](https://github.com/user-attachments/assets/347bad04-5b45-451f-8f29-d6c58c0844db)

Determines the font of the text relevant to the element.

### Common style controls (dotted lines related)

#### Stroke dash

![image](https://github.com/user-attachments/assets/6d467a97-a379-4e5a-9d69-d775ab850b23)

This style control contains 2 parts of data.

The number determines the spacing between the dash marks that make up the dashed line.

Value 0 determines that there will be no spaces. The higher the value, the greater the distance between dashes.

The dropdown allows you to determine the appearance of the ends of the dash endcaps that make up the dashed line.

Butt – The dashes have no effect. The line ends exactly at the ends of its starting and ending points, without extending the line beyond these ends.

Square - There is a small addition along the line. More precisely, adds a rectangle at the end of the line, where the width of the rectangle is half the width of the line and the height is equal to the width of the line.

Round - Expand the line at its end using a semicircle, whose diameter is equal to the width of the line.

Inherit - takes the varian of its parent elements, basically a default value.

## Style presets

![image](https://github.com/user-attachments/assets/0fd99cd1-5e52-4d70-b137-379bda19ecb3)

Dropdown that allows you to choose a set of design settings for all elements.

Each of those sets defines its design settings for each of the elements, for example the ancient preset defines the texture of the land to be with the image setting to be ancient small, and the Clipping setting to be No clipping.

Available presets: default, ancient, gloom, pale, light, watercolor, clean, atlas, darkSeas, cyberpunk, night and monochrome. The **+** button saves the current style as a custom preset, and the **−** button removes the selected custom preset.

**+ button** Allows you to add your own set of settings.

## Global filters
![image](https://github.com/user-attachments/assets/15994c62-1bed-4068-a99d-7d32008892a2)

Allows global filters to be applied to all map elements: Grayscale, Sepia, Dingy, Tint.

## Heightmap styling

Contains some common style controls and the following controls:

### Terracing  slider

![image](https://github.com/user-attachments/assets/1f09d100-1fa4-484a-b00b-ee9d2f066720)

A slider that determines the Terracing power(value between 0 and 20), That determines the strength of the rating between the different colors.

The higher the value, the greater the separation between different colors, which gives the impression of a three-dimensional topographical map.

The above effect is achieved through the visual effect of giving a "shadow" to the height cells, so that it will appear that they are one on top of the other, or "creating terraces" in separate planes, each plane at its own height level.

### Reduce layers

![image](https://github.com/user-attachments/assets/340ae86e-74ec-417b-9c76-8c7caba850b6)

A slider that controls the reduction rate value (value between 0 and 10).

The elevation map consists of "elevation layers".

The reduction rate determines the number of displayed layers (inversely - the higher the reduction rate, the smaller the number of displayed layers).

The higher the number of layers, the more uneven the map will look.

The smaller the number of layers, the more uniform the map will look, when neighboring height cells will be the same color more likely.

Note: this does not affect the height of the map cells, only the display. If you hover neighboring cells on the map, you will see that although they appear to have the same height because of the color, the bottom tooltip will show a different height.

Increasing the reduction rate value increases the performance of fmg.

### Simplify line

![image](https://github.com/user-attachments/assets/077c1f69-0f8a-4452-80a7-eb1ca3ff7203)

A slider that determines the value of the line simplification rate.

When this value is reset, the borders of the topographic map colors will be according to the borders of the map cells.

The higher the value of the line simplification rate, the more the borders of the colors of the topographic map will merge with each other, in such a way that the borders of the colors curve towards each other.

When the value of the line simplification rate is high, the height is illustrated in a better way, thanks to the illusion of depth that the effect gives. For example, the bright orange color is "above" the green color, and above it there is a ring of a darker orange color, and above it there are rings of army red, and above it there are rings of a dark burgundy color.

Increasing the value of the line simplification rate increases the performance of fmg.

### Line style

![image](https://github.com/user-attachments/assets/7f04c7e4-402f-495f-bd75-9c7668b839e5)

Dropdown that allows you to choose the line style of the "height cells". In this context, a "height cell" is a cell painted with a color that represents a certain height.

To understand what the slider does, you should turn on the cell layer.

#### Curved 

In this view, the "elevation cells" extend approximately next to the map cells, so instead of extending exactly over the cell lines, the lines are rounded, to create a more natural look.

#### Linear  

In this view, the "elevation cells" span just above the map cells.

#### Rectangular  

In this view, the "elevation cells" extend approximately next to the map cells, so that instead of extending exactly over the cell lines, the lines are "squared", to create a more pixelated look.

### Color scheme 

![image](https://github.com/user-attachments/assets/f727305e-9d04-4314-a84d-d8ad292b8f96)

Dropdown that allows changing the color scheme, so that each height will be represented in a different color according to the color scheme.

For example, in the default set (Bright), the dark burgundy color represents the highest cell, while in the natural set, the highest cell will have a white color. And so each height will have a slightly different color in the different color schemes.

Available color schemes: bright, light, natural, green, olive, livid and monochrome. The **+** button next to the dropdown lets you define a custom scheme from a list of color stops.

# Map Settings

These settings are applied when you generate a new map.

* Canvas size: Map size in pixels. The button on the left resets the default size. Note: There is no way to change the map size after the map is created and it is always recommended to use the default value.

* Map seed: A number that defines the generation of random values. Every time you generate a new map, a new seed number is set here, which together with the size of the map and the options in the map settings menu, creates a random map. Please note – for 2 maps that have the same map size and the same options and the same number of seed, the maps will be identical. The button on the left side allows you to browse between seed values ​​of previous generators.

* Points number: A slider that defines the number of points (cells), from 1K up to the largest step on the slider. The higher the number of points, the more detailed the map and the smaller each cell, but the worse the performance. The default is 10K. If your computer is powerful and you do not experience performance issues, choose a higher value.

* Map name: This will be the name under which the map will be saved. On the right, there is a button that allows you to replace with a new generator name.

* Year and era: The current year and the name of the current era. They are used by some generated names and text, but FMG does not run a time simulation.

* Heightmap: Opens the topographic map selector, which is intended for selecting a template intended for creating a topographic map. For example an archipelago, a group of continents, etc. You can create your own template, or modify the existing templates.

* Cultures: a slider that determines the number of cultures.

* Cultures set: Dropdown that contains the group of cultures that will be thrown into the map.

* States number: A slider that determines the number of countries.

* Provinces ratio: A slider that determines the percentage of burgs who have their own districts. A province is a sub-unit of a country, and can be edited in the province editor.

* Size variety: A slider that determines the degree of variation in the territory of the countries. The lower the value, the more uniform the country regions.

* Growth rate: A slider that defines how far countries and civilizations will expand into neutral lands after a generation. The lower its value, the more land will remain politically neutral.

* Burgs number: A slider that determines the number of burgs (settlements). Set it to `auto` to let the generator decide.

* Religions number: A slider that determines the number of religions and sects.

# UI settings

Below the map settings, the Options tab holds settings that apply immediately and are not tied to map generation:

* Interface size and Tooltip size: scale the menu and the bottom tooltip.
* Theme color and Transparency: the color and opacity of the dialogs.
* Autosave interval: how often the map is saved to browser storage.
* Onload behavior: generate a new map or load the last saved one when the page opens.
* Azgaar assistant: show or hide the in-app chat assistant.
* Speaker voice: the voice used by the speaker buttons next to names.
* Emblem shape: the default coat of arms shield shape.
* Zoom extent: minimal and maximal zoom levels, `[1, 20]` by default.
* Rendering: SVG shape-rendering mode, trading quality for speed.
* Language: the interface language.

The **Configure World** button opens a separate dialog where you set the map size relative to the world, its latitude and longitude shift on the globe, the temperature at the equator and both poles, and the global precipitation. The **Restore default options** button resets everything and reloads the page.
