function getTarget() {
  if (document.querySelector('#targetBlank').checked)
    return 'blank';

  if (document.querySelector('#targetNoLaunch').checked)
    return 'nolaunch';

  return 'self';
}

function go() {
  const url = document.querySelector('#url').value;
  const target = getTarget();

  navigator.serviceWorker.controller.postMessage({
    tag: 'polyfill_simulatenavigate', url, target
  });
}

window.addEventListener('load', () => {
  if (!navigator.serviceWorker) {
    console.error('Need a browser that supports Service Workers.');
    return;
  }

  document.querySelector('form').addEventListener(
      'submit', e => e.preventDefault());
  document.querySelector('#go').addEventListener('click', go);
});
