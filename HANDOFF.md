# Handoff

## Scope

The CI and documentation audit is intentionally limited to workflow files,
release tooling, and documentation. No `Components/`, `Services/`, or other
runtime control code was changed here.

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

## Local verification

From this checkout:

```text
python scripts/count_lines.py
```

The script completed successfully at the current `master` tip and reported 361
counted text files, 67,217 total lines, and 60,041 non-blank lines. The report
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
