/* This work is licensed under the W3C Software and Document License
 * (http://www.w3.org/Consortium/Legal/2015/copyright-software-and-document).
 */

importScripts('polyfill.js')

self.addEventListener('launch', event => {
  console.log('[SW]: launch:', event);

  const kComposeURL = new URL('compose', self.registration.scope).href;
  if (event.url !== kComposeURL)
    return;

  event.handleLaunch((async () => {
    // Get an existing client at the main page URL.
    const allClients = await clients.matchAll();
    let client;
    for (const c of allClients) {
      if (new URL(c.url).pathname === '/') {
        client = c;
        break;
      }
    }

    if (!client) {
      console.log('[SW] Resuming normal navigation to ', event.url);
      // Any throw causes the normal behaviour to resume.
      throw new Error('Resuming normal navigation');
    }

    console.log('[SW] Focusing existing page:', client.id);
    client.focus();
    client.postMessage('compose');
  })());
});
