'use strict';
// Page gestures stay separate from the map's own zoom and pan.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, event => event.preventDefault(), {passive: false});
}
document.addEventListener('touchmove', event => {
  if (event.touches.length > 1) event.preventDefault();
}, {passive: false});
function openAdventureMap(row) {
  dialog(esc(row.title), `<p class="hint">Écartez deux doigts pour agrandir la carte. Faites-la glisser pour explorer les environs.</p><div class="map-tools" role="group" aria-label="Zoom de la carte"><button class="secondary" data-map-zoom="out" aria-label="Réduire la carte">−</button><output aria-live="polite" data-map-scale>100 %</output><button class="secondary" data-map-zoom="in" aria-label="Agrandir la carte">+</button><button class="secondary" data-map-zoom="reset">Vue entière</button></div><div class="map-viewer" tabindex="0" aria-label="Carte déplaçable"><img src="${esc(row.image)}" alt="${esc(row.title)}" draggable="false"></div>`);
  const modal = document.querySelector('#modal');
  modal.classList.add('map-dialog');
  document.documentElement.classList.add('map-open');
  modal.addEventListener('close', () => document.documentElement.classList.remove('map-open'), {once: true});
  const viewer = modal.querySelector('.map-viewer'), image = viewer.querySelector('img');
  const points = new Map();
  let scale = 1, fit = 1;
  function zoom(next, x = viewer.clientWidth / 2, y = viewer.clientHeight / 2) {
    next = Math.min(6, Math.max(1, next));
    const ratio = next / scale;
    const left = (viewer.scrollLeft + x) * ratio - x;
    const top = (viewer.scrollTop + y) * ratio - y;
    scale = next;
    image.style.width = `${fit * scale}px`;
    viewer.scrollLeft = left; viewer.scrollTop = top;
    modal.querySelector('[data-map-scale]').textContent = `${Math.round(scale * 100)} %`;
    modal.querySelector('[data-map-zoom="out"]').disabled = scale <= 1;
    modal.querySelector('[data-map-zoom="in"]').disabled = scale >= 6;
  }
  function reset() {
    fit = Math.min(image.naturalWidth || viewer.clientWidth, viewer.clientWidth,
      (image.naturalWidth / image.naturalHeight || 1) * viewer.clientHeight);
    zoom(1); viewer.scrollLeft = 0; viewer.scrollTop = 0;
  }
  image.addEventListener('load', reset);
  if (image.complete && image.naturalWidth) reset();
  window.addEventListener('resize', reset);
  modal.addEventListener('close', () => window.removeEventListener('resize', reset), {once: true});
  modal.querySelectorAll('[data-map-zoom]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.mapZoom === 'reset') reset();
    else zoom(scale * (button.dataset.mapZoom === 'in' ? 1.4 : 1 / 1.4));
  }));
  function gesture() {
    const [a, b] = [...points.values()];
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y)};
  }
  viewer.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    viewer.setPointerCapture(event.pointerId);
    points.set(event.pointerId, {x: event.clientX, y: event.clientY});
    event.preventDefault();
  });
  viewer.addEventListener('pointermove', event => {
    if (!points.has(event.pointerId)) return;
    const old = points.get(event.pointerId), before = points.size === 2 ? gesture() : null;
    points.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (points.size === 1) {
      viewer.scrollLeft -= event.clientX - old.x; viewer.scrollTop -= event.clientY - old.y;
    } else if (points.size === 2 && before.distance > 0) {
      const after = gesture(), bounds = viewer.getBoundingClientRect();
      zoom(scale * after.distance / before.distance, before.x - bounds.left, before.y - bounds.top);
      viewer.scrollLeft -= after.x - before.x; viewer.scrollTop -= after.y - before.y;
    }
    event.preventDefault();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    viewer.addEventListener(type, event => points.delete(event.pointerId));
  }
  viewer.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault(); const bounds = viewer.getBoundingClientRect();
    zoom(scale * Math.exp(-event.deltaY * .01), event.clientX - bounds.left, event.clientY - bounds.top);
  }, {passive: false});
}
