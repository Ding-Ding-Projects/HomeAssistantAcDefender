# Hosting setup design and security handoff

Target: Home Assistant AC Defender, Electron companion wizard. Existing controller and GitHub Pages remain separate. Initial source: 117f42d. Packaging: one portable Windows x64 executable with embedded Electron runtime.

## Screens and states

1. `prerequisites`: product identity, artifact version/build date, Docker Engine and Compose checks, missing/running/error outcomes, retry. Native Docker installation and elevation belong to the user.
2. `configuration`: Home Assistant URL, explicit private-network HTTP consent, climate entity, protected access token, host port (8888 default), dedicated new storage directory. Back, validate and continue. Never target an existing deployment directory.
3. `review`: endpoint/entity/port/storage summary, image identity, deployment consequences and explicit Start. Token is never displayed again.
4. `deployment`: actual pull, Compose start, status and bounded HTTP health verification, cancel, truthful failed/cancelled/completed states. Cancellation leaves any already-started service intact and explains recovery.
5. `complete`: verified loopback URL and independently checked LAN candidates; open service action. No HVAC commands or simulated readings.

The shell uses a compact numbered step rail, large current-task title, single bounded content panel and persistent Back/Next footer. Brand colors: slate surfaces and teal primary controls. Genuine Material web outlined fields, filled/outlined buttons, checkboxes and progress primitives. No remote assets. English, Cantonese and bilingual copy; system light/dark with explicit control; visible focus, labelled inputs, polite live status, reduced motion. Normal viewport 1120x820, minimum client area 720x640, scrolling at increased display scale. Required matrix: all listed states, both themes, three languages, normal/minimum viewports, 100/125/150/200 percent. Unavailable native evidence stays pending.

## Security and state

Sandboxed renderer, context isolation, no Node integration, restrictive CSP, deny navigation/new windows. Narrow preload API: prerequisite check, folder picker, validate/save configuration, start, cancel, snapshot, open verified URL. Main process validates exact payload keys, URL protocol/no credentials, entity syntax, bounded port and absolute destination. Commands are fixed Docker argument arrays with shell disabled; no renderer command text. Output is bounded and discarded, with phase-only results so credentials cannot leak. Credentials stay in main-process memory then a permission-restricted deployment secrets file, never logs, snapshots, localStorage or IPC replies. Existing App_Data and .env are never read or changed. Only wizard-created directories/files are written. Non-secret resume state is local; restart requires credential re-entry before first deployment and rechecks existing owned deployment status without overwriting it.

Cancellation terminates the active owned child process and prevents subsequent phases. It never deletes data or stops a service implicitly. Reentry is rejected. Health is a bounded GET to `/healthz`; no climate endpoints are used. Build provenance comes from CI variables, with explicit unavailable state for local missing provenance.

## Evidence and limits

Independent handoff review is required before implementation. Unit tests use injected process/HTTP adapters to verify injection rejection, secret non-disclosure, cancellation and resume/state transitions. Production build and supported headless render checks are separate from native Windows launch, elevation and Docker acceptance. No mocked runtime result is native acceptance.

## Independent review

Reviewer: gpt-6-astra, separate design review agent. Verdict: proceed with conditions, accepted before UI implementation. Review/Start explicitly states that starting the controller can automatically send real HVAC commands; only the wizard's own API calls are read-only. Main owns validated configuration and rejects duplicate Start. Existing owned files are checked for symlinks and never overwritten on resume. Cancellation settles before retry and reports a potentially running service. Health proves HTTP/revision availability, not HVAC safety. Only verified deployment URLs may open. Initial provenance includes local seconds and timezone. Native Windows evidence remains pending. Port remains fixed at 8888.
