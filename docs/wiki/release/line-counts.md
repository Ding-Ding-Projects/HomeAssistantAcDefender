---
layout: doc
title: "Line counts and release archives"
---

# Line counts and release archives

## What CI publishes

Every branch push and every manual release dispatch runs the verification
workflow. It builds and packages the application and Docker images from that
same commit, then publishes an immutable release when build and publication
succeed. GitHub Actions intentionally does not run tests or lint; those checks
remain local evidence and are not release claims.
The workflow ignores its own generated `v0.1.*` tag pushes; this guard prevents
release publication from recursively starting another release while keeping
ordinary branch pushes covered.

The release includes:

- separate `ac-defender-docker-<version>-amd64.tar.gz` and
  `ac-defender-docker-<version>-arm64.tar.gz` single-platform Docker image
  archives for this server application;
- a SHA-256 checksum and exact image/version/architecture/revision metadata for
  each archive; and
- Windows controller assets from the locally built and locally checked Squirrel.Windows job:
  `Setup.exe`, the `.nupkg` update package, and the `RELEASES` feed. These are attached only
  after `npm run dist`, unsigned packaging-control checks, produced-byte
  `NotSigned` checks, and non-empty artifact checks pass on `windows-latest`;
- a release note with the exact commit, checks, public dim-sum code name (when
  a published catalog photo is available), CI-generated line-count table, and
  measured `Workflow started`, `Workflow completed`, and `Workflow duration`
  values in stable `HH:mm:ss` form. The timing starts at the first workflow job
  and ends when `gh release create` completes; the later notes edit only records
  that already-measured publication boundary.

The image is a real installable artifact, not a simulator or placeholder. Load
it on a deployment host with:

```bash
gunzip ac-defender-docker-<commit>.tar.gz
docker load --input ac-defender-docker-<commit>.tar
```

The normal Compose deployment remains the supported runtime path; see
[Deployment](../Deployment.html) for environment variables, state volumes, and
the required port.

## Windows installer and update feed

The Electron controller's `desktop-electron/package.json` targets
Squirrel.Windows. A successful release therefore carries the Setup executable,
the full NuGet package, and `RELEASES`; the latter two are required by Squirrel's
delta/update flow. The current client keeps background checks disabled until an
operator configures an HTTPS feed and preflights its direct `RELEASES` manifest.
Code signing is permanently disabled; HTTPS and package hashes provide transport
and content-integrity evidence, not publisher authenticity. The non-blocking
**Restart to install update** surface remains an auth/UI-owned integration
follow-up and is not claimed by this source-only lane. Treat attached assets as
build artifacts until the independent public release asset digest is verified.

## Reproducing the line-count table

The committed `scripts/count_lines.py` script is the sole source for the table
shown in release notes. It reads tracked files, reports total and non-blank
lines, and breaks the project into application source, tests, styles/markup,
documentation, and configuration/other text. It also reports surviving lines
attributed by `git blame` to automation identities (the author identity or an
explicit `Co-Authored-By` trailer) and states the exclusion rules.

Run it from a clean checkout:

```bash
python scripts/count_lines.py
```

Build output, runtime state, dependency trees, and tracked binary assets are
excluded because they do not represent project source lines. The report keeps a
grand total of counted text beside the project total so those boundaries stay
visible.

The latest checked-in refresh at the `cf07b8b` integration boundary reported
398 counted text files, 74,777 total lines, and 66,810 non-blank lines. CI remains
the release record; this copy is only a handoff convenience and must be refreshed
from the committed script after a later change.

## Release code names and photo provenance

Release automation resolves an unused dish name from the public
[Ding-Ding-Projects/dim-sum-photos catalog](https://github.com/Ding-Ding-Projects/dim-sum-photos)
and verifies that its image is in a published `catalog-v1*` release. Release
notes link to that public asset; this repository never copies or vendors the
photo. If the catalog is unavailable, the release keeps its version and
software artifacts and records that no code name was resolved.

## Failure modes and security

- A restore, build, regression test, Docker build, or line-count failure stops
  publication; no release is created from an unverified commit.
- The workflow uses the narrowest available GitHub token through the standard
  secret fallback chain and never prints it. Home Assistant credentials remain
  deployment-host secrets and are not needed by CI.
- Release archives contain the published application image only. Do not upload
  `.env`, `App_Data`, tokens, or deployment host state.
- A checksum mismatch must be treated as a failed transfer: download the
  archive again and verify it before loading the image.

## Verification checklist

1. Confirm the release tag targets the intended commit.
2. Download the archive and checksum, then run `sha256sum --check`.
3. Load the image and deploy with the documented Compose file on a host that
   has the real Home Assistant entity configured.
4. Open the dashboard and Settings page, then inspect the Defense page after
   deployment; the release workflow does not claim runtime proof for a host it
   cannot reach.

## Suggested articles

- [Deployment](../Deployment.html) — host configuration and secret handling.
- [API](../API.html) — verify the live status endpoints after deployment.
- [Website Tour](../Website-Tour.html) — check the visible pages and navigation.
