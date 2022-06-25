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
  pack: IPack;
  grig: IGrid;
}

interface Node {
  on: (name: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
  off: (name: string, fn: EventListenerOrEventListenerObject) => void;
}

type UnknownObject = {[key: string]: unknown};
