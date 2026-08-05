---
layout: doc
title: "Setpoint Echo"
description: "Waits for Home Assistant to report back the last setpoint before sending another safe command."
---

<p class="article-kicker">Sensor Timing algorithm</p>

# Setpoint Echo

<div class="algorithm-article-hero category-sensor">
  <div>
    <p class="lede">Waits for Home Assistant to report back the last setpoint before sending another safe command.</p>
    <p>These algorithms make corrections land near real house signals instead of on a robotic beat, while still stepping aside when room comfort needs direct cooling.</p>
    <p><a class="mini-link" href="Algorithms.html">Back to all algorithms</a> <a class="mini-link" href="Defender-Logic.html#setpoint-echo">See it on the logic page</a></p>
  </div>
  <div class="motion-stage category-sensor" aria-hidden="true">
  <div class="motion-track motion-track-a"></div>
  <div class="motion-track motion-track-b"></div>
  <div class="motion-node motion-node-input"><span>1</span><strong>Watch</strong></div>
  <div class="motion-node motion-node-decision"><span>2</span><strong>Decide</strong></div>
  <div class="motion-node motion-node-output"><span>3</span><strong>Act</strong></div>
  <div class="thermostat-mini"><i></i></div>
</div>
</div>

<img class="article-visual" src="images/algorithms/article-setpoint-echo.svg" alt="Unique generated explanatory visual for Setpoint Echo">

## The short version

Waits for Home Assistant to report back the last setpoint before sending another safe command.

## What it watches

The pending command setpoint and whether Home Assistant has echoed it yet.

## How it decides

After a command it waits up to the echo grace seconds for Home Assistant to report that setpoint within 0.15 °C. Once echoed, or after the grace expires, the next command is allowed. A too-warm room steps it aside.

## What it changes

Briefly holds the next safe command to avoid piling commands on a slow integration.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

<ul class="settings-list"><li><code>SetpointEchoGuardEnabled</code></li><li><code>SetpointEchoGraceSeconds</code></li><li><code>SetpointEchoSafetyBandCelsius</code></li></ul>

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Setpoint Echo** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- [Feature briefs](Feature-briefs.html) — find every documented surface and guard.
- [Defender Logic](Defender-Logic.html) — follow the complete decision cycle and its bypass rules.
- [Settings](Settings.html) — inspect persisted configuration, language modes, and safety limits.
