export const DEBUG = Boolean(localStorage.getItem("debug"));
export const INFO = DEBUG || !PRODUCTION;
export const TIME = DEBUG || !PRODUCTION;
export const WARN = true;
export const ERROR = true;
