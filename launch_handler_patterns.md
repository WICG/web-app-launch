# Web App Launch Handling: Pattern-Scoped Client Matching

Authors: Daniel Murphy <dmurph@chromium.org>
Created: 2026-11-10

## Introduction

The [`launch_handler`](launch_handler.md) manifest field gives web apps control over app launches. Today, it handles single-window apps and arbitrary-many-window apps well. It does not support "multiple but limited" windows.

If developers emulate this using `focus-existing` and JavaScript, the wrong client activates first. Furthermore, the launch consumer receives no transient user activation ([WICG/manifest-incubations#141](https://github.com/WICG/manifest-incubations/issues/141)). This prevents the consumer from focusing the correct window or opening a new one.

## Use cases

- **Per-machine developer tool**: A developer tool keeps exactly one window open per connected machine (e.g., `/box/:machine/*`).
- **Per-document editor**: A document editor keeps exactly one window open per document ID.
- **Per-workspace chat/mail**: A chat app keeps exactly one window open per workspace.
- **Per-account dashboards**: A dashboard keeps exactly one window open per user account.

## Goals

- Allow a web app to focus an existing window that matches a specific URL pattern.
- Create a declarative routing mechanism for app launches based on URL patterns.

## Non-goals

- Choosing clients using arbitrary logic. Note that the [Service Worker `launch` event](sw_launch_event.md) is a separate, not yet implemented proposal. It is a potential future option, not something developers can use today.
- Changing user-initiated new-window behavior.

## Proposal

We propose expanding the `launch_handler` dictionary to include a `routes` member. The `routes` member contains an ordered list of routing entries. Each entry contains a `client_patterns` array (using URL pattern strings or `URLPatternInit` objects) and a `client_mode` (a string or list of strings).

We also introduce a new `client_mode` value: `focus-matching`. The user agent treats top-level `focus-matching` without patterns as an unsupported mode and falls through to the next valid mode.

### Ecosystem Integration

The user agent evaluates app scope (including scope inclusions, scope exclusions, and `scope_extensions`) before `launch_handler`. The launch `targetURL` is always already in scope. The `routes` match `LaunchParams.targetURL` for all launch triggers (links, shortcuts, file handlers, share targets, protocol handlers). The matched window receives the full `LaunchParams`. Matching origins from `scope_extensions` requires full-URL patterns or `URLPatternInit` objects.

### Routing Algorithm

At parse time, the user agent resolves the top-level `client_mode` to a single mode. It ignores invalid pattern entries in `client_patterns`. It drops any route whose `client_patterns` is empty. It also drops any route whose `client_mode` has no supported values. Valid routes retain their supported `client_mode` list for runtime evaluation. If no route matches at launch time, the user agent falls back to the top-level `client_mode`.

When a launch occurs, the user agent evaluates the `routes` list in order:
1. It tests the patterns in `client_patterns` against the launch URL in array order.
2. The first entry where the launch URL matches a pattern wins.
3. The user agent applies the `client_mode` list from the winning entry.

### The `focus-matching` Client Mode

If the winning entry uses `focus-matching`, the user agent searches for a matching client. A "client" is a top-level application context with the manifest applied and an in-scope current URL. The user agent excludes regular browser tabs.

To define "matches" precisely:
1. Find the first pattern in the winning entry's `client_patterns` that matches the candidate client's URL. If none match, the client does not match.
2. Use the first matching pattern for the launch URL. Use the first matching pattern for the candidate URL. Extract the matched named groups across all `URLPattern` components. The user agent leaves unmatched optional groups undefined.
3. If both sets of `[component, name, value]` entries are identical under case-sensitive code-unit equality, the client matches. Zero named groups across both patterns matches any client matching `client_patterns`.

If one or more clients match, the user agent selects the most recently focused matching client. It brings that client into focus without navigating it. It then enqueues `LaunchParams` on the `window.launchQueue` of that client.

Patterns resolve relative to the manifest URL. If a pattern string or `URLPatternInit` omits an explicit search or hash component, the user agent sets that component's pattern to `*` before matching.

If `focus-matching` finds no matching client context, it falls through to the next supported mode in that entry's list. If none exist, it defaults to `navigate-new`. If the fallback mode is `focus-existing` or `navigate-existing`, the user agent picks the most recently used context regardless of URL.

### Backwards Compatibility

Older user agents ignore unknown members. Because we keep `launch_handler` as a dictionary, old user agents ignore the `routes` array. They fall back to the top-level `client_mode`. The `client_mode` member has accepted either a string or a list of strings since the original explainer and spec. The user agent uses the first value it supports. Thus, the top-level `client_mode` remains the fallback for user agents that ignore `routes`. Inside `routes[].client_mode`, developers use the same string-or-list form. However, the user agent evaluates this list at runtime. It falls through when no client matches, rather than collapsing the list at parse time.

## Examples

### Per-machine developer tool

```json
"launch_handler": {
  "client_mode": "navigate-new",
  "routes": [
    {
      "client_patterns": ["/box/:machine/*"],
      "client_mode": "focus-matching"
    }
  ]
}
```

Note that if `focus-matching` finds no matching context, it defaults to `navigate-new` (the default fallback when no other mode is listed). Old user agents ignore `routes` and evaluate the top-level `client_mode`. The `client_mode` member has supported string lists since the original explainer. Developers can supply a list instead of a single string for any `client_mode`.

### Per-document editor keeping navigate-new for everything else

```json
"launch_handler": {
  "client_mode": ["navigate-existing", "auto"],
  "routes": [
    {
      "client_patterns": ["/doc/:id/*"],
      "client_mode": "focus-matching"
    }
  ]
}
```

### Mixed with focus-existing default

This example demonstrates a non-default fall-through for the route.

```json
"launch_handler": {
  "client_mode": "focus-existing",
  "routes": [
    {
      "client_patterns": ["/chat/:workspace/*"],
      "client_mode": ["focus-matching", "navigate-existing"]
    }
  ]
}
```

## Interaction with `launchQueue`

For `focus-matching`, the user agent brings the target window into focus without navigating it. All modes enqueue `LaunchParams`. The target window receives the event via `window.launchQueue` and decides how to update its UI.

## Testing Strategy

Web Platform Tests cannot install apps or trigger launches.

For the long-term path, we propose a `test_driver` extension or WebDriver BiDi command for "launch web app with URL".

In the interim, user agents will rely on their own browser-level integration tests. These tests must cover route selection order, named-group matching, and zero-named-group routes. They must also cover no-match fall-through, parse-time dropping of invalid routes, and old-UA behavior with `routes` present.

For developer ergonomics, we recommend browser DevTools add support for launch routing. Showing which route matched a given launch in the Application panel is a nice-to-have feature.

## Alternatives considered

- **Service worker `launch` event**: This is powerful. However, a service worker adds registration and lifecycle overhead for static URL routing. Additionally, the launch event has not shipped.
- **`focus-matching-url` exact-URL mode**: Proposed previously as a sketch. Exact URL matching fails for paths with sub-routes (e.g., `/doc/:id/edit` vs `/doc/:id/view`).
- **Per-launch-method launch_handler**: Proposed in the existing explainer. It does not solve the URL-based routing problem.
- **Separate manifests/scopes per workspace**: Forces developers to manage multiple installations. This degrades the user experience.
- **App-side BroadcastChannel routing**: The wrong window activates first via `focus-existing`. It cannot bring the correct window to the front because it lacks user activation.

## Security and privacy

- No new cross-origin exposure. Patterns only match within the app's scope.
- This proposal does not affect user "open in new window" gestures.
- No activation changes in this proposal. Developers must address the separate activation gap ([WICG/manifest-incubations#141](https://github.com/WICG/manifest-incubations/issues/141)) separately.

## Implementation notes

For Chromium, this requires adding a URL filter on the existing most-recently-used client lookup in `FindTopLevelBrowsingContextForWebApp`. MRU tracking already exists.

## Open questions

- **Tabbed display mode**: Should matching consider all tabs within tabbed app windows, or just the active tab?
