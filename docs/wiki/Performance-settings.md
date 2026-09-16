Open the **Options** tab and choose a **Performance** preset. Changes apply immediately; there is no need to regenerate the map.

| Setting | Quality | Balance (default) | Speed |
| --- | --- | --- | --- |
| Shape rendering | Geometric precision | Optimize speed | Optimize speed |
| State halos | Shown | Hidden | Hidden |
| Redraw on zoom | While zooming | While zooming | After zoom |

Choose **Speed** if moving around a large map feels slow. **Quality** keeps the blurred glow along state borders. **Balance** hides that glow while continuing to redraw visible labels, icons and relief during movement.

## Adjust individual settings

Click the cog beside the preset to open **Performance Settings**:

- **Shape rendering** is a hint to the browser about drawing edges. Choices are Geometric precision, Auto, Optimize speed and Crisp edges. Its effect depends on the browser; Optimize speed does not guarantee a speed improvement. Crisp edges can remove edge smoothing.
- **State halos** shows or hides the blurred glow along state borders. Hiding it reduces the cost of drawing the map.
- **Redraw on zoom** controls when labels, icons and relief update during zooming or panning. After zoom redraws once the gesture ends, so newly visible content can appear all at once.

The preset reads **Custom** when the settings do not match one of the three presets. The reset arrow beside a setting restores that setting to its **Balance** value. Selecting Balance in the Options tab restores all three together.

These are application preferences, remembered between sessions. They affect presentation, not the generated geography or population. The Performance controls replace the older separate Rendering and Redraw on zoom options.

For other ways to reduce drawing work, see the [performance FAQ](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A#the-map-performance-is-poor-how-can-i-improve-it).
