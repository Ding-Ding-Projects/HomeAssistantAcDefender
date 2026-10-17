# Built-artifact evidence

Source: `89452864d1cf147dba18e4c10146fcbe8ae825b3`.

The real Linux Electron application ran on a task-owned isolated Xorg display with a separate profile and one verified application CDP target. The initial prerequisite and unconfigured configuration screens were captured at 1120x820 and 720x640, each in English, Cantonese and bilingual modes, and light/dark themes at scale 1. Language and theme changes used the rendered controls. All 24 tuples passed horizontal-overflow and recorded runtime-exception checks. English normal and bilingual dark minimum captures were inspected visually. Vertical scrolling is intentional and keeps the full form reachable.

The actual **Check Docker & Compose** control successfully checked the local Linux engine and enabled **Next**. Next opened the real configuration form. No destination was selected, no Home Assistant credentials were entered, and no container deployment or HVAC command was started during this GUI verification.

The two `*-linux-receipt.json` files bind source, built renderer hash, metadata, screenshot hashes and computed geometry. Their route is the Linux isolated-display exception, not a Windows hidden-desktop receipt. Screenshot hashes and source stability were independently checked after capture.

`package-receipt.json` records the final source's real Windows x64 portable executable. Packaged engine, main process, renderer and provenance files were extracted from the built ASAR and matched to their source/build hashes. The ordinary `npm run dist` route also completed during development; the final local verification package used store compression for faster rebuilding. CI uses the checked-in packaging defaults. The executable is generated under the ignored `hosting-wizard/dist` directory and is not committed.

Windows execution, native ACL effectiveness, executable-path compatibility, Compose process-tree cancellation, real pull/start/health completion, second-device LAN access, other workflow states and 125/150/200 percent display scales remain unverified. The broader per-surface gaps in `../acceptance.md` remain open. These captures and mocked process tests do not establish those outcomes.
