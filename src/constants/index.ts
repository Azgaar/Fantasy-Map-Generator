export const PRODUCTION = location.hostname && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";

// detect device
export const MOBILE = window.innerWidth < 600 || window.navigator.userAgentData?.mobile;

// typed arrays max values
export const UINT8_MAX = 255;
export const UINT16_MAX = 65535;
export const UINT32_MAX = 4294967295;
