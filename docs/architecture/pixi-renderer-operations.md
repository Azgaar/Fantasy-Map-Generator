# Pixi renderer operations

## Supported browsers

The interactive map requires a current stable browser with WebGL 2 or WebGPU, typed arrays, `ResizeObserver`, Pointer
Events, `OffscreenCanvas`-compatible canvas APIs where provided, and module-script support.

| Browser | Supported channel | Renderer preference | Notes |
| --- | --- | --- | --- |
| Chrome / Edge | Current and previous stable | WebGL; WebGPU opt-in for the viewer | Hardware acceleration must be enabled |
| Firefox | Current and previous stable | WebGL | WebGPU is not a release requirement |
| Safari | Current and previous stable macOS/iOS | WebGL | Custom fonts and canvas memory limits vary by OS |

If Pixi cannot create a GPU renderer, the application shows an accessible error above the map. There is no hidden SVG
renderer fallback. Check browser hardware acceleration, graphics-driver blocklists, canvas/WebGL enterprise policy,
and the browser console. A lost WebGL context is monitored and rebuilds renderer resources after restoration.

## Standalone viewer and embedding

`src/viewer/pixi-map-viewer.ts` exports the direct-module API. The host provides either a version-1 `RenderSnapshot` or
editor-free world/style inputs. The returned handle supports `load`, `setCamera`, `fitBounds`, `setLayers`, `pick`,
`resize`, event subscription, and idempotent `destroy`.

The separate `viewer.html` build installs the versioned iframe bridge from `src/viewer/iframe-bridge.ts`. Configure its
allowed parent origins with a comma-separated `data-allowed-origins` attribute on `#viewer`; do not use `*` for
untrusted hosts. Messages use `{source: "fantasy-map-viewer", version: 1, command, requestId}`. Hosts should serve the
viewer with a restrictive CSP that permits its module chunks, configured fonts/images, and the selected WebGL/WebGPU
backend. Asset servers must send appropriate CORS headers.

The standalone element also accepts `data-snapshot-url`, `data-asset-base-url`, `data-credentials`, `data-worker-url`,
`data-renderer-preference`, and `data-resolution-cap`. A strict same-origin starting policy is:

```http
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors https://trusted-host.example
```

Add explicit HTTPS asset origins to `img-src`, `font-src`, and `connect-src` when using a CDN. Do not broaden
`frame-ancestors` or the bridge origin allowlist to `*` for untrusted hosts.

Example direct-module setup:

```ts
const viewer = await mountPixiMapViewer({
  assetPolicy: {baseUrl: "https://cdn.example/maps/", credentials: "omit"},
  data,
  fonts: [{family: "Map Serif", url: "fonts/map-serif.woff2"}],
  rendererPreference: "webgl",
  resolutionCap: 2,
  surface,
  workerUrl: "workers/scene-worker.js"
});
viewer.fitBounds(undefined, 24);
const unsubscribe = viewer.subscribe(event => console.log(event.type));

// Cleanup when the host view unmounts
unsubscribe();
viewer.destroy();
```

## Raster export

Viewport PNG/JPEG composites the live Pixi canvas with only the retained SVG viewport overlay. Full-map tile export
extracts Pixi frames at a map-scale camera, detects the device maximum texture size, grows the requested tile grid when
needed, renders one-pixel overlaps, crops each overlap exactly once, reports progress, supports cancellation, and
removes temporary canvases deterministically. Scale bar, legend, and vignette are composited once in full-map
coordinates; migrated feature geometry is never reconstructed in SVG.

The same full-map compositor supplies transform previews and 3D mesh/globe textures, including hidden-layer and
no-water/no-label requests. SVG download is intentionally unavailable: a vector exporter would have to consume the
renderer-neutral scenes directly, and cloning the compatibility overlay would produce an incomplete map.

## Diagnostics and benchmarks

`npm run benchmark:renderer` records the fixed fixture, active layer set, browser and user agent, Pixi version, GPU
backend, viewport/canvas resolution, scene-build and GPU-submit timings, camera/layer timings, long tasks, DOM size,
heap where available, and renderer resource counts/bytes. See
[`../performance/pixi-reference-profiles.md`](../performance/pixi-reference-profiles.md) for the controlled profiles.
