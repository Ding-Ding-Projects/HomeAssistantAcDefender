---
layout: doc
title: "Local tools"
---

# Local file tools and app logo

Open **Local tools** at `/local-tools` after signing in. Select one file, inspect the detected signature and optional plain-text preview, then choose a conversion from its category. Each category has its own search and adjacent regular-expression builder. The explicit **Convert** action accepts the changes described beside that adapter. **Download validated result** saves actual output with its MIME type and suggested extension. The source remains unchanged. **Cancel operation** terminates the worker.

Files, filenames and previews stay in the browser. They are not passed to the Blazor server, uploaded, logged or persisted. The last ten successful operation summaries remain in the current page session without file names or content. Navigating away releases the result object URL. This is a single-file tool, not a persistent batch queue.

## Available adapters

| Category | Implemented locally | Limits and changes |
| --- | --- | --- |
| Code/Text | Strict source decoding to UTF-8, LF and CRLF normalization | UTF-8, UTF-16 LE/BE or Windows-1252 input; output has no BOM. |
| Binary Encodings | Bytes to/from canonical base64 and hexadecimal | Invalid encodings are refused. Decoded bytes download as `.bin`; choose the appropriate extension yourself. |
| Structured Data/Spreadsheets | JSON formatting; flat JSON object-array to CSV | JSON at most 512 KiB and 64 nesting levels. CSV at most 100,000 rows/256 columns; nested values and formula-like cells are refused. JSON formatting may lose duplicate keys or numeric precision; CSV loses types and null distinctions. |
| Images | Static PNG, JPEG and WebP via isolated native canvas | Required browser encoder must pass a capability probe. At most 4096 pixels per axis and eight million pixels. JPEG/WebP use quality 90%; JPEG replaces transparency with white. Metadata and profiles may be removed. Animated PNG/WebP and SVG are refused. |
| Archives | Gzip compression/decompression using browser Compression Streams | One stream, at most 8 MiB expanded output. Gzip does not preserve source filenames. General archives are unavailable. |

All converters have an 8 MiB input/output ceiling and ten-second worker timeout. Hex input is limited to 4 MiB; base64 encoding input to 6 MiB, so output fits the limit. Decompression stops while reading if expanded output exceeds 8 MiB. No partial download is offered on failure. Format extensions and user-supplied MIME labels do not make unsupported data valid.

**Documents/PDF, Audio, Video, ZIP/7z/RAR/TAR, XLSX/ODS and HTML-to-text remain explicitly unavailable.** No offline isolated runtime for those formats is bundled. The category list makes this visible instead of implying successful conversion. Uploaded HTML is only ever treated as text; scripts and archive entries are never executed or rendered.

## App logo

In Settings, use **App logo** to choose a shipped shield, snowflake or control-ring mark. You can also select a static PNG, JPEG or WebP image up to 4 MiB. Uploaded SVG and animated images are refused.

Choose contain or fill, numeric X/Y focal position and transparent or colored background, then **Create preview**. The actual 128 × 128 derived PNG appears at 24, 40 and 96 pixels. Fill crops; contain preserves the whole image. Check contrast on the current theme. **Apply preview** stores exactly the preview shown; adjusting controls requires creating another preview. To edit a previously saved custom image, reselect its original file.

The selection and editor settings are one versioned browser-local record. Only the validated derived PNG is stored, with a 150,000-character data-URL ceiling. Loading a saved custom image checks its dimensions, signature and decoder round trip. Storage or conversion failure keeps the previously saved logo active. **Reset to shipped logo** clears the saved record and restores the application's original mark. The image changes presentation only; it does not change application identity or HVAC behavior.

## Current boundaries

English, Cantonese and bilingual workflow copy is available through each panel's language control. The shared regex builder currently uses its existing English control labels; low-level validation errors are also currently English. Search operates on shipped adapter/preset metadata, never selected file content. Its .NET engine limits patterns to 512 characters and matching to 100 ms.

This subset does not implement persistent unlimited queues, complete PDF tools, audio/video transcoders, general archive extraction, scheduling of logo preferences, appearance export/import, cross-feature local history, or command-palette integration. Native capability checks and browser fixture tests are not proof of every packaged browser. Full authenticated route and settings layout verification must be performed after shell integration.
