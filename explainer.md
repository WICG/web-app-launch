# Overview

Author: Matt Giuca &lt;<mgiuca@chromium.org>&gt;
Author: Eric Willigers &lt;<ericwilligers@chromium.org>&gt;

Date: 2018-09-04

This explainer proposes a new API to Service Workers to prevent certain incoming
navigations from completing and handle them with custom logic. This allows sites
to catch new windows or tabs being opened in their scope, block the window/tab
from opening, and redirect the navigation into an existing window. This has a
variety of uses, such as writing URL handlers that do not show any UI, and
creating "single-window" web apps.

Crucially, this only allows *certain* navigations to be intercepted. The user is
still in control of the experience, so if they really want to, they can say
"Open in new tab" and the app will not be allowed to prevent the page from
opening. This is only used to prevent basic navigations, such as left-clicking a
link.

Example Service Worker code to redirect navigations into an existing window:

    self.addEventListener('launch', event => {
      event.waitUntil(async () => {
        const allClients = await clients.matchAll();
        // If there isn't one available, the default behaviour = open a window.
        if (allClients.length === 0)
            return;
        const client = allClients[0];
        client.postMessage(event.request.url);
        client.focus();
        event.preventDefault();
      }());
    });

The event is named "launch" (as opposed to "navigate"), as suggested by Jake
Archibald, to evoke the idea that it only takes place when the website is
"launched" like an app, and not on all navigations within the site.

## Use cases (possible today)

* **Single-tab web apps**. An app wants to, as much as possible, maintain only a
  single open tab at a time.
  * e.g., A music player might be playing a track; if the user clicks a link to
    another track in the player's scope, instead of opening a new tab to the
    track (possibly playing music over the existing music), it could focus the
    existing tab, show the new track info but keep playing the old track in the
    background.
  * e.g., Banking websites often fail if users try to use them from multiple
    tabs. This API could be used to bounce the user back into an existing tab if
    they already have one open.
  * e.g., A document editor could allow a separate browser tab for each
    document, but if the user clicks a link to a document that is already open
    in a tab, focus that tab instead of opening a duplicate.
  * Keep in mind, in all of these cases, that the user can override this with
    "Open in new tab" if they really want two tabs for the same app / document.
