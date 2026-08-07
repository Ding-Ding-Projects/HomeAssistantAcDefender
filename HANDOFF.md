# Handoff

## Scope

The current handoff covers the server UI, the Windows controller, the in-app
changelog, release tooling, and deployment evidence. Defender control logic
still remains server-side; the Windows controller contains no simulated HVAC
state.

## Yell-O-Meter survival and wiki expansion

- The Energy page now uses ten qualitative bill story bands from `$0` through `$350+`, with
  more than forty possible household scenarios. It contains no unmeasured decibel values,
  invented probabilities, or promises about another person's behaviour.
- The live screen carries thirty-eight practical survival steps, eight pain and safety facts,
  a fourteen-stage “what I may notice next” timeline, and twelve overthinking-mechanism facts.
  The lived household facts are explicit:
  when the writer's brother yells at them, they can experience fight-or-flight, freeze, and cry.
  Afterward, their brain can enter an extreme overthinking mode. Every rendering labels these as
  personal experience rather than a diagnosis or sensor reading.
- `docs/wiki/Yelling-Survival-Guide.md` contains fifty-two survival moves, including dedicated
  freeze-and-cry and overthinking-response sequences. `docs/wiki/Yelling-Predictions.md` records all ten story bands
  and the possible response timeline. `docs/wiki/Heat-Pain-and-Survival-Facts.md` separates sourced
  hearing and heat guidance from the lived accounts and includes twelve freeze-and-cry plus ten
  overthinking survival tips.
- The in-app wiki indexes every top-level Markdown article, resolves the documentation's Liquid
  feature loop for offline rendering, and wraps tables in keyboard-focusable internal scroll regions.
- `App_Data` is excluded from publish output as well as Docker context. A clean Release publish
  was inspected and contained no runtime account, state, or data-protection material.
- Release builds completed with 0 warnings and 0 errors, and the complete console regression
  runner passed. Authenticated hidden-desktop proof found 0 pixels of root overflow on Energy and
  all three new wiki pages at 390 CSS pixels. At the 200% display-equivalent gate, Energy and the
  facts wiki also had 0 pixels of root overflow; the 580-pixel bottom navigation scrolled inside its
  195-pixel viewport with 0 item overlaps, and the 520-pixel wiki table remained inside a
  keyboard-focusable 126-pixel scroll region.
- The production Docker deployment and public Pages verification belong to issue #2 and the rolling
  task Discussion #3; do not infer their result from this source handoff until those external checks
  have recorded a terminal verdict.

## Cooling failure safety correction

- Cooling Failure Watch still raises its real-input MEGA alert for a possible breaker,
  compressor, or airflow problem, but MEGA is advisory and cannot turn off the real
  thermostat by itself.
- Automatic OFF now requires the independent OMEGA room-rise confirmation. A legacy
  MEGA-only shutdown hold is released on the next worker check instead of waiting for
  the room to warm.
- A person who turns the AC back on after an automatic OFF wins for the rest of that
  failure episode, so stale idle/no-drop evidence cannot repeatedly stop the unit.
- Focused regression coverage is in `HomeAssistantAcDefender.Tests/Program.cs` beside
  the existing cooling-failure tests; the documented build and console runner remain
  the verification gates.

## CI and documentation slice

- `.github/workflows/release.yml` restores, builds, and runs the regression suite;
  creates a Docker image archive and checksum; counts lines with the committed
  script; resolves a public dim-sum code name without copying photos; and creates
  an immutable release only after verification passes. Its trigger covers every
  branch push and manual dispatch while ignoring generated `v0.1.*` tag pushes,
  preventing a release from recursively starting another release.
- The GitHub Pages landing page carries a pinned, version-labelled download link
  for the verified `v0.1.876` Windows Setup.exe asset; newer installer versions
  must replace it only after their own release verification passes.
- `scripts/count_lines.py` is the reproducible line-count implementation used by
  CI and release notes.
- `docs/wiki/release/` documents release artifacts, count boundaries, provenance,
  failure modes, and verification. `README.md`, `ROADMAP.md`, and this file link
  the workflow and its evidence.

## Windows Electron controller

- `desktop-electron/` is a separate Windows-only Electron + React/TypeScript controller. It does
  not contain defender logic or simulated HVAC state.
- `npm run build` and `npm test` pass from `desktop-electron/` in the current checkout.
- `npm run dist` now completes on this Windows checkout and produces a non-empty Setup.exe,
  `.nupkg`, and `RELEASES` feed under `desktop-electron/dist/squirrel-windows`.
  Keep this verification boundary explicit until a Windows packaging host opens the real
  installer and a signed background update feed plus restart banner are verified.
