# Overview

TODO(mgiuca)

# Details

## LaunchEvent

    interface LaunchEvent : ExtendableEvent {
      readonly attribute USVString url;
      readonly attribute DOMString? clientId;

      void handleLaunch(Promise<any> p);
    }

* `handleLaunch` is analogous to
  [`FetchEvent`](https://www.w3.org/TR/service-workers-1/#fetch-event-section)'s
  `respondWith` method. If it is called (during the `launch` event handler), it
  stops the user agent from launching and waits for the promise. If the promise
  fulfills, nothing further happens (the user agent assumes the app has handled
  it). If the promise rejects, the default launch behaviour resumes.
* The `launch` event is considered to be "allowed to show a popup", so that
  `Clients.openWindow` and `Client.focus` can be used.

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
