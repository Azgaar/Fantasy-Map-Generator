// Cloud provider implementations. Provider interface:
//   name:    name of the provider
//   auth():  authenticate and get access tokens from the provider
//   save(filename, contents): save a map file to the provider
//   load(path):  load a file from the provider
//   list():  list available files at the provider
//   getLink(path): get a shareable link for a file
//   initialize(): restore access tokens from storage if possible, else authenticate

import type { Dropbox, sharing } from "dropbox";
import { tip } from "@/ui/tooltips";
import { isElectron } from "@/utils/environment";
import { sentences, t } from "@/utils/i18n";
import { log } from "@/utils/logger";

interface CloudFile {
  name: string;
  updated: string;
  size: number;
  path: string;
}

interface DropboxTokens {
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}

type DropboxMethod =
  | "filesUpload"
  | "filesDownload"
  | "filesListFolder"
  | "filesListFolderContinue"
  | "sharingListSharedLinks"
  | "sharingCreateSharedLinkWithSettings";

interface DropboxTokenResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface DropboxProvider {
  name: string;
  clientId: string;
  pendingAuth: Promise<void> | null;
  token: string | null;
  api: Dropbox | null;
  call<K extends DropboxMethod>(name: K, param: Parameters<Dropbox[K]>[0]): Promise<Awaited<ReturnType<Dropbox[K]>>>;
  initialize(): Promise<void>;
  connect(tokens: DropboxTokens): Promise<void>;
  save(fileName: string, contents: string): Promise<boolean>;
  load(path: string): Promise<Blob>;
  list(): Promise<CloudFile[]>;
  auth(): Promise<void>;
  signIn(): Promise<void>;
  setDropBoxToken(tokens: DropboxTokens): Promise<void>;
  returnError(errorDescription: string): void;
  getLink(path: string): Promise<string>;
}

// helpers for token handling
const lSKey = (provider: string) => `auth-${provider}`;
const setToken = (provider: string, key: string) => localStorage.setItem(lSKey(provider), key);
const getToken = (provider: string) => localStorage.getItem(lSKey(provider));
const setRefreshToken = (provider: string, key: string) => localStorage.setItem(`${lSKey(provider)}-refresh`, key);
const getRefreshToken = (provider: string) => localStorage.getItem(`${lSKey(provider)}-refresh`);
const setTokenExpiry = (provider: string, ts: number) => localStorage.setItem(`${lSKey(provider)}-expires`, String(ts));
const getTokenExpiry = (provider: string) => Number(localStorage.getItem(`${lSKey(provider)}-expires`)) || undefined;

