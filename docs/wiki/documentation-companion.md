---
layout: doc
title: "Offline documentation companion"
---

# Offline documentation companion

AC Defender Documentation is a separate portable Windows reader. It contains the public website's rendered articles and illustrations, works without a network connection, and does not control your thermostat. The public GitHub Pages documentation remains available.

Open the portable executable, search titles or article text, and choose an article. Article links and images resolve within the bundled site. Ctrl+K focuses search. Regular expressions are optional and time-limited. External references are labelled and disabled while reading offline.

The Reading plan walks through the interface tour, deployment requirements, safety decisions and settings. Mark read saves reading progress only; it does not claim your Home Assistant installation is configured. You can revisit previous steps at any time.

Settings provide English, Cantonese or bilingual shell labels and system, light or dark appearance. Articles retain their authored language. Local vocabulary JSON uses schemaVersion 1 and an entries object with exact original wording as keys. Valid entries are accepted up to 256 KiB, keys up to 160 Unicode code points and replacement values up to 1000 code points. Duplicate and unsafe keys, excess nesting and invalid UTF-8 are rejected. Only matching reader navigation labels change; articles, provenance and links remain unchanged. Valid wording is cached locally and revalidated at startup. Rejected imports and storage failures preserve previous wording. Clearing purges the cache and restores original labels. The initial screen shows the actual package version, source revision and recorded build time with seconds and timezone.

The companion is distributed as `AC-Defender-Docs-<version>-portable.exe`. It has no Home Assistant credentials or device-control connection. See the repository's `docs-companion/README.md` for build commands and validation limits.
