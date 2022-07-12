interface Navigator {
  userAgentData?: {
    mobile: boolean;
  };
}

interface Window {
  mapCoordinates: IMapCoordinates;
  $: typeof $; // jQuery

  scale: number;
  viewX: number;
  viewY: number;

  // untyped IIFE modules
  Biomes: any;
  Names: any;
  ThreeD: any;
  ReliefIcons: any;
  Zoom: any;
  Lakes: any;
  HeightmapGenerator: any;
  OceanLayers: any;
  Rivers: any;
  Cultures: any;
  BurgsAndStates: any;
  Religions: any;
  Military: any;
  Markers: any;
}

interface Node {
  on: (name: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
  off: (name: string, fn: EventListenerOrEventListenerObject) => void;
}
