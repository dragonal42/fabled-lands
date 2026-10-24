'use strict';
// Relative URLs preserve installations in an O2Switch subdirectory.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
      .catch(error => console.warn('Installation du mode application indisponible.', error));
  });
}
