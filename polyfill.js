// To be included in the Service Worker.

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

  // For now, just open a new window at that URL.
  // TODO: Polyfill the 'launch' event.
  if (target === 'self')
    event.source.navigate(url);
  else
    clients.openWindow(url);
});
