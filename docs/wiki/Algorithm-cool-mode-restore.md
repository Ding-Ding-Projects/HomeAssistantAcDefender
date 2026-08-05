---
layout: doc
title: "Cool Mode Restore"
description: "Puts the thermostat back into cool mode whenever someone switches it to heat/off/auto."
---

<p class="article-kicker">Core Cooling algorithm</p>

# Cool Mode Restore

<div class="algorithm-article-hero category-core">
  <div>
    <p class="lede">Puts the thermostat back into cool mode whenever someone switches it to heat/off/auto.</p>
    <p>These algorithms keep the main promise: when the room is hot because the wall setpoint drifted upward, AC Defender reads the real climate entity and walks cooling back toward the target without theatrical jumps.</p>
    <p><a class="mini-link" href="Algorithms.html">Back to all algorithms</a> <a class="mini-link" href="Defender-Logic.html#cool-mode-restore">See it on the logic page</a></p>
  </div>
  <div class="motion-stage category-core" aria-hidden="true">
  <div class="motion-track motion-track-a"></div>
  <div class="motion-track motion-track-b"></div>
  <div class="motion-node motion-node-input"><span>1</span><strong>Watch</strong></div>
  <div class="motion-node motion-node-decision"><span>2</span><strong>Decide</strong></div>
  <div class="motion-node motion-node-output"><span>3</span><strong>Act</strong></div>
  <div class="thermostat-mini"><i></i></div>
</div>
</div>

<img class="article-visual" src="images/algorithms/article-cool-mode-restore.svg" alt="Unique generated explanatory visual for Cool Mode Restore">

## The short version

Puts the thermostat back into cool mode whenever someone switches it to heat/off/auto.

## What it watches

The Home Assistant HVAC mode, plus how far the room is above target.

## How it decides

If the mode is not &#x27;cool&#x27; it normally waits a short random delay (between the min and max seconds) so the change is not jarring — but only while the room stays within the comfort band. If the room is warmer than target + band, upstairs is severely hot, or the safety override is crossed, it restores cool immediately.

## What it changes

Sends climate.set_hvac_mode = cool once the delay (if any) elapses.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

<ul class="settings-list"><li><code>CoolModeRestoreDelayEnabled</code></li><li><code>CoolModeRestoreMinimumDelaySeconds</code></li><li><code>CoolModeRestoreMaximumDelaySeconds</code></li><li><code>CoolModeRestoreComfortBandCelsius</code></li></ul>

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Cool Mode Restore** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- [Feature briefs](Feature-briefs.html) — find every documented surface and guard.
- [Defender Logic](Defender-Logic.html) — follow the complete decision cycle and its bypass rules.
- [Settings](Settings.html) — inspect persisted configuration, language modes, and safety limits.
