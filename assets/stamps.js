'use strict';
const STAMP_TYPES=[
 ['skull','Tête de mort','<path d="M7 17v4h10v-4c3-2 4-4 4-7A9 9 0 0 0 3 10c0 3 1 5 4 7Z"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><path d="m10 15 2-2 2 2M10 18v3m4-3v3"/>'],
 ['chest','Coffre au trésor','<path d="M3 11V8c0-4 18-4 18 0v3M3 11h18v10H3Z M7 5v6m10-6v6"/><path d="M10 10h4v5h-4z"/>'],
 ['shop','Magasin','<path d="m2 9 3-6h14l3 6-2 3-3-2-3 2-3-2-3 2-3-2-3 2ZM4 12v9h16v-9M10 21v-6h5v6"/>'],
 ['burger','Repas','<path d="M3 10c0-10 18-10 18 0ZM2 14h20M3 18h18c0 5-18 5-18 0Z M7 6h1m7 0h1"/>'],
 ['home','Maison','<path d="m2 11 10-9 10 9M5 9v13h14V9M10 22v-8h5v8"/>'],
 ['cross','Sanctuaire — croix','<path d="M10 2h4v6h7v4h-7v10h-4V12H3V8h7Z"/>'],
 ['moon','Sanctuaire — croissant','<path d="M20 16A10 10 0 0 1 8 2a10 10 0 1 0 12 14Z"/>'],
 ['star','Sanctuaire — étoile','<path d="m12 2 9 16H3ZM12 22 3 6h18Z"/>'],
 ['arrow-up','Flèche nord','<path d="M12 22V2M4 10l8-8 8 8"/>'],
 ['arrow-down','Flèche sud','<path d="M12 2v20M4 14l8 8 8-8"/>'],
 ['arrow-left','Flèche ouest','<path d="M22 12H2m8-8-8 8 8 8"/>'],
 ['arrow-right','Flèche est','<path d="M2 12h20M14 4l8 8-8 8"/>'],
 ['bow','Arc','<path d="M5 2c18 5 18 15 0 20L5 2Zm0 10h17m-4-4 4 4-4 4"/>'],
 ['swords','Épées','<path d="m4 2 17 17m-1-17L3 19M2 2l1 6 4-4ZM22 2l-1 6-4-4ZM15 19l4-4m-14 0 4 4m-8 3 4-4m14 0 4 4"/>'],
 ['shield','Blason','<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6ZM12 3v18M4 11h16"/>'],
 ...Array.from({length:10},(_,n)=>['digit-'+n,'Chiffre '+n,String(n)])
];
function stampSymbol(kind){
 const type=STAMP_TYPES.find(type=>type[0]===kind);if(!type)return '';
 return kind.startsWith('digit-')?`<b>${type[2]}</b>`:`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${type[2]}</svg>`;
}
function stampPalette(){return `<div class="stamp-palette" hidden><button class="stamp-choice active" data-stamp-kind="" title="Déplacer la carte" aria-label="Déplacer la carte" aria-pressed="true">✋</button>${STAMP_TYPES.map(([kind,label])=>`<button class="stamp-choice" data-stamp-kind="${kind}" title="${label}" aria-label="${label}" aria-pressed="false">${stampSymbol(kind)}</button>`).join('')}<button class="secondary stamp-delete" data-stamp-delete disabled>Supprimer le tampon sélectionné</button></div>`;}
