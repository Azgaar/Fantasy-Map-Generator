export const byId = document.getElementById.bind(document);

declare global {
  interface Window {
    byId: typeof byId;
  }
}
