---
layout: doc
title: "Windows HTTPS update-feed contract"
---

# Windows HTTPS update-feed contract

The Windows Electron controller accepts only a direct HTTPS Squirrel.Windows
feed directory. Before Electron's `autoUpdater` checks for packages, the main
process requests that directory's `RELEASES` manifest and validates its shape.
This gives the operator a useful failure at the **Check for updates** control
when a website URL, an incomplete directory, or a stale proxy was configured.

## Behaviour

- Empty feed configuration leaves updates disabled.
- HTTP, credentials in the URL, query strings, fragments, and GitHub Pages
  hosts are rejected before a request is made.
- The normalized directory URL is checked for a direct `RELEASES` response.
  The manifest is bounded to 256 KiB, must contain at least one package, and
  each entry must have a 40-character SHA-1, a safe `.nupkg` filename, and a
  positive package size.
- A valid manifest is only a preflight. Squirrel.Windows downloads the package
  using the manifest's package hash and size. Those fields provide content-integrity evidence,
  not a publisher signature. The controller never downloads an installer itself and never
  invents an `update-ready` state.
- A failed preflight clears stale readiness and becomes the ordinary,
  dismissible error notification. The non-blocking **Restart to install update**
  action is emitted only by Electron's real `update-downloaded` event.

## Configuration and security

Enter the HTTPS feed directory in Settings. Do not put credentials in the URL;
the feed should be public or protected by the platform's normal transport/auth
boundary, not by embedding a secret in this app's profile. The URL is stored
with the other controller preferences but never logged. `RELEASES` and packages are published
unsigned by permanent project policy. HTTPS, the bounded manifest parser, package SHA-1/size
fields, and the unsigned-artifact warning contract are the complete source-level integrity boundary;
visible controller warning copy remains an integration follow-up in the auth/UI-owned files and is
not claimed by this source-only lane;
none is a certificate or publisher-authenticity claim.

## Failure modes and recovery

| Symptom | Meaning | Recovery |
| --- | --- | --- |
| `GitHub Pages is an HTML site` | A Pages URL was entered, not a feed directory. | Use a direct HTTPS Squirrel feed directory. |
| `HTTP 404` or `HTTP 503` | `RELEASES` is missing or the feed is unavailable. | Restore the feed and use **Check for updates** again. |
| `invalid SHA-1`, package name, or size | The manifest is not a Squirrel `RELEASES` file. | Regenerate the release feed; do not bypass validation. |
| package hash/size mismatch | The package bytes do not match the `RELEASES` manifest. | Keep the current version and restore the exact release assets; no install is offered. |

## Verification

From `desktop-electron/`:

```powershell
npm test
npm run build
npm run dist
```

`tests/update-contract.mjs` covers URL normalization, rejected unsafe forms,
manifest bounds and fields, direct-feed preflight, and HTTP failure recovery.
`npm run dist` produces the non-empty Setup.exe, `.nupkg`, and `RELEASES` files;
local artifacts are unsigned and are not publisher-authenticity proof. The release workflow
attaches the assets and records their source revision and checksums; it never obtains or invokes
a signer.

## Suggested articles

- [Windows Electron controller](../Windows-Electron-controller.html) — the
  controller's API boundary and local profile.
- [Line counts and release archives](line-counts.html) — CI artifact and release
  provenance.
- [Deployment](../Deployment.html) — the hosted service the controller calls.
