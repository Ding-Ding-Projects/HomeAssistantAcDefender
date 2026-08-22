# Roadmap

This file is a compact, factual index of the work still needed to make the
real Home Assistant deployment easier to verify and operate. Detailed feature
behavior belongs in the categorized documentation under `docs/wiki/`.

## Delivery gates

- [x] Add the separate Windows Electron controller source and its local build/static checks.
- [ ] Open a verified Squirrel.Windows installer and verify the unsigned HTTPS/package-hash
      update path end to end; the clean-tree `5a265f9` candidate produced Setup.exe, `.nupkg`, and
      `RELEASES` with an independent unsigned-artifact receipt, but installer execution and the
      non-blocking restart banner remain outstanding. Code signing stays permanently disabled.

- [x] Build and regression-test the application before a release.
- [x] Build a loadable Docker image archive and checksum from the exact tested commit.
- [x] Publish separate linux/amd64 and linux/arm64 image archives, checksums, OCI revision/version
      metadata, and an exact `up --no-build` Compose selection path.
- [x] Add anonymous non-secret `/healthz`, bounded trusted-forwarded-HTTPS configuration, and
      Compose health/resource/secret-state mounts for a small ARM64 host.
- [x] Pin complete multi-platform .NET base-image digests and reject truncated digests before a
      Docker build; the `6c1096a` ARM64 preflight image returned its revision/version health JSON
      in an isolated temporary container.
- [ ] Complete a fully fresh-machine Windows bootstrap with the pinned user-scoped portable ZIP
      fallbacks when winget is unavailable. The source contract and hashes are now recorded, but
      a cold-machine execution proof, live host deployment, and release publication remain
      intentionally unclaimed in this lane.
- [x] Publish a CI-generated line-count table with source, tests, styles/markup,
      documentation, configuration, and exclusion rows.
- [x] Link a verified public dim-sum catalog photo when selecting a release code name;
      keep the photo outside this repository.
- [x] Provide searchable application-owned context menus across signed-in surfaces, with
      `Shift+F10`, truthful shortcut labels, and mobile press-and-hold tab editing.
- [x] Keep Cooling Failure Watch advisory at MEGA and reserve automatic thermostat OFF for
      OMEGA-confirmed room-rise evidence; preserve a manual restart for the rest of the episode.
- [x] Keep rejected Home Assistant climate-command diagnostics bounded to HTTP status and
      normalized operation identity; preserve exact-command backoff while showing one persistent,
      viewport-safe command outcome instead of stacked retry notifications.
- [x] Expand Yell-O-Meter documentation with truthful uncertainty boundaries, fifty-two survival
      moves, the lived fight-or-flight/freeze/cry and extreme-overthinking accounts, a fourteen-stage
      expectation ledger, and sourced hearing, heat, pain, stress, and personal-safety facts.
- [x] Verify the expanded Energy and wiki surfaces at 390 CSS pixels and a 200% display-equivalent
      mobile gate with no root-page horizontal overflow or bottom-navigation item overlap.
- [ ] Re-run browser checks on the dashboard, Defense, Energy, Settings, and
      narrow layouts for each user-facing change.
- [ ] Re-deploy the verified default-branch commit to the production Docker host
      after each coherent change set and record the live endpoint evidence.

## Documentation hygiene

- Keep [Deployment](docs/wiki/Deployment.md), [Release operations](docs/wiki/release/README.md),
  `HANDOFF.md`, and this roadmap aligned with the last verified commit.
- Add a categorized article for each new user-facing feature, including behavior,
  configuration, failure modes, security, and verification evidence.
