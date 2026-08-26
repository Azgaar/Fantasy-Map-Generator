The **heightmap editor** allows you to create and customize the heightmap manually, giving you more control over the world's terrain, unlike random generation.

To access the Heightmap Editor, you can either:
1. Navigate to Tools > Heightmap in the menu. (Look at the image below)
2. Use the hotkey <kbd>Shift</kbd> + <kbd>H</kbd>.

<details>
<summary>Show Image</summary>

![Heightmap Editor Menu](https://github.com/ZZWILLIAMXXTrue/FMG-Console-Codes/blob/main/Image/Heightmap%20Selection.png)

</details>

### Modes
The heightmap editor offers three different modes to choose from. Its recommended to save your map beforehand.
1. **Erase**:
   - This mode regenerates all data on your map, including cultures, states, biomes, and more.
   - It offers the most customization features, such as the image converter and template editor.

2. **Keep**:
   - This mode allows you to retain most of the map's existing data.
   - However, it does not allow changes to the coastline.

3. **Risk**:
   - This mode allows you to keep most of the map's data while also allowing changes to the coastline.
   - Note that using this mode can potentially cause some errors.

<details>
<summary>Show Image</summary>

![Modes](https://github.com/ZZWILLIAMXXTrue/FMG-Console-Codes/blob/main/Image/Heightmap%20Selection%202.png)

</details>

### Heightmap Editor Features

The Heightmap Editor includes tools to help you create and customize your map. Below is a detailed list of all available features:

- **Paint Brushes**:
  - Automatically opens and allows you to edit the map.
  - Use different brushes to draw and modify the height.

- **Template Editor**:
  - Edit, load, or create templates for your heightmap.

- **Image Converter**:
  - Convert images into heightmaps.

- **Preview**:
  - Displays a monochromatic image of the map in the bottom left corner.
  - You can click the image to download it.

- **3D Scene**:
  - Opens the map in the app's 3D preview.
  - Allows for a more immersive view of the map's shape and features.

- **Render Ocean Cells**:
  - Renders or hides ocean cells in the editor preview.
  - It does not enable or disable ocean cells in the map.

- **Allow Water Erosion**:
  - Simulate water erosion effects on the terrain.
  - Adds realism to the map by shaping the landscape according to water flow.

Once you are satisfied with the heightmap, click **Exit Customization** in the bottom right. The map must have at least 200 land cells, and the Image Converter must be closed first.

<details>
<summary>Show Image</summary>

![Features](https://github.com/ZZWILLIAMXXTrue/FMG-Console-Codes/blob/main/Image/Heightmap%20Features.png)

</details>

## Paint brushes

  - **Raise**: increases the height of cells in radius by the Power value; drag for continuous use.
  - **Elevate**: drag to gradually increase the height of cells in radius by the Power value.
  - **Lower**: drag to decrease the height of cells in radius by the Power value.
  - **Depress**: drag to gradually decrease the height of cells in radius.
  - **Align**: drag to set the height of cells in radius to the height of the cell under the cursor.
  - **Smooth**: drag to level the height of cells in radius towards the height of the adjacent cells.
  - **Disrupt**: drag to randomize the height of cells in radius based on the Power value.
  - **Fill**: click an enclosed water area or a same-height land area to create a cone-shaped blob.
  - **Line**: select two points to change the heights along a line — useful for ridges and trenches.

### Sliders
  - **Size**: brush radius (1–100). Shortcut: <kbd>+</kbd> / <kbd>-</kbd>, or <kbd>[</kbd> / <kbd>]</kbd>.
  - **Power**: brush intensity (1–10). Not used by the Align brush.
  - **Power** (Line tool): the height change along the line, from -100 to 100.
  - **Randomness** (Line tool): line jitter — zero makes the line as straight as possible.

### Cells to change
A dropdown restricting which cells a brush may touch: _all cells_, _only land cells_ or _only water cells_. Restricting to land or water prevents the brush from moving the coastline.

### Footer Buttons
  - **Undo** (<kbd>Ctrl</kbd> + <kbd>Z</kbd>): step back. Works only within heightmap customization.
  - **Redo** (<kbd>Ctrl</kbd> + <kbd>Y</kbd>): step forward.
  - **Rescaler**: a slider that shifts all heights up or down.
  - **Conditional rescaler**: applies an operation to heights within a given interval — "if height is between X and Y, then do Z with operand V".
  - **Smooth**: smooths all heights a bit.
  - **Disrupt**: randomizes all heights a bit.
  - **Clear**: sets all heights to 0 (erases the map).

<details>
<summary>Show Image</summary>

![Brushes](https://github.com/BroCrows/FMG-Console-Codes/blob/main/Image/paintbrushes.png)

</details>

## Template Editor

Please see [Template Editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor).


## Image Converter

Once opened, you'll be asked to select an image from your files.

- **Upload Image**:
  - Here you can upload a different image you’d like to convert into a heightmap.
  - Recommended are monochromatic images with black representing the ocean.

- **Auto-Assign Colors Based on Luminosity**:
  - This option assigns the colors to heights based on their luminosity.
  - Good for monochromatic images.

- **Auto-Assign Colors Based on Hue**:
  - This option assigns the colors to heights based on their hue.
  - Suitable for maps with differing colors.

- **Auto-Assign Colors Based on Generated Scheme**:
  - This option assigns the colors to heights based on Azgaar's bright color scheme.
  - Ideal for maps made with the generator.

- **Set Maximum Amount of Colors**:
  - Allows you to set the number of colors to quantize the image to (100 by default).
  - The converter may produce fewer colors than the requested maximum, depending on the source image and palette.

- **Overlay opacity**:
  - A slider that fades the source image over the heightmap being built, so you can trace it.

- **Cancel the Conversion**:
  - Cancel the image conversion and revert back to the previous map.

- **Complete the Conversion**:
  - Fully loads the map into the Fantasy Map Generator.
  - All unassigned colors will default to ocean.

Colors are listed in two groups — _Assigned colors_ and _Unassigned colors_. To assign a color by hand, click the color you want to edit and then pick the height on the slider above. Click an already assigned color to re-assign it.


<details>
<summary>Show Image</summary>

![Converter](https://github.com/BroCrows/FMG-Console-Codes/blob/main/Image/paintbrushes.png)

</details>
