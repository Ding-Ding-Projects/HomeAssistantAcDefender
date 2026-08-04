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

Connection, authentication, HTTP, and API errors are rendered as errors. A disconnected host
never produces a made-up reading or success result. The Squirrel installer target is configured,
and the local Windows packaging command produces the complete installer/update set.

## Verification

From `desktop-electron/`:

```powershell
npm ci --ignore-scripts
npm run build
npm test
```

`npm run build`, `npm test`, and `npm run dist` pass in the current checkout. The packaging command
produces a Squirrel Setup.exe, a `.nupkg` update package, and a `RELEASES` feed under
`dist/squirrel-windows`; the release workflow verifies those files are non-empty before attaching
them. A Lowlevel headless Windows launch also verified the branded frameless title bar and editable
loopback sign-in field. Opening the installer and enabling a signed background update feed remain
separate gates and must not be described as passed until their corresponding evidence exists.

## Suggested articles

- [API](API.md) — the authenticated service routes used by the controller.
- [Notification history](Notification-history.md) — the server-side journal behind its review tab.
- [Command palette](Command-palette.md) — keyboard navigation in the hosted app.
