// Cloud provider implementations. Provider interface:
//   name:    name of the provider
//   auth():  authenticate and get access tokens from the provider
//   save(filename, contents): save a map file to the provider
//   load(path):  load a file from the provider
//   list():  list available files at the provider
//   getLink(path): get a shareable link for a file
//   initialize(): restore access tokens from storage if possible, else authenticate

export interface CloudFile {
  name: string;
  updated: string;
  size: number;
  path: string;
}

interface DropboxProvider {
  name: string;
  clientId: string;
  authWindow: Window | null;
  token: string | null;
  api: any;
  call(name: string, param?: unknown): Promise<any>;
  initialize(): Promise<void>;
  connect(token: string): Promise<void>;
  save(fileName: string, contents: string): Promise<boolean>;
  load(path: string): Promise<Blob>;
  list(): Promise<CloudFile[]>;
  auth(): Promise<void>;
  setDropBoxToken(token: string): Promise<void>;
  returnError(errorDescription: string): void;
  getLink(path: string): Promise<string>;
}

// helpers for token handling
const lSKey = (provider: string) => `auth-${provider}`;
const setToken = (provider: string, key: string) => localStorage.setItem(lSKey(provider), key);
const getToken = (provider: string) => localStorage.getItem(lSKey(provider));

// load a classic library bundle that registers a runtime global (e.g. window.Dropbox)
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Cannot load script ${src}`));
    document.head.append(script);
  });
}

const dropbox: DropboxProvider = {
  name: "dropbox",
  clientId: "pdr9ae64ip0qno4",
  authWindow: null,
  token: null,
  api: null,

  async call(name, param) {
    try {
      if (!this.api) await this.initialize();
      return await this.api[name](param);
    } catch (e) {
      if ((e as Error).name !== "DropboxResponseError") throw e;
      await this.auth(); // retry with auth
      return await this.api[name](param);
    }
  },

  initialize() {
    const token = getToken(this.name);
    return token ? this.connect(token) : this.auth();
  },

  async connect(token) {
    await loadScript("libs/dropbox-sdk.min.js");
    const auth = new Dropbox.DropboxAuth({ clientId: this.clientId });
    auth.setAccessToken(token);
    this.api = new Dropbox.Dropbox({ auth });
  },

  async save(fileName, contents) {
    const resp = await this.call("filesUpload", { path: `/${fileName}`, contents });
    DEBUG.cloud && console.info("Dropbox response:", resp);
    return true;
  },

  async load(path) {
    const resp = await this.call("filesDownload", { path });
    const blob = resp.result.fileBlob;
    if (!blob) throw new Error("Invalid response from dropbox.");
    return blob;
  },

  async list() {
    const resp = await this.call("filesListFolder", { path: "" });
    const filesData: CloudFile[] = resp.result.entries.map(({ name, client_modified, size, path_lower }: any) => ({
      name,
      updated: client_modified,
      size,
      path: path_lower
    }));
    return filesData.filter(({ size }) => size).reverse();
  },

  auth() {
    const width = 640;
    const height = 480;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2.5;
    this.authWindow = window.open(
      "./dropbox.html",
      "auth",
      `width=${width}, height=${height}, top=${top}, left=${left}`
    );

    return new Promise<void>((resolve, reject) => {
      const channel = new BroadcastChannel("dropbox-auth");

      const watchDog = setTimeout(() => {
        channel.close();
        this.authWindow?.close();
        reject(new Error("Timeout. No auth for Dropbox"));
      }, 120 * 1000);

      channel.onmessage = async ({ data }) => {
        channel.close();
        clearTimeout(watchDog);
        if (data.type === "token") {
          await this.setDropBoxToken(data.token);
          resolve();
        } else {
          this.returnError(data.description);
          reject(new Error(data.description));
        }
      };
    });
  },

  async setDropBoxToken(token) {
    DEBUG.cloud && console.info("Access token:", token);
    setToken(this.name, token);
    await this.connect(token);
  },

  returnError(errorDescription) {
    console.error(errorDescription);
    tip(errorDescription.replaceAll("+", " "), true, "error", 4000);
  },

  async getLink(path) {
    // return existing shared link
    const sharedLinks = await this.call("sharingListSharedLinks", { path });
    if (sharedLinks.result.links.length) return sharedLinks.result.links[0].url;

    // create new shared link
    const settings = {
      require_password: false,
      audience: "public",
      access: "viewer",
      requested_visibility: "public",
      allow_download: true
    };
    const resp = await this.call("sharingCreateSharedLinkWithSettings", { path, settings });
    DEBUG.cloud && console.info("Dropbox link object:", resp.result);
    return resp.result.url;
  }
};

export const Cloud = { providers: { dropbox } };

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
