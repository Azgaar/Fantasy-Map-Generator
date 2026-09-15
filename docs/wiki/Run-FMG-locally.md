To run the Generator locally from the source code, install its Node.js dependencies and start the Vite development server. If you only want to use the Generator offline, download the desktop app installer from [Releases](https://github.com/Azgaar/Fantasy-Map-Generator/releases) instead — no build step is needed.

## Download
Clone the repository or download its source archive from [Releases](https://github.com/Azgaar/Fantasy-Map-Generator/releases), then unpack it. Install a current [Node.js](https://nodejs.org/) release, which includes npm.

## Development server

From the project directory run:

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/Fantasy-Map-Generator/`. The development server provides live reload.

## Production build

Run `npm run build` to create a static build in `dist`. Use `npm run preview` to serve that build locally. A generic Python or PHP server can serve an already-built `dist` directory, but it does not replace the Vite setup for the source tree.

## Desktop app

`npm run electron` starts the desktop app against the Vite dev server, with hot reload. `npm run electron dist` packages installers for the current OS into `release/`. The published installers are built by the _Build desktop app_ GitHub workflow when a release is tagged; see [Install with Nix](Install-with-Nix) for the Nix build.
