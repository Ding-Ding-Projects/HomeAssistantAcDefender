# Handoff

## Scope

The current handoff covers the server UI, the Windows controller, the in-app
changelog, release tooling, and deployment evidence. Defender control logic
still remains server-side; the Windows controller contains no simulated HVAC
state.

## CI and documentation slice

- `.github/workflows/release.yml` restores, builds, and runs the regression suite;
  creates a Docker image archive and checksum; counts lines with the committed
  script; resolves a public dim-sum code name without copying photos; and creates
  an immutable release only after verification passes.
- `scripts/count_lines.py` is the reproducible line-count implementation used by
  CI and release notes.
- `docs/wiki/release/` documents release artifacts, count boundaries, provenance,
  failure modes, and verification. `README.md`, `ROADMAP.md`, and this file link
  the workflow and its evidence.

## Windows Electron controller

- `desktop-electron/` is a separate Windows-only Electron + React/TypeScript controller. It does
  not contain defender logic or simulated HVAC state.
- `npm run build` and `npm test` pass from `desktop-electron/` in the current checkout.
- `npm run dist` now completes on this Windows checkout and produces a non-empty Setup.exe,
  `.nupkg`, and `RELEASES` feed under `desktop-electron/dist/squirrel-windows`.
  Keep this verification boundary explicit until a Windows packaging host opens the real
  installer and a signed background update feed plus restart banner are verified.
- The controller uses a frameless Material title bar with real minimize, maximize,
  and close IPC controls. Headless packaged-app capture verified the branded frame.
- Dashboard, Notifications, and Settings are persisted browser-style tabs with
  accessible `tablist`/`tab`/`tabpanel` semantics, overflow-safe scrolling, drag and
  keyboard reordering, and a bounded per-tab appearance editor. A 390px browser
  capture verified four opened routes, no document overflow, and Home-key navigation.
- Settings, schedule rules, settings-repository history, documentation search, and
  changelog search each expose a full anchored regex builder with plain text as the
  default and a bounded .NET/browser engine as documented.

## Changelog viewer

- `/changelog` is an offline, traceable catalog of 220 published non-draft releases at
  the 2026-08-04 refresh boundary. Each entry carries its release tag/date, dim-sum
  code name, completing commit SHA, category, and duplicate-metadata warning where
  the published history reuses a dish or SHA. The regression runner validates every
  SHA with `git cat-file`.
- Headless browser proof at desktop and 390px widths found 220 entries, regex
  `^v0\.1\.(20[0-9]|21[0-9]|22[0-4])$` produced 24 matches, and no horizontal overflow.

## Local verification

From this checkout:

```text
python scripts/count_lines.py
```

The script completed successfully at the `6cedbed` integration boundary and reported 370
counted text files, 69,384 total lines, and 62,028 non-blank lines. The report
also listed 38 tracked binary/non-text files and the excluded build/runtime/vendor
 directories. The Electron controller's 86,642-byte icon is binary and is not
inflated into the source-line total.

## Integration and deployment notes

After this slice is integrated into the default branch, run the full `dotnet
build` and browser checks required by `AGENTS.md`, then let the release workflow
create its first verified release. Only after that remote evidence is available
should the Docker Compose stack be rebuilt on the deployment host.
Keep `.env`, `App_Data`, access tokens, and host state outside Git.

## Open issues

At audit start, `gh issue list --state open` returned no open issues for either
this repository or `Ding-Ding-Projects/agent-global-memory`.
