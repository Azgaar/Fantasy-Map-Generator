# Runtime Compatibility Inventory

This inventory records deliberate browser-global seams retained after the legacy runtime cleanup.
New `src/` modules import their dependencies; a global remains only for an on-demand third-party integration or a documented classic compatibility surface.

| Runtime surface | Load / owner | Workflow | Compatibility reason |
| --- | --- | --- | --- |
| `window.Dropbox` | `services/io/cloud.ts`, loaded on demand | Dropbox save and load | Dropbox SDK is an optional external integration. |
| `window.JSZip` | `services/io/export.ts`, loaded on demand | PNG tile archive export | Archive generation remains optional and is not in the startup bundle. |
| `window.RgbQuant` | `controllers/heightmap-editor.ts`, loaded on demand | Image-to-heightmap palette reduction | Image quantization is optional and retains the vendored library until a replacement proposal is approved. |
| `window.tinymce` | `controllers/notes-editor.ts`, loaded on demand | Rich-text map notes | TinyMCE is a legacy optional editor integration. |
| `window.Services`, `window.Controllers` | `services/index.ts`, `controllers/index.ts` | Supported classic markup and browser API | Transitional public API for existing commands and dynamic legacy markup. |
| Unit input globals | `services/units-settings.ts` | Map settings, map serialization, historical map loading | Controller-owned detached inputs preserve the legacy value API while the units dialog is mounted only on demand. |

Removed startup globals: Alea, FlatQueue, Simplify, and the `ldb` IndexedDB wrapper. The service worker remains a public asset and is not an application-runtime module.

## Persistent workspace ownership

`src/index.html` retains the map SVG, loading and drag/drop shells, persistent workspace chrome, the React tools mount root, file-input infrastructure, and `#defElements`. The Vite definitions plugin still reads `#defElements` directly, so it remains a deliberate build-time boundary.

The former static side-panel bodies are mounted before their established bindings run, with their IDs preserved during this structural first move:

| Panel | Owner |
| --- | --- |
| Layer controls | `components/layers/layer-panel.ts` |
| Generation and preferences | `components/options/options-panel.ts` |
| Style controls | `components/style/style-panel.ts` |
| Heightmap customization | `components/options/customization-panel.ts` |
| About | `components/app-info/about-panel.ts` |
