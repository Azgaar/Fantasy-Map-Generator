# Pixi standalone viewer

The M12 viewer mounts the production `PixiMapRenderer` without the editor shell, classic scripts, SVG map stack, or
global `pack` state. The direct-module API and iframe bridge consume the same versioned, immutable `RenderSnapshot`.

## Entry points and build

- `src/viewer/pixi-map-viewer.ts` exports the editor-independent API.
- `src/viewer/iframe-bridge.ts` provides the version-1, origin-checked `postMessage` wrapper.
- `src/viewer/pixi-viewer-entry.ts` and `src/viewer.html` form the standalone iframe build.
- `npm run build:viewer` writes the standalone artifacts to the ignored `dist/viewer` directory.

The 2026-08-24 reference build produced a 20.04 kB entry chunk (7.09 kB gzip), a lazy 427.24 kB renderer chunk
(127.49 kB gzip), and separately cached Pixi backend/system chunks. The viewer stylesheet is emitted as a separate
asset so a strict `style-src 'self'` policy does not require inline-style exceptions.

## Public contract

The host supplies an HTML surface and either a version-1 `RenderSnapshot` or editor-free world/style inputs. The
returned handle supports `load`, `render`, `setCamera`, `fitBounds`, `setLayers`, `pick`, `resize`, event subscription,
and idempotent `destroy`. Input handling supports pointer drag, two-pointer pinch, wheel zoom, and click picking.

Configuration includes:

- asset base URL, custom resolver, and fetch credentials;
- managed font URLs and `FontFace` descriptors;
- worker URL passed to custom renderer/worker factories;
- WebGL/WebGPU preference and resolution cap;
- reduced motion, which disables the animated trade layer.

Configured texture URLs are resolved before the immutable snapshot reaches the renderer. The production viewer uses
strict asset mode: missing textures, emblems, relief/symbol images, external marker/regiment images, and fonts reject
the render with an asset-specific error. Font responses use the configured credentials and registered faces are
removed when the viewer is destroyed.

The viewer restores its size and camera when its owner document becomes visible after a hidden-tab transition. All
input, visibility, font, and renderer resources are released on destroy, and multiple instances keep independent
camera, layer, event, and resource state.

## Standalone element configuration

The standalone entry reads optional attributes from `#viewer`:

- `data-snapshot-url`, `data-asset-base-url`, and `data-credentials`;
- `data-worker-url`, `data-renderer-preference`, and `data-resolution-cap`;
- `data-allowed-origins`, a comma-separated iframe parent allowlist.

Asset hosts must provide suitable CORS headers. The checked-in static fixture has no required external assets and is
used only as the initial/diagnostic scene when no snapshot URL is configured.

## Verification

Unit coverage includes version validation, load/error events, two viewers on one page, repeated destruction, explicit
resize, hidden-tab restoration, cross-origin URL/credential resolution, managed fonts, strict missing-asset errors,
iframe origin/version checks, and mobile pointer gestures. `npm run build:viewer` is the compile and bundle-size gate.
Browser visual/startup proof remains an environment gate when in-app browser automation is unavailable.
