Author: Matt Giuca <mgiuca@>

Input from: Alan Cutter <alancutter@>, Dominick Ng <dominickn@>

Authored: 2020-05-25
Updated: 2022-03-03

## Obsolete

This API proposal is obsolete in favor of [`launch_handler`](launch_handler.md).
Context: https://docs.google.com/document/d/1w9qHqVJmZfO07kbiRMd9lDQMW15DeK5o-p-rZyL7twk

## Overview

[sw-launch](https://github.com/WICG/sw-launch) has been proposed for a number of years and has never made it past a proposal stage, largely due to the complexity involved in both spec and implementation (a complex effort spanning PWAs, service workers, and HTML navigation stack).

We found that almost all `launch` use cases could be covered by a handful of fixed rules (for example, "choose an existing window in the same app, focus it, and navigate it to the launched URL"). Thus, this proposal, "Declarative Link Capturing", allows sites to choose one of those fixed rules without having to implement custom `launch` event logic, which should satisfy most use cases, and simplify the implementation in the browser and in all the sites. We leave open the option of expanding into the full `launch` event later on.


## Goals / use cases



*   Link capturing for PWAs: a PWA that wants to open in a window whenever the user clicks a link to a URL within that app’s [navigation scope](https://www.w3.org/TR/appmanifest/#nav-scope), rather than opening in a browser tab.
*   Capturing links and navigations from the following (non-exhaustive list of) sources:
    *   Clicked links from other web pages.
    *   URL launch from a native app in the operating system.
    *   [Shortcuts API](https://www.w3.org/TR/appmanifest/#shortcuts-member) (jump lists to within the app)
    *   [Protocol handlers](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/registerProtocolHandler)
    *   [File handlers](https://github.com/WICG/file-handling/blob/master/explainer.md)
    *   [Share Target API](https://web.dev/web-share-target/)
*   Single-window PWAs: a PWA that prefers to only have a single instance of itself open at any time, with new navigations focusing the existing instance. Sub-use cases include:
    *   Apps that generally only make sense to have one instance running (e.g., a music player, a game).
    *   Apps that include multi-document management within a single instance (e.g., an HTML-implemented tab strip, floating sub-windows like Gmail).


### Relevant issues



*   [w3c/manifest#764](https://github.com/w3c/manifest/issues/764): Option for specifying browser app picker behavior
*   [w3c/manifest#597](https://github.com/w3c/manifest/issues/597): Single-window mode option


### Non-goals



*   Capturing links from origin A to open in a PWA on origin B (see “[URL Handlers](https://github.com/WICG/pwa-url-handler/blob/master/explainer.md)” proposal which has this as an explicit goal).
*   Defining a separate scope for link capturing, separate from the existing [navigation scope](https://www.w3.org/TR/appmanifest/#navigation-scope) (see “[URL Handlers](https://github.com/WICG/pwa-url-handler/blob/master/explainer.md)” proposal which has this as an explicit goal).
*   Allowing a web app to force itself to only ever be in a single window. (The user will always be able to override a single-window setting, since after all, these are just web pages and the user is in control of navigation.)
*   If multiple clients are open, allowing the application to choose which client to focus. [This is an extended goal of the full sw-launch design.]
*   Stopping a navigation from opening any windows, and handling the navigation in the background. [This is an extended goal of the full sw-launch design.]


## Proposal

(All of the proposed names are subject to change / debate.)

This proposal defines new manifest members that control what happens when the browser is asked to navigate to a URL that is within the application’s [navigation scope](https://www.w3.org/TR/appmanifest/#dfn-navigation-scope), from a context outside of the navigation scope.

It doesn’t apply if the user is already within the navigation scope (for instance, if the user has a browser tab open that is within scope, and clicks an internal link). The user agent is also allowed to decide under what conditions this does not apply; for example, middle-clicking a link (or right-clicking -> “open in new tab”) would typically not trigger this behaviour. Note that this interception behaviour would apply to both `target=_self` and `target=_blank` links, so that links clicked in a browser window (or window of a different PWA) would be opened in the PWA even if they would normally cause a navigation within the same tab. This accords with link capturing behaviour of native apps on operating systems like Android.

A new manifest field “`capture_links`” is introduced with a string or list-of-strings value. Its value dictates the launch behaviour as follows:



*   “`none`” (the default) — no link capturing; links clicked leading to this PWA scope navigate as normal without opening a PWA window.
    * Note that user agents can technically choose `new-client` or `existing-client-navigate` as the default, since the behaviour of all three of these, while different to the user, is indistinguishable to the site. The remaining options fundamentally change how the site experiences navigation, so a user agent cannot unilaterally choose those without the site explicitly opting in.
*   “`new-client`” — each link clicked leading to this PWA scope opens a new PWA window at that URL.
*   “`existing-client-navigate`” — when a link is clicked leading to this PWA scope, the user agent finds an existing PWA window (if more than one exists, the user agent may choose one arbitrarily), and causes it to navigate to the opened URL.
    *   Behaves as `new-client` if no window is currently open.
    *   This option potentially leads to data loss as pages can be arbitrarily navigated away from. Sites should be aware that they are opting into such behaviour by choosing this option. Works best for “read-only” sites that don’t hold user data in memory, such as music players.
    *   If the page being navigated away from has a “`beforeunload`” event, the user would see the prompt before the navigation completes.
*   “`existing-client-event`” — when a link is clicked leading to this PWA scope, the user agent finds an existing PWA window (if more than one exists, the user agent may choose one arbitrarily), and fires a “[`launch`](explainer.md)” event in that window’s top-level context, containing the launched URL.
    *   Behaves as `new-client` if no window is currently open.
    *   This is intended for more advanced sites, which inspect the launched URL and use it to load data into the current browsing context, without a navigation. For example, a site that allows multiple documents to be loaded in the same window can pop open a new sub-window in response to the navigation.
*   (future) “`serviceworker`” — doesn’t open a window at all, instead firing a “[`launch`](explainer.md)” event in the service worker’s context. This is an opt in to the full originally proposed [service worker launch event](explainer.md).
    *   This will be omitted initially (due to complexity, and the fact that it has taken us three years to neither spec nor implement this), but we can bring it in later in accordance with demand.

If a list of strings is given, the user agent chooses the first supported item in the list (this is for future proofing, allowing us to add new choices later), defaulting to `none` if none of them are supported. (Much like the [proposed `display_override` member](https://github.com/dmurph/display-mode/blob/master/explainer.md); note that if we had our time again, we likely would build the explicit display fallback chain into the display member, rather than as a separate `display_override` member.) If a string is given, it is the same as a singleton list containing that string.

## Relation to existing proposals


### [Service Worker launch event](explainer.md)

This proposal is forwards-compatible with the original [sw-launch](https://github.com/WICG/sw-launch) proposal in WICG. It covers many of the same use cases, but omits the more advanced use cases (specifically, the option to choose which client to focus, and the option to not show any UI). By adding a new “`capture_links`” mode (“`serviceworker`”), the app can explicitly opt in to receiving the “`launch`” event in the service worker, enabling those other use cases, while the majority of uses can be achieved without having to write extra service worker code.


### [WICG: URL Handlers](https://github.com/WICG/pwa-url-handler/blob/master/explainer.md)

These two proposals are ostensibly both “link capturing”, but upon close inspection, they are quite orthogonal. Huang’s URL Handlers deals with _what_ is captured (i.e., the set of URLs associated with an app), which my proposal simply assumes to be the app’s navigation scope. My proposal deals with _how_ the app works once invoked via a captured link.

I think these proposals can be considered independently (for example, we could enact both of them, with the optional `url_handlers` defining the set of URLs to capture, defaulting to the app’s navigation scope, while `capture_links` defines the behaviour upon navigating to such a URL).

For posterity, here is my (Matt's) [initial response to that proposal](https://github.com/MicrosoftEdge/MSEdgeExplainers/issues/300#issuecomment-627759147).


### [File Handling](https://github.com/WICG/file-handling)

File Handling defines a “`launchQueue`” variable that was intended to be expanded into the launch event once that proposal was finalized. This proposal is compatible with that. When a PWA is launched via a file handler, the behaviour would change based on the “`capture_links`” member:



*   `none`, `new-client` or `existing-client-navigate` all result in a new browsing context being created. This just works as normal (create a launchQueue and put a single item in it).
*   `existing-client-event` would push a new file handle to the `launchQueue` of the existing context before firing the `launch` event.
*   (future) `serviceworker` would put the file handle in the service worker’s `launch` event, which can then be forwarded to an existing client’s `launchQueue`.


### [Tabbed Application Mode](https://github.com/w3c/manifest/issues/737)

Link capturing goes hand-in-hand with tabbed application mode, because it’s very weird to have a tabbed application that _doesn’t_ capture links (you would have links opening in new browser tabs when they could be opening in new tabs within the PWA).

When this proposal is used with a tabbed mode PWA, the “`new-client`” link capture mode would cause the user agent to find an existing PWA window, and open the launched URL in a new tab within that window. It is suggested that tabbed apps use the “`new-client`” link capture mode.

All of the other link capture modes would behave as defined above (e.g., “`existing-client-navigate`” would find an existing tab and navigate it), which don’t really make sense for a tabbed application.


## Issues



*   We have noticed that some websites (notably Google Drive) exhibit behaviour that works weirdly in conjunction with link capturing:
    *   Clicking a link from the site opens another page in a new browser tab. However, instead of just opening the target page with a `window.open()` or a `target=_blank` link, the site first opens an `about:blank` page with a `window.open()`, and then proceeds to navigate it to the intended page.
    *   We believe this behaviour has something to do with the originating site wanting to have a handle on the opened client.
    *   This behaviour breaks link capturing logic, because the initial `about:blank` navigation would open a new browser tab, and then the subsequent navigation gets captured and opened in a PWA window, leaving an about:blank tab open in the browser.
*   Figure out how to capture POST requests in each of the above modes. (For example, “`existing-client-event`” might have to encode the POST data in the event.)
*   Having the user agent arbitrarily choose an existing window (in the “`existing-client-*` modes) may not be very good behaviour for any app. For example, you may have two windows open: one on the main application and one on a help article. You would want to message the main application window, not the help article. We may need to define more control over which window gets targeted.

## Security & Privacy Questionnaire

https://www.w3.org/TR/security-privacy-questionnaire/

**2.11. Does this specification allow an origin some measure of control over a user agent’s native UI?**

Yes. This API allows sites new additional control options:

* Being able to automatically open installed apps in a window (this uses existing UI but makes it possible for the site to automatically trigger it).
* Focus an existing window on its own domain and fire an event containing the clicked URL. This is intended to allow the site to navigate an existing window to a new page, overriding the default HTML navigation flow.

**2.14. How does this specification work in the context of a user agent’s Private Browsing or "incognito" mode?**

This probably should not work in incognito mode. (We don't want a link clicked in Incognito to open in a non-Incognito app.) The browser could also give a warning that you are leaving incognito mode, which is what Chrome does when link capturing to Android apps.

## Changelog

* 2021-04-28
  * Added Security & Privacy Questionnaire
* 2020-01-08
  * Got rid of `auto` (just says that `none` is the default).
  * Converted underscores (`_`) to dashes (`-`) in enum values.
  * Accept either a string or a list.
