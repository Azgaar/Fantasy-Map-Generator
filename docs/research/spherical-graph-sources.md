# Cylindrical and spherical graph generation: algorithm research

Investigated 2026-09-29. This note separates established geometry from proposed FMG implementation choices. No dependencies or application code were changed.

## Findings

The idea is feasible at graph construction time, but connectivity, geometric measurements, and drawing are separate responsibilities. A graph can hide its surface from neighbor-based simulation; raw rectangular coordinates cannot hide it from every consumer.

| Surface | Identification | Consequence |
| --- | --- | --- |
| Cylinder | Left and right edges identify periodically | Horizontal neighbors wrap; north and south remain boundaries |
| Flat torus | Both opposite edge pairs identify periodically | Vertical wrapping connects north to south, which is not a globe |
| Sphere | Longitude wraps; each latitude endpoint collapses to its own pole | Closed surface with two distinct poles; no physical boundary |

CGAL explicitly distinguishes cylindrical periodicity from its doubly periodic, flat-torus triangulation. Its representation includes point IDs **and offsets** specifying which periodic image participates in each face. This is important for keeping adjacency canonical while preserving local geometry. [CGAL periodic triangulations](https://doc.cgal.org/latest/Periodic_2_triangulation_2/index.html)

The sphere row follows directly from the longitude/latitude-to-Cartesian map used in [d3-geo-voronoi's implementation](https://raw.githubusercontent.com/Fil/d3-geo-voronoi/main/src/delaunay.js):

`p = (cos(latitude) cos(longitude), cos(latitude) sin(longitude), sin(latitude))`.

At latitude ±90°, longitude vanishes from the position. Continuing across the north pole maps `(longitude, 90° + delta)` to `(longitude + 180°, 90° - delta)`. This is a coordinate identity, not a recipe for obtaining spherical Delaunay neighbors by pairing rectangular border cells. In particular, top-to-bottom links model the wrong surface.

## Candidate cylinder algorithm

Proposed FMG implementation, not a tested patch:

1. Generate canonical sites inside `[0, width) × [0, height]`.
2. Triangulate their copies shifted by `-width`, `0`, and `+width`, retaining the existing north/south boundary treatment but removing the east/west boundary guards. The guards themselves must be periodic in x.
3. Extract cells around central sites. Map neighboring image sites back to canonical cell IDs, retaining image offsets for incident geometry.
4. Canonicalize triangle/dual-vertex identities consistently across copies. Derive `cells.c`, `cells.v`, `vertices.c`, and `vertices.v` from the same mesh; editing only `cells.c` leaves an inconsistent dual.
5. Compute distances and polygon areas in locally unwrapped coordinates. Split/duplicate drawing geometry at the display seam.

Delaunator already exposes triangle indices and opposite halfedges, and its documented Voronoi construction uses triangle circumcenters and circulation around each site. It provides the underlying representation, not a ready-made periodic wrapper. [Delaunator guide](https://mapbox.github.io/delaunator/)

Start with full copies for correctness. A narrow ghost strip can reduce work later, but cannot safely use a fixed width without a geometric bound: the packed graph removes deep ocean sites and can contain large cells. Degenerate or very sparse periodic meshes also require care: distinct image incidences must not be erased by blindly deduplicating IDs. CGAL documents covering-space complications for such inputs. [CGAL periodic triangulations](https://doc.cgal.org/latest/Periodic_2_triangulation_2/index.html)

## Candidate sphere algorithms

**Convex hull and dual.** Generate sites on the unit sphere, compute their 3D convex hull, and obtain the spherical Delaunay triangulation from its faces. Dualize the faces into spherical Voronoi vertices and ordered cell rings. For a full-globe sample enclosing the origin, outward unit face normals locate the corresponding Voronoi vertices. Use incidence traversal to order them. SciPy documents the convex-hull equivalence and favors neighbor-based ordering over angle sorting for numerical stability. [SciPy SphericalVoronoi](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.SphericalVoronoi.html)

**Stereographic projection and repair.** A JavaScript implementation already exists in `d3-geo-voronoi`: it projects spherical sites stereographically, triangulates through d3-delaunay, repairs the horizon around the projection singularity, and computes spherical circumcenters. Its indexed API exposes neighbors and polygon topology. This is a useful comparison implementation, but adopting the package needs explicit dependency approval. [Project/API](https://github.com/Fil/d3-geo-voronoi), [algorithm source](https://raw.githubusercontent.com/Fil/d3-geo-voronoi/main/src/delaunay.js)

**Available without a new package.** FMG already declares `three` and `delaunator` dependencies in [package.json](../../package.json). Three.js supplies `three/addons/math/ConvexHull.js`, a Quickhull implementation with `setFromPoints`. The installed copy was inspected; it exposes faces and halfedges suitable for deriving the mesh. This is a concrete prototype candidate, not evidence of acceptable performance or robustness at FMG's largest sizes. [Three.js ConvexHull](https://threejs.org/docs/pages/ConvexHull.html)

Robustness needs explicit validation. CGAL warns that floating-point coordinates do not lie exactly on the mathematical sphere, discusses point separation, and recommends exact predicates for reliable triangulation. Samples confined to one hemisphere require special handling. FMG's packed graph can create precisely this sampling problem after dropping most ocean sites; retaining ocean support sites may be necessary. CGAL also distinguishes straight 3D chord geometry from great-circle arcs. [CGAL spherical triangulations](https://doc.cgal.org/latest/Triangulation_on_sphere_2/index.html)

## What the graph layer must provide

The current [Voronoi builder](../../src/generators/voronoi.ts) stores a single planar point per vertex. The [pack generator](../../src/generators/pack-generator.ts) directly averages coordinates for coastal insertion, calculates planar polygon areas, and uses a planar quadtree. A seam-crossing pair near x=0 and x=width therefore needs a different midpoint, distance, and spatial query even when its adjacency is correct. Both [grid](../../src/generators/grid-generator.ts) and pack rebuild their own diagrams, so both builders must use the chosen surface.

An appropriate boundary is canonical IDs plus surface-aware distance, midpoint, area, spatial lookup, and display-geometry operations. Cell attributes such as heights, culture IDs, and state IDs can remain attached to ordinary canonical cells. Algorithms using only neighbors need little or no surface knowledge. Consumers reading raw coordinates must move behind the geometry operations.

A flat view still needs a cartographic cut. D3 explicitly provides antimeridian clipping to split crossing lines and polygons. This display seam need not be a seam in the simulated world. [D3 projection and clipping](https://d3js.org/d3-geo/projection#geoClipAntimeridian)

Uniform longitude/latitude sampling also does not give uniform spherical cell areas: the area element is proportional to `cos(latitude)`. This is a direct geometric deduction, not a library claim. Choose deliberately between preserving rectangular grid indexing and introducing approximately equal-area spherical sites. Reusing a rectangular sample on a sphere is possible but over-resolves the poles.

## Suggested proof before implementation

Use deterministic synthetic sites to check reciprocal adjacency, closed ordered rings, no unintended boundary, and consistent cell/vertex incidence. For a nondegenerate triangulated sphere with N sites, verify `E = 3N - 6` and `F = 2N - 4` (Euler's formula plus three edges per triangular face). Check total spherical area against `4πR²`, seam and pole queries, coast insertion, and graph reconstruction after save/load. Compare topology and geometry with an independent implementation on small samples; benchmark at 10k and 100k cells. Test packed samples with large empty oceans separately.

Recommendation: prove the cylinder using the existing Delaunator first, while defining geometry operations that also admit a sphere. Prototype the sphere with Three.js ConvexHull in isolation. Do not claim that adding wrap neighbors alone makes all current generators and renderers seamless.
