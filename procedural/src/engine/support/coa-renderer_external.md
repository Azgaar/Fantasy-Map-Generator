# coa-renderer_external.md

External Dependencies for coa-renderer.js
The refactored coa-renderer.js module has one critical external data dependency that must be provided by the calling environment.

- Required Data Dependencies
- chargesData
- Type: Object
- Description: An object that serves as a map between a charge's name and its raw SVG content. The engine no longer fetches these files itself; the Viewer/Client is responsible for loading them and passing them into the render function.
Structure:

```javascript
{
  "chargeName1": "<g>...</g>", // The raw <g> tag content of the charge's SVG
  "chargeName2": "<g>...</g>",
  // etc.
}
```

Example:

```javascript
const chargesData = {
  "lion": '<g><path d="..."/></g>',
  "eagle": '<g><path d="..."/></g>'
};
```

## Notes on Viewer Implementation

The Viewer application is now responsible for the I/O operations previously handled by the engine. It must:

- Identify all unique charges required for a set of Coats of Arms.
- Fetch the corresponding SVG files (e.g., from a /charges/ directory).
- Read the content of each file into a string.
- Assemble the chargesData object.
- Pass this object to the coa-renderer.render() function.

This change ensures the core engine remains free of environment-specific APIs like fetch and is fully portable.