---
layout: doc
title: "Tug-of-War Truce"
description: "Calls a temporary truce when the real thermostat bounces up and down, so answer-back commands do not look like a duel."
---

<p class="article-kicker">Wall-Touch Response algorithm</p>

# Tug-of-War Truce

<div class="algorithm-article-hero category-wall">
  <div>
    <p class="lede">Calls a temporary truce when the real thermostat bounces up and down, so answer-back commands do not look like a duel.</p>
    <p>These algorithms exist for the exact household fight AC Defender is built for: someone keeps raising the thermostat, but the room still needs to come back to your temperature without starting a visible duel.</p>
    <p><a class="mini-link" href="Algorithms.html">Back to all algorithms</a> <a class="mini-link" href="Defender-Logic.html#tug-of-war-truce">See it on the logic page</a></p>
  </div>
  <div class="motion-stage category-wall" aria-hidden="true">
  <div class="motion-track motion-track-a"></div>
  <div class="motion-track motion-track-b"></div>
  <div class="motion-node motion-node-input"><span>1</span><strong>Watch</strong></div>
  <div class="motion-node motion-node-decision"><span>2</span><strong>Decide</strong></div>
  <div class="motion-node motion-node-output"><span>3</span><strong>Act</strong></div>
  <div class="thermostat-mini"><i></i></div>
</div>
</div>

<img class="article-visual" src="images/algorithms/article-tug-of-war-truce.svg" alt="Unique generated explanatory visual for Tug-of-War Truce">

## The short version

Calls a temporary truce when the real thermostat bounces up and down, so answer-back commands do not look like a duel.

## What it watches

The real external thermostat audit log: previous setpoint, new setpoint, timestamp, and source classification.

## How it decides

Inside the configured flip window it converts each external setpoint change into up/down/flat, counts direction flips, and compares that count to the flip trigger. If the flip trigger is met and the room is still inside the safety band, it holds only safe answer-back corrections for the truce minutes. A warm room, severe upstairs heat, matching setpoint, cooler-intent fast lane, or Super Defender strict bypass clears it.

## What it changes

Holds safe corrections until the truce window ends, then lets the normal defender chain continue.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

<ul class="settings-list"><li><code>TugOfWarTruceEnabled</code></li><li><code>TugOfWarTruceMinimumFlips</code></li><li><code>TugOfWarTruceWindowMinutes</code></li><li><code>TugOfWarTruceHoldMinutes</code></li><li><code>TugOfWarTruceSafetyBandCelsius</code></li></ul>

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Tug-of-War Truce** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- [Feature briefs](Feature-briefs.html) — find every documented surface and guard.
- [Defender Logic](Defender-Logic.html) — follow the complete decision cycle and its bypass rules.
- [Settings](Settings.html) — inspect persisted configuration, language modes, and safety limits.
