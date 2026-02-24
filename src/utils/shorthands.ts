export const byId = <T extends HTMLElement>(id: string): T | undefined =>
  document.getElementById(id) as T;

declare global {
  interface Window {
    byId: typeof byId;
  }
}
