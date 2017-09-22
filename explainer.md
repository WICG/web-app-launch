# Overview

TODO(mgiuca)

# Details

## LaunchEvent

    interface LaunchEvent : ExtendableEvent {
      readonly attribute USVString url;
      readonly attribute DOMString? clientId;

      void handleLaunch(Promise<any> promise);
    }

* `handleLaunch` is analogous to
  [`FetchEvent`](https://www.w3.org/TR/service-workers-1/#fetch-event-section)'s
  `respondWith` method. If it is called (during the `launch` event handler), it
  stops the user agent from launching and waits for the promise. If the promise
  fulfills, nothing further happens (the user agent assumes the app has handled
  it). If the promise rejects, the default launch behaviour resumes.
* The `launch` event handler can also just call `preventDefault` to accomplish
  the same thing (but this is more limited in that you can't decide
  asynchronously whether to consume the event or not).
* The `launch` event is considered to be "allowed to show a popup", so that
  `Clients.openWindow` and `Client.focus` can be used.

Spec-ish text for `handleLaunch` algorithm with promise *promise* applied to
event *event*:

1. If internal slot [[*handlePending*]] is not null, throw `InvalidStateError`.
2. Invoke *event*'s `waitUntil` with *promise*.
3. Set internal slot [[*handlePending*]] to *promise*.

### Alternative design ideas

* `handleLaunch` could be given a promise that resolves to a Client or Client
  ID, which automatically becomes focused (so `Client.focus` doesn't have to be
  called). This could mean that we never need a user gesture token, because you
  just reject if you want to open a window with the URL, or resolve with a
  Client to focus.
* Alternatively, if we don't need to wait for a promise, we could just use
  `preventDefault` and not have `handleLaunch` at all.
* I would like to make sure that notifications can be shown from a `launch`
  event handler. This satisfies use cases like a "save for later" tool that has
  a share target. When the share target is chosen, it just shows a notification
  "Saved for later", but doesn't actually spawn a browsing context.

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


