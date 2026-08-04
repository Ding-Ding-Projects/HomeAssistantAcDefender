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
- `npm run dist` reaches Squirrel.Windows packaging but is not an installer proof: the local
  Squirrel writer failed while writing setup because `dist/win-unpacked/locales` was missing.
  Keep this verification boundary explicit until a Windows packaging host produces and opens the
  real installer.

## Local verification

From this checkout:

```text
python scripts/count_lines.py
```

The script completed successfully at the current `master` tip and reported 361
counted text files, 67,092 total lines, and 59,927 non-blank lines. The report
also listed 38 tracked binary/non-text files and the excluded build/runtime/vendor
directories. The Electron controller's 86,642-byte icon is binary and is not
inflated into the source-line total.

## Integration and deployment notes

After this slice is integrated into the default branch, run the full `dotnet
build` and browser checks required by `AGENTS.md`, then let the release workflow
create its first verified release. Only after that remote evidence is available
should the Docker Compose stack be rebuilt on the deployment host.
Keep `.env`, `App_Data`, access tokens, and host state outside Git.

## Dim-sum startup surprise

- `Services/DimSumSurpriseService.cs` carries a five-row metadata cache pinned to the public
  `dim-sum-photos` catalog revision `f77ea1169db0bfc17365414c44ff495a823c6823`. Its five
  immutable `catalog-v1` release URLs are public PNGs; no image bytes are tracked here.
- `Components/Layout/MainLayout.razor` performs one fresh 10%-bucket draw after boot, only on
  the signed-in command route when no cooling-failure alert is active. The anchored status card
  is keyboard-dismissable, auto-dismisses after 12 seconds, respects reduced motion through the
  shared stylesheet, and removes itself with a non-blocking notice if the public image fails.
- `HomeAssistantAcDefender.Tests/DimSumSurpriseTests.cs` covers metadata provenance, published
  URL shape, exact draw boundaries, deterministic selection, and invalid bucket handling. Full
  `dotnet build` and the console regression runner remain the required integration checks.

## Open issues

At audit start, `gh issue list --state open` returned no open issues for either
this repository or `Ding-Ding-Projects/agent-global-memory`.
