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
  Rivers: any;
  Names: any;
  ThreeD: any;
  ReliefIcons: any;
  Zoom: any;
  Lakes: any;
  HeightmapGenerator: any;
  OceanLayers: any;
  Cultures: any;
  BurgsAndStates: any;
  Religions: any;
  Military: any;
  Markers: any;
  COA: any;
  Routes: any;
}

interface Node {
  on: (name: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
  off: (name: string, fn: EventListenerOrEventListenerObject) => void;
}

interface Quadtree extends d3.Quadtree<Number> {
  find: (x: number, y: number, radius: number) => [x: number, y: number, cellId: number];
  findAll: (x: number, y: number, radius: number) => [x: number, y: number, cellId: number][];
}
