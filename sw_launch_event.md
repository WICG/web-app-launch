# `launch` Event Explainer

Author: Marijn Kruisselbrink &lt;<mek@chromium.org>&gt;<br>
Former Author: Matt Giuca &lt;<mgiuca@chromium.org>&gt;<br>
Former Author: Eric Willigers &lt;<ericwilligers@chromium.org>&gt;<br>
Former Author: Jay Harris &lt;<harrisjay@chromium.org>&gt;<br>
Former Author: Raymes Khoury &lt;<raymes@chromium.org>&gt;

Created: 2017-09-22
Updated: 2024-08-28

## Introduction and Motivation

The `launch_handler` manifest field gives web apps limited control over what should happen when a user launches their application. While the currently available options (`navigate-existing`, `navigate-new` and `focus-existing`) address many use cases, there are a few use cases where even more flexibility is desired.

Both `navigate-existing` and `focus-existing` activate the most recently used tab/window of an application, while sometimes an application might want to use a different tab or window to handle the navigation. While this behavior can be
partially emulated with `focus-existing` by having javascript focus or navigate an existing client, the fact that the "wrong" window gets activated first makes this a less than ideal user experience. In other words, the existing launch handler options handle single-window and arbitrary-many-window apps pretty well, they don't support multiple-but-limited windows.

Examples of such use cases:
* A document editor could allow a separate window for each document, but if the user clicks a link to a document that is already open in a window, focus that window instead of opening a duplicate.
* A chat web app might sometimes be embedded in a different (same origin) app. Some links to specific chat rooms should activate the already open app rather than open a new chat specific window.

In some cases, web apps may not want to open a new window at all, and may be content to show a notification. e.g.
* A "`magnet:`" URL is handled by a torrent client, which automatically starts downloading the file, showing a notification but not opening a new window or tab.
* A "save for later" tool that has a share target. When the share target is chosen, it just shows a notification "Saved for later", but doesn't actually spawn a browsing context.

Example Service Worker code to handle all launches of a web app in an existing window if one exists:

```js
self.addEventListener('launch', event => {
  event.waitUntil(async () => {
    const allClients = await clients.matchAll();
    // If there isn't one available, open a new window.
    if (allClients.length === 0) {
      clients.openWindow(event.request.url);
      return;
    }

    const client = allClients[0];
    client.focus();
  }());
});
```

## Background

The proposed API here is an extension to launch handlers described in https://github.com/WICG/web-app-launch/blob/main/launch_handler.md#background and https://wicg.github.io/web-app-launch/.

This proposal handles the same ways that web apps can be launched as described in there, such as:

1. **Navigations:** A user clicks a link into a Social Media web app.
2. **OS Shortcuts:** A user opens an Image Editor web app using an OS shortcut (e.g. on their 
   desktop). This shortcut was created when they installed the app.
