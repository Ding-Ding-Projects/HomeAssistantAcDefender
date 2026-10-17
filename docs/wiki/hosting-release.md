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

## Container package pins

The Noble runtime pins `curl=8.5.0-2ubuntu10.16` and `git=1:2.43.0-1ubuntu7.3`. The previous curl revision was no longer present in the configured official archives. The replacement was checked with signed `apt-get update` using the Ubuntu archive keyring from the exact pinned ASP.NET base image. Both amd64 and arm64 package downloads passed APT verification against those signed indexes; amd64 installation also completed successfully. ARM64 package availability was verified using its official ports indexes without claiming an ARM64 execution test.

The dependency manifest records the official repository origins and the SHA256 hashes of the downloaded packages for each architecture. The runtime image digest in that manifest matches the Dockerfile. Package indexes change over time: if a future exact pin disappears, repeat signed repository verification for both architectures and update the explicit pin and provenance together. Do not substitute a floating package version or bypass signature checks.
