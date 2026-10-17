# Offline documentation companion

This is a documentation reader, separate from the live HVAC controller. The public GitHub Pages site remains available. The distributable contains the rendered site, every wiki article and current static assets. It does not contact Home Assistant.

## Screens and states

| ID | State | Action and outcome |
| --- | --- | --- |
| library | Initial library | Shows artifact version, source revision and recorded build time in local timezone; open any bundled article |
| article | Reading | Render packaged HTML, follow local links, return to library |
| search | Results / no matches / invalid expression | Search article title and body locally; plain text default, explicit regex controls |
| guide | Reading plan / complete | Back, Next and mark-read operate a saved reading checklist, without claiming device setup |
| settings | Preferences | Persist language, theme and dialog decoration; accept user-selected vocabulary JSON |
| error | Content unavailable | Explain missing content and return to library; never fetch a remote replacement |

Normal client area 1100×760, minimum 680×520; responsive web verification additionally uses 360×740. Shell language modes: English, Cantonese, bilingual. Existing article prose retains its authored language. Themes: light/dark/system. Scale targets: 100%, 125%, 150%, 200%. Native semantic controls, visible focus, labelled article frame, skip link and reduced-motion support. The source website retains its own article styling.

## Architecture and provenance

Typed Electron main process registers a secure packaged-content protocol. No preload, renderer Node access, IPC, credentials, shell execution or arbitrary filesystem reads. New windows, remote navigation, external resource requests and permissions are blocked. Articles run in an iframe sandbox with scripts disabled; reader search and guided reading are owned by the shell. Build consumes the actual Jekyll site and checks every wiki article exists. It rewrites repository-relative and website-root links for the local bundle, and copies the complete site tree.

## Reference and evidence contract

This prose handoff is the design record; no visual mock is claimed as a production capture. Evidence must identify source revision, output hash, viewport, theme, language and scale. Windows executable launch requires native Windows evidence; Linux browser evidence does not satisfy that claim.

## Known scope gaps

The inherited universal UI contract is broader than this documentation delivery. The shell uses registered @material/web buttons, fields, switches and selects. The browser file picker and authored article document retain platform/semantic elements; a complete Material 3 surface audit remains open. Full reference parity, all language/scale captures, universal conversion/server/model tooling, narrator, schedule engine, locks, external-editor and other unrelated universal controls are not implemented by this bounded companion lane. These remain open compliance findings, not waived requirements or claims of completion.

## Independent review and implementation

Independent reviewer: gpt-6-astra. Architecture approved with required packaged-path confinement, blocked external requests, scriptless article sandbox, bounded regex worker, honest source-language labels and initial artifact provenance. Implemented those guards. Review approval is not native Windows acceptance.

Validation includes full local link/assets checks, rendered-article completeness, isolated built-output Chromium interaction captures, and actual Linux Electron protocol/sandbox/offline navigation. Evidence is generated under docs-companion/evidence and retained outside tracked source for review; native Windows remains unverified.
