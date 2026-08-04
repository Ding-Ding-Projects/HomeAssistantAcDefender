---
layout: doc
title: "Notification history"
---

# Notification history

AC Defender keeps a reviewable history of defender activity notifications. The live dashboard still
shows the recent event tail, but the notification centre API retains notices after that tail rolls off,
so dismissing a snackbar does not erase the evidence.

The signed-in website exposes the same journal at `/notifications`; the page is searchable, level-filterable,
and includes dismissed records on demand. The Windows Electron controller reads the same authenticated API.

## Behaviour

- Every event emitted by `DefenderStateStore` is recorded as an `info`, `success`, `warning`, or `error`
  notification (duplicate events suppressed by the defender are not recorded twice).
- Records are appended as JSON Lines beside the configured state file (`notification-history.jsonl`),
  on the same persisted Docker volume.
- `GET /api/notifications` returns active records newest-first, an unread count, and an active count.
  Use `includeDismissed=true` to review dismissed records or `level=warning` to narrow the centre.
- `POST /api/notifications/{id}/read`, `/dismiss`, and `/restore` append review actions to the journal;
  a restart reconstructs the same read and dismissed state.
- `/notifications` is a non-blocking review surface: mark-read, dismiss, and restore actions use toasts,
  while the anchored regex builder keeps plain-text search as the default.
- Journal or disk failures never block a real Home Assistant command or a background poll. The event
  remains visible in the live snapshot and the failure is logged for recovery.

## Local exports

The notification centre can export the current filtered view with **Export JSON** or **Export Markdown**.
The browser creates the download locally from the already-filtered records; no export request, message,
credential, Home Assistant token, or thermostat state is sent to a server. Both formats are UTF-8 and carry
the schema identifier `ac-defender.notification-history.v1`, the UTC export time, the active search query,
plain/regex mode and flags, level filter, dismissed-record choice, and exported count. JSON keeps the complete
record fields for machine processing. Markdown renders a reviewable table, escapes pipes and line breaks,
and writes an explicit no-match message for an empty filtered view.

If browser download or serialization fails, the page keeps the notification centre open and shows a persistent
error toast; the journal and real defender command pipeline are unchanged. Treat exported files as local
user data: notification messages may contain operational details, so store or share them only with the same
care as the app's state directory.

## Configuration and security

The journal path follows `Defender:StateFilePath`; no new secret, token, thermostat state, or Home
Assistant credential is written. Messages are capped at 4,000 characters and levels are normalized to
the four supported values. The API remains inside the authenticated `/api` route group.

## Verification

`HomeAssistantAcDefender.Tests` runs `NotificationHistoryStoreTests.JournalSurvivesRestartAndReviewActions`
and `NotificationExportServiceTests.JsonAndMarkdownExportsPreserveFiltersAndUtf8`. The export checks prove
UTF-8 Cantonese text, schema/filter metadata, Markdown escaping, and an explicit empty-result state; a static
contract check also proves both buttons and the local download bridge are wired into `/notifications`.
The journal test appends, reads, dismisses, restores, restarts, and replays a malformed final line; it proves
the valid prefix survives without inventing thermostat state. Browser verification uses the real signed-in
`/notifications` page and captures the two export controls in the built app.

## Suggested articles

- [Website Tour](Website-Tour.html) — inspect the live activity and thermostat-change tails on Logs.
- [Settings repository](Settings.html) — local Git-backed snapshots for editable settings.
- [API](API.html) — authenticated JSON endpoints and the status stream.
- [Windows Electron controller](Windows-Electron-controller.html) — the companion Windows review surface.
