"use strict";

/*
Cloud provider implementations (Dropbox only as now)

provider Interface:

name: name of the provider
async auth(): authenticate and get access tokens from provider
async save(filename): save map file to provider as filename
async load(filename): load filename from provider
async list(): list available filenames at provider
async getLink(filePath): get shareable link for file
restore(): restore access tokens from storage if possible
*/

window.Cloud = (function () {
  // helpers to use in providers for token handling
  const lSKey = x => `auth-${x}`;
  const setToken = (prov, key) => localStorage.setItem(lSKey(prov), key);
  const getToken = prov => localStorage.getItem(lSKey(prov));

  /**********************************************************/
  /* Dropbox provider                                       */
  /**********************************************************/

  const DBP = {
    name: "dropbox",
    clientId: "61ndwmjyxi8bkrc",
    authWindow: undefined,
    token: null, // Access token
    api: null,

    async call(name, param) {
      try {
        if (!this.api) await this.initialize();
        return await this.api[name](param);
      } catch (e) {
        if (e.name !== "DropboxResponseError") throw e;
        await this.auth(); // retry with auth
        return await this.api[name](param);
      }
    },

    initialize() {
      const token = getToken(this.name);
      if (token) {
        return this.connect(token);
      } else {
        return this.auth();
      }
    },

    async connect(token) {
      await import("../../libs/dropbox-sdk.min.js");
      const auth = new Dropbox.DropboxAuth({clientId: this.clientId});
      auth.setAccessToken(token);
      this.api = new Dropbox.Dropbox({auth});
    },

    async save(fileName, contents) {
      const resp = await this.call("filesUpload", {path: "/" + fileName, contents});
      DEBUG && console.info("Dropbox response:", resp);
      return true;
    },

    async load(path) {
      const resp = await this.call("filesDownload", {path});
      const blob = resp.result.fileBlob;
      if (!blob) throw new Error("Invalid response from dropbox.");
      return blob;
    },

    async list() {
      const resp = await this.call("filesListFolder", {path: ""});
      const filesData = resp.result.entries.map(({name, client_modified, size, path_lower}) => ({
        name: name,
        updated: client_modified,
        size,
        path: path_lower
      }));
      return filesData.filter(({size}) => size).reverse();
    },

    auth() {
      const width = 640;
      const height = 480;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2.5;
      this.authWindow = window.open("./dropbox.html", "auth", `width=640, height=${height}, top=${top}, left=${left}}`);

      return new Promise((resolve, reject) => {
        const watchDog = setTimeout(() => {
          this.authWindow.close();
          reject(new Error("Timeout. No auth for Dropbox"));
        }, 120 * 1000);

        window.addEventListener("dropboxauth", e => {
          clearTimeout(watchDog);
          resolve();
        });
      });
    },

    // Callback function for auth window
    async setDropBoxToken(token) {
      DEBUG && console.info("Access token:", token);
      setToken(this.name, token);
      await this.connect(token);
      this.authWindow.close();
      window.dispatchEvent(new Event("dropboxauth"));
    },

    returnError(errorDescription) {
      console.error(errorDescription);
      tip(errorDescription.replaceAll("+", " "), true, "error", 4000);
      this.authWindow.close();
    },

    async getLink(path) {
      // return existing shared link
      const sharedLinks = await this.call("sharingListSharedLinks", {path});
      if (sharedLinks.result.links.length) return sharedLinks.result.links[0].url;

      // create new shared link
      const settings = {
        require_password: false,
        audience: "public",
        access: "viewer",
        requested_visibility: "public",
        allow_download: true
      };
      const resp = await this.call("sharingCreateSharedLinkWithSettings", {path, settings});
      DEBUG && console.info("Dropbox link object:", resp.result);
      return resp.result.url;
    }
  };

  const providers = {dropbox: DBP};
  return {providers};
})();
