---
title: "Windows Electron controller"
---

# Windows Electron controller

The `desktop-electron/` folder is a separate Windows-only Electron + React/TypeScript client for
the hosted AC Defender service. It is a controller, not a second thermostat brain: defender
decisions remain in the server and every reading or command comes from the real API.

## Behaviour

- First-run address: `http://127.0.0.1:8888`; the address remains editable for another
  approved deployment. Public docs intentionally do not record private LAN addresses.
- The main process performs the real `/login` form exchange, preserves the server cookie and
  antiforgery token, and exposes only a narrow authenticated IPC bridge to the renderer.
- Dashboard commands call `/api/status`, `/api/target`, `/api/defender`, and the real thermostat
  command endpoints. Thermostat-off has an explicit confirmation naming the affected device.
- Notification history reads, marks read, dismisses, and restores records through the hosted API.
- The optional Squirrel update feed is normalized and preflighted against a direct `RELEASES`
  manifest before Electron checks for packages. HTTPS transport and the manifest's package hashes
  provide transport/content-integrity evidence; shipped artifacts are unsigned and may trigger an
  operating-system publisher warning. Settings, manual checks, and the ready banner render that
  exact warning in source. See [Windows HTTPS update-feed contract](release/windows-update-feed.html)
  for the boundary and recovery states.
- Settings persist language mode, independent English/Cantonese funny levels, theme, density,
  accent/seed color, installed-font choice, and UI scale (85%–135%), plus a settings-local
  plain-text/regex search builder. Appearance values apply live to the controller only;
  `Ctrl+Shift+F` opens the command palette and focuses each appearance control directly.

## Configuration and security

The optional remembered password is stored with Electron `safeStorage` and is omitted when
encrypted storage is unavailable. Renderer code does not receive the password or cookie.
Credentials are never accepted in the base URL, and the client does not weaken TLS validation.
Appearance values are normalized in the Electron main process to fixed color/font/scale
allow-lists before the renderer applies CSS variables. The public source keeps a loopback default;
an approved hosted address is entered explicitly by the operator.
There are no fake temperatures, fallback thermostat states, analytics, CDN scripts, or remote
runtime images.

## Failure modes

Connection, authentication, HTTP, API, and update-feed errors are rendered as errors. A
disconnected host never produces a made-up reading or success result. The Squirrel installer
target is configured, and the local Windows packaging command produces the complete
  installer/update set; the feed article records why unsigned local artifacts are not publisher
  authenticity proof.

## Verification

From `desktop-electron/`:

```powershell
npm ci --ignore-scripts
node node_modules/electron/install.js
node node_modules/esbuild/install.js
npm run build
npm test
```

The package job does not run arbitrary npm lifecycle hooks. Electron `43.4.1` and esbuild
`0.28.1` install steps are invoked explicitly after the script-disabled install; transitive
electron-winstaller `5.4.0` is version-checked but its vendor-dependent install hook is not
invoked because this project does not own its `vendor/7z-*` inputs.

`npm run build` and `npm test` pass in the current checkout. The current Electron `43.4.1`
candidate has not yet completed its bounded `npm run dist` pass. That packaging command must
produce a Squirrel Setup.exe, a `.nupkg` update package, and a `RELEASES` feed under
`dist/squirrel-windows` before the release workflow can attach them. A previous Lowlevel headless
baseline verified the branded frameless title bar and editable loopback sign-in field; the current
package still requires fresh capture and installer evidence. Background updates
never claim a signature: they require HTTPS plus a valid `RELEASES` manifest and package hashes,
and render the exact unsigned-artifact warning in Settings, manual check results, and the ready
banner. Packaged interaction remains unverified until the current installer is exercised.

The landing page exposes the exact verified installer asset from release `v0.1.876`:
[Download the Windows controller v0.1.876 Setup.exe](https://github.com/Ding-Ding-Projects/HomeAssistantAcDefender/releases/download/v0.1.876/AC.Defender.Controller.Setup.0.1.0.exe).
The link names its version and platform and is intentionally pinned to that immutable release
asset; it is not a claim that a newer release has passed the installer gate.

## Suggested articles

- [API](API.html) — the authenticated service routes used by the controller.
- [Notification history](Notification-history.html) — the server-side journal behind its review tab.
- [Command palette](Command-palette.html) — keyboard navigation in the hosted app.

## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
