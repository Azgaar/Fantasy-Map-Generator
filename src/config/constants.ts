// detect device
export const MOBILE = globalThis.innerWidth < 600 || globalThis.navigator?.userAgentData?.mobile;

// typed arrays max values
export const INT8_MAX = 127;
export const UINT8_MAX = 255;
export const UINT16_MAX = 65535;
export const UINT32_MAX = 4294967295;