const dropbox: DropboxProvider = {
  name: "dropbox",
  clientId: "pdr9ae64ip0qno4",
  pendingAuth: null,
  token: null,
  api: null,

  call(name, param) {
    type Result = Awaited<ReturnType<Dropbox[typeof name]>>;
    const request = () => (this.api![name] as (arg: typeof param) => Promise<Result>)(param);
    const ready = this.api ? Promise.resolve() : this.initialize();
    return ready.then(request).catch(async (e: { status?: number }): Promise<Result> => {
      // only an expired or revoked token is fixed by signing in again
      if (e.status !== 401) throw e;
      await this.auth();
      return request();
    });
  },

  initialize() {
    const token = getToken(this.name);
    if (!token) return this.auth();
    const refreshToken = getRefreshToken(this.name) || undefined;
    const expiresAt = getTokenExpiry(this.name);
    return this.connect({ token, refreshToken, expiresAt });
  },

  async connect({ token, refreshToken, expiresAt }) {
    const { Dropbox, DropboxAuth } = await import("dropbox");
    const auth = new DropboxAuth({ clientId: this.clientId });
    auth.setAccessToken(token);
    // with a refresh token set, the SDK refreshes the short-lived access token before each request
    if (refreshToken) auth.setRefreshToken(refreshToken);
    if (expiresAt) auth.setAccessTokenExpiresAt(new Date(expiresAt));
    this.api = new Dropbox({ auth });
  },

  async save(fileName, contents) {
    const resp = await this.call("filesUpload", { path: `/${fileName}`, contents, mode: { ".tag": "overwrite" } });
    log.debug.cloud && log.info("Dropbox response:", resp);
    return true;
  },

  async load(path) {
    const resp = await this.call("filesDownload", { path });
    const blob = resp.result.fileBlob;
    if (!blob) throw new Error("Invalid response from dropbox.");
    return blob as Blob; // the browser build downloads into a Blob
  },

  async list() {
    let { result } = await this.call("filesListFolder", { path: "" });
    const entries = [...result.entries];
    while (result.has_more) {
      ({ result } = await this.call("filesListFolderContinue", { cursor: result.cursor }));
      entries.push(...result.entries);
    }

    const filesData: CloudFile[] = entries.flatMap(entry =>
      entry[".tag"] === "file"
        ? [{ name: entry.name, updated: entry.client_modified, size: entry.size, path: entry.path_lower ?? "" }]
        : []
    );
    return filesData.filter(({ size }) => size).sort((a, b) => b.updated.localeCompare(a.updated));
  },

  /** Sign in once for every caller that asks while a sign-in runs: they share the one popup */
  auth() {
    this.pendingAuth ??= this.signIn().finally(() => {
      this.pendingAuth = null;
    });
    return this.pendingAuth;
  },

  async signIn() {
    // Dropbox only redirects back to a registered https address, which the app:// origin can never be
    if (isElectron()) {
      const message = t("Dropbox is not available in the Desktop App, use the browser version to sync maps");
      this.returnError(message);
      throw new Error(message);
    }

    // opened before anything is awaited, so the click that asked for it still lets the popup through
    const width = 640;
    const height = 480;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2.5;
    const popup = window.open("./dropbox.html", "auth", `width=${width}, height=${height}, top=${top}, left=${left}`);
    if (!popup) {
      const message = sentences(t("Dropbox sign-in window was blocked"), t("Allow popups for this site and retry"));
      this.returnError(message);
      throw new Error(message);
    }

    // the page Dropbox sends the code back to, registered for this app; dropbox.html relays the code here
    const redirectUri = new URL("./dropbox.html", window.location.href).href;
    const { DropboxAuth } = await import("dropbox");
    const auth = new DropboxAuth({ clientId: this.clientId }); // keeps the PKCE verifier for the code exchange

    const code = await new Promise<string>((resolve, reject) => {
      const channel = new BroadcastChannel("dropbox-auth");
      const fail = (message: string) => {
        this.returnError(message);
        reject(new Error(message));
      };
      const watchDog = setTimeout(() => {
        channel.close();
        popup.close();
        reject(new Error("Timeout. No auth for Dropbox"));
      }, 120 * 1000);

      channel.onmessage = ({ data }) => {
        channel.close();
        clearTimeout(watchDog);
        if (data.type === "code") resolve(data.code);
        else fail(data.description);
      };

      auth
        .getAuthenticationUrl(redirectUri, undefined, "code", "offline", undefined, undefined, true)
        .then(url => {
          popup.location.href = String(url);
        })
        .catch((error: Error) => {
          channel.close();
          clearTimeout(watchDog);
          popup.close();
          fail(`Cannot start Dropbox authentication: ${error.message}`);
        });
    });

    try {
      const { result } = await auth.getAccessTokenFromCode(redirectUri, code);
      const { access_token, refresh_token, expires_in } = result as DropboxTokenResult;
      const expiresAt = expires_in ? Date.now() + expires_in * 1000 : undefined;
      await this.setDropBoxToken({ token: access_token, refreshToken: refresh_token, expiresAt });
    } catch (error) {
      const message = `Cannot get Dropbox access token: ${error instanceof Error ? error.message : String(error)}`;
      this.returnError(message);
      throw new Error(message);
    }
  },

  async setDropBoxToken({ token, refreshToken, expiresAt }) {
    log.debug.cloud && log.info("Access token:", token, "refresh token:", refreshToken);
    setToken(this.name, token);
    if (refreshToken) setRefreshToken(this.name, refreshToken);
    if (expiresAt) setTokenExpiry(this.name, expiresAt);
    await this.connect({ token, refreshToken, expiresAt });
  },

  returnError(errorDescription) {
    log.error(errorDescription);
    tip(errorDescription.replaceAll("+", " "), true, "error", 4000);
  },

  async getLink(path) {
    // return existing shared link
    const sharedLinks = await this.call("sharingListSharedLinks", { path });
    if (sharedLinks.result.links.length) return sharedLinks.result.links[0].url;

    // create new shared link
    const settings: sharing.SharedLinkSettings = {
      require_password: false,
      audience: { ".tag": "public" },
      access: { ".tag": "viewer" },
      requested_visibility: { ".tag": "public" },
      allow_download: true
    };
    const resp = await this.call("sharingCreateSharedLinkWithSettings", { path, settings });
    log.debug.cloud && log.info("Dropbox link object:", resp.result);
    return resp.result.url;
  }
};

// Method facade so the registry (which dispatches method calls, not property
// reads) can reach cloud storage uniformly as `Services.Cloud.<method>()`.
export const CloudStorage = {
  save: (fileName: string, contents: string) => dropbox.save(fileName, contents),
  load: (path: string) => dropbox.load(path),
  getLink: (path: string) => dropbox.getLink(path),
  list: () => dropbox.list(),
  connect: () => dropbox.initialize(),
  isConnected: () => Boolean(dropbox.api)
};
