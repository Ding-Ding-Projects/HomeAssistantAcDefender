# AC Defender Documentation

A separate offline Electron documentation reader. It bundles the actual rendered GitHub Pages site, all wiki articles, navigation and illustrations. It never connects to Home Assistant and does not replace the HVAC controller or the public GitHub Pages site.

## Build

Use Node 24 and the same Jekyll toolchain as `.github/workflows/pages.yml`. From the repository root, build a separate copy with an empty base URL:

```sh
docker run --rm --user "$(id -u):$(id -g)" --entrypoint /bin/sh \
  --mount "type=bind,src=$PWD,dst=/repo" \
  ghcr.io/actions/jekyll-build-pages:v1.0.13 \
  -c 'jekyll build --source /repo/docs --destination /repo/docs-companion/site --baseurl ""'
cd docs-companion
npm ci
npm run build
npm test
npm start
```

Alternatively set `DOCS_SITE_DIR` to a completed Jekyll output directory. Release CI builds that output on Linux and transfers it to Windows before packaging. The build fails if any wiki article is absent. Tests check all local HTML links and assets. The complete site tree is copied, including static images.

On Windows:

```sh
npm version 0.1.123 --no-git-tag-version
npm run dist
```

Output: `dist/AC-Defender-Docs-0.1.123-portable.exe`. Electron Builder's portable target is one executable, with no separate installer. Windows runtime acceptance must be performed on Windows; browser tests do not prove the native executable launches.

## Reader

Search titles and full article text locally. Ctrl+K focuses search. Regular-expression search runs in a disposable worker and is terminated after 200 ms. Article links and anchors stay local. Back/Forward navigate opened articles. The reading plan saves marked-read progress; it never represents device configuration as completed. Settings persist shell language, appearance and message decoration. Article text retains its published language. A local JSON vocabulary object can be loaded and previewed as text in the session, replaced or cleared; it does not change source documents.

Release CI supplies `AC_DEFENDER_VERSION`, `AC_DEFENDER_REVISION` and `AC_DEFENDER_BUILD_TIME`. The build validates these values and requires the release version to match package.json; local builds fall back to package version, Git HEAD and the time the bundle is built. The initial screen shows package version, Git source revision and build timestamp formatted with seconds and local timezone. This timestamp is written when the bundle is built, not when it is launched.

The renderer has no Node access, preload or IPC. Requests resolve inside packaged files; remote resources, new windows, permission requests and webviews are refused. Article scripts, handlers, forms, embedded frames and external active links are removed; external references remain labelled as unavailable offline. The article iframe has scripts disabled. Existing site script-driven menus are therefore replaced by the reader's own search and navigation.

## Validation and limitations

`npm run build`, `npm test` and `node scripts/browser-proof.mjs` validate the bundle. Browser proof uses isolated Chromium, serves the built output over loopback, blocks all non-loopback requests, tests interactions and stores genuine captures and a source/hash receipt in ignored `evidence/`. It is not native Windows acceptance.

The design handoff records outstanding universal-feature and full parity requirements. This reader's implemented controls use registered `@material/web` components; existing authored article content and the platform file picker retain semantic document/browser controls. No complete universal UI compliance claim is made.
