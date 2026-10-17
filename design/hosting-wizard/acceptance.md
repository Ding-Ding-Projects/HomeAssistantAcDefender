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

Broader canonical interface contracts are not claimed complete by this bounded setup companion. Outstanding per-surface work includes narrator, School mode, humor/emoji controls, scheduled/external settings, command palette and regex builders, universal local history/export tools, custom logo, element locks/support recovery, authenticator and other universal tool suites, deterministic design-reference app/parity captures, and executable completeness-negative enforcement. Current controls provide the actual setup workflow; this inventory explicitly records remaining acceptance work rather than substituting a checklist for implementations or evidence.

## Review corrections

Independent source review required stricter local engine checks and recovery after partial preparation. The engine now validates exact local Unix socket or local named-pipe forms and pins that checked endpoint on every deployment command. Partial preparation records an explicit new-destination requirement before creating files; a localized recovery action preserves the previous directory and requires credentials again. Private HTTP uses parsed IPv4 ranges, not DNS prefixes. The review includes the full immutable image tag and source revision. Generated host-filter configuration uses comma-separated exact loopback and private-interface addresses, matching the application's real parser.

Native Windows cancellation of Docker Compose plugin descendants remains unverified. The automated cancellation test proves owned launcher settlement and no subsequent wizard phase, not full native process-tree termination. Already-started containers may remain running. This is a pending acceptance boundary.

Independent bounded source re-review by gpt-6-astra: proceed. The reviewer confirmed endpoint pinning, exact local-pipe validation, conflicting environment removal, partial-preparation persistence/recovery, parsed private-IP checks, image/revision review, ACL-before-secret ordering and explicit real-HVAC consent. Native Windows ACL effectiveness, executable paths and Compose-descendant cancellation remain separate unverified acceptance work.

## Local personal wording

The setup window now has its own always-visible, keyboard-accessible JSON upload and clear controls, localized status, and window drop support. Its local-only cache is revalidated on load. Validation matches the application schema: 256 KiB, depth 8, 160-codepoint keys, 1000-codepoint string values, exact schemaVersion/entries shape, and duplicate/unsafe/extra-key rejection. Only explicitly selected shell titles, navigation and action text are replaced. Inputs, configuration, tokens, provenance and release URLs remain factual. Importer controls retain original labels for recovery. Invalid imports preserve the last valid cache; clear cancels pending import work. Native portable initial-window proof is wired separately and remains pending until Windows CI runs it.
