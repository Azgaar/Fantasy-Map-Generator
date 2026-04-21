"use strict";

const tectonicTemplates = (function () {
  return {
    tectonic: {
      id: 14,
      name: "Tectonic",
      template: "tectonic",
      probability: 10,
      config: {
        plateCount: 20,
        continentalRatio: 0.2,
        collisionIntensity: 1.5,
        noiseLevel: 0.3,
        hotspotCount: 3,
        smoothingPasses: 3,
        erosionPasses: 5,
        seaLevel: 5
      }
    },
    tectonicPangea: {
      id: 15,
      name: "Tectonic Pangea",
      template: "tectonic",
      probability: 5,
      config: {
        plateCount: 8,
        continentalRatio: 0.55,
        collisionIntensity: 1.2,
        noiseLevel: 0.25,
        hotspotCount: 3,
        smoothingPasses: 4,
        erosionPasses: 2,
        seaLevel: -3
      }
    },
    tectonicArchipelago: {
      id: 16,
      name: "Tectonic Archipelago",
      template: "tectonic",
      probability: 5,
      config: {
        plateCount: 15,
        continentalRatio: 0.25,
        collisionIntensity: 0.8,
        noiseLevel: 0.35,
        hotspotCount: 5,
        smoothingPasses: 3,
        erosionPasses: 2,
        seaLevel: 3
      }
    },
    tectonicRift: {
      id: 17,
      name: "Tectonic Rift",
      template: "tectonic",
      probability: 3,
      config: {
        plateCount: 10,
        continentalRatio: 0.4,
        collisionIntensity: 1.5,
        noiseLevel: 0.3,
        hotspotCount: 2,
        smoothingPasses: 3,
        erosionPasses: 3,
        seaLevel: 0
      }
    }
  };
})();
