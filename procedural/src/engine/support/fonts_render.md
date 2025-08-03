# Removed Rendering/UI Logic from fonts.js

The following code blocks related to DOM manipulation and UI rendering have been **removed** from the engine module and should be moved to the Viewer application:

## 1. Font Option DOM Manipulation

```javascript
function addFontOption(family) {
  const options = document.getElementById("styleSelectFont");
  const option = document.createElement("option");
  option.value = family;
  option.innerText = family;
  option.style.fontFamily = family;
  options.add(option);
}
```

## 2. DOM Font Registration

```javascript
function declareFont(font) {
  const {family, src, ...rest} = font;
  addFontOption(family); // <- UI logic

  if (!src) return;
  const fontFace = new FontFace(family, src, {...rest, display: "block"});
  document.fonts.add(fontFace); // <- Browser-specific DOM API
}

function declareDefaultFonts() {
  fonts.forEach(font => declareFont(font)); // <- Uses DOM
}

// Auto-execution on load
declareDefaultFonts(); // execute once on load
```

## 3. SVG DOM Querying

```javascript
function getUsedFonts(svg) {
  const usedFontFamilies = new Set();

  // Direct DOM querying - moved to viewer
  const labelGroups = svg.querySelectorAll("#labels g");
  for (const labelGroup of labelGroups) {
    const font = labelGroup.getAttribute("font-family");
    if (font) usedFontFamilies.add(font);
  }

  // Global variable access
  const provinceFont = provs.attr("font-family");
  if (provinceFont) usedFontFamilies.add(provinceFont);

  // Direct DOM querying
  const legend = svg.querySelector("#legend");
  const legendFont = legend?.getAttribute("font-family");
  if (legendFont) usedFontFamilies.add(legendFont);

  const usedFonts = fonts.filter(font => usedFontFamilies.has(font.family));
  return usedFonts;
}
```

## 4. UI Notification and Interaction Logic

```javascript
// From addGoogleFont function
async function addGoogleFont(family) {
  const fontRanges = await fetchGoogleFont(family);
  if (!fontRanges) return tip("Cannot fetch Google font for this value", true, "error", 4000);
  tip(`Google font ${family} is loading...`, true, "warn", 4000);

  // ... font loading logic ...

  Promise.all(promises)
    .then(fontFaces => {
      fontFaces.forEach(fontFace => document.fonts.add(fontFace)); // <- DOM manipulation
      fonts.push(...fontRanges);
      tip(`Google font ${family} is added to the list`, true, "success", 4000); // <- UI notification
      addFontOption(family); // <- DOM manipulation
      document.getElementById("styleSelectFont").value = family; // <- DOM manipulation
      changeFont(); // <- UI callback
    })
    .catch(err => {
      tip(`Failed to load Google font ${family}`, true, "error", 4000); // <- UI notification
      ERROR && console.error(err);
    });
}

// From addLocalFont function
function addLocalFont(family) {
  fonts.push({family});

  const fontFace = new FontFace(family, `local(${family})`, {display: "block"});
  document.fonts.add(fontFace); // <- DOM manipulation
  tip(`Local font ${family} is added to the fonts list`, true, "success", 4000); // <- UI notification
  addFontOption(family); // <- DOM manipulation
  document.getElementById("styleSelectFont").value = family; // <- DOM manipulation
  changeFont(); // <- UI callback
}

// From addWebFont function
function addWebFont(family, url) {
  const src = `url('${url}')`;
  fonts.push({family, src});

  const fontFace = new FontFace(family, src, {display: "block"});
  document.fonts.add(fontFace); // <- DOM manipulation
  tip(`Font ${family} is added to the list`, true, "success", 4000); // <- UI notification
  addFontOption(family); // <- DOM manipulation
  document.getElementById("styleSelectFont").value = family; // <- DOM manipulation
  changeFont(); // <- UI callback
}
```

## 5. Global Variable Dependencies

- Access to `provs` global variable
- Calls to `tip()` function for UI notifications
- Calls to `changeFont()` function for UI updates
- Access to `ERROR` global flag

## Summary

All DOM manipulation, UI notification, browser font registration, and SVG querying logic has been removed. The refactored engine module now provides pure data processing functions that the Viewer can use to:

1. Get available fonts
2. Determine used fonts from SVG data structure
3. Fetch Google Font definitions
4. Load fonts as data URIs
5. Create font definitions

The Viewer application should handle all DOM interactions, UI updates, and browser-specific font registration.