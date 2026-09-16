**Fantasy Map Generator** is a web tool, but it runs offline once the app assets are available locally. The simplest option is the desktop app: installers for Windows, macOS and Linux are attached to every [release](https://github.com/Azgaar/Fantasy-Map-Generator/releases) (Nix users see [Install with Nix](Install-with-Nix)). To run from source instead, download or clone the repository, run `npm install`, and start the local Vite server as described in [Run FMG locally](Run-FMG-locally).

*Known Limitations:*

* Fonts and textures loaded from external URLs require an internet connection unless they have been downloaded or embedded locally.
* A production build or installed PWA can work without network access after its assets have been cached.

The desktop app is an Electron build of the same code and needs no browser; the source of the app is in the `electron` directory of the repository.
