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
}

type UnknownObject = {[key: string]: unknown};
