interface Navigator {
  userAgentData?: {
    mobile: boolean;
  };
}

interface Window {
  mapCoordinates: IMapCoordinates;
  // untyped IIFE modules
  $: typeof $;
  d3: typeof d3;
  Biomes: typeof Biomes;
  Names: typeof Names;
  ThreeD: typeof ThreeD;
  ReliefIcons: typeof ReliefIcons;
  Zoom: typeof Zoom;
}

interface Node {
  on: (name: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
  off: (name: string, fn: EventListenerOrEventListenerObject) => void;
}
