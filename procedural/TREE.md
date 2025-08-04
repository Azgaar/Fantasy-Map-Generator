procedural
├── .gitignore
├── NEXT_STEPS.md
├── PORT_PLAN.md
├── TREE.md
├── cli.js
├── index.html
├── main.js
├── package-lock.json
├── package.json
├── public
│   ├── assets
│   │   ├── charges
│   │   │   ├── agnusDei.svg
│   │   │   ├── anchor.svg
│   │   │   ├── angel.svg
│   │   │   ├── annulet.svg
.
.
.
│   │   │   ├── wolfHeadErased.svg
│   │   │   ├── wolfPassant.svg
│   │   │   ├── wolfRampant.svg
│   │   │   ├── wolfStatant.svg
│   │   │   ├── wyvern.svg
│   │   │   └── wyvernWithWingsDisplayed.svg
│   │   ├── heightmaps
│   │   │   ├── africa-centric.png
│   │   │   ├── arabia.png
│   │   │   ├── atlantics.png
│   │   │   ├── britain.png
│   │   │   ├── caribbean.png
│   │   │   ├── east-asia.png
│   │   │   ├── eurasia.png
│   │   │   ├── europe-accented.png
│   │   │   ├── europe-and-central-asia.png
│   │   │   ├── europe-central.png
│   │   │   ├── europe-north.png
│   │   │   ├── europe.png
│   │   │   ├── greenland.png
│   │   │   ├── hellenica.png
│   │   │   ├── iceland.png
│   │   │   ├── import-rules.txt
│   │   │   ├── indian-ocean.png
│   │   │   ├── mediterranean-sea.png
│   │   │   ├── middle-east.png
│   │   │   ├── north-america.png
│   │   │   ├── us-centric.png
│   │   │   ├── us-mainland.png
│   │   │   ├── world-from-pacific.png
│   │   │   └── world.png
│   │   └── images
│   │       ├── Discord.png
│   │       ├── Facebook.png
│   │       ├── Pinterest.png
│   │       ├── Reddit.png
│   │       ├── Twitter.png
│   │       ├── icons
│   │       │   ├── favicon-16x16.png
│   │       │   ├── favicon-32x32.png
│   │       │   ├── icon_x512.png
│   │       │   ├── maskable_icon_x128.png
│   │       │   ├── maskable_icon_x192.png
│   │       │   ├── maskable_icon_x384.png
│   │       │   └── maskable_icon_x512.png
│   │       ├── kiwiroo.png
│   │       ├── pattern1.png
│   │       ├── pattern2.png
│   │       ├── pattern3.png
│   │       ├── pattern4.png
│   │       ├── pattern5.png
│   │       ├── pattern6.png
│   │       ├── preview.png
│   │       └── textures
│   │           ├── antique-big.jpg
│   │           ├── antique-small.jpg
│   │           ├── folded-paper-big.jpg
│   │           ├── folded-paper-small.jpg
│   │           ├── gray-paper.jpg
│   │           ├── iran-small.jpg
│   │           ├── marble-big.jpg
│   │           ├── marble-blue-big.jpg
│   │           ├── marble-blue-small.jpg
│   │           ├── marble-small.jpg
│   │           ├── mars-big.jpg
│   │           ├── mars-small.jpg
│   │           ├── mauritania-small.jpg
│   │           ├── mercury-big.jpg
│   │           ├── mercury-small.jpg
│   │           ├── ocean.jpg
│   │           ├── pergamena-small.jpg
│   │           ├── plaster.jpg
│   │           ├── soiled-paper-vertical.png
│   │           ├── soiled-paper.jpg
│   │           ├── spain-small.jpg
│   │           ├── timbercut-big.jpg
│   │           └── timbercut-small.jpg
│   └── vite.svg
├── src
│   ├── default_prompt.md
│   ├── engine
│   │   ├── main.js
│   │   ├── modules
│   │   │   ├── biomes.js
│   │   │   ├── burgs-and-states.js
│   │   │   ├── coa-generator.js
│   │   │   ├── coa-renderer.js
│   │   │   ├── cultures-generator.js
│   │   │   ├── features.js
│   │   │   ├── fonts.js
│   │   │   ├── heightmap-generator.js
│   │   │   ├── lakes.js
│   │   │   ├── markers-generator.js
│   │   │   ├── military-generator.js
│   │   │   ├── names-generator.js
│   │   │   ├── ocean-layers.js
│   │   │   ├── provinces-generator.js
│   │   │   ├── religions-generator.js
│   │   │   ├── resample.js
│   │   │   ├── river-generator.js
│   │   │   ├── routes-generator.js
│   │   │   ├── submap.js
│   │   │   ├── voronoi.js
│   │   │   └── zones-generator.js
│   │   └── utils
│   │       ├── alea.js
│   │       ├── arrayUtils.js
│   │       ├── cell.js
│   │       ├── colorUtils.js
│   │       ├── commonUtils.js
│   │       ├── debugUtils.js
│   │       ├── flatqueue.js
│   │       ├── functionUtils.js
│   │       ├── geography.js
│   │       ├── graphUtils.js
│   │       ├── index.js
│   │       ├── languageUtils.js
│   │       ├── lineclip.js
│   │       ├── nodeUtils.js
│   │       ├── numberUtils.js
│   │       ├── pathUtils.js
│   │       ├── polyfills.js
│   │       ├── polylabel.js
│   │       ├── probabilityUtils.js
│   │       ├── simplify.js
│   │       ├── stringUtils.js
│   │       └── unitUtils.js
│   ├── libs
│   │   └── delaunator.min.js
│   └── viewer
│       ├── _config_data
│       │   ├── biomes_config.md
│       │   ├── burgs-and-states_config.md
│       │   ├── coa-generator_config.md
│       │   ├── coa-renderer_config.md
│       │   ├── cultures-generator_config.md
│       │   ├── features_config.md
│       │   ├── fonts_config.md
│       │   ├── heightmap-generator_config.md
│       │   ├── lakes_config.md
│       │   ├── markers-generator_config.md
│       │   ├── military-generator.js_config.md
│       │   ├── names-generator_config.md
│       │   ├── ocean-layers_config.md
│       │   ├── provinces-generator.js_config.md
│       │   ├── religions-generator_config.md
│       │   ├── resample_config.md
│       │   ├── river-generator_config.md
│       │   ├── routes-generator_config.md
│       │   ├── submap_config.md
│       │   ├── voronoi_config.md
│       │   └── zones_config.md
│       ├── config-builder.js
│       ├── config-integration.md
│       ├── config-presets.js
│       ├── config-schema.md
│       ├── config-validator.js
│       ├── libs
│       │   ├── dropbox-sdk.min.js
│       │   ├── indexedDB.js
│       │   ├── jquery-3.1.1.min.js
│       │   ├── jquery-ui.css
│       │   ├── jquery-ui.min.js
│       │   ├── jquery.ui.touch-punch.min.js
│       │   ├── jszip.min.js
│       │   ├── loopsubdivison.min.js
│       │   ├── objexporter.min.js
│       │   ├── openwidget.min.js
│       │   ├── orbitControls.min.js
│       │   ├── rgbquant.min.js
│       │   ├── shorthands.js
│       │   ├── three.min.js
│       │   └── umami.js
│       └── main.js
└── style.css
