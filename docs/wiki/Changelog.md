---
layout: doc
title: "Changelog viewer"
---

# Changelog viewer

The signed-in **Release changelog** page (`/changelog`) is the in-app record of every
non-draft release published for AC Defender. It is bundled offline so a disconnected site
can still explain what shipped.

## What it shows

Each entry contains the version tag, release date, dim-sum code name, category, completing
commit subject, and the full 40-character commit SHA. The short SHA opens the exact commit
in the HomeAssistantAcDefender repository. The committed catalog is regenerated from the
current published non-draft release API before a release build, so the viewer stays current
without reaching the network at runtime.

At this 2026-08-04 regeneration checkpoint, 220 unique published tags were visible. Releases
published after the query are intentionally outside this immutable snapshot and are included
by the next catalog regeneration.

Some historical releases reuse a dim-sum code name or completing SHA because that is what
their published metadata says. Those entries are marked as legacy metadata in the viewer and
Markdown export; the app preserves the exact tag, date, name, and SHA instead of silently
rewriting history.

## Search, dates, and regex

The search is plain-text-first and matches version, code name, category, summary, and full
SHA. **Regex builder** is an explicit opt-in beside the field. It supports a raw .NET regex,
ignore-case (`i`), multiline (`m`), and dot-all (`s`) flags, validates patterns inline, and
uses a 100 ms evaluation timeout. From/to native date inputs accept typed ISO dates and
compose with search; **All dates** clears the range and **Today** selects the current date.

## Export and failure handling

The **Export & traceability** tab downloads or copies the currently filtered entries as
UTF-8 Markdown, including the active filters and full commit links. Invalid dates and regex
patterns keep the user's input visible and produce an inline error; no-match results say
which combined filter produced the empty view. Clipboard permission failures do not block
the Markdown download.

The catalog is static and contains no access token, Home Assistant state, or thermostat
command. If a release API refresh is unavailable, the last committed catalog remains usable;
the build should fail rather than emit a release entry without a real commit SHA.

## Verification

1. Open **Command palette → Release changelog**.
2. Search `v0.1.8`, set a date range, and confirm the count composes both filters.
3. Open Regex builder, enter `^v0\.1\.(8[0-9])$`, enable `i`, and confirm only matching
   versions remain. Enter `[` to verify inline validation and an honest empty state.
4. Open a commit link, download Markdown, and confirm the exported full SHA matches the
   visible entry.
5. Repeat at a 390 px viewport and with bilingual mode; no horizontal overflow is allowed.

Suggested next steps: [Release operations](release/README.html), [Settings](Settings.html),
and [Website Tour](Website-Tour.html).
