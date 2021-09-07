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
  const lSKey = x => `auth-${x}`
  const setToken = (prov, key) => localStorage.setItem(lSKey(prov), key)
  const getToken = prov => localStorage.getItem(lSKey(prov))

  /**********************************************************/
  /* Dropbox provider                                       */
  /**********************************************************/

  const DBP = {
    name: 'dropbox',
    clientId: 'sp7tzwm27u2w5ns',
    authWindow: undefined,
    token: null, // Access token
    api: null,

    restore() {
      this.token = getToken(this.name)
      if (this.token) this.connect(this.token)
    },

    async call(name, param) {
      try {
        return await this.api[name](param)
      } catch (e) {
        if (e.name !== "DropboxResponseError") throw(e)
        // retry with auth
        await this.auth()
        return await this.api[name](param)
      }
    },

    connect(token) {
      const clientId = this.clientId
      const auth = new Dropbox.DropboxAuth({ clientId })
      auth.setAccessToken(token)
      this.api = new Dropbox.Dropbox({ auth })
    },

    async save(fileName, contents) {
      if (!this.api) await this.auth()
      const resp = this.call('filesUpload', { path: '/' + fileName, contents })
      console.log("Dropbox response:", resp)
      return true
    },

    async load(path) {
      if (!this.api) await this.auth()
      const resp = await this.call('filesDownload', { path })
      const blob = resp.result.fileBlob
      if (!blob) throw(new Error('Invalid response from dropbox.'))
      return blob
    },

    async list() {
      if (!this.api) return null
      const resp = await this.call('filesListFolder', { path: '' })
      return resp.result.entries.map(e => ({ name: e.name, path: e.path_lower }))
    },

    auth() {
        const url = window.location.origin + window.location.pathname + 'dropbox.html'
        this.authWindow = window.open(url, 'auth', 'width=640,height=480')
        // child window expected to call
        // window.opener.Cloud.providers.dropbox.setDropBoxToken (see below)
        return new Promise((resolve, reject) => {
          const watchDog = () => {
            this.authWindow.close()
            reject(new Error("Timeout. No auth for dropbox."))
          }
          setTimeout(watchDog, 120*1000)
          window.addEventListener('dropboxauth', e => {
            clearTimeout(watchDog)
            resolve()
          })
        })
    },

    // Callback function for auth window.
    setDropBoxToken(token) {
      console.log('Access token got:', token)
      setToken(this.name, token)
      this.connect(token)
      this.authWindow.close()
      window.dispatchEvent(new Event('dropboxauth'))
    },

    async getLink(path) {
      if (!this.api) await this.auth()
      let resp

      // already exists?
      resp = await this.call('sharingListSharedLinks', { path })
      if (resp.result.links.length)
        return resp.result.links[0].url

      // create new
      resp = await this.call('sharingCreateSharedLinkWithSettings', {
        path,
        settings: {
          require_password: false,
          audience: 'public',
          access: 'viewer',
          requested_visibility: 'public',
          allow_download: true,
        }
      })
      console.log("dropbox link object:", resp.result)
      return resp.result.url
    },
  }

  // register providers here:
  const providers = {
    dropbox: DBP,
  }

  // restore all providers at startup
  for (const p of Object.values(providers)) p.restore()

  return { providers }
})()
