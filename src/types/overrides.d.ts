interface Navigator {
  userAgentData?: {
    mobile: boolean;
  };
}

interface Window {
  fmg: {
    modules: {
      [key: string]: boolean;
    };
  };
  d3: typeof d3;
  $: typeof $;
  mapCoordinates: IMapCoordinates;
}

interface Node {
  on: (name: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
  off: (name: string, fn: EventListenerOrEventListenerObject) => void;
}
