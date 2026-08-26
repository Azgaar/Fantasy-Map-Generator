Fantasy Map Generator is built with [Vite](https://vitejs.dev) and TypeScript, so a plain static web server can't run the source directly &mdash; you need Node.js and a build step.

## Requirements

* [Node.js](https://nodejs.org) 24 or later (see `engines` in `package.json`).
* `npm` (bundled with Node.js).

## Download

Clone the repository:

```
git clone https://github.com/Azgaar/Fantasy-Map-Generator.git
```

or download a zip of the `master` branch from GitHub (**Code** &rarr; **Download ZIP**) and unzip it.

Note: the [Releases](https://github.com/Azgaar/Fantasy-Map-Generator/releases) page is not cut every version and can lag well behind `master`. For the current code, use `master` rather than the latest tagged release.

## Development

Install dependencies once, then start the dev server:

```
npm install
npm run dev
```

This starts a Vite dev server with live reload: the app rebuilds and refreshes the browser automatically whenever you save a file. Vite prints the local URL to open (typically `http://localhost:5173/`).

## Just running a local copy

If you only want to run the tool without editing it, build it once and serve the output:

```
npm install
npm run build
```

This runs `tsc` and `vite build`, producing a static `dist/` folder. Serve that folder with any static web server (for example `npx serve dist`, `python -m http.server` from inside `dist/`, or an existing web server) and open it in a browser. This is the same process the project's own deployment uses to publish the live site.

## Contributor scripts

A few other scripts are useful when working on the code:

* `npm run lint` &mdash; run the [Biome](https://biomejs.dev) linter/formatter.
* `npm run test` &mdash; run unit tests ([Vitest](https://vitest.dev)).
* `npm run test:e2e` &mdash; run end-to-end tests ([Playwright](https://playwright.dev)).

See also [Working offline](Working-offline) and [Dependencies](Dependencies).
