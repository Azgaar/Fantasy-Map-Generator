interface Navigator {
  userAgentData?: {
    mobile: boolean;
  };
}

interface Window {
  mapCoordinates: IMapCoordinates;
  $: typeof $;
  // untyped IIFE modules
  Biomes: typeof Biomes;
  Names: typeof Names;
  ThreeD: typeof ThreeD;
  ReliefIcons: typeof ReliefIcons;
  Zoom: typeof Zoom;
  Lakes: typeof Lakes;
  HeightmapGenerator: typeof HeightmapGenerator;
  OceanLayers: typeof OceanLayers;
}

interface Node {
  on: (name: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
  off: (name: string, fn: EventListenerOrEventListenerObject) => void;
}
