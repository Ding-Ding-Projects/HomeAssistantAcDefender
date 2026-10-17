---
layout: doc
title: "Feature compliance and delivery boundaries"
---

# Feature compliance and delivery boundaries

The complete requested product goal remains **incomplete**. This source inventory records
109 explicit feature identities across six surfaces. It is a work queue, not a release
certificate. Missing work stays visible while independent implementation continues.

[Download the inventory](../feature-compliance.csv). Run its structural and negative checks:

```sh
node scripts/test-feature-inventory.mjs
node scripts/test-feature-inventory.mjs --require-complete
```

The first command validates inventory coverage and demonstrates failures when an exact
row, required cell, surface status or evidence cell disappears. The second additionally
rejects incomplete surface states and is expected to fail today. Neither command launches
the application, controls a thermostat, proves remote publication, or replaces actual
built-artifact acceptance. The guard has its own literal expected feature/family list and
surface list; it never discovers the required set from the CSV. A successful structural
check must never be reported as complete implementation.

## Surfaces and ownership

| Inventory column | Actual or intended surface | Source boundary |
| --- | --- | --- |
| `webapp` | Docker-hosted ASP.NET/Blazor climate application | `Components/`, `Services/`, `Program.cs` |
| `publicdocs` | Existing public landing and documentation site | `docs/`, `.github/workflows/pages.yml`; preserve GitHub Pages |
| `controller` | Existing Windows Electron remote controller | `desktop-electron/`; currently three controller destinations |
| `setupwizard` | Requested application-specific Electron deployment wizard | `hosting-wizard/`; integrated source, local package/configuration proof, real-host acceptance incomplete |
| `docscompanion` | Requested packaged offline documentation companion | `docs-companion/`; integrated source and Linux Electron proof; additional to Pages |
| `tauri` | Retained legacy Tauri controller source | `desktop/`; retained and unverified until an explicit supported/retired decision |

An existing controller does not prove deployment wizard or offline companion delivery.
Each retained user-facing surface needs its own implementation, localization, persistence,
focused tests, built interaction and captures. Shared source may be reused, but another
surface's working route cannot satisfy an absent local control. A hidden generic route,
static catalogue, prototype, source-only assertion or synthetic success never counts.

Repository-wide rows describe delivery obligations across the artifact set rather than
requiring six copies of a root build script. Genuine nonapplicability is explicit:
reference-system-only deliverables, Roblox-game contracts and private-source encrypted
build delivery do not describe this public climate product. Discord bridge, panic dispatch
and Tidbyt transport belong to the shared status service; this product still owes its own
truthful status integration. Product forge publishing is currently absent as a capability;
CI release publication alone does not make it a product workflow. Website JSON drop is
excluded from the drop contract while the website's local upload remains required.

Public-safe stable identifiers describe all catalogue entries without publishing private
terminology or private source locations. They preserve identity and family boundaries.

## Status meanings and evidence

- `implemented`: complete contract with current implementation and all required proof.
  No row receives this state from source inspection alone.
- `source-only`: concrete reusable implementation exists, but the complete contract or
  current built-artifact proof is absent.
- `unverified`: ownership, external state, retained legacy behavior or artifact execution
  has not been established in this bounded pass.
- `missing`: implementation or required evidence was not located in the audited base.
- `not-applicable`: the row or surface has an explicit capability/scope reason above or
  in its applicability cell; this never excuses an applicable independent feature.

The original snapshot used base revision `117f42d`; this refresh inspected integrated
revision `b79589a`. Existing receipts remain bound to their own recorded revisions and
hashes, not automatically to that latest commit. The CSV names their exact paths and
scoped outcomes. Local web upload/reload/clear, setup missing-token refusal and JSON
conversion proof exists in `design/delivery-evidence/receipt.json`, with eight real
1440/390-pixel captures. This does not prove live device connectivity or a LAN deployment.
Wizard configuration interaction and local Windows package hash receipts exist under
`design/hosting-wizard/evidence/`; real deployment and native Windows execution remain
separate acceptance. Companion evidence under `design/docs-companion/evidence/` includes
built-output browser interaction, actual Linux Electron offline/sandbox/navigation proof,
and the Windows portable package hash. Its package receipt explicitly records native
Windows launch as unverified. Historical and newer captures therefore coexist; neither
is silently promoted to complete current-source acceptance.

