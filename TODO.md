# TODO

## GeoJSON Exports (RFC 7946 compliance)

- Geometry in WGS84: Output `geometry.coordinates` as `[lon, lat]` (degrees). Do not include a top-level `crs` member (deprecated in RFC 7946).
- Move custom coords to properties: Keep fantasy/cartesian meters and pixel positions under `properties` (e.g., `fantasy_coordinates: [x_m, y_m]`, `x_px`, `y_px`, `meters_per_pixel`).
- Preserve fields: Continue exporting `id`, `type`, `name`, `icon` (where applicable), style fields (`size`, `fill`, `stroke`), and `note` (legend) if present.
- Update exporters: Apply to all GeoJSON exporters in `modules/io/export.js`:
  - `saveGeoJsonMarkers`
  - `saveGeoJsonRivers`
  - `saveGeoJsonBurgs`
  - `saveGeoJsonRoutes`
  - `saveGeoJsonCells`
  - `saveGeoJsonRegiments`
- Geometry specifics:
  - Points (markers/burgs): `[lon, lat]` via `getLongitude(x)`, `getLatitude(y)`.
  - Lines (rivers/routes): arrays of `[lon, lat]`; keep width/length and any fantasy metrics in `properties`.
  - Polygons (cells): rings in `[lon, lat]`; move fantasy/cartesian vertices to `properties` if needed.
- Metadata: Keep projection info only as a custom field (e.g., `metadata.projection: "Fantasy Map Cartesian (meters)"`). Avoid reintroducing `crs`.
- Acceptance criteria:
  - Files validate without CRS/projection warnings in common validators.
  - QGIS/geojson.io load geometries correctly as WGS84.
  - Internal consumers retain access to fantasy coords via `properties`.
- Backward compatibility: Consider a toggle to export in either WGS84 or fantasy-cartesian for users relying on previous behavior; otherwise bump export format version in `metadata`.

Note: `saveGeoJsonMarkers` now includes `name` (mirrors CSV). Ensure other exporters include analogous name fields where applicable.

