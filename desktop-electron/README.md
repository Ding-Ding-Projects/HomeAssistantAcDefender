# AC Defender Controller (Windows Electron)

This folder is a separate **Windows-only Electron + React + TypeScript** controller for a
running Home Assistant AC Defender deployment. The existing `desktop/` Tauri client and the
defender's C# worker remain unchanged; this app never contains defender logic or simulated HVAC
state. It reads the real `/api/status` snapshot and sends explicit authenticated commands to the
hosted service.

## Connect to the hosted site

The first-run address is **`http://192.168.50.242:8888`**, the Docker host and port used by this
repository. It is editable in the sign-in screen and Settings tab for another deployment. Use
HTTPS when the address crosses an untrusted network; the controller does not weaken certificate
validation or put credentials in a URL. The app signs in through `/login`, preserves the server's
cookie and antiforgery token, and then calls the authenticated API from Electron's main process,
so renderer code never receives a password or cookie.

Remembered passwords use Electron `safeStorage` (Windows credential-backed encryption where
available). If encrypted storage is unavailable, the password is not written. The controller
does not log request bodies, tokens, or passwords.

## Controls and boundaries

- Live room/setpoint/HVAC telemetry, defender state, runtime, next action, and activity feed.
- Real target, defender switch, force-target, force-cooling, refresh, and thermostat-off commands.
- Thermostat-off has an explicit confirmation naming the real API action and device impact.
- Notification history can be read, dismissed, and restored through the hosted API.
- Connection URL, English/Cantonese/bilingual language mode, independent funny levels (1–5),
  theme, density, and a settings-local regex builder are persisted per Windows profile.
- `Ctrl+Shift+F` opens the command palette and navigates to every controller page.

Errors from the host are shown as errors. A disconnected or unavailable API never produces a
made-up temperature, HVAC state, success message, or fallback command.

## Build and package

Prerequisites: Windows, Node 20+, and the usual native prerequisites for Electron. All assets are
local; there are no CDN scripts, fonts, analytics, or remote images.

```powershell
cd desktop-electron
npm install
npm run test
npm run build
npm run dist       # Windows Squirrel installer/update artifacts
npm run electron   # run the packaged renderer after npm run build
```

`npm run build` emits the Vite renderer to `dist/`. `npm run dist` uses electron-builder's
Squirrel.Windows target and does not publish releases by itself; publishing remains the parent
repository's release workflow and must attach a verified installer.
