---
title: "Command palette"
---

# Command palette

AC Defender exposes a keyboard-first command palette from every signed-in page.
Press **Ctrl+Shift+F** (or the platform-equivalent modifier) or activate **COMMANDS** in the
header. The palette searches local command labels and descriptions, supports
Up/Down selection and Enter activation, and closes with Escape. It navigates to
the same real pages as the rail, so no command creates simulated thermostat
state or bypasses the existing authorization and safety gates.

## Configuration and accessibility

The palette is an in-app, non-networked overlay. It traps focus while open,
returns focus to the launching control when dismissed, provides an accessible
dialog name, and remains scrollable on narrow screens. Search is deliberately
plain-text-first; no query leaves the browser or is persisted.

## Failure modes and verification

If a destination is unavailable, the normal route and authorization handling
remain in force. The feature was verified with `dotnet build
HomeAssistantAcDefender.csproj --disable-build-servers` (0 warnings, 0 errors).

## Security

The palette only issues client-side navigation to existing routes. It does not
expose tokens, Home Assistant state, or command payloads and does not add a new
thermostat control path.

## Suggested articles

- [Settings repository](Settings.md) — local Git-backed settings history.
- [API](API.md) — authenticated real-device endpoints.
- [Website tour](Website-Tour.md) — the full navigation map.
