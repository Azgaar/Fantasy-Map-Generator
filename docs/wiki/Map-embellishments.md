Version 1.153.0 adds engraved terrain and water effects, illustrated icons and more label styling. These controls change the map's appearance and are saved with its style.

## Start with a preset

Choose a preset at the top of the **Style** tab:

- **Ink** uses a black-and-white engraved look.
- **Cinderwood** combines warm parchment, illustrated relief and settlement icons.
- **Frostbite** uses a cold palette, straight strokes over the sea and shadowed labels.

A preset replaces the map's style settings. Use **+** beside the preset selector to save your current style first if you want to return to it. You can adjust the following controls with any preset.

## Hachures

1. Enable the **Heightmap** layer in the Layers tab.
2. Open **Style → Heightmap** and select **landHeights** or **oceanHeights**.
3. Set **Hachures** to **Over colors** or **Strokes only**. Choose **Off** to remove them.

Hachures are short strokes running down slopes. Steeper slopes produce denser, heavier strokes. Adjust Density, Length, Stroke color, Stroke width and Opacity to change their appearance. For ocean hachures, enable **Render ocean heights** as well.

Hachures and contour lines are display options; neither changes cell elevations. Hachure placement is stable for the same map and settings.

## Ocean waves and coastal bands

Open **Style → Ocean**:

- Enable **Ocean embellishment** and choose **Waves** or **Straight strokes**. Density and Length control the strokes; Reach controls how far they fade into the sea; Coastal gap leaves clear water beside the shore or coastal bands. Stroke color, width, dash pattern and opacity control the line style.
- Enable **Coastline bands** for bands extending out from the shores. Adjust Band count, Band spacing, Outline color and Band opacity. Nearshore color and Shading add a tint over the ocean. Nearby bands merge across narrow straits.

These are drawing effects; they do not move the coastline or change water depth.

## Lake ripples

Open **Style → Lakes**, select a lake group, and set **Embellishment** to **Ripples** or **Straight strokes**. Choose **None** to remove it. Density, Length, Shore gap, Stroke width, Stroke opacity and Stroke color control the effect.

The setting applies to every lake in the group. To style one lake separately, create a group in its Lake Editor and assign the lake to it. See [Geographical Features Overview](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Geographical-Features-Overview#lake-groups).

## Illustrated relief and settlements

- In **Style → Relief Icons**, choose the **Illustrated** set alongside Simple, Colored and Gray.
- In **Style → Burg Icons**, select a burg group and choose an Illustrated icon: Palace, Burgh, Castle, Abbey, Caravanserai or Camp. The group's fill and stroke recolor its icon.
- In **Style → Burg Anchors**, select a group and choose **Anchor** or **Harbor** for its port symbols. Adjust their size and horizontal/vertical shift independently of the burg icon. Shift is measured in icon-size units; positive values move right and down.

These symbol choices style existing settlements and ports. They do not turn a burg into a port or alter its population. The burg icon picker uses bundled symbols; image upload in the general Icon Selector is a separate control used by other editors.

## Label appearance

Open **Style → Labels** and select a label group:

- **Font weight** offers Normal and weights from 100 to 950.
- **Font style** selects Normal or Italic.
- **Text transform** selects None, Uppercase, Lowercase or Capitalize.

Text transform changes the displayed letters while retaining the original name. Cinzel, Iceberg and Snowburst One are available in the font list. Font appearance depends on the selected font and the variants it provides.

Save the `.map` file to keep the finished map. To reuse the style on another map, save a custom preset with **+** and use **Download** in the Style Saver to export its `.json` file.
