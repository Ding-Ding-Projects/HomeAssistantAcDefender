---
layout: doc
title: "Release operations"
---

# Release operations

This category documents the repeatable checks that turn a passing commit into a
downloadable Home Assistant AC Defender release.

| Article | Covers |
| --- | --- |
| [Line counts and release archives](line-counts.html) | CI-generated source/test/markup counts, Docker image archives, checksums, and public release metadata |
| [Windows signed update-feed contract](windows-update-feed.html) | HTTPS Squirrel `RELEASES` preflight, manifest validation, signature boundary, and recovery |

## Suggested articles

- [Deployment](../Deployment.html) — configure the real Home Assistant connection and Compose volumes.
- [Architecture](../Architecture.html) — understand the application and worker boundaries before upgrading.
- [Website Tour](../Website-Tour.html) — review the user-facing surfaces after a release.
