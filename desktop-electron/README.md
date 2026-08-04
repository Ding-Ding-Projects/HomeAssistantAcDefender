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
- Optional Windows update feed: configure an HTTPS Squirrel.Windows feed in Settings. Electron's
  `autoUpdater` performs the signed background check/download; this app never invents an update,
  downloads an arbitrary URL, or executes an unverified installer. Only the `update-downloaded`
  event creates the non-blocking **Restart to install update** banner, and installation runs only
  after the user presses that action.
- Every controller search surface (Settings, Notifications, and the `Ctrl+Shift+F` command palette)
  has its own anchored regex builder. It is plain-text-first, with guided literal/class/anchor/
  group/alternation/quantifier blocks, a bounded raw pattern and flags editor, sample text, syntax
  feedback, live matches and capture groups, plus copy and **Use in search** actions. Patterns are
  evaluated locally in the renderer and are never sent to the defender API.
- Dashboard, Notifications, and Settings are browser-style tabs with `tablist`/`tab`/`tabpanel`
  roles. The active tab, order, and per-tab bounded appearance values (surface/text color and
  font size) persist in the Windows profile. Tabs scroll horizontally instead of clipping; drag
  or `Ctrl+Shift+←/→` reorders them, and right-click or <kbd>F2</kbd> opens the anchored **Edit
  tab appearance…** editor with Save, Reset, and Cancel. The editor is intentionally bounded to
  tab chrome and does not alter defender logic or page content.

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

## Signed update-feed contract

The feed URL points to a Squirrel.Windows release directory containing the signed `RELEASES`
manifest and signed `.nupkg`/setup artifacts produced by the release workflow. The feed must be
HTTPS and must not be a GitHub Pages HTML page or an unsigned file share. The workflow owns key
management and signing; private signing keys never enter this repository or the controller.

The main process passes the feed to Electron's Windows `autoUpdater`, which verifies the package
signature before emitting `update-downloaded`. A failed check is shown as an ordinary, dismissible
error notification. There is no fake `updateReady` state: the renderer receives it only from the
real Electron event, and `Restart to install update` calls `quitAndInstall` only after that event.
On non-Windows development runs, checks report `windows-only` and do not attempt a download.
