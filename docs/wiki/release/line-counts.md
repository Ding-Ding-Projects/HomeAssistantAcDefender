---
layout: doc
title: "Line counts and release archives"
---

# Line counts and release archives

## What CI publishes

Every push to `master` and every manual release dispatch runs the verification
workflow. It restores and builds the application and regression suite, runs the
real Home Assistant HTTP regression checks, builds the Docker image from that
same commit, and publishes an immutable release only after those checks pass.

The release includes:

- `ac-defender-docker-<commit>.tar.gz`, a loadable Docker image archive for this
  server application;
- a SHA-256 checksum for the archive; and
- a release note with the exact commit, checks, public dim-sum code name (when
  a published catalog photo is available), and the CI-generated line-count table.

The image is a real installable artifact, not a simulator or placeholder. Load
it on a deployment host with:

```bash
gunzip ac-defender-docker-<commit>.tar.gz
docker load --input ac-defender-docker-<commit>.tar
```

The normal Compose deployment remains the supported runtime path; see
[Deployment](../Deployment.html) for environment variables, state volumes, and
the required port.

## Reproducing the line-count table

The committed `scripts/count_lines.py` script is the sole source for the table
shown in release notes. It reads tracked files, reports total and non-blank
lines, and breaks the project into application source, tests, styles/markup,
documentation, and configuration/other text. It also reports surviving lines
attributed by `git blame` to automation identities and states the exclusion
rules.

Run it from a clean checkout:

```bash
python scripts/count_lines.py
```

Build output, runtime state, dependency trees, and tracked binary assets are
excluded because they do not represent project source lines. The report keeps a
grand total of counted text beside the project total so those boundaries stay
visible.

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
