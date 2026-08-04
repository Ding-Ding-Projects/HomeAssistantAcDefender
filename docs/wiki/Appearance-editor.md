---
layout: doc
title: "Appearance editor"
---

# Appearance editor

The **Settings → Appearance** card customizes the website shell without changing any
defender setting or sending a Home Assistant service call. It is available on the
server-rendered Blazor Settings surface and applies the result live through the loaded
`acAppearance` JavaScript bridge.

## Behavior and configuration

- **Theme** selects light or dark shell chrome and keeps the existing header toggle in sync.
- **Density** selects compact, comfortable, or spacious shell spacing.
- **Accent / seed color** accepts a six-digit HEX value and has an accessible native color
  picker. The value is allow-listed before it reaches CSS custom properties.
- **UI font family** selects from installed/common families (`Segoe UI`, `Arial`,
  `Cascadia Code`, `Consolas`, and `system-ui`). Each stack keeps a CJK-capable fallback.
- **UI font size** scales from `0.85×` to `1.35×` in bounded `0.05×` steps.

Apply writes schema version `1` to browser `localStorage` under
`ac-defender-appearance`, then updates the shell's CSS variables and theme/density data
attributes. Reset removes that record and applies the documented defaults. The preference
is presentation-only and is deliberately not part of `DefenderSettings`, the worker's
state store, or any Home Assistant request.

## Failure modes

If private browsing or a browser policy rejects `localStorage`, the shell still applies a
change for the current render and the Settings page shows a warning. A malformed or stale
record is normalized to safe defaults; unknown fonts, themes, densities, colors, and
out-of-range scales are never interpolated into CSS. A failed preference write cannot block
the real settings save or a thermostat command.

## Security considerations

Appearance values are untrusted browser input. The C# model and the JavaScript bridge both
enforce the same allow-list and bounds before applying them. Only validated HEX colors are
used, family names map to fixed CSS stacks, and no preference is transmitted to Home
Assistant or included in logs. The bridge does not fetch fonts, images, analytics, or any
third-party asset.

## Verification

Run the focused contract check from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-appearance-editor.ps1
```

Then run `dotnet build`. In a browser, open **Settings → Appearance**, apply light/dark,
each density, a valid accent, each font family, and the font-size range; reload to verify
persistence, and use Reset to verify defaults. Confirm that Dashboard/Defense/Controls
still show live Home Assistant state and that no appearance action emits a defender command.

Suggested articles: [Settings](Settings.html), [Accessibility](Accessibility.html),
[Architecture](Architecture.html), and [Deployment](Deployment.html).
