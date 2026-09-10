This document outlines the expected data structure. Current data model described in [data-model.md](data-model.md) is inconsistent and not well-documented, so it is not a reliable reference for the future model. The future model is designed to be more consistent, modular, and maintainable, with clear separation of concerns and better encapsulation.

`.map` file is a valid JSON capturing all data required to render and operate the map, including UI and style settings. Once loaded, it a single gigantic object `map`, parsed from the json.

`facts` is `options.map` and nothing else: the requests the generators consume (`options.generation`) and this browser's preferences (`options.app`) never enter the file. The admission test is in [configuration.md](./configuration.md#the-test) — that is why the heightmap template, the size varieties and growth rates, and `labels.showAll` are absent below.

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

  "facts": {
    "seed": "342342342323",
    "graph": {
      "width": 1280,
      "height": 740,
      "points": 50000
    },

    "geography": {
      "mapSize": 100,
      "latitude": 50,
      "longitude": 50,
      "coordinates": { "latT": 180, "latN": 90, "latS": -90, "lonT": 320, "lonW": -160, "lonE": 160 }
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

    "cultures": {
      "set": "oriental"
    },

    "lore": {
      "name": "Narnia",
      "description": "",

      "calendar": {
        "year": 2026,
        "era": "Triffids Era",
        "eraShort": "TE"
      }
    },

    "units": {
      "distance": { "unit": "m", "scale": 3 },
      "area": { "unit": "square" },
      "height": { "unit": "ft", "exponent": 2 },
      "temperature": { "unit": "°C" },
      "population": {
        "scale": 1000,
        "urbanization": {
          "rate": 1,
          "density": 10
        }
      }
    },

    "style": { "preset": "default" },

    "burgs": {
      "groups": []
    },

    "labels": {
      "resizeOnZoom": true,
      "groups": []
    },

    "military": {
      "units": []
    },

    "transports": [],

    "coastline": {
      "enabled": true,
      "maxDepth": 4,
      "baseAmplitude": 1.5,
      "amplitudeDecay": 0.9,
      "minEdge": 1,
      "smoothThreshold": 0.25,
      "roughnessContrast": 1.5,
      "roughnessScale": 60,
      "lakeSmoothThreshMult": 2,
      "variant": 0
    }
  },

  // planned: a feature may carry its own `coastline` block of the same shape, overriding the map-level
  // one for that island or lake alone. The generator already takes its settings per call
  // (`Coastline.fractalize(points, seed, settings)`), so the work is the feature record, the IO round
  // trip and an editor entry point — not the fractalization itself

  "layers": {
    "order": ["ocean", "landmass", "heightmap", "lakes", "rivers", "states", "borders", "labels", "scaleBar"],
    "active": ["heightmap", "lakes", "rivers", "states", "borders", "labels", "scaleBar"]
  },

  "style": {
    "scaleBar": {
      "size": 2,
      "label": "",
      "x": 99,
      "y": 99,
      "backOpacity": 0.2,
      "backColor": "#ffffff"
    },
    "labels": {
      "groups": {
        "states": {
          "fontSize": 22
        },
        "capitals": {
          "fontSize": 8
        }
      }
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
          "c": [][]
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
          "c": [][]
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

    "states": {
      "0": {},
      "1": {}
    },

    "cultures": {},

    "religions": {},

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
