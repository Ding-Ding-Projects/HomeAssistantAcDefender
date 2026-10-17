# Documentation companion verification

The documentation companion packages the actual rendered Jekyll site and preserves the public GitHub Pages site. The Pages workflow targets the repository's default branch, `main`.

## Exact tested source

Source: `e9920236aace5ac5daa7ebb3c3e8f45dc468b8b7`. The bundle contains 85 rendered documentation pages, including the newly integrated feature-compliance, local-tools and hosting articles. A later source change, `cb7f300`, adds discoverability links to the documentation home page; that link-only change is not represented by these captures or this local executable. Release CI rebuilds the complete current tree.

## Checks completed

- Real Jekyll build using the same image family as the Pages action, with empty base URL for the separate local bundle.
- TypeScript compile and bundled Material Web renderer build.
- All four content tests passed: every wiki source rendered; every local article/site link and asset resolves; complete artifact provenance; article scripts, inline handlers and active remote URLs removed.
- Negative completeness check failed when new wiki Markdown lacked frontmatter. Added frontmatter to the three affected articles, rebuilt Jekyll and obtained a passing completeness check.
- Isolated Chromium loaded built output with external requests blocked. Exercised reading progress and reload, full-text search, no results, invalid regex, local vocabulary application/clear, settings and packaged site home. Fourteen genuine captures cover the recorded normal and minimum/narrow layouts, English/Cantonese/bilingual shell and light/dark appearances. Layout probes found no outer horizontal overflow.
- Actual Linux Electron launched on an isolated headless X display with an isolated profile. The reader used its packaged `docs://reader` protocol, had no renderer Node/process globals, denied a remote fetch, searched locally and opened a bundled scriptless article. The owned Electron process and profile were closed; the shared task-owned display remained under the parent task's lifecycle.

See [browser receipt](evidence/receipt.json), [Electron receipt](evidence/electron-linux.json), [raw Electron capture](evidence/electron-linux.png), [narrow dark capture](evidence/narrow-bilingual-dark.png) and [capture hashes](evidence/capture-hashes.json). Receipts include the recorded build timestamp, source revision and SHA-256 values for every built file. Raw screenshots are unmodified.

## Limits

This is a documentation reader, not the live HVAC controller. Shell translation does not translate original article prose. The executable is unsigned and Windows launch/install acceptance has not been performed; Linux Electron and Chromium evidence cannot establish native Windows success. Complete 125%, 150% and 200% display-scale coverage, reference-image parity and the wider universal feature inventory remain open. These checks do not establish complete product compliance.

## Portable artifact

Built successfully as `dist/AC-Defender-Docs-0.1.0-portable.exe` (99787191 bytes). SHA-256: `09df099f5a3b9f40f80b4268c27f0f8cbf6648e304821f3f57904d02d9940ea5`. All 264 files in the packaged Windows ASAR match the hashes of the tested browser/Electron bundle. See [artifact receipt](evidence/portable-artifact.json). The executable itself remains an ignored build output, not a tracked source file.
