# Build Instructions

## Requirements

- **OS**: Linux, macOS, or Windows
- **Node.js**: v18.0.0 or later (tested with v22.x) - https://nodejs.org/
- **npm**: v9.0.0 or later (included with Node.js)

## Steps

1. Install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

3. The built extension is in the `dist/` directory. Load it in Firefox via `about:debugging#/runtime/this-firefox` > "Load Temporary Add-on" > select `dist/manifest.json`.

## Build script

Alternatively, run the included build script:

```bash
chmod +x build.sh
./build.sh
```

## What the build does

The project uses [Vite](https://vite.dev/) (v8.x) as its build tool. Two build steps run in sequence:

1. `vite build` - Bundles the main extension (popup, reading mode, history, options, multi-analysis, PDF analysis pages, background service worker, and shared utilities). Output goes to `dist/`.
2. `vite build --config vite.config.content.js` - Bundles the content script separately as an IIFE (required by Firefox for content scripts). Output goes to `dist/src/content/`.

A custom Vite plugin (`firefoxExtensionPlugin` in `vite.config.js`) copies `manifest.json` and `content-script.css` into `dist/` during the build.

## Third-party libraries (installed via npm)

- `@mozilla/readability` - Article content extraction (Mozilla, Apache-2.0)
- `jspdf` - PDF export generation (MIT)
- `pdfjs-dist` - PDF parsing, includes pre-built worker in `public/workers/pdf.worker.min.js` (Apache-2.0)
- `lz-string` - Data compression for browser storage (MIT)

## Generating the .xpi package

```bash
npm run build:xpi
```

This runs the build and then `web-ext build --source-dir dist`, producing a zip file in `web-ext-artifacts/`.
