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
| `setupwizard` | Requested application-specific Electron deployment wizard | Expected deployment modules inside `desktop-electron/`; pending integration, not verified |
| `docscompanion` | Requested packaged offline documentation companion | Expected `desktop-docs/`; pending integration, not verified; additional to Pages |
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

The snapshot was inspected from base revision `117f42d`. Other work may subsequently add
expected files: those remain pending until integration and verification update the row.
Evidence fields name existing source and honest limitations. Every row separately records
documentation, localization, persistence, tests, artifact interaction and captures. Historical
screenshots in `docs/wiki/images/` demonstrate historical UI, not the current revision.
Before upgrading any row to `implemented`, replace its pending fields with exact repository
paths, source revision and artifact hash, test result, interaction receipt and inspected
capture proof. Stateful features also need restart/reset proof; stateless ones need an
explicit non-persistence reason. Localization acceptance covers English, Cantonese and
bilingual mode, both independent funny-level extremes, keyboard access, screen readers,
reduced motion and narrow/high-scale layouts wherever relevant. The current guard checks
missing boundaries; it cannot inspect pixels or independently establish truthful behavior.

## Immediate delivery order

1. Publish the real multi-platform Docker image to a pullable registry, record immutable
   revision/digest metadata and verify anonymous pulls where publication is public. Existing
   CI Docker archives are useful release assets but do not prove registry publication.
2. Keep tracked `docker-compose.yml`, persistent state and port `8888`. Add expected
   `host.bat` detached startup and real interactive management. Never automatically stop,
   reset or overwrite an existing deployment or report healthy before `/healthz` succeeds.
3. Extend the existing Electron application with a practical deployment/setup wizard:
   inspect prerequisites and existing destination, review actual configuration, preserve
   private settings, show real progress, support Back/Next/resume/cancellation, and verify
   deployment through read-only health checks. Release the requested single portable `.exe`
   through CI. Existing Squirrel controller assets remain separately identified; a portable
   wizard is not evidence of Squirrel installation or update lifecycle acceptance.
4. Add a packaged offline documentation companion and retain the public GitHub Pages site.
   Bundle complete landing, feature and wiki content with working navigation. Verify both
   the actual packaged artifact and hosted output rather than substituting a file browser.
5. Deliver resumable in-app onboarding separately from installation, complete front-screen
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
