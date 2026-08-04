---
layout: doc
title: "App tabs"
---

# App tabs

The signed-in shell provides a browser-style **Open tabs** strip below the classification ribbon.

It complements the complete navigation rail and mobile navigation; it never removes a route from those surfaces.

Visiting a real page adds its tab to the local tab set, and returning to that page selects the
existing tab instead of creating a duplicate.

## Behavior and persistence

- Tabs use the real route hrefs (`/`, `/defense`, `/comfort`, `/energy`, `/logs`, `/controls`,
  `/settings`, `/repository`, `/guide`, `/wiki`, `/api-docs`, and `/changelog`).
- The tab order and membership are stored in browser `localStorage` under `ac-defender-open-tabs`.
  Invalid, duplicate, or unknown hrefs are discarded on load; `/` is always retained as the safe
  command tab, and the current route is always added.
- Storage is a convenience only. If it is unavailable or malformed, the in-memory tab set starts
  from the command tab and the current route; no Home Assistant command or live state is changed.
- The horizontal viewport scrolls rather than clipping long tab sets. When navigation changes, the
  active tab is revealed inside that viewport.

## Accessibility and keyboard use

The strip is a `tablist`; each route is a named `tab` with `aria-selected`, `aria-controls`,
roving `tabindex`, and a visible focus ring. `ArrowLeft`/`ArrowRight` move between open tabs,
`Home`/`End` jump to the first/last tab, and <kbd>Enter</kbd>/<kbd>Space</kbd> activate the
focused route. The main route surface is the associated `tabpanel`. Hidden overflow remains
keyboard-reachable, and reduced-motion users do not receive animated scrolling.

## Failure and security considerations

Tab state contains only an allow-listed route path; it never stores Home Assistant tokens, climate
readings, command payloads, or provider-authored content. A broken local-storage value cannot
redirect navigation outside the app's known routes. The rail remains available if the tab strip
fails to initialize, and route navigation never waits for Home Assistant.

## Verification

1. Sign in and visit at least three rail pages. Confirm each appears once in **Open tabs** and the
   selected tab tracks the current route.
2. Reload the browser and confirm the tab membership/order survives.
3. At a 390 px viewport, open enough pages to overflow the strip. Confirm the viewport scrolls,
   the active tab is visible, and the document has no horizontal overflow.
4. Focus a tab and use <kbd>Home</kbd>, <kbd>End</kbd>, arrow keys, and <kbd>Enter</kbd>. Confirm
   `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, and `tabpanel` values remain truthful.

Suggested next steps: [Command palette](Command-palette.html), [Settings](Settings.html), and
[Changelog](Changelog.html).
