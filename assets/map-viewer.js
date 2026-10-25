'use strict';
// Page gestures stay separate from the map's own zoom and pan.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, event => event.preventDefault(), {passive: false});
}
document.addEventListener('touchmove', event => {
  if (event.touches.length > 1) event.preventDefault();
}, {passive: false});
function openAdventureMap(row) {
  dialog(esc(row.title), `<div class="map-tools" role="group" aria-label="Affichage de la carte"><button class="secondary" data-map-zoom="out" aria-label="Réduire la carte">−</button><output aria-live="polite" data-map-scale>100 %</output><button class="secondary" data-map-zoom="in" aria-label="Agrandir la carte">+</button><button class="secondary" data-stamp-tools aria-label="Ouvrir les tampons" aria-expanded="false">⚑</button>${mapEditionPicker(row)}</div><p class="map-help">Pincez pour zoomer, glissez pour explorer. ⚑ pour poser un tampon.</p>${stampPalette()}<div class="map-viewer" data-map-id="${esc(row.id||'')}" tabindex="0" aria-label="Carte déplaçable"><div class="map-canvas"><img src="${esc(mapImage(row))}" alt="${esc(row.title)}" draggable="false"><div class="map-stamps"></div></div></div>`);
  const modal = document.querySelector('#modal');
  modal.classList.add('map-dialog');
  const close=modal.querySelector('[data-close]');close.className='map-close';close.innerHTML='<span aria-hidden="true">×</span>';
  document.documentElement.classList.add('map-open');
  modal.addEventListener('close', () => document.documentElement.classList.remove('map-open'), {once: true});
  const viewer = modal.querySelector('.map-viewer'), image = viewer.querySelector('img');
  const canvas=modal.querySelector('.map-canvas'),layer=modal.querySelector('.map-stamps');
  const points = new Map();
  let selectedKind='',selectedStamp=null,dragged=null,tap=null,gestureUsed=false;
  let scale = 1, fit = 1;
  function zoom(next, x = viewer.clientWidth / 2, y = viewer.clientHeight / 2) {
    next = Math.min(6, Math.max(1, next));
    const ratio = next / scale;
    const left = (viewer.scrollLeft + x) * ratio - x;
    const top = (viewer.scrollTop + y) * ratio - y;
    scale = next;
    canvas.style.width = `${fit * scale}px`;image.style.width='100%';
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
    zoom(scale * (button.dataset.mapZoom === 'in' ? 1.4 : 1 / 1.4));
  }));
  function drawStamps(){
    layer.replaceChildren();
    for(const stamp of state.mapStamps.filter(stamp=>stamp.mapId===row.id)){
      const button=document.createElement('button');button.type='button';button.className='map-stamp'+(stamp.id===selectedStamp?' selected':'');button.dataset.stampId=stamp.id;
      button.innerHTML=stampSymbol(stamp.kind);button.setAttribute('aria-label',(STAMP_TYPES.find(type=>type[0]===stamp.kind)?.[1]||'Tampon')+' — déplacer ou supprimer');
      button.style.left=stamp.x*100+'%';button.style.top=stamp.y*100+'%';layer.append(button);
    }
    modal.querySelector('[data-stamp-delete]').disabled=!selectedStamp;
  }
  function point(event){
    const bounds=image.getBoundingClientRect();return {x:(event.clientX-bounds.left)/bounds.width,y:(event.clientY-bounds.top)/bounds.height};
  }
  function selectStamp(id){selectedStamp=id;drawStamps();}
  const palette=modal.querySelector('.stamp-palette');
  modal.querySelector('[data-stamp-tools]').addEventListener('click',event=>{palette.hidden=!palette.hidden;event.currentTarget.setAttribute('aria-expanded',String(!palette.hidden));});
  palette.querySelectorAll('[data-stamp-kind]').forEach(button=>button.addEventListener('click',()=>{
    selectedKind=button.dataset.stampKind;selectedStamp=null;drawStamps();
    palette.querySelectorAll('[data-stamp-kind]').forEach(other=>{const selected=other.dataset.stampKind===selectedKind;other.classList.toggle('active',selected);other.setAttribute('aria-pressed',String(selected));});
    modal.querySelector('.map-help').textContent=selectedKind?'Touchez la carte pour poser le tampon. Glissez un tampon pour le déplacer.':'Pincez pour zoomer, glissez pour explorer.';
  }));
  modal.querySelector('[data-stamp-delete]').addEventListener('click',()=>{state.mapStamps=state.mapStamps.filter(stamp=>stamp.id!==selectedStamp);selectedStamp=null;drawStamps();changed();});
  drawStamps();
  function gesture() {
    const [a, b] = [...points.values()];
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y)};
  }
  viewer.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    viewer.setPointerCapture(event.pointerId);
    if(points.size===0){
      gestureUsed=false;const hit=event.target.closest('[data-stamp-id]');tap={x:event.clientX,y:event.clientY,hit:!!hit};
      selectedStamp=hit?.dataset.stampId||null;
      dragged=selectedStamp?{id:selectedStamp,pointer:event.pointerId,moved:false}:null;
      if(selectedStamp){palette.hidden=false;modal.querySelector('[data-stamp-tools]').setAttribute('aria-expanded','true');}
      drawStamps();
    }
    points.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if(points.size>1){if(dragged?.moved)changed();gestureUsed=true;dragged=null;tap=null;}
    event.preventDefault();
  });
  viewer.addEventListener('pointermove', event => {
    if (!points.has(event.pointerId)) return;
    const old = points.get(event.pointerId), before = points.size === 2 ? gesture() : null;
    points.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if(points.size===1&&dragged){
      const stamp=state.mapStamps.find(stamp=>stamp.id===dragged.id),position=point(event);
      if(stamp){stamp.x=Math.min(1,Math.max(0,position.x));stamp.y=Math.min(1,Math.max(0,position.y));dragged.moved=true;drawStamps();}
    } else if (points.size === 1) {
      viewer.scrollLeft -= event.clientX - old.x; viewer.scrollTop -= event.clientY - old.y;
    } else if (points.size === 2 && before.distance > 0) {
      const after = gesture(), bounds = viewer.getBoundingClientRect();
      zoom(scale * after.distance / before.distance, before.x - bounds.left, before.y - bounds.top);
      viewer.scrollLeft -= after.x - before.x; viewer.scrollTop -= after.y - before.y;
    }
    event.preventDefault();
  });
  function endPointer(event){
    if(!points.has(event.pointerId))return;
    if(dragged?.pointer===event.pointerId){if(dragged.moved)changed();dragged=null;}
    else if(event.type==='pointerup'&&points.size===1&&!gestureUsed&&tap&&!tap.hit&&selectedKind&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<8){
      const position=point(event);
      if(position.x>=0&&position.x<=1&&position.y>=0&&position.y<=1){const stamp={id:uid(),mapId:row.id,kind:selectedKind,...position};state.mapStamps.push(stamp);selectedStamp=stamp.id;drawStamps();changed();}
    }
    points.delete(event.pointerId);if(!points.size)tap=null;
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewer.addEventListener(type,endPointer);
  viewer.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault(); const bounds = viewer.getBoundingClientRect();
    zoom(scale * Math.exp(-event.deltaY * .01), event.clientX - bounds.left, event.clientY - bounds.top);
  }, {passive: false});
}