3. **Protocol Handlers:** A user clicks on a `mailto:` protocol link which a website has registered to handle using the [`registerProtocolHandler`](https://html.spec.whatwg.org/multipage/system-state.html#dom-navigator-registerprotocolhandler) API or [`"protocol_handlers"` manifest member](https://wicg.github.io/manifest-incubations/index.html#protocol_handlers-member).
4. **Web Share Target:** A user shares an image with an Image Editor web app that has registered as
   a share target using the [Web Share Target API](https://wicg.github.io/web-share-target/).
5. **File Handlers:** A user opens a file that an Image Editor web app has registered to handle using the [`"file_handlers"` manifest member](https://wicg.github.io/manifest-incubations/index.html#file_handlers-member)).

## `launch_handler` manifest member

This explainer proposes adding a new `"service-worker"` value to the `client_mode` field of the `launch_handler` manifest member. This would invoke a `"launch"` event on a service worker instead of handling a launch as normal. This allows the site to for example redirect the navigation into an existing window or trigger a notification.

Since service worker scopes and web app manifest scopes don't necessarily match, the service worker used for this event would be the active worker of whatever registration has the URL being navigated to/launched in scope. If no such service worker can be found (or if the user agent otherwise decides this particular launch should not trigger a `"launch"` event) the next supported option from the provided list of `client_mode`s will be used instead.

Like with existing `launch_handler` options, this only allows *certain* navigations to be intercepted. The user is still in control of the experience, so if they really want to, they can say "Open in new tab" and the app will not be allowed to prevent the page from opening. This is only used to prevent basic navigations, such as left-clicking a link.

Further, not every navigation to a web app would trigger a `launch` event, only those that indicate it is being launched like an app. Typically, only events external to the app could trigger a `launch` event (e.g. navigations from a website outside of the app's scope into the app, opening a file, sharing a link to the app).

### Example

Example Service Worker code to redirect navigations into an existing window:

```js
self.addEventListener('launch', event => {
  event.waitUntil(async () => {
    const allClients = await clients.matchAll();
    // If there isn't one available, open a new window.
    if (allClients.length === 0) {
      const client = await clients.openWindow(event.params.targetURL);
      return;
    }

    const client = allClients[0];
    client.postMessage(event.params.targetURL);
    client.focus();
  }());
});
```
Notes:
* `waitUntil` delays the user agent from launching and waits for the promise. This is necessary because inspecting existing client windows happens asynchronously.
* The `launch` event is considered to be "allowed to show a popup", so that `Clients.openWindow` and `Client.focus` can be used.
* If the launch handler does not:
  1. Focus a client.
  2. Open a new client.
  3. Show a notification (Note: permission to show notifications is required).
    
  then the user agent should assume that the launch handler did not handle the launch, and should continue as if there were no `launch` event handler.

### Event Definition

```ts
interface LaunchEvent : ExtendableEvent {
  readonly attribute LaunchParams params;
}
```


## Design Questions/Details

### Should we expose the full `Request` instead of `LaunchParams` in the `LaunchEvent`

For example for web share target, the data being shared could be part of the "POST" data of the request. By exposing a `Request` instead of (or in addition to) the `LaunchParams` this could be better handled by the service worker. However at the time launch handling runs, the request hasn't been created yet, so we'd have to create a synthetic request to be able to pass it in. Additionally if we do want to expose the POST data, we'd also want to expose that to `focus-existing` launch handlers, and thus would to add it to `LaunchParams` anyway.

### Restricting launch events to installed websites

By only triggering `launch` events when the manifest specifies the `service-worker` `client_mode`, we limit this functionality to installed web apps.

There are 2 reasons for this:
 1. It is difficult to attribute bad behavior to misbehaving websites if they aren't installed (see the section below).
 2. It could be confusing if the behavior of clicking a link changes just because a user has visited a site that registered itself as a `launch` event handler. 

Allowing launch events to be handled on the drive-by web could be explored in the future.

### Requiring a user gesture to trigger launch events

Since a launch event can result in a new window being created or an existing window being focused, a user gesture should be required. In particular, a launch event should not be able to trigger another launch event without a subsequent user gesture.

### Addressing malicious or poorly written sites

not-a-great-experience.com could register a `launch` handler that just does nothing. This would result in a poor user experience as the user could click links into the site, or share files with the site and nothing would happen.

Similarly, slow-experience.com may unintentionally do a lot of processing in the `launch` event handler before it opens any UI surface. The user could open a file that would be handled by the app and not see anything for a long time. This would also be a poor user experience.

User agents can give feedback to users when a site is handling a `launch` event to signify that the app is loading. User agents have a lot of flexibility to experiment here but some suggestions on what could be done if the app doesn't show some UI after a small delay (e.g. 1-2 seconds):
- Show a splash screen indicating the app is launching
- Show an entry for the app in the taskbar/dock/shelf indicating it's loading
- Focus a previously opened window in the scope of the app

If the app doesn't show UI after a long delay (e.g. 10 seconds), the user agent could:
- Kill the `launch` event handler and show an error message indicating the app couldn't launch
- If apps behave badly on a repetitive basis, don't allow it to handle `launch` events (fallback to opening URLs directly in their default context)

### Responding with a Client vs. calling Client.focus()

`fetch` events provide a response via a `FetchEvent.respondWith` function. In a similar way, `launch` events could be designed to call a `LaunchEvent.launchWith` function with a `Client` which should be focused and/or navigated.

The main benefit to this approach is that it would ensure that developers don't forget to focus a client window. The main issue with this is that it removes the flexibility for doing things besides focusing windows. For example, `launch` events may just want to show a notification. We could address this by adding other methods to `LaunchEvent` for triggering notifications and other behavior we would want to support, but that ends up duplication a large amount of API surface. It seems simpler to just stick with explicit `Client` manipulation.

As an aside, the `notificationclick` event has similar challenges to the `launch` event in that handlers can be written such that nothing happens when a notification is clicked. Whatever solution is decided for `launch` event should also apply to `notificationclick` for consistency.

### Register Service Workers from the manifest?

Since launch events would only work if a service worker has been registered by the application, it might be nice to be able to register a service worker with fields in the manifest as well. This explainer does not attempt to define this functionality, although this could be a good follow-up.

### Enqueue a launch in an existing client

A service worker might want to emulate `focus-existing` launch handler behavior. This would require enqueueing an event into the launch queue of an existing client. This is not something that is currently possible, but we could consider a future extension of the `WindowClient` API that enabled this. For now a service worker would have to `postMessage` to the client, with corresponding code in the client to handle the message from the service worker.

## Security and privacy considerations

* The user agent must only fire a `launch` event for navigations to URLs inside the service worker's scope, or a service worker could spy on other navigations.

## Appendix

* [Service Worker GitHub issue](https://github.com/w3c/ServiceWorker/issues/1028)
* [mgiuca proposal document](https://docs.google.com/document/d/1jWLpNEFttyLTnxsHs15oT-Hn8I81N0cwUa3JjISoPV8/edit)
* [Earlier version of this explainer](https://github.com/WICG/web-app-launch/blob/ddc64da204af342ed2a908d96aa1401d025fbd70/sw_launch_event.md)
