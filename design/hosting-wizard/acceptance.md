# Acceptance inventory

Design handoff: `handoff.md`. Implementation: `hosting-wizard/src`, `hosting-wizard/electron`. Documentation: `docs/wiki/hosting-wizard.md`.

| Boundary | Implementation | Evidence status |
| --- | --- | --- |
| Prerequisite, configuration, review, deployment, completion | Explicit screen states in app.js | Build passes; native interaction pending |
| Failure, cancellation, restart/resume | Engine phases and ownership checks | Focused process tests pass |
| Material controls | @material/web 2.4.1 buttons, fields, checkboxes, progress | Bundled genuine primitives; custom document layout remains a design-contract deviation |
| Language modes and theme | English/Cantonese/bilingual; localStorage preferences | Source implemented; full built matrix pending |
| Provenance | CI metadata bundled in resources/build.json | Initial visible version/time, unavailable fallback; native capture pending |
| Credential boundary | Narrow IPC, protected new directory, no secret replies | Injection/redaction/ACL failure tests pass; native Windows ACL verification pending |
| Docker operations | Fixed argument arrays, shell disabled, bounded output/time | Mocked orchestration plus real process cancellation/error tests; live deployment pending |
| LAN delivery | Local private IPv4 discovery with exact-revision health checks | Native host and second-device verification pending |
| Portable packaging | electron-builder portable x64 target | CI artifact/launch/readback pending |

Required capture matrix remains open: every screen and failure/cancel/complete state, normal 1120x820 and minimum 720x640, English/Cantonese/bilingual, light/dark, 100/125/150/200 percent scale. No mocked or injected state is accepted as real deployment proof.

Broader canonical interface contracts are not claimed complete by this bounded setup companion. Outstanding per-surface work includes personal wording upload/drop, narrator, School mode, humor/emoji controls, scheduled/external settings, command palette and regex builders, universal local history/export tools, custom logo, element locks/support recovery, authenticator and other universal tool suites, deterministic design-reference app/parity captures, and executable completeness-negative enforcement. Current controls provide the actual setup workflow; this inventory explicitly records remaining acceptance work rather than substituting a checklist for implementations or evidence.
