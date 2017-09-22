/* This work is licensed under the W3C Software and Document License
 * (http://www.w3.org/Consortium/Legal/2015/copyright-software-and-document).
 */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');

  navigator.serviceWorker.addEventListener('message', event => {
    const logsDiv = document.querySelector('#logs');
    const p = document.createElement('p');
    p.appendChild(document.createTextNode('Got message: ' + event.data));
    logsDiv.appendChild(p);
  });
}
