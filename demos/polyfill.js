/* This work is licensed under the W3C Software and Document License
 * (http://www.w3.org/Consortium/Legal/2015/copyright-software-and-document).
 */

// To be included in the Service Worker.

class LaunchEvent extends ExtendableEvent {
  constructor(type, init) {
    super(type, init);
    this.url = init ? init.url || null : null;
    this.clientId = init ? init.clientId || null : null;
    this._handlePending = null;
  }

  handleLaunch(promise) {
    if (this._handlePending !== null)
      throw new InvalidStateError('handleLaunch has already been called');

    // Extend the lifetime of the event until the promise completes.
    // This is not actually allowed on a script-constructed ExtendableEvent.
    //this.waitUntil(promise);

    // Wait until the promise resolves before applying the default.
    this._handlePending = promise;
  }
}

// Listen for a message from simulatenavigate.html.
self.addEventListener('message', async event => {
  if (event.data.tag !== 'polyfill_simulatenavigate')
    return;

  // |url| is relative to Service Worker scope.
  const url = new URL(event.data.url, self.registration.scope).href;
  const target = event.data.target;
  console.log('[Polyfill]: simulatenavigate message: source =', event.source.id,
              ', url =', url, ', target =', target);

  if (target === 'nolaunch') {
    // Like target === 'blank', but do not dispatch the launch event (simulate a
    // user explicitly asking for a new context).
    clients.openWindow(url);
    return;
  }

  // Create and fire a LaunchEvent.
  // If target is self, pass the client ID into the launch event, so it can
  // identify the sending window. If target is blank, this navigation is not
  // tied to any particular context.
  const clientId = target === 'self' ? event.source.id : null;
  const launchEvent = new LaunchEvent('launch', {url, clientId});
  self.dispatchEvent(launchEvent);

  defaultBehavior = () => {
    if (target === 'self')
      event.source.navigate(url);
    else
      clients.openWindow(url);
  }

  if (launchEvent._handlePending === null) {
    // Launch handler did not queue a custom handler. Immediately apply the
    // default behavior.
    defaultBehavior();
  } else {
    launchEvent._handlePending.catch(() => {
      // Promise failed. Apply the default behavior.
      // NOTE: If we do not want to do this (i.e., we don't care whether it
      // succeeds or fails), we can just use preventDefault instead of
      // handleLaunch taking a promise.
      defaultBehavior();
    });
  }
});
