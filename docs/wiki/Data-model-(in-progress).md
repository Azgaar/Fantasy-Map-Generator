In this document I would like to outline the expected data structure. 

Relevant links:
* [Current data model](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-model)
* [Trello ticket](https://trello.com/c/IWltiMC2/902-rework-save-data-format)
* [Refactor branch contract changes](https://github.com/Azgaar/Fantasy-Map-Generator/pull/842)

Architecture

The overall desired architecture model is as below:

```
                 settings
                    │
                    ▼
                GENERATORS
                    │
                    ▼
                  WORLD
             (data + style)
                    │
      ┌─────────────┴─────────────┐
      ▼                           ▼
   EDITORS                    RENDERERS
      │                           │
      ▼                           ▼
data mutations            SVG or WebGL Canvas
```

All the map-related state should be represented by a single gigantic `map` object. When the `.map` file is saved, the object is transformed into a single json file.

Structure:

`.map` file is a valid JSON capturing all data required to render and operate the map, including UI and style settings.

```json
{
  "meta": {
    "copyright": "Azgaar's Fantasy Map Generator",
    "license": "MIT",
    "source": "http://azgaar.github.io/Fantasy-Map-Generator",
    "initial": {
      "timestamp": "2023-09-11T23:36:17.227Z",
      "version": "2.1.12",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    },
    "current": {
      "timestamp": "2025-02-15T14:42:31.748Z",
      "version": "2.126.3",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "revision": 124
    }
  },

  "settings": {
    "seed": "342342342323",
    "graph": {
      "width": 1280,
      "height": 740,
      "points": 50000
    },

    "heightmap": {
      "template": "Volcano",
      "isRandom": false,
      "isPrecreated": false,
      "isCustom": false
    },

    "cultures": {
      "set": "Oriental",
      "limit": 11,
      "sizeVariety": 2,
      "growthRate": 1.3
    },

    "states": {
      "limit": 14,
      "sizeVariety": 2,
      "growthRate": 3,
      "labels": {
        "mode": "auto"
      }
    },

    "provinces": {
      "ratio": 30
    },

    "burgs": {
      "limit": null,
      "showMfcgMap": true
    },

    "religions": {
      "limit": 7
    },

    "labels": {
      "autoHide": true,
      "rescaleOnZoom": true
    },

    "notes": {
      "pinned": false
    },

    "scaleBar": {
      "label": "",
      "position": {
        "x": 99,
        "y": 99
      }
    },

    "military": {
      "units": {
        "0": { "name": "infantry" }
      }
    },

    "world": {
      "name": "Narnia",

      "calendar": {
        "year": 2024,
        "era": "Test Era",
        "eraShort": "TE"
      },

      "climate": {
        "temperature": {
          "equator": 30,
          "northPole": -30,
          "southPole": -25
        },
        "winds": [225, 45, 225, 315, 135, 315],
        "precipitation": 100
      },

      "geography": {
        "mapSize": 11,
        "latitudeShift": 50,
        "coordinates": {
          "latN": 34
        }
      },

      "units": {
        "distance": { "unit": "m", "scale": 3 },
        "area": { "unit": "square", "scale": 1 },
        "height": { "unit": "ft", "exponent": 2 },
        "temperature": { "unit": "°C", "scale": 1 },
        "population": {
          "scale": 1000,
          "urbanization": {
            "rate": 1,
            "density": 10
          }
        }
      }
    },

    "layers": {
      "heightmap": false,
      "states": true
    }
  },

  "style": {
    "scaleBar": {
      "size": 2,
      "backOpacity": 0.2,
      "backColor": "#ffffff"
    }
  },

  "data": {

    "topology": {
      "grid": {
        "cells": {
          "i": [],
          "temp": []
        },
        "vertices": {
          "c": [[]]
        }
      },

      "pack": {
        "cells": {
          "i": [],
          "g": [],
          "state": [],
          "culture": []
        },
        "vertices": {
          "c": [[]]
        }
      }
    },

    "geography": {
      "biomes": {
        "0": {
          "name": "Marine",
          "isCustom": false,
          "cells": 354
        },
        "1": {}
      }
    },

    "civilizations": {
      "states": {
        "0": {},
        "1": {}
      },

      "cultures": {},

      "religions": {}
    },

    "settlements": {
      "burgs": {},
      "routes": {}
    },

    "annotations": {
      "notes": {
        "0": {}
      },

      "rulers": {
        "0": {
          "i": 0,
          "type": "ruler",
          "points": [
            [0, 0],
            [642, 17]
          ]
        }
      }
    }
  }
}
```