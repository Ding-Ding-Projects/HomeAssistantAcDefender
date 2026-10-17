# Portable hosting setup

AC Defender Setup is a separate Windows companion that creates a new Docker deployment of Home Assistant AC Defender. The existing desktop controller and public documentation site remain available.

Download `AC-Defender-Setup-<version>-portable.exe` from the release. It contains its Electron runtime and starts without an adjacent runtime directory or another installer. Docker Desktop with Linux containers is a separate hosting prerequisite. Install and start Docker yourself, including any native administrator consent.

1. Run **Check Docker & Compose**. Setup requires a local Linux-container engine, not a remote Docker context.
2. Enter your real Home Assistant HTTPS root URL and climate entity. Private-network HTTP requires explicit consent; public HTTP and URLs containing credentials are rejected.
3. Choose a parent folder. Setup creates a uniquely named child directory, never overwriting an existing deployment. The host port is fixed at **8888**. A port conflict fails deployment rather than silently selecting another port.
4. Enter a Home Assistant long-lived access token in the password field. It clears after submission. The review screen never displays it.
5. Review the endpoint, entity and new storage directory. Explicitly acknowledge that starting AC Defender may automatically send real HVAC commands, then select **Pull image and start service**.
6. Follow actual pull, Compose start, running-service and HTTP health phases. Completion requires `/healthz` to report the expected version and source revision. Open the verified address to continue in AC Defender.

A successful health check proves service availability, not the safety of thermostat settings or complete Home Assistant connectivity. The wizard itself calls no climate command endpoint. The started application operates normally and may control the selected real entity.

## Storage and credentials

The new deployment directory contains a copy of the tracked Compose definition, `.env`, ownership metadata and Docker-created `App_Data` directories. On Windows, setup removes inherited directory permissions and grants the current user access using their actual SID before writing the credential file. If this protection fails, credentials are not written. Keep the directory private and out of version control and shared backups. Docker administrators can inspect container environment variables.

The existing project `.env`, existing `App_Data` and existing deployments are not modified. Progress is stored under Electron's per-user application-data directory and excludes the token. An unfinished configuration requires token re-entry after restart. An already-created deployment is resumed by checking its ownership and reusing its files without rewriting secrets. Symbolic-link deployment files are rejected.

## Cancellation and recovery

Cancel stops the current owned command and prevents later phases. Cancellation waits for the command to settle before another deployment can start. Containers already started can remain running, and no data is deleted. Closing the window during deployment first requests cancellation; close it again after the operation settles.

For a missing Docker prerequisite, install/start Docker and retry. For a failed deployment, check Docker Desktop and port 8888, then select **Recheck and resume**. If setup failed before the deployment ownership record was completed, choose a new parent/destination and re-enter the token. The incomplete directory is preserved for your inspection. Never delete a directory containing data you need.

Only URLs that passed the wizard's health check can open from the wizard. LAN candidates come from local private IPv4 interfaces and are verified individually. A LAN URL working on the host does not establish firewall access from another device. If no LAN address passes, the loopback URL works only on the hosting computer.

## Build and verification

From `hosting-wizard`, run `npm ci`, `npm test`, `npm run build`, and `npm run dist`. The last command creates `dist/AC-Defender-Setup-<version>-portable.exe`. CI sets the package version and `AC_DEFENDER_VERSION`, `AC_DEFENDER_REVISION`, and `AC_DEFENDER_BUILD_TIME` to the same release provenance used by the image. A local build without a source revision cannot deploy and displays unavailable build provenance honestly.

The first screen shows the artifact version and recorded build time in the computer's local timezone, including seconds. English, Cantonese and bilingual modes and light/dark appearance are stored locally. The window supports keyboard controls and a minimum 720 by 640 client area with scrolling at larger display scales.

Automated process tests cover configuration injection, credential non-disclosure, cancellation, Windows ACL failure, and safe resume. These tests do not prove native Windows launch, real Docker installation, elevation, or LAN access from another device. Those require separate supported-host acceptance evidence.

## Personal wording on this device

Use **Load personal wording JSON** in the setup window, or drop one JSON file onto it. The file stays in this renderer's private local storage and is never sent to Docker, Home Assistant, IPC or a server. **Clear personal wording** removes the saved cache and restores shipped wording. Invalid files keep the last valid wording. Saved wording is validated again each time the application opens.

The neutral schema is an object containing exactly `schemaVersion: 1` and an `entries` object of exact text keys and string replacements. Files are limited to 256 KiB and depth 8, keys to 160 Unicode codepoints and values to 1000. Duplicate, unsafe or extra keys are rejected. Selected setup titles, navigation and button text can change. Form values and labels, credentials, entity IDs, configuration, artifact provenance and URLs are excluded. No personal mappings ship with the application.

The Windows release pipeline runs `node scripts/native-portable-proof.mjs <portable.exe> <output-directory>` after packaging. It launches a byte-identical copy of the exact executable in an otherwise-empty folder, uses an isolated profile, verifies the owning process tree and exact packaged renderer, then checks the initial controls and artifact provenance and captures the real client area. `receipt.json` reports success only after bounded cleanup. This proof performs no setup, Docker, credential or HVAC action; operational acceptance remains separate.
