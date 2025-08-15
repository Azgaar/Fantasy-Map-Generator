# QGIS Style Conversion from Fantasy Map JSON

## Overview

This document converts the fantasy map styling JSON to QGIS-compatible styles. The original JSON contains SVG/CSS-style properties that need to be translated to QGIS symbology.

## Layer Style Conversions

### Water Bodies

#### Rivers (`#rivers`)

```xml
<!-- QML Style for Rivers -->
<symbol alpha="1" type="line" name="rivers">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="0,137,202,255"/>
    <prop k="width" v="0.8"/>
    <prop k="capstyle" v="round"/>
  </layer>
</symbol>
```

#### Freshwater Lakes (`#freshwater`)

```xml
<!-- QML Style for Freshwater -->
<symbol alpha="1" type="fill" name="freshwater">
  <layer class="SimpleFill" enabled="1">
    <prop k="color" v="202,227,247,255"/>
    <prop k="outline_color" v="0,137,202,255"/>
    <prop k="outline_width" v="1.01"/>
  </layer>
</symbol>
```

#### Ocean Base (`#oceanBase`)

```xml
<!-- QML Style for Ocean -->
<symbol alpha="1" type="fill" name="ocean">
  <layer class="SimpleFill" enabled="1">
    <prop k="color" v="180,210,243,255"/>
    <prop k="outline_style" v="no"/>
  </layer>
</symbol>
```

### Landmass and Terrain

#### Landmass (`#landmass`)

```xml
<!-- QML Style for Landmass -->
<symbol alpha="1" type="fill" name="landmass">
  <layer class="SimpleFill" enabled="1">
    <prop k="color" v="238,246,251,255"/>
    <prop k="outline_style" v="no"/>
  </layer>
</symbol>
```

#### Ice (`#ice`)

```xml
<!-- QML Style for Ice -->
<symbol alpha="0.9" type="fill" name="ice">
  <layer class="SimpleFill" enabled="1">
    <prop k="color" v="232,240,246,255"/>
    <prop k="outline_color" v="232,240,246,255"/>
    <prop k="outline_width" v="1"/>
  </layer>
</symbol>
```

### Relief and Terrain

The Fantasy Map Generator uses SVG icons placed based on elevation to create relief effects. QGIS can replicate this using several approaches:

#### Method 1: Hillshade from Elevation Data

Create a Digital Elevation Model (DEM) from the cells GeoJSON data:

1. **Import cells GeoJSON** with elevation data in the `height` property
2. **Convert to raster**: Vector → Conversion Tools → Rasterize
   - Use `height` field for raster values
   - Set appropriate resolution (e.g., 100m)
3. **Generate hillshade**: Raster → Analysis → Hillshade
   - Z factor: 1.0
   - Azimuth: 315° (northwest)
   - Altitude: 45°

```xml
<!-- Hillshade Layer Style -->
<rasterrenderer opacity="0.6" type="hillshade">
  <rasterproperties>
    <mDrawingStyle>SingleBandGray</mDrawingStyle>
    <mColorShadingAlgorithm>0</mColorShadingAlgorithm>
    <mInvertColor>false</mInvertColor>
    <mGrayBand>1</mGrayBand>
  </rasterproperties>
</rasterrenderer>
```

#### Method 2: Icon-Based Relief (Fantasy Map Style)

Replicate the original icon-based relief using rule-based point symbols:

**Step 1**: Create point layer from cell centroids
- Vector → Geometry Tools → Centroids
- Filter: `"height" >= 50` (land areas only)

**Step 2**: Configure rule-based symbology

```xml
<!-- Mountain Icons (height > 70) -->
<symbol alpha="1" type="marker" name="mountains">
  <layer class="SvgMarker" enabled="1">
    <prop k="size" v="8"/>
    <prop k="name" v="mountain.svg"/>
    <prop k="color" v="139,69,19,255"/>
    <prop k="angle" v="0"/>
  </layer>
</symbol>

<!-- Hill Icons (height 50-70) -->
<symbol alpha="1" type="marker" name="hills">
  <layer class="SvgMarker" enabled="1">
    <prop k="size" v="5"/>
    <prop k="name" v="hill.svg"/>
    <prop k="color" v="101,67,33,255"/>
    <prop k="angle" v="0"/>
  </layer>
</symbol>
```

**Step 3**: Rule expressions
- Mountains: `"height" > 70`
- Hills: `"height" >= 50 AND "height" <= 70`

#### Method 3: Density-Controlled Relief Points

