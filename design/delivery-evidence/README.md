# Container and browser acceptance

The receipt binds eight real Chromium captures to the isolated Linux Docker image and
the source revision reported by `/healthz`. The application was built with .NET SDK
10.0.301; the build completed with zero warnings and errors. The full console regression
suite, presentation schema checks, local conversion worker checks, 21 setup-engine tests,
five hosting contract checks and feature-inventory structural checks passed.

Authenticated dashboard, setup, settings and local-tools routes were exercised at
1440 and 390 pixels without horizontal overflow or an application error banner. Actual
wording import, persistence after reload, clearing, missing-token setup refusal and local
JSON conversion passed. The final container log contained no unhandled teardown errors.
The setup check did not issue climate commands. The isolated configuration contained no
Home Assistant token; this is not evidence of working device connectivity.

GitHub Pages remains the published documentation site. Its workflow is retained and
tracks the default `main` branch. New documentation articles have Jekyll front matter;
the separate companion build checks that every wiki article has rendered output.
Portable companions supplement the site and the existing Windows controller.

The complete feature inventory explicitly remains unfinished. Native portable execution,
published release readback, anonymous registry access and intended LAN deployment need
their own runtime evidence. The review container exposes loopback port 8888 only. It is
not the user's LAN deployment and does not establish a usable LAN URL.
