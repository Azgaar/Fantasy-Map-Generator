// What the app runs in: the desktop app or a browser, a local or a published build, a phone
export type ElectronBridge = {
  isElectron: true;
  platform: string;
  versions: { electron: string; chrome: string; node: string };
};

export const isElectron = (): boolean => Boolean(window.electron?.isElectron);

export const isLocalhost = (): boolean => location.hostname === "localhost" || location.hostname === "127.0.0.1";

export const isProduction = (): boolean => Boolean(location.hostname) && !isLocalhost();

export const isMobile = (): boolean => window.innerWidth < 600 || Boolean(navigator.userAgentData?.mobile);

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
  interface Navigator {
    userAgentData?: {
      mobile?: boolean;
      platform?: string;
      getHighEntropyValues?(hints: string[]): Promise<{ architecture?: string }>;
    };
    standalone?: boolean;
  }
}