For scattered relief icons (matching FMG's Poisson distribution):

**Step 1**: Use Geometry Generator with point symbols
- Symbol type: Point
- Geometry type: Point
- Expression for scattered points:

```sql
-- Generate multiple points per cell based on elevation
CASE 
  WHEN "height" > 70 THEN 
    -- Mountains: 2-4 points per cell
    array_to_string(
      array_foreach(
        generate_series(1, floor("height"/30)),
        point_on_surface(
          translate($geometry, 
            rand(-50,50), 
            rand(-50,50)
          )
        )
      ), ','
    )
  WHEN "height" >= 50 THEN
    -- Hills: 1-2 points per cell  
    point_on_surface($geometry)
  ELSE
    NULL
END
```

#### Method 4: Hybrid Approach (Recommended)

Combine multiple techniques for best results:

1. **Base layer**: Hillshade raster (opacity 30%)
2. **Mid layer**: Graduated cell polygons by elevation
3. **Top layer**: Scattered point symbols for major peaks

**Graduated Elevation Symbology**:
```xml
<!-- Low elevation -->
<symbol alpha="0.3" type="fill" name="low">
  <layer class="SimpleFill" enabled="1">
    <prop k="color" v="144,238,144,76"/>
  </layer>
</symbol>

<!-- High elevation -->
<symbol alpha="0.5" type="fill" name="high">
  <layer class="SimpleFill" enabled="1">
    <prop k="color" v="139,69,19,127"/>
  </layer>
</symbol>
```

#### Relief Color Ramps

For elevation-based coloring:

**Height Classes**:
- 0-20: Ocean (blue tones)
- 20-40: Lowlands (green tones) 
- 40-60: Hills (yellow-brown tones)
- 60-80: Mountains (brown tones)
- 80+: High peaks (gray-white tones)

```xml
<!-- Elevation Color Ramp -->
<colorrampshader colorRampType="INTERPOLATED">
  <item alpha="255" value="0" color="#4A90E2" label="Ocean"/>
  <item alpha="255" value="20" color="#90EE90" label="Coast"/>
  <item alpha="255" value="40" color="#F4A460" label="Hills"/>
  <item alpha="255" value="60" color="#8B4513" label="Mountains"/>
  <item alpha="255" value="80" color="#696969" label="High Peaks"/>
</colorrampshader>
```

### Political Boundaries

#### State Borders (`#stateBorders`)

```xml
<!-- QML Style for State Borders -->
<symbol alpha="1" type="line" name="state_borders">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="0,0,0,255"/>
    <prop k="width" v="1.01"/>
    <prop k="capstyle" v="flat"/>
  </layer>
</symbol>
```

#### Province Borders (`#provinceBorders`)

```xml
<!-- QML Style for Province Borders -->
<symbol alpha="0.8" type="line" name="province_borders">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="0,0,0,255"/>
    <prop k="width" v="0.69"/>
    <prop k="capstyle" v="round"/>
  </layer>
</symbol>
```

### Transportation

Routes can be styled based on their `type` property using QGIS rule-based styling. The available route types are:

- **royal**: Major roads connecting capitals and important cities
- **market**: Trade routes connecting market towns
- **local**: Secondary roads for regional connectivity  
- **footpath**: Walking trails and paths
- **majorSea**: Major shipping routes between ports

#### Royal Roads (type = 'royal')

```xml
<!-- QML Style for Royal Roads -->
<symbol alpha="1" type="line" name="royal_roads">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="255,44,44,255"/>
    <prop k="width" v="1.2"/>
    <prop k="capstyle" v="flat"/>
  </layer>
</symbol>
```

#### Market Roads (type = 'market')

```xml
<!-- QML Style for Market Roads -->
<symbol alpha="1" type="line" name="market_roads">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="255,100,44,255"/>
    <prop k="width" v="0.9"/>
    <prop k="capstyle" v="flat"/>
  </layer>
</symbol>
```

#### Local Roads (type = 'local')

```xml
<!-- QML Style for Local Roads -->
<symbol alpha="1" type="line" name="local_roads">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="200,100,50,255"/>
    <prop k="width" v="0.6"/>
    <prop k="capstyle" v="flat"/>
  </layer>
</symbol>
```

#### Footpaths (type = 'footpath')

```xml
<!-- QML Style for Footpaths -->
<symbol alpha="1" type="line" name="footpaths">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="159,81,34,255"/>
    <prop k="width" v="0.43"/>
    <prop k="capstyle" v="flat"/>
    <prop k="customdash" v="2;1"/>
    <prop k="use_custom_dash" v="1"/>
  </layer>
</symbol>
```

#### Major Sea Routes (type = 'majorSea')

```xml
<!-- QML Style for Major Sea Routes -->
<symbol alpha="1" type="line" name="major_searoutes">
  <layer class="SimpleLine" enabled="1">
    <prop k="color" v="0,137,202,255"/>
    <prop k="width" v="0.6"/>
    <prop k="capstyle" v="round"/>
    <prop k="customdash" v="1;2"/>
    <prop k="use_custom_dash" v="1"/>
  </layer>
</symbol>
```

#### Legacy Route Groups

For backward compatibility, routes can also be styled by `group` property:

- **roads**: All land-based routes (royal, market, local)
- **trails**: Walking paths (footpath)
- **searoutes**: All sea-based routes (majorSea)

### Settlements

Burgs can be styled based on their boolean properties using QGIS rule-based styling. The available burg feature types are:

- **capital**: State capitals (administrative centers)
- **port**: Coastal settlements with harbors
- **citadel**: Fortified settlements with citadels
- **walls**: Settlements with defensive walls
- **plaza**: Settlements with central plazas
- **temple**: Settlements with religious temples
- **shanty**: Settlements with shanty town districts

#### Capital Cities (capital = true)

```xml
<!-- QML Style for Capital Cities -->
<symbol alpha="1" type="marker" name="capitals">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="255,215,0,255"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.4"/>
    <prop k="size" v="5"/>
    <prop k="name" v="star"/>
  </layer>
</symbol>
```

#### Port Cities (port = true)

```xml
<!-- QML Style for Port Cities -->
<symbol alpha="1" type="marker" name="ports">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="0,137,202,255"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.3"/>
    <prop k="size" v="4"/>
    <prop k="name" v="diamond"/>
  </layer>
</symbol>
```

#### Fortified Cities (citadel = true OR walls = true)

```xml
<!-- QML Style for Fortified Cities -->
<symbol alpha="1" type="marker" name="fortified">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="139,69,19,255"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.3"/>
    <prop k="size" v="4"/>
    <prop k="name" v="square"/>
  </layer>
</symbol>
```

#### Religious Centers (temple = true)

```xml
<!-- QML Style for Religious Centers -->
<symbol alpha="1" type="marker" name="religious">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="128,0,128,255"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.3"/>
    <prop k="size" v="4"/>
    <prop k="name" v="cross"/>
  </layer>
</symbol>
```

#### Trading Centers (plaza = true)

```xml
<!-- QML Style for Trading Centers -->
<symbol alpha="1" type="marker" name="trading">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="255,165,0,255"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.3"/>
    <prop k="size" v="3.5"/>
    <prop k="name" v="pentagon"/>
  </layer>
</symbol>
```

#### Shanty Towns (shanty = true)

```xml
<!-- QML Style for Shanty Towns -->
<symbol alpha="0.8" type="marker" name="shanty">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="139,131,120,255"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.2"/>
    <prop k="size" v="2.5"/>
    <prop k="name" v="triangle"/>
  </layer>
</symbol>
```

#### Regular Settlements (default)

```xml
<!-- QML Style for Regular Settlements -->
<symbol alpha="0.7" type="marker" name="settlements">
  <layer class="SimpleMarker" enabled="1">
    <prop k="color" v="0,0,0,179"/>
    <prop k="outline_color" v="0,0,0,255"/>
    <prop k="outline_width" v="0.24"/>
    <prop k="size" v="3"/>
    <prop k="name" v="circle"/>
  </layer>
</symbol>
```

#### Settlement Labels

```xml
<!-- QML Style for Settlement Labels -->
<text-style fontFamily="Arial" fontSize="5" fontSizeUnit="Point">
  <text-color alpha="255" r="0" g="0" b="0"/>
  <text-buffer bufferDraw="1" bufferSize="1" bufferSizeUnits="Point">
    <buffer-color alpha="255" r="255" g="255" b="255"/>
  </text-buffer>
</text-style>
```

## Implementation Steps

### 1. Create Layer Structure

```
Project Root/
├── Water Bodies/
│   ├── Rivers
│   ├── Lakes
│   └── Ocean
├── Landmass/
│   ├── Base Land
│   └── Ice
├── Relief & Terrain/
│   ├── Elevation DEM (raster)
│   ├── Hillshade (raster)
│   ├── Relief Icons (points)
│   └── Elevation Polygons
├── Political/
│   ├── State Borders
│   └── Province Borders
├── Transportation/
│   ├── Routes (by type)
│   └── Routes (by group)
└── Settlements/
    ├── Burgs (by feature type)
    └── Settlement Labels
```

### 2. Apply Styles in QGIS

1. **Load your vector layers** into QGIS
2. **Right-click layer** → Properties → Symbology
3. **Copy the XML** from above into a text editor
4. **Save as .qml file** (e.g., `rivers.qml`)
5. **Load style** in layer properties → Style → Load Style

### 3. Color Reference Table

|Original Color|RGB Values|QGIS Color Code|
|---|---|---|
|`#000000`|0,0,0|`0,0,0,255`|
|`#0089ca`|0,137,202|`0,137,202,255`|
|`#cae3f7`|202,227,247|`202,227,247,255`|
|`#eef6fb`|238,246,251|`238,246,251,255`|
|`#ff2c2c`|255,44,44|`255,44,44,255`|
|`#9f5122`|159,81,34|`159,81,34,255`|
|`#b4d2f3`|180,210,243|`180,210,243,255`|

### 4. Layer Ordering (Bottom to Top)

1. Ocean Base
2. Landmass
3. Elevation DEM (raster) 
4. Hillshade (30% opacity)
5. Elevation Polygons (graduated colors)
6. Freshwater Bodies
7. Ice
8. Province Borders
9. State Borders
10. Transportation Routes (by type or group)
11. Relief Icons (mountains/hills)
12. Settlement Icons (by feature type)
13. Settlement Labels

## Notes

- **Opacity values** from the JSON (like 0.8, 0.9) translate to QGIS alpha values
- **Stroke-dasharray** properties become custom dash patterns in QGIS
- **Filter effects** like blur and drop shadows need to be recreated using QGIS effects
- **Font families** may need substitution if not available in your system
- **Coordinate system** should be set to the Fantasy Map Cartesian CRS (WKT format below)

## Coordinate Reference System (CRS)

The Fantasy Map Generator uses a custom Cartesian coordinate system. Use this WKT definition in QGIS:

```
ENGCRS["Fantasy Map Cartesian (meters)",
    EDATUM["Fantasy Map Datum"],
    CS[Cartesian,2],
        AXIS["easting (X)",east,
            ORDER[1],
            LENGTHUNIT["metre",1]],
        AXIS["northing (Y)",north,
            ORDER[2],
            LENGTHUNIT["metre",1]]]
```

### Setting up the CRS in QGIS:
1. Go to **Settings** → **Custom Projections**
2. Click **+** to add a new CRS
3. Set **Name**: `Fantasy Map Cartesian`
4. Set **Format**: `WKT (Recommended)`
5. Paste the WKT definition above
6. Click **OK** and **Apply**

## Data Requirements for Relief

### Essential GeoJSON Exports

To implement relief rendering, you need these exports from Fantasy Map Generator:

1. **Cells GeoJSON** (`cells.geojson`)
   - Contains elevation data in `height` property
   - Provides cell polygons for DEM generation
   - Includes biome information for terrain variation

2. **Burgs GeoJSON** (`burgs.geojson`) 
   - Settlement locations for reference
   - Population data for symbol sizing

### Processing Workflow

1. **Import cells.geojson** into QGIS
2. **Create DEM raster**: Vector → Conversion Tools → Rasterize
   - Field: `height`
   - Resolution: 50-200m (depending on map detail)
   - Output extent: Use layer extent
3. **Generate hillshade**: Raster → Analysis → Hillshade
4. **Create relief points**: Vector → Geometry Tools → Centroids
5. **Apply symbology** using the styles below

## Rule-Based Styling

### Route Styling by Type
To style routes by their `type` property:
1. Right-click route layer → Properties → Symbology
2. Change from "Single Symbol" to "Rule-based"
3. Add rules with expressions like: `"type" = 'royal'`
4. Apply the corresponding symbol for each type

### Burg Styling by Features
To style burgs by their feature properties:
1. Right-click burg layer → Properties → Symbology  
2. Change to "Rule-based" styling
3. Create rules with expressions like:
   - `"capital" = 1` for capitals
   - `"port" = 1` for ports
   - `"citadel" = 1 OR "walls" = 1` for fortified cities
4. Set priority order (capitals first, then ports, etc.)

### Graduated Symbols by Population
To size burg symbols by population:
1. Right-click burg layer → Properties → Symbology
2. Change to "Graduated" 
3. Set **Value**: `population`
4. Choose appropriate **Method** and **Classes**
5. Adjust symbol sizes in the range

## Advanced Features

For complex effects like the texture overlay (`#texture`) and fogging (`#fogging`), consider:

- Using **Raster layers** with blend modes
- **Layer effects** in symbology
- **Custom SVG symbols** for complex markers
- **Expression-based styling** for dynamic effects