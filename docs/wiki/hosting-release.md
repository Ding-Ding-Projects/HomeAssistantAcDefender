---
layout: doc
title: "Published hosting releases"
---

# Published Docker and Windows hosting assets

The release workflow keeps the existing Squirrel.Windows desktop controller artifacts and additionally builds the portable hosting setup. It publishes a multi-platform GHCR service image labeled with the source revision and version, tagged by the full source commit, then records its immutable registry digest.

Each release attaches `image-reference.txt` and `docker-compose.published.yml`. The former is a single digest reference; the latter is generated from the tracked Compose file with that exact digest. The tracked Compose file accepts only an explicitly supplied image; the Windows launcher validates the approved registry path and immutable reference format. Docker archive downloads remain available separately for offline installation.

A registry package owner must enable public read access for `ghcr.io/ding-ding-projects/homeassistantacdefender` when first publishing. CI verifies an anonymous pull with a fresh Docker configuration and records its outcome in the GitHub release notes. A failed anonymous pull leaves hosting delivery explicitly incomplete without blocking the existing controller release. GitHub package permissions and registry availability remain external prerequisites. No registry credentials belong in the repository or release assets.

The workflow verifies that the normal GitHub release contains the expected Docker, Squirrel and portable hosting assets and targets the intended commit. Local script checks, registry publication, Windows execution and real network reachability are distinct evidence: a successful source check alone does not establish any of the latter.

The image embeds the shared CI UTC build time and source revision as assembly metadata, environment metadata and OCI labels. Compose preserves those baked image values rather than replacing them with local-development defaults.
