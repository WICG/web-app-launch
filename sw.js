importScripts('polyfill.js')

self.addEventListener('launch', event => {
  console.log('[SW]: launch:', event);

  const kComposeURL = new URL('compose', self.registration.scope).href;
  if (event.url !== kComposeURL)
    return;

  event.handleLaunch((async () => {
    // Get an existing client.
    const client = (await clients.matchAll())[0];

    if (client) {
      console.log('[SW] Focusing existing page:', client.id);
      client.focus();
      client.postMessage('compose');
    } else {
      console.log('[SW] Opening new page at', event.url);
      clients.openWindow(event.url);
    }
  })());
});