- The update contract rejects non-HTTPS, credential-bearing, query-bearing, fragment-bearing,
  and GitHub Pages feed URLs; it bounds and validates the direct RELEASES manifest before
  Electron asks Squirrel.Windows to check for updates. Local packaging is unsigned until a
  private signing certificate is supplied.
- The controller uses a frameless Material title bar with real minimize, maximize,
  and close IPC controls. Headless packaged-app capture verified the branded frame.
- Dashboard, Notifications, and Settings are persisted browser-style tabs with
  accessible `tablist`/`tab`/`tabpanel` semantics, overflow-safe scrolling, drag and
  keyboard reordering, and a bounded per-tab appearance editor. A 390px browser
  capture verified four opened routes, no document overflow, and Home-key navigation.
- Settings, schedule rules, settings-repository history, documentation search, and
  changelog search each expose a full anchored regex builder with plain text as the
  default and a bounded .NET/browser engine as documented.
- The command palette, Defense roster, and Field Manual now also expose anchored regex
  builders with the same 512-character / 100 ms local matcher bounds. Their regex mode is
  opt-in and plain text remains the default.
- The server tab strip persists pinned order and bounded local group labels while preserving
  the older localStorage format. It now provides four independent tab searches and containing
  or inverse bulk-close previews with pinned, active, and command-tab protection.
- The signed-in shell now owns right-click context menus for tabs, groups, controls, cards,
  navigation targets, and page surfaces. `Shift+F10` opens the focused target menu, `Shift+Alt+A`
  opens appearance editing, and a cancelled-motion 620 ms touch/pen long press edits mobile tabs.
  Each menu has its own bounded regex builder, opaque scrollable surface, and repeated tab-close
  protection at execution time.
- Dashboard and Controls route real thermostat OFF actions through the native two-key/full-slider
  super-confirmation with Emergency exit, Escape, focus return, reduced-motion handling, and no
  fake Home Assistant state.
- Notification history now composes regex search with typed UTC date windows, Today/7d/30d
  presets, journal-derived action counts, validated API bounds, and filter-complete exports.
- Appearance settings now persist a bounded HEX/RGB/HSL/alpha translator, WCAG contrast
  readouts, and scoped shell/header/rail/main accent targets. Word-depth typography,
  advanced color spaces, and per-control editors remain explicitly documented follow-up work.

## Changelog viewer

- `/changelog` is an offline, traceable catalog of 220 published non-draft releases at
  the 2026-08-04 refresh boundary. Each entry carries its release tag/date, dim-sum
  code name, completing commit SHA, category, and duplicate-metadata warning where
  the published history reuses a dish or SHA. The regression runner validates every
  SHA with `git cat-file`.
- Headless browser proof at desktop and 390px widths found 220 entries, regex
  `^v0\.1\.(20[0-9]|21[0-9]|22[0-4])$` produced 24 matches, and no horizontal overflow.

## Local verification

From this checkout:

```text
python scripts/count_lines.py
```

The script completed successfully at the `cf07b8b` integration boundary and reported 398
counted text files, 74,777 total lines, and 66,810 non-blank lines. The report
also listed 38 tracked binary/non-text files and the excluded build/runtime/vendor
 directories. The Electron controller's 86,642-byte icon is binary and is not
inflated into the source-line total.

## Integration and deployment notes

After this slice is integrated into the default branch, run the full `dotnet
build` and browser checks required by `AGENTS.md`, then let the release workflow
create its first verified release. Only after that remote evidence is available
should the Docker Compose stack be rebuilt on the deployment host.
Keep `.env`, `App_Data`, access tokens, and host state outside Git.

## Dim-sum startup surprise

- `Services/DimSumSurpriseService.cs` carries a five-row metadata cache pinned to the public
  `dim-sum-photos` catalog revision `f77ea1169db0bfc17365414c44ff495a823c6823`. Its five
  immutable `catalog-v1` release URLs are public PNGs; no image bytes are tracked here.
- `Components/Layout/MainLayout.razor` performs one fresh 10%-bucket draw after boot, only on
  the signed-in command route when no cooling-failure alert is active. The anchored status card
  is keyboard-dismissable, auto-dismisses after 12 seconds, respects reduced motion through the
  shared stylesheet, and removes itself with a non-blocking notice if the public image fails.
- `HomeAssistantAcDefender.Tests/DimSumSurpriseTests.cs` covers metadata provenance, published
  URL shape, exact draw boundaries, deterministic selection, and invalid bucket handling. Full
  `dotnet build` and the console regression runner remain the required integration checks.

## Open issues

At audit start, `gh issue list --state open` returned no open issues for either
this repository or `Ding-Ding-Projects/agent-global-memory`.
