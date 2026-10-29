export type Point = [number, number];

declare global {
  interface Window {
    tip?: (...args: unknown[]) => void;
    clearMainTip?: () => void;
  }
}
