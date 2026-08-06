# Roadmap

This file is a compact, factual index of the work still needed to make the
real Home Assistant deployment easier to verify and operate. Detailed feature
behavior belongs in the categorized documentation under `docs/wiki/`.

## Delivery gates

- [x] Add the separate Windows Electron controller source and its local build/static checks.
- [ ] Open a verified Squirrel.Windows installer and enable its signed background update feed;
      `npm run dist` now produces Setup.exe, `.nupkg`, and `RELEASES`, but opening the installer,
      signing the feed, and verifying a non-blocking restart banner remain outstanding.

- [x] Build and regression-test the application before a release.
- [x] Build a loadable Docker image archive and checksum from the exact tested commit.
- [x] Publish a CI-generated line-count table with source, tests, styles/markup,
      documentation, configuration, and exclusion rows.
- [x] Link a verified public dim-sum catalog photo when selecting a release code name;
      keep the photo outside this repository.
- [x] Provide searchable application-owned context menus across signed-in surfaces, with
      `Shift+F10`, truthful shortcut labels, and mobile press-and-hold tab editing.
- [x] Keep Cooling Failure Watch advisory at MEGA and reserve automatic thermostat OFF for
      OMEGA-confirmed room-rise evidence; preserve a manual restart for the rest of the episode.
- [ ] Re-run browser checks on the dashboard, Defense, Energy, Settings, and
      narrow layouts for each user-facing change.
- [ ] Re-deploy the verified default-branch commit to the production Docker host
      after each coherent change set and record the live endpoint evidence.

## Documentation hygiene

- Keep [Deployment](docs/wiki/Deployment.md), [Release operations](docs/wiki/release/README.md),
  `HANDOFF.md`, and this roadmap aligned with the last verified commit.
- Add a categorized article for each new user-facing feature, including behavior,
  configuration, failure modes, security, and verification evidence.