Before upgrading any row to `implemented`, replace its pending fields with exact repository
paths, source revision and artifact hash, test result, interaction receipt and inspected
capture proof. Stateful features also need restart/reset proof; stateless ones need an
explicit non-persistence reason. Localization acceptance covers English, Cantonese and
bilingual mode, both independent funny-level extremes, keyboard access, screen readers,
reduced motion and narrow/high-scale layouts wherever relevant. The current guard checks
missing boundaries; it cannot inspect pixels or independently establish truthful behavior.

## Immediate delivery order

1. Verify the integrated registry publication workflow against a real run. Publish the multi-platform image and record immutable
   revision/digest metadata and verify anonymous pulls where publication is public. Existing
   CI Docker archives are useful release assets but do not prove registry publication.
2. Keep tracked `docker-compose.yml`, persistent state and port `8888`. Verify integrated
   `host.bat` and `scripts/hosting/host.ps1` detached startup and interactive management. Never automatically stop,
   reset or overwrite an existing deployment or report healthy before `/healthz` succeeds.
3. Verify the integrated separate Electron `hosting-wizard/` deployment/setup wizard:
   inspect prerequisites and existing destination, review actual configuration, preserve
   private settings, show real progress, support Back/Next/resume/cancellation, and verify
   deployment through read-only health checks. Release the requested single portable `.exe`
   through CI. Existing Squirrel controller assets remain separately identified; a portable
   wizard is not evidence of Squirrel installation or update lifecycle acceptance.
4. Verify the integrated `docs-companion/` package and retain the public GitHub Pages site.
   Bundle complete landing, feature and wiki content with working navigation. Verify both
   the actual packaged artifact and hosted output rather than substituting a file browser.
5. Verify integrated resumable in-app onboarding separately from installation and front-screen
   artifact provenance, then work through the explicit personalization, navigation, safety,
   records, tools, documentation and evidence gaps in the CSV.

## Existing reusable capabilities

The repository already has real Home Assistant integration and a continuously running
worker, owner-account registration, settings history, notification history/export,
changelog filtering, three-mode language services, appearance preferences, tabs/search,
regex builder, command palette, context-menu policy, destructive confirmation, wiki
rendering, Windows dependency/bootstrap scripts and substantial release packaging.
These are foundations rather than complete universal feature claims. `TwoFactorAuth`
login support is not a complete authenticator manager; climate scheduling is not scheduled
presentation settings; MudBlazor providers do not establish every rendered control's
Material component provenance.

This inventory does not audit thermostat algorithms or operate HVAC. Acceptance must use
real read-only connection/entity checks, truthful missing/error states and reviewed
non-actuating routes. Never add dummy thermostat state, fake deployment progress, runtime
credentials, production data or private vocabulary to source or evidence. External host,
registry, release, Pages and installed-Windows evidence remains unverified until actually
observed through an authorized route.

## Refresh verification and remaining acceptance

The CSV keeps `source-only` for partially verified subsets because its status vocabulary
reserves `implemented` for the entire contract. Exact receipts identify the verified subset
without waiving broader requirements. The web wording loader now has a versioned bounded
schema and scoped persistence/clear evidence; the companion wording control remains a
limited session-local subset in the inspected source. New native-proof scripts in CI are
source capabilities until a genuine successful run and its receipts are observed. No CI
execution, registry availability, published release download or native Windows launch is
claimed from workflow text.

The structural guard must still pass and `--require-complete` must still fail. Remaining
universal requirements include full per-surface localization and funny-level behavior,
School mode, narration, presentation schedules, complete tooling, locks/recovery, complete
Material controls, per-control guidance, and the complete state/language/theme/scale proof
matrix. Implementations may continue independently while these gaps remain explicit.