* **Advanced protocol handlers**. Sites that use
  [`registerProtocolHandler`](https://html.spec.whatwg.org/multipage/system-state.html#dom-navigator-registerprotocolhandler)
  to handle URLs of a certain scheme may wish to handle incoming URLs without
  opening a new tab.
  * e.g., (An extension of the previous point): A mail client already has an
    open tab; if a "`mailto:`" URL is clicked, it focuses the existing open tab,
    opening a Compose sub-window, rather than opening a new tab to compose the
    email.
  * e.g., A "`magnet:`" URL is handled by a torrent client, which automatically
    starts downloading the file, showing a notification but not opening a new
    window or tab.

## Use cases (future)

* **Single-window installable apps**. The same use case as "single-tab web apps"
  above, but for installed apps that run in a window. With a focus on
  [installable web apps](https://www.w3.org/TR/appmanifest/) that "look and
  feel" more like native apps, this use case makes a lot more sense, as
  single-window apps are very common on both mobile and desktop platforms.
* **Web Share Target API**. Similar to `registerProtocolHandler`, share targets
  may wish to deal with an incoming piece of shared data without opening a new
  tab. One particular use case is a "save for later" app; when it receives a
  share, it just shows a notification "Saved", rather than opening a new tab or
  window. Note that our original Share Target design ([Approach 2 in this
  explainer](https://github.com/WICG/web-share-target/blob/master/docs/explainer.md#sample-code))
  involved a new service worker event, which would be obsoleted by the `launch`
  event.
* **Deep-link shortcuts API**. A proposed API ([proposal
  1](https://gist.github.com/kenchris/0acec2790cd38dfdff0a7197ff00d1de);
  [proposal
  2](https://docs.google.com/a/chromium.org/document/d/1WzpCnpc1N7WjDJnFmj90-Z5SALI3cSPtNrYuH1EVufg/edit))
  to allow web apps to create shortcuts to deep links within the app. The
  original proposal was to have those links fire a new type of service worker
  event. The second proposal just navigates to a URL, a simpler but less
  powerful approach. With the `launch` event, the latter approach would be just
  as powerful as the former.

# Background

* [Service Worker GitHub issue](https://github.com/w3c/ServiceWorker/issues/1028)
* [mgiuca proposal document](https://docs.google.com/document/d/1jWLpNEFttyLTnxsHs15oT-Hn8I81N0cwUa3JjISoPV8/edit)

# Details

Speccing this API will require amendments to the
[HTML](https://html.spec.whatwg.org/) spec (**navigate** algorithm) and [Service
Workers](https://www.w3.org/TR/service-workers-1) spec (where the `LaunchEvent`
would live).

Initially, it could exist in its own spec document, which monkey-patches the
HTML spec.

This section is a rough draft of "spec-ish" language, without being too picky
about getting things "right". See also the [polyfill source
code](demos/polyfill.js), which roughly implements this logic.

## LaunchEvent

    interface LaunchEvent : ExtendableEvent {
      readonly attribute Request request;
      readonly attribute DOMString? clientId;
    }

* `waitUntil` delays the user agent from launching and waits for the promise.
  If the promise rejects, the default launch behaviour resumes.
* `preventDefault` is analogous to
  [`FetchEvent`](https://www.w3.org/TR/service-workers-1/#fetch-event-section)'s
  `respondWith` method. If it is called (during the `launch` event handler), it
  stops the user agent from launching. Nothing further happens (the user agent
  assumes the app has handled it).
* The `launch` event is considered to be "allowed to show a popup", so that
  `Clients.openWindow` and `Client.focus` can be used.

### Alternative design ideas and notes

* We considered adding a `handleLaunch` method that accepts a promise like
  `waitUntil`. `handleLaunch` would have called `preventDefault` unless the
  promise rejected.
* `handleLaunch` could have been given a promise that resolves to a Client or Client
  ID, which automatically becomes focused (so `Client.focus` doesn't have to be
  called). This could mean that we never need a user gesture token, because you
  just reject if you want to open a window with the URL, or resolve with a
  Client to focus.
* Alternatively, it might be bad to just do the default behavior on rejection
  (since an async function rejects on any error). Instead, make the promise
  return a Boolean that indicates whether to cancel or default.
* I would like to make sure that notifications can be shown from a `launch`
  event handler. This satisfies use cases like a "save for later" tool that has
  a share target. When the share target is chosen, it just shows a notification
  "Saved for later", but doesn't actually spawn a browsing context.
* It isn't sufficient to just cancel with `preventDefault`, because that
  requires you to make the cancel decision synchronously. Since the Clients API
  is asynchronous, you should be able to inspect the existing clients in a
  promise before deciding whether to override the navigation. Thus the event
  needs to be an `ExtendableEvent`.
* LaunchEvent could have a url member instead of a request member. However, the
  handler would then have no access to the form data of POST requests.

## Firing the `launch` event

When the user agent [navigates](https://html.spec.whatwg.org/#navigate) a
browsing context *browsingContext* to a URL *resource*, if *resource* is in the
scope of an active service worker, the user agent **MAY** go through the
`launch` flow instead of the normal navigation behaviour.

(NOTE: I don't understand the details of how new browsing contexts are created
when using `window.open` or "Open in new window". I'm just going to assume that
the *browsingContext* is null for navigations that open a new window or tab, and
figure out the "correct" details later.)

The purpose of this "**MAY**" is to allow the user agent to determine in what
situations to allow the target site to interfere with the navigation. It
**SHOULD** generally be done when navigating from a resource outside the target
service worker scope, but **SHOULD NOT** be done when navigating within the same
service worker scope. It **SHOULD NOT** be done when the user has explicitly
indicated the intended browsing context for the navigation (e.g., "Open in new
tab" or "Open in new window").

If the user agent opts to use the `launch` flow, it should do the following
instead of the normal navigation algorithm, within the context of *resource*'s
active service worker:

1. Create a new `LaunchEvent` *event* with `type` set to `"launch"`, `url` set
   to *resource* and `clientId` set to the service worker client ID of
   *browsingContext*. (`clientId` is `null` if this navigation would open a new
   browsing context.)
2. Fire *event* at the service worker global scope. The event listener is
   **triggered by user activation**.
3. If *event* is **cancelled**, abort these steps (and do not continue with the
   navigation).
4. If *event*'s [[*handlePending*]] slot is null, abort these steps and proceed
   with the normal navigation algorithm.
5. Wait until [[*handlePending*]] is fulfilled or rejected.
6. If [[*handlePending*]] is rejected, proceed with the normal navigation
   algorithm. (If it is fulfilled, do not continue with the navigation.)

# Security and privacy considerations

* The user agent must only fire a `launch` event for navigations to URLs inside
  the service worker's scope, or a service worker could spy on other
  navigations.
* By providing the service worker with the client ID of the navigation source,
  the target site may be able to learn a lot more information about where the
  user came from than the usual `Referer` header.
* Not really security or privacy, but a concern as it could be seen as taking
  control away from the user. In particular, it could be confusing to click a
  link and have nothing happen. Mitigations:
  * You can already click a link and have nothing happen (as it might have an
    onclick handler that prevents default).
  * The user has full control if they use explicit navigation commands like
    "Open in new tab", which do not fire the `launch` event.
